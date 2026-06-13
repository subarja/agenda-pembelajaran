<?php

namespace App\Http\Controllers\Api;

use App\Enums\RecommendationStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\AgendaStudentScore;
use App\Models\CharacterInput;
use App\Models\HandlingSession;
use App\Models\Note;
use App\Models\Recommendation;
use App\Models\Student;
use App\Models\StudentAttendance;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecommendationController extends Controller
{
    // ── Admin: tambah catatan + sarankan penangan ─────────────────────────────

    // PUT /recommendations/{uuid}/admin-note
    public function updateAdminNote(Request $request, string $uuid): JsonResponse
    {
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

    // ── Wali Kelas: kelola sesi penanganan ────────────────────────────────────

    // POST /recommendations/{uuid}/sessions
    public function storeSession(Request $request, string $uuid): JsonResponse
    {
        $rec  = Recommendation::where('uuid', $uuid)->firstOrFail();
        $user = $request->user();

        $this->authorizeWaliKelasOrAbove($request, $rec);

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
            'tanggal'           => $data['tanggal'],
            'catatan'           => $data['catatan'],
            'link_dokumen'      => $data['link_dokumen'] ?? null,
            'link_foto'         => $data['link_foto'] ?? null,
            'links'             => $data['links'] ?? null,
        ]);

        // Otomatis update status rekomendasi ke proses jika masih pending
        if ($rec->status->value === 'pending') {
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

        $session->delete();

        return response()->json(['message' => 'Catatan dihapus.']);
    }

    // PUT /recommendations/{uuid}/status — wali kelas tandai menunggu verifikasi
    public function updateStatus(Request $request, string $uuid): JsonResponse
    {
        $rec  = Recommendation::where('uuid', $uuid)->firstOrFail();
        $role = $request->user()->role->value;

        $data = $request->validate([
            'status' => ['required', 'in:proses,menunggu_verifikasi,diabaikan'],
        ]);

        // Hanya wali kelas yang boleh tandai menunggu verifikasi/proses/abaikan
        abort_if(
            ! in_array($role, ['wali_kelas', 'admin', 'wakasek']),
            403, 'Tidak memiliki akses.'
        );

        $rec->update(['status' => RecommendationStatus::from($data['status'])]);

        return response()->json(['message' => 'Status diperbarui.']);
    }

    // ── Laporan riwayat penanganan (PDF, siap cetak) ──────────────────────────

    // GET /students/{studentUuid}/handling-report?format=pdf
    public function handlingReport(Request $request, string $studentUuid)
    {
        $student = Student::where('uuid', $studentUuid)
            ->with(['user', 'schoolClass.waliKelas'])
            ->firstOrFail();

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

        $data = [
            'student'   => $student,
            'recs'      => $recs,
            'wali'      => $student->schoolClass?->waliKelas,
            'generated' => now('Asia/Jakarta')->format('d M Y H:i'),
            'report_id' => strtoupper(\Illuminate\Support\Str::random(8)),
            'ews'       => $ews,
        ];

        return Pdf::loadView('reports.handling', $data)
            ->setPaper('a4', 'portrait')
            ->download("Riwayat_Penanganan_{$student->user->nama}.pdf");
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

    // ── Helper: format sesi ───────────────────────────────────────────────────

    private function formatSession(HandlingSession $s): array
    {
        return [
            'id'           => $s->uuid,
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

    private function authorizeWaliKelasOrAbove(Request $request, Recommendation $rec): void
    {
        $role = $request->user()->role->value;
        if (in_array($role, ['admin', 'wakasek', 'bk'])) return;

        // Wali kelas hanya untuk siswa binaannya
        if ($role === 'wali_kelas') {
            $student = Student::find($rec->student_id);
            abort_if(
                $student?->schoolClass?->wali_kelas_id !== $request->user()->id,
                403, 'Anda bukan wali kelas siswa ini.'
            );
            return;
        }

        abort(403, 'Tidak memiliki akses.');
    }
}
