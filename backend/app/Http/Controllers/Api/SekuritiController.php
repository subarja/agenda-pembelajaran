<?php

namespace App\Http\Controllers\Api;

use App\Enums\IzinKeluarStatus;
use App\Http\Controllers\Controller;
use App\Models\IzinKeluar;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * Sisi SEKURITI (role sekuriti): memindai QR izin keluar. Satu QR = satu izin, sekali siklus
 * keluar lalu masuk. Server TIDAK percaya payload mentah: token dicari di DB (hanya server
 * yang bisa membuatnya via HMAC), lalu status & masa berlaku divalidasi.
 */
class SekuritiController extends Controller
{
    // ── POST /sekuriti/scan {qr_token} ───────────────────────────────────────
    public function scan(Request $request): JsonResponse
    {
        $data = $request->validate(['qr_token' => ['required', 'string', 'max:128']]);

        $izin = IzinKeluar::with('student.user', 'student.schoolClass')
            ->where('qr_token', $data['qr_token'])
            ->first();

        if (! $izin) {
            return response()->json(['ok' => false, 'message' => 'QR tidak dikenali atau sudah tidak berlaku.'], 422);
        }

        $now = Carbon::now('Asia/Jakarta');

        // KELUAR: izin disetujui + dalam masa berlaku.
        if ($izin->status === IzinKeluarStatus::Disetujui) {
            if ($izin->berlaku_dari && $now->lt($izin->berlaku_dari)) {
                return response()->json(['ok' => false, 'message' => 'Belum masuk masa berlaku izin.'], 422);
            }
            if ($izin->berlaku_sampai && $now->gt($izin->berlaku_sampai)) {
                return response()->json(['ok' => false, 'message' => 'Masa berlaku izin sudah lewat.'], 422);
            }

            $izin->update([
                'status' => IzinKeluarStatus::Keluar,
                'waktu_keluar' => $now,
                'scan_keluar_oleh' => $request->user()->id,
            ]);

            return response()->json(['ok' => true, 'arah' => 'keluar', 'message' => 'Siswa keluar tercatat.', 'data' => $this->kartu($izin, 'keluar')]);
        }

        // MASUK: sudah keluar, scan lagi (QR sama). Masa berlaku TIDAK menghalangi kembali
        // (siswa yang telat pulang tetap harus bisa masuk & tercatat).
        if ($izin->status === IzinKeluarStatus::Keluar) {
            $izin->update([
                'status' => IzinKeluarStatus::Kembali,
                'waktu_masuk' => $now,
                'scan_masuk_oleh' => $request->user()->id,
            ]);

            return response()->json(['ok' => true, 'arah' => 'masuk', 'message' => 'Siswa kembali tercatat.', 'data' => $this->kartu($izin, 'masuk')]);
        }

        return response()->json([
            'ok' => false,
            'message' => 'Izin ini berstatus "'.$izin->status->label().'", tidak bisa dipindai.',
        ], 422);
    }

    // ── GET /sekuriti/log — riwayat scan hari ini ────────────────────────────
    public function log(Request $request): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();

        $log = IzinKeluar::with('student.user')
            ->where('tanggal', $tanggal)
            ->whereNotNull('waktu_keluar')
            ->orderByDesc('waktu_keluar')
            ->get()
            ->map(fn ($i) => [
                'nama' => $i->student?->user?->nama,
                'keperluan' => $i->keperluan,
                'status_label' => $i->status->label(),
                'waktu_keluar' => $i->waktu_keluar?->format('H:i'),
                'waktu_masuk' => $i->waktu_masuk?->format('H:i'),
            ]);

        return response()->json(['data' => $log]);
    }

    /** Kartu identitas untuk konfirmasi visual sekuriti. */
    private function kartu(IzinKeluar $izin, string $arah): array
    {
        return [
            'nama' => $izin->student?->user?->nama,
            'kelas' => $izin->student?->schoolClass?->label(),
            'foto_url' => $izin->student?->foto ? Storage::disk('public')->url($izin->student->foto) : null,
            'keperluan' => $izin->keperluan,
            'arah' => $arah,
            'waktu' => Carbon::now('Asia/Jakarta')->format('H:i'),
        ];
    }
}
