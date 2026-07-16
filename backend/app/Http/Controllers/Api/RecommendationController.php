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
use App\Models\SchoolClass;
use App\Models\Teacher;
use App\Models\User;
use App\Notifications\KonselingDiajukanNotification;
use App\Support\FileCompressor;
use App\Traits\HandlesPdfPreview;
use App\Traits\RejectsFutureDate;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use App\Support\ClassAccess;

class RecommendationController extends Controller
{
    use HandlesPdfPreview;
    use RejectsFutureDate;

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

        // Catatan wali kelas dibatasi 200 kata (indikator sisa kata ditampilkan FE);
        // catatan BK bebas panjang (sering perlu detail klinis).
        $catatanRules = ['required', 'string', 'max:3000'];
        if ($jenis === HandlingSessionJenis::WaliKelas->value) {
            $catatanRules[] = $this->maxWordsRule(200);
        }

        $data = $request->validate([
            'judul'                => ['required', 'string', 'max:120'],
            'tanggal'              => ['required', 'date', $this->notFutureDateRule()],
            'catatan'              => $catatanRules,
            'link_dokumen'         => ['nullable', 'url', 'max:500'],
            'link_foto'            => ['nullable', 'url', 'max:500'],
            'links'                => ['nullable', 'array', 'max:5'],
            'links.*.url'          => ['required_with:links', 'url', 'max:500'],
            'links.*.keterangan'   => ['required_with:links', 'string', 'max:200'],
            // 3 field ini cuma terisi utk link hasil "Upload File" (lihat uploadDocumentation)
            // — link yang ditempel manual tidak punya ini. Dipakai fitur "Riwayat Dokumen
            // Penanganan" utk membedakan file yang beneran diupload vs link eksternal.
            'links.*.uploaded'     => ['sometimes', 'boolean'],
            'links.*.path'         => ['sometimes', 'nullable', 'string', 'max:500'],
            'links.*.size'         => ['sometimes', 'nullable', 'integer'],
        ], $this->notFutureDateMessages());

