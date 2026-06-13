<?php

namespace App\Http\Controllers\Api;

use App\Enums\EwsLevel;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use Barryvdh\DomPDF\Facade\Pdf;
use App\Models\AcademicYear;
use App\Models\AgendaStudentScore;
use App\Models\CharacterInput;
use App\Models\EwsStatus;
use App\Models\Note;
use App\Models\Recommendation;
use App\Models\Student;
use App\Models\StudentAttendance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class EwsController extends Controller
{
    private const THRESHOLD_KEHADIRAN = 80.0;
    private const THRESHOLD_KARAKTER  = 0;
    private const THRESHOLD_CATATAN   = 3;
    private const THRESHOLD_NILAI     = 70.0;

    // GET /ews
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $ay   = AcademicYear::where('aktif', true)->first();

        if (! $ay) {
            return response()->json(['data' => [], 'meta' => ['total' => 0]]);
        }

        $query = Student::with(['user:id,nama', 'schoolClass'])
            ->whereHas('schoolClass', fn ($q) => $q->where('academic_year_id', $ay->id));

        match ($user->role) {
            UserRole::WaliKelas => $query->whereHas('schoolClass', fn ($q) => $q->where('wali_kelas_id', $user->id)),
            UserRole::Guru      => $query->whereHas('schoolClass.schedules', fn ($q) =>
                $q->whereHas('teacher', fn ($q2) => $q2->where('user_id', $user->id))
            ),
            UserRole::Siswa     => $query->whereHas('user', fn ($q) => $q->where('id', $user->id)),
            UserRole::OrangTua  => $user->linked_student_id
                ? $query->where('id', $user->linked_student_id)
                : $query->whereRaw('1=0'),
            default             => null,
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
        // ───────────────────────────────────────────────────────────────────

        $now        = now()->toDateTimeString();
        $upsertRows = [];

        $results = $students->map(function ($s) use ($ay, $attData, $charData, $noteData, $nilaiData, $now, &$upsertRows) {
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
                    ? "{$s->schoolClass->tingkat->value} {$s->schoolClass->jurusan} - {$s->schoolClass->rombel}"
                    : null,
                'level'           => $level,
                'kehadiran_score' => round($kehadiran['score'], 1),
                'karakter_score'  => $karakter['score'],
                'catatan_count'   => $catatan['count'],
                'nilai_score'     => $nilai['score'] !== null ? round($nilai['score'], 1) : null,
                'warning_count'   => $kehadiran['warning'] + $karakter['warning'] + $catatan['warning'] + $nilai['warning'],
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

        if ($user->role === UserRole::Siswa) {
            $own = Student::where('user_id', $user->id)->first();
            if (! $own || $own->id !== $student->id) {
                return response()->json(['message' => 'Akses ditolak.'], 403);
            }
        } elseif ($user->role === UserRole::OrangTua) {
            if (! $user->linked_student_id || $user->linked_student_id !== $student->id) {
                return response()->json(['message' => 'Akses ditolak.'], 403);
            }
        }

        $ay = AcademicYear::where('aktif', true)->first();

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

        $allKarakter = CharacterInput::where('student_id', $student->id)
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

        $absences = StudentAttendance::where('student_id', $student->id)
            ->where('status', '!=', 'hadir')
            ->with(['agenda.schedule.subject', 'agenda.schedule.schoolClass'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($a) => [
                'tanggal' => $a->agenda->tanggal->format('Y-m-d'),
                'status'  => $a->status->value,
                'mapel'   => $a->agenda->schedule->subject->nama ?? '—',
                'kelas'   => $a->agenda->schedule->schoolClass
                    ? "{$a->agenda->schedule->schoolClass->tingkat->value} {$a->agenda->schedule->schoolClass->jurusan} - {$a->agenda->schedule->schoolClass->rombel}"
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

        $rekomendasi = Recommendation::where('student_id', $student->id)
            ->with(['threshold', 'suggestedHandlers', 'handlingSessions.handler', 'verifiedBy'])
            ->orderByRaw("CASE status WHEN 'pending' THEN 0 WHEN 'proses' THEN 1 WHEN 'menunggu_verifikasi' THEN 2 ELSE 3 END")
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($r) => [
                'id'                 => $r->uuid,
                'rekomendasi'        => $r->threshold->rekomendasi,
                'sifat'              => $r->threshold->sifat->value,
                'akumulasi'          => $r->akumulasi_saat_trigger,
                'status'             => $r->status->value,
                'catatan_admin'      => $r->catatan_admin,
                'dibuat_pada'        => $r->created_at->format('Y-m-d'),
                'verified_by'        => $r->verifiedBy?->nama,
                'verified_at'        => $r->verified_at?->format('Y-m-d'),
                'suggested_handlers' => $r->suggestedHandlers->map(fn ($u) => [
                    'id'   => $u->uuid,
                    'nama' => $u->nama,
                    'role' => $u->role->value,
                ]),
                'handling_sessions'  => $r->handlingSessions->map(fn ($s) => [
                    'id'           => $s->uuid,
                    'tanggal'      => $s->tanggal->format('Y-m-d'),
                    'catatan'      => $s->catatan,
                    'link_dokumen' => $s->link_dokumen,
                    'link_foto'    => $s->link_foto,
                    'links'        => $s->links ?? [],
                    'handled_by'   => $s->handler->nama,
                    'created_at'   => $s->created_at->format('Y-m-d H:i'),
                ]),
            ]);

        return response()->json([
            'data' => [
                'student' => [
                    'id'    => $student->uuid,
                    'nama'  => $student->user->nama,
                    'nis'   => $student->nis,
                    'kelas' => $student->schoolClass
                        ? "{$student->schoolClass->tingkat->value} {$student->schoolClass->jurusan} - {$student->schoolClass->rombel}"
                        : null,
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

        $generated = now('Asia/Jakarta')->format('d M Y H:i');
        $namaFile  = "EWS_{$dim}_{$student->user->nama}";
        $kelas     = $student->schoolClass
            ? "{$student->schoolClass->tingkat->value} {$student->schoolClass->jurusan} - {$student->schoolClass->rombel}"
            : '—';

        if ($dim === 'kehadiran') {
            $kehadiran = $this->calcKehadiran($student->id);
            $rows = StudentAttendance::where('student_id', $student->id)
                ->where('status', '!=', 'hadir')
                ->with(['agenda.schedule.subject', 'agenda.schedule.schoolClass'])
                ->orderByDesc('created_at')
                ->get()
                ->map(fn ($a) => [
                    'tanggal' => $a->agenda->tanggal->format('d/m/Y'),
                    'status'  => strtoupper($a->status->value),
                    'mapel'   => $a->agenda->schedule->subject->nama ?? '—',
                ]);
            return Pdf::loadView('reports.dim_kehadiran', compact('student', 'kelas', 'kehadiran', 'rows', 'generated'))
                ->setPaper('a4', 'portrait')->download("{$namaFile}.pdf");
        }

        if ($dim === 'karakter') {
            $karakter = $this->calcKarakter($student->id);
            $rows = CharacterInput::where('student_id', $student->id)
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
            return Pdf::loadView('reports.dim_karakter', compact('student', 'kelas', 'karakter', 'rows', 'generated'))
                ->setPaper('a4', 'portrait')->download("{$namaFile}.pdf");
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
            return Pdf::loadView('reports.dim_catatan', compact('student', 'kelas', 'catatanStat', 'rows', 'generated'))
                ->setPaper('a4', 'portrait')->download("{$namaFile}.pdf");
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
        return Pdf::loadView('reports.dim_nilai', compact('student', 'kelas', 'nilaiStat', 'rows', 'generated'))
            ->setPaper('a4', 'portrait')->download("{$namaFile}.pdf");
    }

    // ── Batch loaders (untuk index) ───────────────────────────────────────────

    private function batchAttendance(Collection $ids): Collection
    {
        return DB::table('student_attendances')
            ->whereIn('student_id', $ids->toArray())
            ->selectRaw("student_id, status::text as status, count(*)::int as cnt")
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
                coalesce(sum(CASE WHEN character_inputs.sign::text = 'positif'
                    THEN character_subitems.bobot
                    ELSE -character_subitems.bobot END), 0)::float AS total_score,
                count(*)::int AS cnt")
            ->groupBy('character_inputs.student_id')
            ->get()
            ->keyBy('student_id');
    }

    private function batchNotes(Collection $ids): Collection
    {
        return DB::table('notes')
            ->where('target_type', Student::class)
            ->whereIn('target_id', $ids->toArray())
            ->selectRaw('target_id, count(*)::int as cnt')
            ->groupBy('target_id')
            ->pluck('cnt', 'target_id');
    }

    private function batchNilai(Collection $ids): Collection
    {
        return DB::table('agenda_student_scores')
            ->whereIn('student_id', $ids->toArray())
            ->selectRaw('student_id, avg(nilai)::float as avg_nilai, count(*)::int as cnt')
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
        $total   = StudentAttendance::where('student_id', $studentId)->count();
        $hadir   = StudentAttendance::where('student_id', $studentId)->where('status', 'hadir')->count();
        $alpha   = StudentAttendance::where('student_id', $studentId)->where('status', 'alpha')->count();
        $sakit   = StudentAttendance::where('student_id', $studentId)->where('status', 'sakit')->count();
        $izin    = StudentAttendance::where('student_id', $studentId)->where('status', 'izin')->count();
        $score   = $total > 0 ? ($hadir / $total) * 100 : 100.0;
        $warning = $score < self::THRESHOLD_KEHADIRAN ? 1 : 0;
        return compact('score', 'total', 'hadir', 'alpha', 'sakit', 'izin', 'warning');
    }

    private function calcKarakter(int $studentId): array
    {
        $inputs  = CharacterInput::where('student_id', $studentId)->with('subitem')->get();
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

    private function determineLevel(array $k, array $kar, array $c, array $n): string
    {
        $warnings = $k['warning'] + $kar['warning'] + $c['warning'] + $n['warning'];
        return match (true) {
            $warnings >= 3  => 'merah',
            $warnings === 2 => 'oranye',
            $warnings === 1 => 'kuning',
            default         => 'hijau',
        };
    }
}
