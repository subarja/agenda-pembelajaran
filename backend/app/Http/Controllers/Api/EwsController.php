<?php

namespace App\Http\Controllers\Api;

use App\Enums\EwsLevel;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Traits\HandlesPdfPreview;
use Barryvdh\DomPDF\Facade\Pdf;
use App\Models\AcademicYear;
use App\Models\AgendaStudentScore;
use App\Models\CharacterInput;
use App\Models\EwsStatus;
use App\Models\Note;
use App\Models\PrintSetting;
use App\Models\Recommendation;
use App\Models\Schedule;
use App\Models\Student;
use App\Support\ClassAccess;
use App\Models\StudentAttendance;
use App\Models\Teacher;
use App\Traits\BuildsXlsxReports;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use OpenSpout\Common\Entity\Cell\NumericCell;
use OpenSpout\Common\Entity\Cell\StringCell;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Writer;

class EwsController extends Controller
{
    use HandlesPdfPreview;
    use BuildsXlsxReports;

    private const THRESHOLD_KEHADIRAN = 80.0;
    private const THRESHOLD_KARAKTER  = 0;
    private const THRESHOLD_CATATAN   = 3;
    private const THRESHOLD_NILAI     = 70.0;

    // GET /ews
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $ay   = \App\Support\TahunAjaran::current();

        if (! $ay) {
            return response()->json(['data' => [], 'meta' => ['total' => 0]]);
        }

        $query = Student::with(['user:id,nama', 'schoolClass'])
            ->whereHas('schoolClass', fn ($q) => $q->where('academic_year_id', $ay->id));

        // Scoping EWS berbasis KAPABILITAS (bukan role literal). Wali kelas & BK di app
        // ini adalah akun role=guru — kapabilitas dari SchoolClass.wali_kelas_id / Teacher.is_bk.
        // Enum masih punya role literal `wali_kelas`/`bk` (akun lama belum termigrasi); dulu
        // `UserRole::BK` TIDAK ada di match ini sehingga jatuh ke `default => null` dan guru BK
        // MELIHAT SELURUH SISWA (bocor). Sekarang: hanya admin & wakasek yang lihat semua;
        // selain siswa/orang tua, semua staf dibatasi ClassAccess::pastoralClassIds().
        match ($user->role) {
            UserRole::Siswa     => $query->whereHas('user', fn ($q) => $q->where('id', $user->id)),
            UserRole::OrangTua  => $user->linked_student_id
                ? $query->where('id', $user->linked_student_id)
                : $query->whereRaw('1=0'),
            default             => (function () use ($query, $user, $request) {
                // DAFTAR EWS pakai ewsListClassIdsForUser dgn `scope`:
                //  - scope=wali → HANYA kelas perwaliannya (menu Wali Kelas)
                //  - scope=bk   → HANYA kelas yang ia ampu sbg BK (menu Guru BK)
                //  - tanpa scope → wali dulu lalu BK (kompat dashboard/prefetch)
                // Beda dari ClassAccess::pastoralClassIds (union) yg dipakai otorisasi buka detail.
                $allowed = $this->ewsListClassIdsForUser($user, $request->query('scope'));
                if ($allowed === null) return;                 // admin/wakasek: semua siswa
                $allowed->isEmpty()
                    ? $query->whereRaw('1=0')                   // guru biasa (bukan wali/BK): tak ada
                    : $query->whereIn('class_id', $allowed->all());
            })(),
        };

        if ($request->filled('class_id')) {
            $query->whereHas('schoolClass', fn ($q) => $q->where('uuid', $request->class_id));
        }

        $students   = $query->get();
        $studentIds = $students->pluck('id');

        if ($studentIds->isEmpty()) {
            return response()->json(['data' => [], 'meta' => ['total' => 0, 'summary' => ['hijau' => 0, 'kuning' => 0, 'oranye' => 0, 'merah' => 0]]]);
        }

        // ── 4 batch query menggantikan N×8 individual query ────────────────
        $attData   = $this->batchAttendance($studentIds);
        $charData  = $this->batchCharacter($studentIds);
        $noteData  = $this->batchNotes($studentIds);
        $nilaiData = $this->batchNilai($studentIds);
        // GK7: siswa mana yang sedang punya penanganan wali-kelas aktif (belum
        // selesai/diabaikan, belum dieskalasi ke BK) — dipakai badge dashboard.
        $sedangDitangani = Recommendation::whereIn('student_id', $studentIds)
            ->where('status', 'proses')->where('bk_status', 'none')
            ->pluck('student_id')->unique()->flip();
        // ───────────────────────────────────────────────────────────────────

        $now        = now()->toDateTimeString();
        $upsertRows = [];