        $session = HandlingSession::create([
            'recommendation_id' => $rec->id,
            'handled_by'        => $user->id,
            'jenis'             => $jenis,
            'judul'             => $data['judul'],
            'is_resume'         => false,
            // Catatan BK baru default PRIVAT (opt-in) — wali kelas hanya lihat bila BK
            // klik "Bagikan ke Wali Kelas". Catatan wali_kelas selalu terlihat wali kelas.
            'shared_with_wali_kelas' => false,
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
            'data'    => $this->formatSession($session->load('handler'), $jenis === HandlingSessionJenis::Bk->value),
        ], 201);
    }

    // POST /recommendations/{uuid}/sessions/upload — upload foto/PDF dokumentasi
    // penanganan. Tidak ada kolom DB baru: hasil upload cuma jadi URL yang lalu
    // ditambahkan user ke array `links` (skema yang sudah ada) saat submit sesi,
    // sama seperti kalau user tempel link manual. File dikompresi dulu (FileCompressor)
    // sebelum disimpan — upload asli dari HP bisa besar, hasil kompresi jauh lebih kecil.
    public function uploadDocumentation(Request $request, string $uuid): JsonResponse
    {
        $rec = Recommendation::where('uuid', $uuid)->firstOrFail();
        $this->authorizeSessionWrite($request, $rec);

        $request->validate([
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ]);

        $file = $request->file('file');
        $compressedPath = FileCompressor::compress($file);
        $isPdf = $file->getMimeType() === 'application/pdf';
        $extension = $isPdf ? 'pdf' : 'jpg'; // FileCompressor selalu re-encode gambar jadi jpg
        $storedPath = 'dokumentasi_penanganan/'.uniqid('doc_', true).'.'.$extension;

        Storage::disk('public')->put($storedPath, file_get_contents($compressedPath));
        if ($compressedPath !== $file->getRealPath()) {
            @unlink($compressedPath);
        }

        return response()->json([
            'url'      => Storage::disk('public')->url($storedPath),
            'path'     => $storedPath,
            'filename' => $file->getClientOriginalName(),
            'size'     => Storage::disk('public')->size($storedPath),
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

        $catatanRules = ['sometimes', 'string', 'max:3000'];
        if ($session->jenis === HandlingSessionJenis::WaliKelas) {
            $catatanRules[] = $this->maxWordsRule(200);
        }

        $data = $request->validate([
            'judul'              => ['sometimes', 'required', 'string', 'max:120'],
            'tanggal'            => ['sometimes', 'date', $this->notFutureDateRule()],
            'catatan'            => $catatanRules,
            'link_dokumen'       => ['nullable', 'url', 'max:500'],
            'link_foto'          => ['nullable', 'url', 'max:500'],
            'links'              => ['nullable', 'array', 'max:5'],
            'links.*.url'        => ['required_with:links', 'url', 'max:500'],
            'links.*.keterangan' => ['required_with:links', 'string', 'max:200'],
            'links.*.uploaded'   => ['sometimes', 'boolean'],
            'links.*.path'       => ['sometimes', 'nullable', 'string', 'max:500'],
            'links.*.size'       => ['sometimes', 'nullable', 'integer'],
        ], $this->notFutureDateMessages());

        $session->update($data);

        $canToggle = $session->jenis === HandlingSessionJenis::Bk && ! $session->is_resume;

        return response()->json(['message' => 'Catatan diperbarui.', 'data' => $this->formatSession($session->fresh('handler'), $canToggle)]);
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

    // PUT /recommendations/{uuid}/sessions/{sessionId}/share — BG buka/tutup berbagi
    // catatan BK ke wali kelas. Reversible kapan saja. Catatan wali_kelas tidak relevan
    // (selalu terlihat wali kelas); resume penutup selalu dibagikan (tidak bisa ditutup).
    public function toggleSessionShare(Request $request, string $uuid, string $sessionId): JsonResponse
    {
        $rec     = Recommendation::where('uuid', $uuid)->firstOrFail();
        $session = HandlingSession::where('uuid', $sessionId)
            ->where('recommendation_id', $rec->id)
            ->firstOrFail();

        $teacher = $request->user()->teacher;
        abort_if(! $teacher || $rec->bk_teacher_id !== $teacher->id, 403, 'Hanya Guru BK yang menangani kasus ini yang dapat mengatur berbagi.');
        abort_if($session->jenis !== HandlingSessionJenis::Bk, 422, 'Hanya catatan BK yang bisa diatur berbaginya.');
        abort_if($session->is_resume, 422, 'Ringkasan penutup selalu dibagikan ke wali kelas.');

        $data = $request->validate(['shared' => ['required', 'boolean']]);
        $session->update(['shared_with_wali_kelas' => $data['shared']]);

        return response()->json([
            'message' => $data['shared'] ? 'Catatan dibagikan ke wali kelas.' : 'Catatan disembunyikan dari wali kelas.',
            'data'    => $this->formatSession($session->fresh('handler'), true),
        ]);
    }

    // GET /recommendations/wali-aktif — daftar siswa di kelas perwalian yang kasusnya
    // BELUM selesai (utk widget dashboard wali kelas: siapa ditangani, status, umur).
    public function waliActiveCases(Request $request): JsonResponse
    {
        $user     = $request->user();
        $classIds = SchoolClass::where('wali_kelas_id', $user->id)->pluck('id');

        if ($classIds->isEmpty()) {
            return response()->json(['data' => [], 'meta' => ['total' => 0]]);
        }

        $rows = Recommendation::whereHas('student', fn ($q) => $q->whereIn('class_id', $classIds))
            ->whereNotIn('status', [RecommendationStatus::Selesai->value, RecommendationStatus::Diabaikan->value])
            ->where('bk_status', '!=', BkStatus::Selesai->value)
            ->with(['student.user', 'student.schoolClass'])
            ->withCount('handlingSessions')
            ->orderBy('created_at') // tertua dulu (paling lama belum selesai di atas)
            ->get()
            ->map(function ($r) {
                $statusLabel = match ($r->bk_status) {
                    BkStatus::Diterima => 'Ditangani BK',
                    BkStatus::Diajukan => 'Menunggu Guru BK',
                    default            => 'Penanganan Wali Kelas',
                };

                return [
                    'id'            => $r->uuid,
                    'student_id'    => $r->student->uuid,
                    'nama'          => $r->student->user->nama,
                    'kelas'         => $r->student->schoolClass
                        ? $r->student->schoolClass->label()
                        : null,
                    'foto_url'      => $r->student->foto ? Storage::disk('public')->url($r->student->foto) : null,
                    'status'        => $r->bk_status->value === 'none' ? 'wali_kelas' : $r->bk_status->value,
                    'status_label'  => $statusLabel,
                    'umur_hari'     => (int) $r->created_at->startOfDay()->diffInDays(now()->startOfDay()),
                    'jumlah_sesi'   => $r->handling_sessions_count,
                    'dibuat_pada'   => $r->created_at->format('Y-m-d'),
                ];
            });

        return response()->json(['data' => $rows, 'meta' => ['total' => $rows->count()]]);
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

        // GK11: resume BK ikut muncul di riwayat penanganan (dilihat wali kelas) sebagai
        // HandlingSession ber-flag is_resume. Ini "ringkasan penutup" wajib → OTOMATIS
        // dibagikan ke wali kelas (shared_with_wali_kelas=true), tak peduli catatan BK
        // lain dibagikan atau tidak. Judul tetap supaya rapi di daftar collapse.
        HandlingSession::create([
            'recommendation_id'      => $rec->id,
            'handled_by'             => $user->id,
            'jenis'                  => HandlingSessionJenis::Bk->value,
            'judul'                  => 'Ringkasan Penutup Konseling',
            'is_resume'              => true,
            'shared_with_wali_kelas' => true,
            'tanggal'                => now()->toDateString(),
            'catatan'                => $data['resume'],
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

        $classIds = Schedule::tahunAjaran()->where('teacher_id', $teacher->id)->where('aktif', true)->pluck('class_id')->unique();

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
                        ? $r->student->schoolClass->label()
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
        $total     = \App\Models\StudentAttendance::tahunAjaran()->where('student_id', $studentId)->count();
        $hadir     = \App\Models\StudentAttendance::tahunAjaran()->where('student_id', $studentId)->where('status', 'hadir')->count();
        $kehadiran = $total > 0 ? round(($hadir / $total) * 100, 1) : 100.0;

        $inputs   = \App\Models\CharacterInput::tahunAjaran()->where('student_id', $studentId)->with('subitem')->get();
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

    private function formatSession(HandlingSession $s, bool $canToggleShare = false): array
    {
        return [
            'id'                     => $s->uuid,
            'jenis'                  => $s->jenis->value,
            'judul'                  => $s->judul,
            'is_resume'              => $s->is_resume,
            'shared_with_wali_kelas' => $s->shared_with_wali_kelas,
            'can_toggle_share'       => $canToggleShare,
            'tanggal'                => $s->tanggal->format('Y-m-d'),
            'catatan'                => $s->catatan,
            'link_dokumen'           => $s->link_dokumen,
            'link_foto'              => $s->link_foto,
            'links'                  => $s->links ?? [],
            'handled_by'             => $s->handler->nama,
            'created_at'             => $s->created_at->format('Y-m-d H:i'),
        ];
    }

    /**
     * Rule closure: `catatan` maksimal $max kata (dipakai utk catatan wali kelas; BK bebas).
     * Hitung kata dgn pisah spasi/whitespace, abaikan token kosong.
     */
    private function maxWordsRule(int $max): \Closure
    {
        return function (string $attribute, $value, \Closure $fail) use ($max) {
            $words = array_filter(preg_split('/\s+/', trim((string) $value)) ?: [], fn ($w) => $w !== '');
            if (count($words) > $max) {
                $fail("Deskripsi penanganan wali kelas maksimal {$max} kata (saat ini ".count($words)." kata).");
            }
        };
    }

    // ── Riwayat Dokumen Penanganan ────────────────────────────────────────────

    // GET /handling-documents — daftar semua foto/PDF yang PERNAH diupload (bukan link
    // manual) lewat fitur dokumentasi penanganan siswa. Scope beda per kapabilitas:
    // admin/wakasek = semua sekolah, wali kelas = siswa di kelasnya sendiri (thn ajaran
    // aktif), guru lain (termasuk BK) = sesi yang dia buat sendiri. Reuse pola scoping
    // yang sama dengan EwsController::index()/UserResource::computeKapabilitas() —
    // JANGAN cek literal role 'wali_kelas'/'bk' (lihat Isu GK6, akun guru asli selalu
    // role='guru', status wali-kelas/BK adalah kapabilitas terpisah).
    public function documents(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->scopedDocuments($request)]);
    }

    // GET /handling-documents/download?path=... — download SATU dokumen dgn nama file
    // rapi (bukan nama acak hasil uniqid() di storage). `path` divalidasi harus ada di
    // scope dokumen yang boleh dilihat user ini, bukan sekadar percaya query param.
    public function downloadDocument(Request $request)
    {
        $request->validate(['path' => ['required', 'string']]);

        $doc = collect($this->scopedDocuments($request))->firstWhere('path', $request->path);
        abort_unless($doc, 404, 'Dokumen tidak ditemukan atau bukan milik Anda.');

        $ext = pathinfo($doc['path'], PATHINFO_EXTENSION);

        return Storage::disk('public')->download($doc['path'], $this->safeFilename($doc).'.'.$ext);
    }

    // GET /handling-documents/download-all — ZIP dokumen dalam scope user ini, DISUSUN
    // PER KELAS (tiap kelas = folder di dalam ZIP). Bila query `kelas` diisi (dari dropdown
    // filter kelas di FE), hanya kelas itu yang di-ZIP.
    public function downloadAllDocuments(Request $request)
    {
        $docs = $this->scopedDocuments($request);

        if ($request->filled('kelas')) {
            $docs = array_values(array_filter($docs, fn ($d) => $d['kelas'] === $request->kelas));
        }

        abort_if(empty($docs), 404, 'Tidak ada dokumen untuk diunduh.');

        $zipPath = tempnam(sys_get_temp_dir(), 'riwayat_dok_').'.zip';
        $zip = new \ZipArchive;
        $zip->open($zipPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);

        $usedNames = []; // simpan path lengkap (folder/nama) agar unik per folder kelas
        foreach ($docs as $doc) {
            if (! Storage::disk('public')->exists($doc['path'])) {
                continue;
            }
            $ext    = pathinfo($doc['path'], PATHINFO_EXTENSION);
            $folder = $this->safeKelasFolder($doc['kelas']);
            $base   = $this->safeFilename($doc, includeKelas: false);
            $name   = "{$base}.{$ext}";
            $i = 1;
            while (in_array("{$folder}/{$name}", $usedNames, true)) {
                $name = "{$base}_{$i}.{$ext}";
                $i++;
            }
            $usedNames[] = "{$folder}/{$name}";
            $zip->addFromString("{$folder}/{$name}", Storage::disk('public')->get($doc['path']));
        }
        $zip->close();

        $zipName = $request->filled('kelas')
            ? 'riwayat_dokumen_'.$this->safeKelasFolder($request->kelas).'.zip'
            : 'riwayat_dokumen_penanganan_'.now()->format('Y-m-d').'.zip';

        return response()->download($zipPath, $zipName)->deleteFileAfterSend(true);
    }

    // Nama folder kelas yang aman utk entri ZIP (mis. "XI Teknik Kimia Industri - A").
    private function safeKelasFolder(?string $kelas): string
    {
        $clean = preg_replace('/[^A-Za-z0-9 _-]/', '', str_replace('/', '-', (string) $kelas));

        return trim(preg_replace('/\s+/', '_', $clean), '_') ?: 'Tanpa_Kelas';
    }

    // $includeKelas=false dipakai saat file sudah masuk folder kelas di ZIP (agar nama
    // tidak mengulang kelas); =true (default) utk download satuan yang tanpa folder.
    private function safeFilename(array $doc, bool $includeKelas = true): string
    {
        $prefix = $includeKelas ? "{$doc['kelas']}_" : '';
        $raw = pathinfo("{$prefix}{$doc['nama_siswa']}_{$doc['tanggal']}_{$doc['nama_file']}", PATHINFO_FILENAME);
        $clean = preg_replace('/[^A-Za-z0-9 _-]/', '', str_replace('/', '-', $raw));

        return trim(preg_replace('/\s+/', '_', $clean), '_') ?: 'dokumen';
    }

    private function scopedDocuments(Request $request): array
    {
        $user = $request->user();

        // Siswa & orang tua tidak pernah punya dokumen penanganan "miliknya" di sini —
        // sebelumnya mereka lolos ke cabang `handled_by = $user->id` dan menerima daftar
        // kosong. Hasilnya kebetulan aman, bukan karena disengaja; tolak secara eksplisit
        // supaya perubahan cabang di masa depan tidak diam-diam membukanya.
        abort_if(ClassAccess::isStudentSide($user), 403, 'Akses tidak diizinkan.');

        $query = HandlingSession::with(['recommendation.student.user', 'recommendation.student.schoolClass', 'handler']);

        if (! in_array($user->role->value, ['admin', 'wakasek'], true)) {
            // Wali kelas boleh mengampu >1 kelas → scope ke SEMUA kelas perwaliannya
            // (bukan cuma satu via ->first()), supaya filter kelas di FE bermakna.
            $kelasWaliIds = SchoolClass::where('wali_kelas_id', $user->id)
                ->where('academic_year_id', \App\Support\TahunAjaran::id())
                ->pluck('id');

            if ($kelasWaliIds->isNotEmpty()) {
                $query->whereHas('recommendation.student', fn ($q) => $q->whereIn('class_id', $kelasWaliIds));
            } else {
                $query->where('handled_by', $user->id);
            }
        }

        $documents = [];
        foreach ($query->orderByDesc('tanggal')->get() as $s) {
            $student = $s->recommendation->student;
            $kelas = $student->schoolClass
                ? $student->schoolClass->label()
                : '-';

            foreach (($s->links ?? []) as $link) {
                if (empty($link['uploaded']) || empty($link['path'])) {
                    continue; // cuma file yang beneran diupload (punya `path`), bukan link tempel manual
                }

                $documents[] = [
                    'session_id' => $s->uuid,
                    'recommendation_id' => $s->recommendation->uuid,
                    'nama_siswa' => $student->user->nama ?? '-',
                    'kelas' => $kelas,
                    'tanggal' => $s->tanggal->format('Y-m-d'),
                    'diupload_oleh' => $s->handler->nama ?? '-',
                    'nama_file' => $link['keterangan'] ?? 'Dokumen',
                    'url' => $link['url'],
                    'path' => $link['path'],
                    'ukuran' => $link['size'] ?? null,
                    'tipe' => str_ends_with(strtolower($link['path']), '.pdf') ? 'pdf' : 'gambar',
                ];
            }
        }

        return $documents;
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
