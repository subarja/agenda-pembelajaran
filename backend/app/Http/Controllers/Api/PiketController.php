<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PiketAssignment;
use App\Support\BellRingPlan;
use App\Support\PiketAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Dashboard Piket (guru piket hari itu). Sprint 3: pandangan bel real-time (bel berjalan,
 * berikutnya, sebelumnya) + daftar petugas hari ini. Izin keluar/kesiangan/absensi/resume
 * menyusul di sprint berikutnya. Semua endpoint diproteksi PiketAccess::isPetugas.
 */
class PiketController extends Controller
{
    // ── GET /piket/ringkasan ─────────────────────────────────────────────────
    public function ringkasan(Request $request): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);

        $petugas = PiketAssignment::tahunAjaran()
            ->with('teacher.user')
            ->where('tanggal', $tanggal)
            ->get()
            ->map(fn ($a) => $a->teacher?->user?->nama)
            ->filter()->values();

        return response()->json(['data' => [
            'tanggal' => $tanggal,
            'server_time' => Carbon::now('Asia/Jakarta')->format('H:i:s'),
            'petugas' => $petugas,
            'events' => BellRingPlan::forDate($tanggal),
        ]]);
    }

    /** Abort 403 bila user bukan petugas piket pada tanggal itu. */
    private function pastikanPetugas(Request $request, string $tanggal): void
    {
        abort_unless(PiketAccess::isPetugas($request->user(), $tanggal), 403, 'Anda tidak bertugas piket hari ini.');
    }
}