        $results = $students->map(function ($s) use ($ay, $attData, $charData, $noteData, $nilaiData, $sedangDitangani, $now, &$upsertRows) {
            $kehadiran = $this->calcKehadiranBatch($s->id, $attData);
            $karakter  = $this->calcKarakterBatch($s->id, $charData);
            $catatan   = $this->calcCatatanBatch($s->id, $noteData);
            $nilai     = $this->calcNilaiBatch($s->id, $nilaiData);
            $level     = $this->determineLevel($kehadiran, $karakter, $catatan, $nilai);

            $upsertRows[] = [
                'student_id'         => $s->id,
                'academic_year_id'   => $ay->id,
                'level'              => $level,
                'kehadiran_score'    => round($kehadiran['score'], 2),
                'karakter_score'     => $karakter['score'],
                'catatan_count'      => $catatan['count'],
                'nilai_score'        => $nilai['score'] !== null ? round($nilai['score'], 2) : null,
                'last_calculated_at' => $now,
                'created_at'         => $now,
                'updated_at'         => $now,
            ];

            return [
                'student_id'      => $s->uuid,
                'nama'            => $s->user->nama,
                'nis'             => $s->nis,
                'kelas'           => $s->schoolClass
                    ? $s->schoolClass->label()
                    : null,
                'foto_url'        => $s->foto ? \Illuminate\Support\Facades\Storage::disk('public')->url($s->foto) : null,
                'level'           => $level,
                'kehadiran_score' => round($kehadiran['score'], 1),
                'karakter_score'  => $karakter['score'],
                'catatan_count'   => $catatan['count'],
                'nilai_score'     => $nilai['score'] !== null ? round($nilai['score'], 1) : null,
                'warning_count'   => $kehadiran['warning'] + $karakter['warning'] + $catatan['warning'] + $nilai['warning'],
                'sedang_ditangani_wali_kelas' => $sedangDitangani->has($s->id),
            ];
        });

        // 1 upsert menggantikan N updateOrCreate
        EwsStatus::upsert(
            $upsertRows,
            ['student_id', 'academic_year_id'],
            ['level', 'kehadiran_score', 'karakter_score', 'catatan_count', 'nilai_score', 'last_calculated_at', 'updated_at']
        );

        $summary = [
            'hijau'  => $results->where('level', 'hijau')->count(),
            'kuning' => $results->where('level', 'kuning')->count(),
            'oranye' => $results->where('level', 'oranye')->count(),
            'merah'  => $results->where('level', 'merah')->count(),
        ];

        if ($request->filled('level')) {
            $results = $results->filter(fn ($r) => $r['level'] === $request->level)->values();
        }

        $levelOrder = ['merah' => 0, 'oranye' => 1, 'kuning' => 2, 'hijau' => 3];
        $results    = $results->sortBy([
            fn ($a, $b) => ($levelOrder[$a['level']] ?? 9) <=> ($levelOrder[$b['level']] ?? 9),
            fn ($a, $b) => $b['warning_count'] <=> $a['warning_count'],
            fn ($a, $b) => $a['kehadiran_score'] <=> $b['kehadiran_score'],
        ])->values();

