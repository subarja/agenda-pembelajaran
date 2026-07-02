<?php

namespace App\Http\Controllers\Api;

use App\Enums\BkStatus;
use App\Enums\HandlingSessionJenis;
use App\Enums\RecommendationStatus;
use App\Http\Controllers\Controller;
use App\Models\HandlingSession;
use App\Models\PrintSetting;
use App\Models\Recommendation;
use App\Models\Schedule;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Notifications\KonselingDiajukanNotification;
use App\Traits\HandlesPdfPreview;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecommendationController extends Controller
{
    use HandlesPdfPreview;

    // ── Admin: tambah catatan + sarankan penangan ─────────────────────────────

    // PUT /recommendations/{uuid}/admin-note
    public function updateAdminNote(Request $request, string $uuid): JsonResponse
    {
        // Dulu TIDAK ADA otorisasi di sini sama sekali — guru manapun bisa ubah catatan
        // admin di rekomendasi siapa pun. Ditemukan saat audit ulang GK3 (celah serupa).
        $this->authorizeAdminOrWakasek($request);

        $rec = Recommendation::where('uuid', $uuid)->firstOrFail();

        $data = $request->validate([
            'catatan_admin' => ['nullable', 'string', 'max:2000'],
        ]);

        $rec->update(['catatan_admin' => $data['catatan_admin']]);

        return response()->json(['message' => 'Catatan admin disimpan.']);
    }

    // PUT /recommendations/{uuid}/handlers  — set (replace) suggested handlers
    public function updateHandlers(Request $request, string $uuid): JsonResponse
    {
        // Sama — dulu tanpa otorisasi, siapa pun bisa ubah daftar penangan disarankan.
        $this->authorizeAdminOrWakasek($request);

        $rec  = Recommendation::where('uuid', $uuid)->firstOrFail();
        $user = $request->user();

        $data = $request->validate([
            'handler_ids'   => ['required', 'array'],
            'handler_ids.*' => ['string'],  // UUID user
        ]);

        $userIds = User::whereIn('uuid', $data['handler_ids'])->pluck('id');

        // Sync handlers, catat siapa yang menyarankan
        $syncData = $userIds->mapWithKeys(fn ($id) => [
            $id => ['suggested_by' => $user->id],
        ])->toArray();

        $rec->suggestedHandlers()->sync($syncData);

        return response()->json([
            'message'  => 'Penangan disarankan berhasil disimpan.',
            'handlers' => $rec->fresh()->suggestedHandlers->map(fn ($u) => ['id' => $u->uuid, 'nama' => $u->nama]),
        ]);
    }

    // PUT /recommendations/{uuid}/verify — admin/wakasek verifikasi selesai
    public function verify(Request $request, string $uuid): JsonResponse
    {
        $this->authorizeAdminOrWakasek($request);

        $rec = Recommendation::where('uuid', $uuid)->firstOrFail();

        abort_if(
            ! in_array($rec->status->value, ['menunggu_verifikasi', 'proses']),
            422,
            'Hanya bisa verifikasi jika status Menunggu Verifikasi atau Sedang Diproses.'
        );

        $rec->update([
            'status'      => RecommendationStatus::Selesai,
            'verified_by' => $request->user()->id,
            'verified_at' => now(),
        ]);

        return response()->json(['message' => 'Penanganan diverifikasi dan dinyatakan selesai.']);
    }

    // ── GK6: Wali kelas bisa buat kasus penanganan manual kapan pun ───────────

    // POST /students/{uuid}/case
    public function storeManual(Request $request, string $studentUuid): JsonResponse
    {
        $student = Student::where('uuid', $studentUuid)->with('schoolClass')->firstOrFail();
        $user    = $request->user();

        $isAdmin = in_array($user->role->value, ['admin', 'wakasek'], true);
        $isWali  = $student->schoolClass?->wali_kelas_id === $user->id;
        abort_if(! $isAdmin && ! $isWali, 403, 'Hanya wali kelas siswa ini yang dapat membuat kasus penanganan.');

        $data = $request->validate(['alasan' => ['required', 'string', 'max:500']]);

        $netScore = app(\App\Services\CharacterService::class)->calculateNetScore($student);

        $rec = Recommendation::create([
            'student_id'             => $student->id,
            'threshold_id'           => null,
            'alasan_manual'          => $data['alasan'],
            'akumulasi_saat_trigger' => $netScore,
            'status'                 => RecommendationStatus::Pending,
            'bk_status'              => BkStatus::None,
            'created_by'             => $user->id,
        ]);

        return response()->json([
            'message' => 'Kasus penanganan baru dibuat.',
            'data'    => ['id' => $rec->uuid],
        ], 201);
    }

    // ── Wali Kelas / BK: kelola sesi penanganan ────────────────────────────────

    // POST /recommendations/{uuid}/sessions
    public function storeSession(Request $request, string $uuid): JsonResponse
    {
        $rec  = Recommendation::where('uuid', $uuid)->with('student.schoolClass')->firstOrFail();
        $user = $request->user();

        [$jenis] = $this->authorizeSessionWrite($request, $rec);

        $data = $request->validate([
            'tanggal'              => ['required', 'date'],
            'catatan'              => ['required', 'string', 'max:3000'],
            'link_dokumen'         => ['nullable', 'url', 'max:500'],
            'link_foto'            => ['nullable', 'url', 'max:500'],
            'links'                => ['nullable', 'array', 'max:5'],
            'links.*.url'          => ['required_with:links', 'url', 'max:500'],
            'links.*.keterangan'   => ['required_with:links', 'string', 'max:200'],
        ]);

        $session = HandlingSession::create([
            'recommendation_id' => $rec->id,
            'handled_by'        => $user->id,
            'jenis'             => $jenis,
            'is_resume'         => false,
            'tanggal'           => $data['tanggal'],
            'catatan'           => $data['catatan'],
            'link_dokumen'      => $data['link_dokumen'] ?? null,
            'link_foto'         => $data['link_foto'] ?? null,
            'links'             => $data['links'] ?? null,
        ]);

        // Otomatis update status rekomendasi ke proses jika masih pending (hanya untuk
        // sesi wali kelas — sesi BK tidak menyentuh status wali-kelas, itu state terpisah).
        if ($jenis === HandlingSessionJenis::WaliKelas->value && $rec->status->value === 'pending') {
            $rec->update(['status' => RecommendationStatus::Proses]);
        }

        return response()->json([
            'message' => 'Catatan penanganan disimpan.',
            'data'    => $this->formatSession($session->load('handler')),
        ], 201);
    }

    // PUT /recommendations/{uuid}/sessions/{sessionId}
    public function updateSession(Request $request, string $uuid, string $sessionId): JsonResponse
    {
        $rec     = Recommendation::where('uuid', $uuid)->firstOrFail();
        $session = HandlingSession::where('uuid', $sessionId)
            ->where('recommendation_id', $rec->id)
            ->firstOrFail();

        abort_if($session->handled_by !== $request->user()->id, 403, 'Anda hanya bisa mengubah catatan sendiri.');
        abort_if($session->is_resume, 422, 'Catatan resume BK tidak bisa diubah setelah kasus ditandai selesai.');

        $data = $request->validate([
            'tanggal'            => ['sometimes', 'date'],
            'catatan'            => ['sometimes', 'string', 'max:3000'],
            'link_dokumen'       => ['nullable', 'url', 'max:500'],
            'link_foto'          => ['nullable', 'url', 'max:500'],
            'links'              => ['nullable', 'array', 'max:5'],
            'links.*.url'        => ['required_with:links', 'url', 'max:500'],
            'links.*.keterangan' => ['required_with:links', 'string', 'max:200'],
        ]);

        $session->update($data);

        return response()->json(['message' => 'Catatan diperbarui.', 'data' => $this->formatSession($session->fresh('handler'))]);
    }

    // DELETE /recommendations/{uuid}/sessions/{sessionId}
    public function deleteSession(Request $request, string $uuid, string $sessionId): JsonResponse
    {
        $rec     = Recommendation::where('uuid', $uuid)->firstOrFail();
        $session = HandlingSession::where('uuid', $sessionId)
            ->where('recommendation_id', $rec->id)
            ->firstOrFail();

        abort_if($session->handled_by !== $request->user()->id, 403, 'Anda hanya bisa menghapus catatan sendiri.');
        abort_if($session->is_resume, 422, 'Catatan resume BK tidak bisa dihapus.');

        $session->delete();

        return response()->json(['message' => 'Catatan dihapus.']);
    }

    // PUT /recommendations/{uuid}/status — wali kelas tandai proses/menunggu-verifikasi/selesai/diabaikan
    public function updateStatus(Request $request, string $uuid): JsonResponse
    {
        $rec  = Recommendation::where('uuid', $uuid)->with('student.schoolClass')->firstOrFail();
        $user = $request->user();

        $data = $request->validate([
            'status' => ['required', 'in:proses,menunggu_verifikasi,selesai,diabaikan'],
        ]);

        $isAdmin = in_array($user->role->value, ['admin', 'wakasek'], true);
        $isWali  = $rec->student?->schoolClass?->wali_kelas_id === $user->id;
        abort_if(! $isAdmin && ! $isWali, 403, 'Tidak memiliki akses.');

        $updates = ['status' => RecommendationStatus::from($data['status'])];
        // GK7: wali kelas bisa tandai selesai sendiri (tidak wajib lewat verifikasi admin)
        // — log kapan tepatnya, supaya tetap tercatat di laporan meski riwayatnya tidak hilang.
        if ($data['status'] === 'selesai') {
            $updates['ditangani_pada'] = now();
        }
        $rec->update($updates);

        return response()->json(['message' => 'Status diperbarui.']);
    }

    // ── GK8: Wali kelas ajukan konseling ke BK ─────────────────────────────────

    // PUT /recommendations/{uuid}/ajukan-konseling
    public function ajukanKonseling(Request $request, string $uuid): JsonResponse
    {
        $rec     = Recommendation::where('uuid', $uuid)->with('student.schoolClass')->firstOrFail();
        $user    = $request->user();
        $student = $rec->student;

        abort_if($student?->schoolClass?->wali_kelas_id !== $user->id, 403, 'Hanya wali kelas siswa ini yang dapat mengajukan konseling.');
        abort_if($rec->bk_status !== BkStatus::None, 422, 'Konseling untuk kasus ini sudah pernah diajukan.');

        $waliSessionCount = $rec->handlingSessions()->where('jenis', HandlingSessionJenis::WaliKelas->value)->count();
        abort_if($waliSessionCount < 3, 422, 'Minimal 3 catatan penanganan wali kelas diperlukan sebelum mengajukan konseling.');

        $rec->update(['bk_status' => BkStatus::Diajukan, 'diajukan_konseling_pada' => now()]);

        $bkTeachers = $this->resolveBkTeachersForClass($student->schoolClass);
        foreach ($bkTeachers as $bk) {
            $bk->user?->notify(new KonselingDiajukanNotification($student, $user->nama));
        }

        return response()->json([
            'message'     => 'Konseling berhasil diajukan ke Guru BK.',
            'bk_notified' => $bkTeachers->count(),
        ]);
    }

    // ── GK9: BK terima pengajuan konseling ─────────────────────────────────────

    // PUT /recommendations/{uuid}/bk-terima
    public function bkTerima(Request $request, string $uuid): JsonResponse
    {
        $rec     = Recommendation::where('uuid', $uuid)->with('student.schoolClass')->firstOrFail();
        $user    = $request->user();
        $teacher = $user->teacher;

        abort_if(! $teacher?->is_bk, 403, 'Hanya Guru BK yang dapat menerima pengajuan konseling.');
        abort_if($rec->bk_status !== BkStatus::Diajukan, 422, 'Kasus ini tidak sedang menunggu konseling.');

        $isRelevantBk = Schedule::where('teacher_id', $teacher->id)
            ->where('class_id', $rec->student->class_id)->where('aktif', true)->exists();
        abort_if(! $isRelevantBk, 403, 'Anda tidak mengampu BK di kelas siswa ini.');

        $rec->update([
            'bk_status'         => BkStatus::Diterima,
            'bk_teacher_id'     => $teacher->id,
            'diterima_bk_pada'  => now(),
        ]);

        return response()->json(['message' => 'Konseling diterima. Anda sekarang menangani kasus ini.']);
    }

    // ── GK11: BK tandai selesai (wajib isi resume dulu) ────────────────────────

    // PUT /recommendations/{uuid}/bk-selesai
    public function bkSelesai(Request $request, string $uuid): JsonResponse
    {
        $rec     = Recommendation::where('uuid', $uuid)->firstOrFail();
        $user    = $request->user();
        $teacher = $user->teacher;

        abort_if(! $teacher || $rec->bk_teacher_id !== $teacher->id, 403, 'Hanya BK yang menangani kasus ini yang dapat menandai selesai.');
        abort_if($rec->bk_status !== BkStatus::Diterima, 422, 'Kasus ini belum diterima atau sudah selesai.');

        $data = $request->validate(['resume' => ['required', 'string', 'max:3000']]);

        $rec->update([
            'bk_status'       => BkStatus::Selesai,
            'resume_bk'       => $data['resume'],
            'bk_selesai_pada' => now(),
        ]);

        // GK11: resume BK ikut muncul di riwayat penanganan (dilihat wali kelas) dengan
        // judul "Resume BK" — direalisasikan sebagai HandlingSession ber-flag is_resume,
        // supaya tampil di timeline riwayat yang sudah ada tanpa UI terpisah.
        HandlingSession::create([
            'recommendation_id' => $rec->id,
            'handled_by'        => $user->id,
            'jenis'             => HandlingSessionJenis::Bk->value,
            'is_resume'         => true,
            'tanggal'           => now()->toDateString(),
            'catatan'           => $data['resume'],
        ]);

        return response()->json(['message' => 'Penanganan BK ditandai selesai. Resume dikirim ke riwayat wali kelas.']);
    }

    // ── GK8/GK9: daftar "Murid Konseling" untuk Guru BK ────────────────────────

    // GET /bk/konseling
    public function myKonseling(Request $request): JsonResponse
    {
        $user    = $request->user();
        $teacher = $user->teacher;
        abort_if(! $teacher?->is_bk, 403, 'Hanya Guru BK yang dapat mengakses menu ini.');

        $classIds = Schedule::where('teacher_id', $teacher->id)->where('aktif', true)->pluck('class_id')->unique();

        $recs = Recommendation::where(function ($q) use ($classIds, $teacher) {
                $q->where(function ($q2) use ($classIds) {
                    $q2->where('bk_status', BkStatus::Diajukan->value)
                        ->whereHas('student', fn ($q3) => $q3->whereIn('class_id', $classIds));
                })->orWhere('bk_teacher_id', $teacher->id);
            })
            ->whereIn('bk_status', [BkStatus::Diajukan->value, BkStatus::Diterima->value, BkStatus::Selesai->value])
            ->with(['student.user', 'student.schoolClass'])
            ->orderByDesc('diajukan_konseling_pada')
            ->get()
            ->map(fn ($r) => [
                'id'                      => $r->uuid,
                'student'                 => [
                    'id'    => $r->student->uuid,
                    'nama'  => $r->student->user->nama,
                    'kelas' => $r->student->schoolClass
                        ? "{$r->student->schoolClass->tingkat->value} {$r->student->schoolClass->jurusan} - {$r->student->schoolClass->rombel}"
                        : null,
                ],
                'bk_status'               => $r->bk_status->value,
                'diajukan_konseling_pada' => $r->diajukan_konseling_pada?->format('Y-m-d H:i'),
                'diterima_bk_pada'        => $r->diterima_bk_pada?->format('Y-m-d H:i'),
                'bk_selesai_pada'         => $r->bk_selesai_pada?->format('Y-m-d H:i'),
                'is_mine'                 => $r->bk_teacher_id === $teacher->id,
            ]);

        return response()->json(['data' => $recs]);
    }

    // ── Laporan riwayat penanganan (PDF, siap cetak) ──────────────────────────

    // GET /students/{studentUuid}/handling-report?format=pdf
    public function handlingReport(Request $request, string $studentUuid)
    {
        $student = Student::where('uuid', $studentUuid)
            ->with(['user', 'schoolClass.waliKelas'])
            ->firstOrFail();

        $this->authorizeHandlingReport($request, $student);

        $recs = Recommendation::where('student_id', $student->id)
            ->with([
                'threshold',
                'assignedTo',
                'verifiedBy',
                'suggestedHandlers',
                'handlingSessions.handler',
            ])
            ->orderBy('created_at')
            ->get();

        $ews = $this->calcEwsForReport($student->id);

        $printSettings = PrintSetting::instance($request->user()->id);
        $data = [
            'student'       => $student,
            'recs'          => $recs,
            'wali'          => $student->schoolClass?->waliKelas,
            'generated'     => now('Asia/Jakarta')->format('d M Y H:i'),
            'report_id'     => strtoupper(\Illuminate\Support\Str::random(8)),
            'ews'           => $ews,
            'printSettings' => $printSettings,
        ];

        $pdf = Pdf::loadView('reports.handling', $data)
            ->setPaper($printSettings->paperDimensionsPt(), 'portrait');
        return $this->pdfResponse($pdf, "Riwayat_Penanganan_{$student->user->nama}.pdf", $request);
    }

    private function calcEwsForReport(int $studentId): array
    {
        $total     = \App\Models\StudentAttendance::where('student_id', $studentId)->count();
        $hadir     = \App\Models\StudentAttendance::where('student_id', $studentId)->where('status', 'hadir')->count();
        $kehadiran = $total > 0 ? round(($hadir / $total) * 100, 1) : 100.0;

        $inputs   = \App\Models\CharacterInput::where('student_id', $studentId)->with('subitem')->get();
        $karakter = $inputs->sum(fn ($i) => $i->sign->value === 'positif' ? abs($i->subitem->bobot) : -abs($i->subitem->bobot));

        $catatan = \App\Models\Note::where('target_type', \App\Models\Student::class)->where('target_id', $studentId)->count();

        $nilaiAvg = \App\Models\AgendaStudentScore::where('student_id', $studentId)->avg('nilai');
        $nilai    = $nilaiAvg !== null ? round($nilaiAvg, 1) : null;

        $w     = ($kehadiran < 80 ? 1 : 0) + ($karakter < 0 ? 1 : 0) + ($catatan >= 3 ? 1 : 0) + ($nilai !== null && $nilai < 70 ? 1 : 0);
        $level = match (true) { $w >= 3 => 'merah', $w === 2 => 'oranye', $w === 1 => 'kuning', default => 'hijau' };

        return compact('kehadiran', 'karakter', 'catatan', 'nilai', 'level');
    }

    // ── Helper: routing BK berdasarkan jadwal (sama seperti pola "kelas diampu") ──

    private function resolveBkTeachersForClass(\App\Models\SchoolClass $class): \Illuminate\Support\Collection
    {
        $teacherIds = Schedule::where('class_id', $class->id)->where('aktif', true)->pluck('teacher_id')->unique();
        return Teacher::whereIn('id', $teacherIds)->where('is_bk', true)->with('user')->get();
    }

    // ── Helper: format sesi ───────────────────────────────────────────────────

    private function formatSession(HandlingSession $s): array
    {
        return [
            'id'           => $s->uuid,
            'jenis'        => $s->jenis->value,
            'is_resume'    => $s->is_resume,
            'tanggal'      => $s->tanggal->format('Y-m-d'),
            'catatan'      => $s->catatan,
            'link_dokumen' => $s->link_dokumen,
            'link_foto'    => $s->link_foto,
            'links'        => $s->links ?? [],
            'handled_by'   => $s->handler->nama,
            'created_at'   => $s->created_at->format('Y-m-d H:i'),
        ];
    }

    private function authorizeAdminOrWakasek(Request $request): void
    {
        abort_if(
            ! in_array($request->user()->role->value, ['admin', 'wakasek']),
            403, 'Hanya admin atau wakasek yang dapat melakukan verifikasi.'
        );
    }

    /**
     * Wali kelas siswa ybs ATAU BK yang sedang menangani kasus ini (bk_status=diterima
     * & bk_teacher_id cocok) boleh menulis sesi baru. Wali kelas TERKUNCI (GK9) begitu
     * BK menerima kasus. Kembalikan jenis sesi yang harus dicatat.
     *
     * @return array{0: string} [$jenis]
     */
    private function authorizeSessionWrite(Request $request, Recommendation $rec): array
    {
        $user    = $request->user();
        $teacher = $user->teacher;

        if ($teacher && $rec->bk_teacher_id === $teacher->id) {
            abort_if($rec->bk_status !== BkStatus::Diterima, 422, 'Kasus ini belum/tidak sedang Anda tangani.');
            return [HandlingSessionJenis::Bk->value];
        }

        if (in_array($user->role->value, ['admin', 'wakasek'], true)) {
            return [HandlingSessionJenis::WaliKelas->value];
        }

        $student = $rec->student ?? Student::find($rec->student_id);
        abort_if($student?->schoolClass?->wali_kelas_id !== $user->id, 403, 'Anda bukan wali kelas siswa ini.');
        abort_if(
            in_array($rec->bk_status->value, [BkStatus::Diterima->value, BkStatus::Selesai->value], true),
            422,
            'Pengisian riwayat wali kelas dikunci — kasus ini sedang/sudah ditangani BK.'
        );

        return [HandlingSessionJenis::WaliKelas->value];
    }

    /**
     * GK10: hanya admin/wakasek, wali kelas siswa ybs, atau BK yang bersangkutan
     * (sudah pernah menangani ATAU berwenang di kelas ini via jadwal) yang boleh
     * cetak laporan riwayat penanganan lengkap.
     */
    private function authorizeHandlingReport(Request $request, Student $student): void
    {
        $user = $request->user();
        if (in_array($user->role->value, ['admin', 'wakasek'], true)) return;
        if ($student->schoolClass?->wali_kelas_id === $user->id) return;

        $teacher = $user->teacher;
        if ($teacher?->is_bk) {
            $sudahMenangani = Recommendation::where('student_id', $student->id)
                ->where('bk_teacher_id', $teacher->id)->exists();
            if ($sudahMenangani) return;

            $berwenangDiKelas = Schedule::where('teacher_id', $teacher->id)
                ->where('class_id', $student->class_id)->where('aktif', true)->exists();
            if ($berwenangDiKelas) return;
        }

        abort(403, 'Anda tidak memiliki akses ke laporan riwayat penanganan siswa ini.');
    }
}