        return response()->json([
            'data' => $results,
            'meta' => ['total' => $results->count(), 'summary' => $summary],
        ]);
    }

    // GET /ews/{studentUuid}
    public function show(Request $request, string $uuid): JsonResponse
    {
        $student = Student::where('uuid', $uuid)
            ->with(['user:id,nama', 'schoolClass'])
            ->firstOrFail();

        $user = $request->user();

        if ($resp = $this->authorizeEwsStudentAccess($user, $student)) {
            return $resp;
        }

        $ay = \App\Support\TahunAjaran::current();

        $kehadiran = $this->calcKehadiran($student->id);
        $karakter  = $this->calcKarakter($student->id);
        $catatan   = $this->calcCatatan($student->id);
        $nilai     = $this->calcNilai($student->id);
        $level     = $this->determineLevel($kehadiran, $karakter, $catatan, $nilai);

        if ($ay) {
            EwsStatus::updateOrCreate(
                ['student_id' => $student->id, 'academic_year_id' => $ay->id],
                [
                    'level'              => EwsLevel::from($level),
                    'kehadiran_score'    => $kehadiran['score'],
                    'karakter_score'     => $karakter['score'],
                    'catatan_count'      => $catatan['count'],
                    'nilai_score'        => $nilai['score'],
                    'last_calculated_at' => now(),
                ],
            );
        }

        $allKarakter = CharacterInput::tahunAjaran()
            ->where('student_id', $student->id)
            ->with(['subitem.category', 'teacher.user'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($i) => [
                'kategori' => $i->subitem->category->nama,
                'subitem'  => $i->subitem->deskripsi,
                'poin'     => $i->sign->value === 'positif' ? abs($i->subitem->bobot) : -abs($i->subitem->bobot),
                'guru'     => $i->teacher->user->nama,
                'tanggal'  => $i->created_at->format('Y-m-d H:i'),
            ]);

        $absences = StudentAttendance::tahunAjaran()
            ->where('student_id', $student->id)
            ->where('status', '!=', 'hadir')
            ->with(['agenda.schedule.subject', 'agenda.schedule.schoolClass'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($a) => [
                'tanggal' => $a->agenda->tanggal->format('Y-m-d'),
                'status'  => $a->status->value,
                'mapel'   => $a->agenda->schedule->subject->nama ?? '—',
                'kelas'   => $a->agenda->schedule->schoolClass
                    ? $a->agenda->schedule->schoolClass->label()
                    : '—',
            ]);

        $allCatatan = Note::where('target_type', Student::class)
            ->where('target_id', $student->id)
            ->with('createdBy:id,nama')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($n) => [
                'tanggal'       => $n->created_at->format('Y-m-d'),
                'kategori'      => $n->kategori->value,
                'isi'           => $n->isi,
                'tindak_lanjut' => $n->tindak_lanjut,
                'dicatat_oleh'  => $n->createdBy?->nama ?? '—',
            ]);

        $allNilai = AgendaStudentScore::where('student_id', $student->id)
            ->with(['agenda.schedule.subject'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($n) => [
                'tanggal' => $n->agenda->tanggal->format('Y-m-d'),
                'mapel'   => $n->agenda->schedule->subject->nama ?? '—',
                'nilai'   => $n->nilai,
            ]);

        // Viewer BK/admin menentukan sesi BK mana yang boleh dilihat (GK10) — sesi
        // wali-kelas selalu terlihat semua pihak yang boleh buka halaman ini, sesi BK
        // (jenis=bk) HANYA terlihat oleh BK yang menangani kasus itu + admin/wakasek,
        // KECUALI sesi resume (is_resume) yang memang sengaja diteruskan ke wali kelas
        // begitu BK menandai selesai (GK11).
        $viewerTeacher = $user->teacher;
        $viewerIsAdmin = in_array($user->role->value, ['admin', 'wakasek'], true);

        // Guru BK boleh menerima pengajuan konseling hanya jika ia benar-benar mengajar
        // BK di kelas siswa ini (routing berbasis jadwal, sama seperti GK8/GK9).
        $viewerIsRelevantBk = $viewerTeacher?->is_bk && Schedule::where('teacher_id', $viewerTeacher->id)
            ->where('class_id', $student->class_id)->where('aktif', true)->exists();

        // Riwayat penanganan sengaja TIDAK difilter TA: kasus yang belum selesai memang
        // berlanjut lintas semester. Penanda carry_over di bawah yang memberi tahu UI
        // bahwa sebuah kasus berasal dari semester sebelumnya.
        $activeAyId  = \App\Support\TahunAjaran::id();
        $rekomendasi = Recommendation::where('student_id', $student->id)
            ->with(['threshold', 'suggestedHandlers', 'handlingSessions.handler', 'verifiedBy', 'bkTeacher.user', 'academicYear'])
            ->orderByRaw("CASE status WHEN 'pending' THEN 0 WHEN 'proses' THEN 1 WHEN 'menunggu_verifikasi' THEN 2 ELSE 3 END")
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($r) use ($viewerTeacher, $viewerIsAdmin, $viewerIsRelevantBk, $activeAyId) {
                $waliKelasSessionCount = $r->handlingSessions
                    ->filter(fn ($s) => $s->jenis === \App\Enums\HandlingSessionJenis::WaliKelas)
                    ->count();

                $visibleSessions = $r->handlingSessions->filter(function ($s) use ($viewerIsAdmin, $viewerTeacher, $r) {
                    if ($viewerIsAdmin) return true;
                    if ($s->jenis === \App\Enums\HandlingSessionJenis::WaliKelas) return true;
                    // Sesi BK: penangani (bk_teacher) selalu lihat catatannya sendiri;
                    // pihak lain (wali kelas) HANYA bila dibagikan eksplisit (opt-in) atau
                    // ringkasan penutup (is_resume, selalu dibagikan).
                    $isBkHandler = $viewerTeacher && $r->bk_teacher_id === $viewerTeacher->id;
                    if ($isBkHandler) return true;
                    return $s->is_resume || $s->shared_with_wali_kelas;
                })->values();

                return [
                    'id'                       => $r->uuid,
                    'rekomendasi'              => $r->threshold?->rekomendasi ?? $r->alasan_manual ?? 'Kasus manual (tanpa ambang otomatis)',
                    'sifat'                    => $r->threshold?->sifat->value ?? 'manual',
                    'akumulasi'                => $r->akumulasi_saat_trigger,
                    'status'                   => $r->status->value,
                    // Kasus bawaan semester sebelumnya — UI menandainya dengan label TA asal.
                    'carry_over'               => $r->academic_year_id !== null && $activeAyId !== null && $r->academic_year_id !== $activeAyId,
                    'tahun_ajaran_label'       => $r->academicYear ? "{$r->academicYear->tahun} " . ucfirst($r->academicYear->semester->value) : null,
                    'catatan_admin'            => $r->catatan_admin,
                    'dibuat_pada'              => $r->created_at->format('Y-m-d'),
                    'ditangani_pada'           => $r->ditangani_pada?->format('Y-m-d H:i'),
                    'verified_by'              => $r->verifiedBy?->nama,
                    'verified_at'              => $r->verified_at?->format('Y-m-d'),
                    // GK7-GK11: status eskalasi BK
                    'bk_status'                => $r->bk_status->value,
                    'bk_teacher_nama'          => $r->bkTeacher?->user?->nama,
                    'is_my_bk_case'            => $viewerTeacher && $r->bk_teacher_id === $viewerTeacher->id,
                    'bisa_terima_konseling'    => (bool) ($viewerIsRelevantBk && $r->bk_status === \App\Enums\BkStatus::Diajukan),
                    'diajukan_konseling_pada'  => $r->diajukan_konseling_pada?->format('Y-m-d H:i'),
                    'diterima_bk_pada'         => $r->diterima_bk_pada?->format('Y-m-d H:i'),
                    'bk_selesai_pada'          => $r->bk_selesai_pada?->format('Y-m-d H:i'),
                    'resume_bk'                => $r->bk_status->value === 'selesai' ? $r->resume_bk : null,
                    'wali_kelas_session_count' => $waliKelasSessionCount,
                    'bisa_ajukan_konseling'    => $r->bk_status->value === 'none' && $waliKelasSessionCount >= 3,
                    'input_wali_kelas_terkunci'=> in_array($r->bk_status->value, ['diterima', 'selesai'], true),
                    'suggested_handlers'       => $r->suggestedHandlers->map(fn ($u) => [
                        'id'   => $u->uuid,
                        'nama' => $u->nama,
                        'role' => $u->role->value,
                    ]),
                    'handling_sessions'        => $visibleSessions->map(fn ($s) => [
                        'id'                     => $s->uuid,
                        'jenis'                  => $s->jenis->value,
                        'judul'                  => $s->judul,
                        'is_resume'              => $s->is_resume,
                        'shared_with_wali_kelas' => $s->shared_with_wali_kelas,
                        // Toggle berbagi hanya utk BK penangani, sesi BK, bukan resume.
                        'can_toggle_share'       => $viewerTeacher && $r->bk_teacher_id === $viewerTeacher->id
                                                    && $s->jenis === \App\Enums\HandlingSessionJenis::Bk && ! $s->is_resume,
                        'tanggal'                => $s->tanggal->format('Y-m-d'),
                        'catatan'                => $s->catatan,
                        'link_dokumen'           => $s->link_dokumen,
                        'link_foto'              => $s->link_foto,
                        'links'                  => $s->links ?? [],
                        'handled_by'             => $s->handler->nama,
                        'created_at'             => $s->created_at->format('Y-m-d H:i'),
                    ])->values(),
                ];
            });

        // Guru BK pengampu kelas siswa — dipakai FE utk modal konfirmasi "Ajukan Konseling"
        // (tampilkan nama + foto BK tujuan). Bisa >1 bila kelas diampu beberapa guru BK.
        $bkPengampu = collect();
        if ($student->schoolClass) {
            $bkTeacherIds = Schedule::where('class_id', $student->schoolClass->id)
                ->where('aktif', true)->pluck('teacher_id')->unique();
            $bkPengampu = Teacher::whereIn('id', $bkTeacherIds)->where('is_bk', true)->with('user')->get()
                ->map(fn ($t) => [
                    'nama'     => $t->user?->nama,
                    'foto_url' => $t->user?->foto ? \Illuminate\Support\Facades\Storage::disk('public')->url($t->user->foto) : null,
                ])->values();
        }

        return response()->json([
            'data' => [
                'student' => [
                    'id'    => $student->uuid,
                    'nama'  => $student->user->nama,
                    'nis'   => $student->nis,
                    'kelas' => $student->schoolClass
                        ? $student->schoolClass->label()
                        : null,
                    'foto_url' => $student->foto ? \Illuminate\Support\Facades\Storage::disk('public')->url($student->foto) : null,
                    'bk_pengampu' => $bkPengampu,
                ],
                'level'            => $level,
                'dimensions'       => [
                    'kehadiran' => $kehadiran,
                    'karakter'  => $karakter,
                    'catatan'   => $catatan,
                    'nilai'     => $nilai,
                ],
                'recent_karakter'  => $allKarakter->take(10),
                'detail_kehadiran' => $absences,
                'detail_karakter'  => $allKarakter,
                'detail_catatan'   => $allCatatan,
                'detail_nilai'     => $allNilai,
                'rekomendasi'      => $rekomendasi,
            ],
        ]);
    }

    // GET /ews/{uuid}/pdf?dim=kehadiran|karakter|catatan|nilai
    public function dimensionPdf(Request $request, string $uuid)
    {
        $dim = $request->query('dim', 'kehadiran');
        abort_unless(in_array($dim, ['kehadiran', 'karakter', 'catatan', 'nilai']), 404);

        $student = Student::where('uuid', $uuid)
            ->with(['user:id,nama', 'schoolClass'])
            ->firstOrFail();

        // GK3: dulu TIDAK ADA otorisasi sama sekali di sini — guru manapun bisa cetak
        // PDF dimensi EWS siswa manapun via URL langsung. Sama seperti show().
        if ($this->authorizeEwsStudentAccess($request->user(), $student) !== null) {
            abort(403, 'Anda tidak memiliki akses ke EWS siswa ini.');
        }

        $generated = now('Asia/Jakarta')->format('d M Y H:i');
        $namaFile  = "EWS_{$dim}_{$student->user->nama}";
        $kelas     = $student->schoolClass
            ? $student->schoolClass->label()
            : '—';
        $printSettings = PrintSetting::instance($request->user()->id);
        $paperDims     = $printSettings->paperDimensionsPt();

        if ($dim === 'kehadiran') {
            $kehadiran = $this->calcKehadiran($student->id);
            $rows = StudentAttendance::tahunAjaran()
                ->where('student_id', $student->id)
                ->where('status', '!=', 'hadir')
                ->with(['agenda.schedule.subject', 'agenda.schedule.schoolClass'])
                ->orderByDesc('created_at')
                ->get()
                ->map(fn ($a) => [
                    'tanggal' => $a->agenda->tanggal->format('d/m/Y'),
                    'status'  => strtoupper($a->status->value),
                    'mapel'   => $a->agenda->schedule->subject->nama ?? '—',
                ]);
            $pdf = Pdf::loadView('reports.dim_kehadiran', compact('student', 'kelas', 'kehadiran', 'rows', 'generated', 'printSettings'))
                ->setPaper($paperDims, 'portrait');
            return $this->pdfResponse($pdf, "{$namaFile}.pdf", $request);
        }

        if ($dim === 'karakter') {
            $karakter = $this->calcKarakter($student->id);
            $rows = CharacterInput::tahunAjaran()
                ->where('student_id', $student->id)
                ->with(['subitem.category', 'teacher.user'])
                ->orderByDesc('created_at')
                ->get()
                ->map(fn ($i) => [
                    'tanggal'  => $i->created_at->format('d/m/Y'),
                    'kategori' => $i->subitem->category->nama,
                    'subitem'  => $i->subitem->deskripsi,
                    'poin'     => $i->sign->value === 'positif' ? abs($i->subitem->bobot) : -abs($i->subitem->bobot),
                    'guru'     => $i->teacher->user->nama,
                ]);
            $pdf = Pdf::loadView('reports.dim_karakter', compact('student', 'kelas', 'karakter', 'rows', 'generated', 'printSettings'))
                ->setPaper($paperDims, 'portrait');
            return $this->pdfResponse($pdf, "{$namaFile}.pdf", $request);
        }

        if ($dim === 'catatan') {
            $catatanStat = $this->calcCatatan($student->id);
            $rows = Note::where('target_type', Student::class)
                ->where('target_id', $student->id)
                ->with('createdBy:id,nama')
                ->orderByDesc('created_at')
                ->get()
                ->map(fn ($n) => [
                    'tanggal'       => $n->created_at->format('d/m/Y'),
                    'kategori'      => $n->kategori->value,
                    'isi'           => $n->isi,
                    'tindak_lanjut' => $n->tindak_lanjut,
                    'oleh'          => $n->createdBy?->nama ?? '—',
                ]);
            $pdf = Pdf::loadView('reports.dim_catatan', compact('student', 'kelas', 'catatanStat', 'rows', 'generated', 'printSettings'))
                ->setPaper($paperDims, 'portrait');
            return $this->pdfResponse($pdf, "{$namaFile}.pdf", $request);
        }

        $nilaiStat = $this->calcNilai($student->id);
        $rows = AgendaStudentScore::where('student_id', $student->id)
            ->with(['agenda.schedule.subject'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($n) => [
                'tanggal' => $n->agenda->tanggal->format('d/m/Y'),
                'mapel'   => $n->agenda->schedule->subject->nama ?? '—',
                'nilai'   => $n->nilai,
            ]);
        $pdf = Pdf::loadView('reports.dim_nilai', compact('student', 'kelas', 'nilaiStat', 'rows', 'generated', 'printSettings'))
            ->setPaper($paperDims, 'portrait');
        return $this->pdfResponse($pdf, "{$namaFile}.pdf", $request);
    }

    /**
     * GET /ews/{uuid}/profile-pdf — Profil Siswa satu halaman (FR-106): data pribadi +
     * ringkasan EWS 4 dimensi + riwayat poin karakter terakhir + rekomendasi aktif.
     * Bekal wali kelas & BK untuk konseling dan pemanggilan orang tua.
     */
    public function profilePdf(Request $request, string $uuid)
    {
        $student = Student::where('uuid', $uuid)
            ->with(['user:id,nama', 'schoolClass.waliKelas'])
            ->firstOrFail();

        if ($this->authorizeEwsStudentAccess($request->user(), $student) !== null) {
            abort(403, 'Anda tidak memiliki akses ke profil siswa ini.');
        }

        $kehadiran = $this->calcKehadiran($student->id);
        $karakter  = $this->calcKarakter($student->id);
        $catatan   = $this->calcCatatan($student->id);
        $nilai     = $this->calcNilai($student->id);
        $level     = $this->determineLevel($kehadiran, $karakter, $catatan, $nilai);

        $riwayatKarakter = CharacterInput::tahunAjaran()
            ->where('student_id', $student->id)
            ->with(['subitem.category', 'teacher.user'])
            ->orderByDesc('created_at')
            ->limit(12)
            ->get()
            ->map(fn ($i) => [
                'tanggal' => $i->created_at->format('d/m/Y'),
                'item'    => "{$i->subitem->category->nama} — {$i->subitem->deskripsi}",
                'poin'    => $i->sign->value === 'positif' ? abs($i->subitem->bobot) : -abs($i->subitem->bobot),
                'guru'    => $i->teacher->user->nama,
            ]);

        $rekomendasi = Recommendation::where('student_id', $student->id)
            ->whereIn('status', ['pending', 'proses', 'menunggu_verifikasi'])
            ->with('threshold')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($r) => [
                'tanggal'     => $r->created_at->format('d/m/Y'),
                'rekomendasi' => $r->threshold?->rekomendasi ?? $r->alasan_manual ?? '—',
                'status'      => ucfirst(str_replace('_', ' ', $r->status->value)),
            ]);

        $ay        = \App\Support\TahunAjaran::current();
        $ayLabel   = $ay ? "TP {$ay->tahun} — Semester ".ucfirst($ay->semester->value) : '—';
        $generated = now('Asia/Jakarta')->format('d M Y H:i');
        $kelas     = $student->schoolClass
            ? $student->schoolClass->label()
            : '—';
        $printSettings = PrintSetting::instance($request->user()->id);

        $pdf = Pdf::loadView('reports.profil_siswa', compact(
            'student', 'kelas', 'ayLabel', 'level',
            'kehadiran', 'karakter', 'catatan', 'nilai',
            'riwayatKarakter', 'rekomendasi', 'generated', 'printSettings',
        ))->setPaper($printSettings->paperDimensionsPt(), 'portrait');

        return $this->pdfResponse($pdf, "Profil_Siswa_{$student->user->nama}.pdf", $request);
    }

    // GET /ews/export?format=excel|pdf&level=...
    public function export(Request $request)
    {
        // Re-use index logic to get the data
        $indexResponse = $this->index($request);
        $payload = $indexResponse->getData(true);
        $rows    = $payload['data'] ?? [];

        // Laporan (PDF/Excel) diurutkan per kelas dulu, baru level (merah→hijau di dalam
        // kelas), baru nama abjad — beda dengan index() yang diurutkan prioritas risiko
        // (dipakai dashboard EWS live), supaya laporan cetak enak dibaca per rombel.
        $levelOrder = ['merah' => 0, 'oranye' => 1, 'kuning' => 2, 'hijau' => 3];
        usort($rows, fn ($a, $b) => [$a['kelas'] ?? '', $levelOrder[$a['level']] ?? 9, mb_strtolower($a['nama'])]
            <=> [$b['kelas'] ?? '', $levelOrder[$b['level']] ?? 9, mb_strtolower($b['nama'])]);

        if ($request->query('format') === 'pdf') {
            $ay = \App\Support\TahunAjaran::current();
            // Group by jurusan
            $byJurusan = [];
            foreach ($rows as $r) {
                $kelas   = $r['kelas'] ?? 'Tanpa Kelas';
                $jurusan = preg_match('/X{0,3}(?:I{1,3}|IV|VI{0,3}|IX|V?I{0,3})?\s+(.+?)\s+-/', $kelas, $m) ? $m[1] : ($kelas !== 'Tanpa Kelas' ? explode(' - ', $kelas)[0] : 'Tanpa Kelas');
                $byJurusan[$jurusan][] = $r;
            }
            $ayLabel = $ay ? "Semester {$ay->semester->value} — TP {$ay->tahun}" : '';
            $printSettings = PrintSetting::instance($request->user()->id);
            $legend = $this->ewsSiswaLegend();
            $pdf = Pdf::loadView('reports.ews_siswa', compact('rows', 'byJurusan', 'ayLabel', 'printSettings', 'legend'))
                ->setPaper($printSettings->paperDimensionsPt(), 'landscape');
            return $this->pdfResponse($pdf, 'EWS_Siswa.pdf', $request);
        }

        // Excel export
        $tmpFile = tempnam(sys_get_temp_dir(), 'ews_siswa_') . '.xlsx';
        $writer  = new Writer();
        $writer->openToFile($tmpFile);

        $this->xlsxSetColumnWidths($writer, [1 => 5, 2 => 26, 3 => 12, 4 => 16, 5 => 12, 6 => 14, 7 => 15, 8 => 12, 9 => 15]);

        $writer->addRow(Row::fromValuesWithStyle(['Daftar EWS Siswa'], $this->xlsxTitleStyle()));
        $writer->addRow(Row::fromValues(['']));
        $writer->addRow(Row::fromValuesWithStyle(
            ['No', 'Nama Siswa', 'NIS', 'Kelas', 'Level EWS', 'Kehadiran (%)', 'Karakter (Poin)', 'Catatan (x)', 'Nilai Rata-rata'],
            $this->xlsxHeaderStyle()
        ));

        $cellCenter = $this->xlsxCellCenterStyle();
        $cellText   = $this->xlsxCellStyle();
        foreach ($rows as $i => $r) {
            $writer->addRow(new Row([
                new NumericCell($i + 1, $cellCenter),
                new StringCell($r['nama'], $cellText),
                new StringCell($r['nis'], $cellCenter),
                new StringCell($r['kelas'] ?? '—', $cellCenter),
                new StringCell(strtoupper($r['level']), $cellCenter),
                new NumericCell($r['kehadiran_score'], $cellCenter),
                new NumericCell($r['karakter_score'], $cellCenter),
                new NumericCell($r['catatan_count'], $cellCenter),
                new StringCell($r['nilai_score'] ?? '—', $cellCenter),
            ]));
        }

        // Keterangan kolom
        $noteStyle = (new Style())->withFontItalic(true)->withFontColor('6B7280');
        $writer->addRow(Row::fromValues(['']));
        $writer->addRow(Row::fromValuesWithStyle(['Keterangan Kolom:'], $this->xlsxLabelStyle()));
        foreach ($this->ewsSiswaLegend() as $line) {
            $writer->addRow(Row::fromValuesWithStyle([$line], $noteStyle));
        }

        $writer->close();
        $content = file_get_contents($tmpFile);
        @unlink($tmpFile);

        return response($content, 200, [
            'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="EWS_Siswa.xlsx"',
        ]);
    }

    /**
     * Penjelasan arti kolom EWS Siswa, ditampilkan di bagian bawah laporan (PDF & Excel)
     * supaya pembaca (wali kelas/BK/wakasek) paham ambang batas yang dipakai sistem —
     * sinkron dengan threshold di determineLevel()/calc*() di atas.
     *
     * @return array<int,string>
     */
    private function ewsSiswaLegend(): array
    {
        return [
            'Level EWS: tingkat kewaspadaan siswa dari jumlah indikator bermasalah (Kehadiran < 80%, Karakter < 0 poin, Catatan ≥ 3x, Nilai rata-rata < 70). Hijau = 0 indikator, Kuning = 1, Oranye = 2, Merah = ≥ 3 (perlu tindak lanjut segera).',
            'Kehadiran (%): persentase kehadiran "Hadir" dari seluruh sesi tercatat. Dianggap bermasalah jika di bawah 80%.',
            'Karakter (Poin): akumulasi poin karakter (apresiasi positif dikurangi pelanggaran negatif) dari seluruh guru. Dianggap bermasalah jika bernilai negatif (di bawah 0).',
            'Catatan (x): jumlah catatan pelanggaran/perhatian yang tercatat dari guru/BK. Dianggap bermasalah jika 3 kali atau lebih.',
        ];
    }

    // ── Batch loaders (untuk index) ───────────────────────────────────────────

    private function batchAttendance(Collection $ids): Collection
    {
        return DB::table('student_attendances')
            ->whereIn('student_id', $ids->toArray())
            ->selectRaw("student_id, status, count(*) as cnt")
            ->groupBy('student_id', 'status')
            ->get()
            ->groupBy('student_id');
    }

    private function batchCharacter(Collection $ids): Collection
    {
        return DB::table('character_inputs')
            ->join('character_subitems', 'character_subitems.id', '=', 'character_inputs.subitem_id')
            ->whereIn('character_inputs.student_id', $ids->toArray())
            ->selectRaw("character_inputs.student_id,
                coalesce(sum(CASE WHEN character_inputs.sign = 'positif'
                    THEN character_subitems.bobot
                    ELSE -character_subitems.bobot END), 0) AS total_score,
                count(*) AS cnt")
            ->groupBy('character_inputs.student_id')
            ->get()
            ->keyBy('student_id');
    }

    private function batchNotes(Collection $ids): Collection
    {
        return DB::table('notes')
            ->where('target_type', Student::class)
            ->whereIn('target_id', $ids->toArray())
            ->selectRaw('target_id, count(*) as cnt')
            ->groupBy('target_id')
            ->pluck('cnt', 'target_id');
    }

    private function batchNilai(Collection $ids): Collection
    {
        return DB::table('agenda_student_scores')
            ->whereIn('student_id', $ids->toArray())
            ->selectRaw('student_id, avg(nilai) as avg_nilai, count(*) as cnt')
            ->groupBy('student_id')
            ->get()
            ->keyBy('student_id');
    }

    // ── Batch calculators (untuk index, tanpa DB hit) ─────────────────────────

    private function calcKehadiranBatch(int $studentId, Collection $attData): array
    {
        $counts  = $attData->get($studentId, collect());
        $total   = $counts->sum('cnt');
        $hadir   = (int) ($counts->firstWhere('status', 'hadir')?->cnt ?? 0);
        $alpha   = (int) ($counts->firstWhere('status', 'alpha')?->cnt ?? 0);
        $sakit   = (int) ($counts->firstWhere('status', 'sakit')?->cnt ?? 0);
        $izin    = (int) ($counts->firstWhere('status', 'izin')?->cnt ?? 0);
        $score   = $total > 0 ? ($hadir / $total) * 100 : 100.0;
        $warning = $score < self::THRESHOLD_KEHADIRAN ? 1 : 0;
        return compact('score', 'total', 'hadir', 'alpha', 'sakit', 'izin', 'warning');
    }

    private function calcKarakterBatch(int $studentId, Collection $charData): array
    {
        $row     = $charData->get($studentId);
        $score   = $row ? (float) $row->total_score : 0;
        $count   = $row ? (int) $row->cnt : 0;
        $warning = $score < self::THRESHOLD_KARAKTER ? 1 : 0;
        return compact('score', 'count', 'warning');
    }

    private function calcCatatanBatch(int $studentId, Collection $noteData): array
    {
        $count   = (int) ($noteData->get($studentId) ?? 0);
        $warning = $count >= self::THRESHOLD_CATATAN ? 1 : 0;
        return compact('count', 'warning');
    }

    private function calcNilaiBatch(int $studentId, Collection $nilaiData): array
    {
        $row     = $nilaiData->get($studentId);
        $score   = $row ? (float) $row->avg_nilai : null;
        $count   = $row ? (int) $row->cnt : 0;
        $warning = ($score !== null && $score < self::THRESHOLD_NILAI) ? 1 : 0;
        return compact('score', 'count', 'warning');
    }

    // ── Per-student calculators (untuk show — single student) ─────────────────

    private function calcKehadiran(int $studentId): array
    {
        $base    = fn () => StudentAttendance::tahunAjaran()->where('student_id', $studentId);
        $total   = $base()->count();
        $hadir   = $base()->where('status', 'hadir')->count();
        $alpha   = $base()->where('status', 'alpha')->count();
        $sakit   = $base()->where('status', 'sakit')->count();
        $izin    = $base()->where('status', 'izin')->count();
        $score   = $total > 0 ? ($hadir / $total) * 100 : 100.0;
        $warning = $score < self::THRESHOLD_KEHADIRAN ? 1 : 0;
        return compact('score', 'total', 'hadir', 'alpha', 'sakit', 'izin', 'warning');
    }

    private function calcKarakter(int $studentId): array
    {
        $inputs  = CharacterInput::tahunAjaran()->where('student_id', $studentId)->with('subitem')->get();
        $score   = $inputs->sum(fn ($i) =>
            $i->sign->value === 'positif' ? abs($i->subitem->bobot) : -abs($i->subitem->bobot)
        );
        $count   = $inputs->count();
        $warning = $score < self::THRESHOLD_KARAKTER ? 1 : 0;
        return compact('score', 'count', 'warning');
    }

    private function calcCatatan(int $studentId): array
    {
        $count   = Note::where('target_type', Student::class)->where('target_id', $studentId)->count();
        $warning = $count >= self::THRESHOLD_CATATAN ? 1 : 0;
        return compact('count', 'warning');
    }

    private function calcNilai(int $studentId): array
    {
        $scores  = AgendaStudentScore::where('student_id', $studentId)->pluck('nilai');
        $score   = $scores->count() > 0 ? $scores->avg() : null;
        $count   = $scores->count();
        $warning = ($score !== null && $score < self::THRESHOLD_NILAI) ? 1 : 0;
        return compact('score', 'count', 'warning');
    }

    /**
     * Aturannya kini tinggal di App\Enums\EwsLevel::dariKomponen() supaya AlphaAlertService
     * & CharacterService memakai rumus yang sama persis — dulu ketiganya berbeda.
     * Indikator di sini sudah dihitung batch, jadi cukup diteruskan nilainya.
     */
    private function determineLevel(array $k, array $kar, array $c, array $n): string
    {
        return EwsLevel::dariKomponen(
            (float) $k['score'],
            (int) $kar['score'],
            (int) $c['count'],
            $n['score'] !== null ? (float) $n['score'] : null,
        )->value;
    }

    /**
     * Kelas utk DAFTAR EWS (index) — SENGAJA beda dari ClassAccess::pastoralClassIds() yang
     * menggabungkan. Daftar EWS wali kelas HANYA menampilkan siswa kelas perwaliannya
     * (bukan kelas mapel yang ia ajar / kelas yang ia ampu sbg BK). Guru BK membuka
     * DETAIL siswa konseling lewat menu "Murid Konseling" (+ authorizeEwsStudentAccess
     * yang tetap union), bukan lewat daftar EWS ini. Guru BK yang BUKAN wali kelas tetap
     * melihat kelas yang ia ampu di daftar.
     *  - null = semua (admin/wakasek); Collection = daftar class_id; kosong = nihil.
     */
    private function ewsListClassIdsForUser(\App\Models\User $user, ?string $scope = null): ?Collection
    {
        if (ClassAccess::isSchoolWide($user)) {
            return null;
        }

        $kelasWaliIds = ClassAccess::waliClassIds($user);
        $bkClassIds   = ClassAccess::bkClassIds($user);

        // Menu terpisah: EWS di menu Wali Kelas (homeroom) vs EWS di menu Guru BK (kelas
        // yang diampu). Guru yang wali kelas SEKALIGUS BK punya DUA menu EWS berbeda.
        if ($scope === 'bk')   return $bkClassIds;
        if ($scope === 'wali') return $kelasWaliIds;

        // Tanpa scope (mis. dashboard/prefetch lama): wali kelas didahulukan, lalu BK.
        return $kelasWaliIds->isNotEmpty() ? $kelasWaliIds : $bkClassIds;
    }

    /**
     * GK3: satu titik otorisasi untuk SEMUA endpoint EWS per-siswa (show, dimensionPdf,
     * dan siapa pun lagi nanti) — supaya tidak ada lagi endpoint yang lupa dijaga seperti
     * yang ditemukan saat verifikasi ulang (dimensionPdf() dulu TANPA otorisasi sama
     * sekali). Kembalikan JsonResponse 403 kalau ditolak, null kalau boleh lanjut.
     */
    private function authorizeEwsStudentAccess(\App\Models\User $user, Student $student): ?JsonResponse
    {
        if ($user->role === UserRole::Siswa) {
            $own = Student::where('user_id', $user->id)->first();
            if (! $own || $own->id !== $student->id) {
                return response()->json(['message' => 'Akses ditolak.'], 403);
            }
            return null;
        }

        if ($user->role === UserRole::OrangTua) {
            if (! $user->linked_student_id || $user->linked_student_id !== $student->id) {
                return response()->json(['message' => 'Akses ditolak.'], 403);
            }
            return null;
        }

        // Staf (guru/wali kelas/BK/admin/wakasek) — dibatasi kapabilitas yang sama dengan index().
        // Sebelumnya role literal `bk`/`wali_kelas` lolos ke `return null` (boleh akses siswa mana pun).
        $allowed = ClassAccess::pastoralClassIds($user);
        if ($allowed === null) {
            return null; // admin/wakasek
        }
        if (! $student->class_id || ! $allowed->contains($student->class_id)) {
            return response()->json(['message' => 'Anda tidak memiliki akses ke EWS siswa ini.'], 403);
        }

        return null;
    }
}
