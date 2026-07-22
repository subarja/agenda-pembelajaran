<?php

namespace App\Http\Controllers\Api;

use App\Enums\BellEvent;
use App\Http\Controllers\Controller;
use App\Models\BellAudio;
use App\Models\BellDevice;
use App\Models\BellRingLog;
use App\Support\BellRingPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/**
 * Pemutar bel (kiosk). Halaman perangkat di PC/HP tersambung speaker mengambil "jadwal bunyi
 * hari ini", memutar via Web Audio API, lalu melapor heartbeat & log tiap bunyi.
 *
 * Strategi cPanel: TANPA websocket. Kiosk cache jadwal hari ini + tick lokal 1 dtk + sinkron 60 dtk.
 * Baca jadwal bersifat publik (jam bel bukan data pribadi); tulis (heartbeat/log) butuh token perangkat.
 */
class BellPlayerController extends Controller
{
    // ── GET /bel/hari-ini?device_token= ──────────────────────────────────────
    public function hariIni(Request $request): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();

        // Registrasi/heartbeat ringan bila token perangkat valid dikirim.
        if ($token = $request->query('device_token')) {
            BellDevice::where('token', $token)->where('aktif', true)
                ->update(['last_heartbeat_at' => now()]);
        }

        // Audio siap-pakai untuk bel manual/darurat (tidak dijadwalkan otomatis).
        $manual = BellAudio::where('aktif', true)
            ->whereIn('kategori', ['darurat', 'khusus', 'upacara', 'murottal'])
            ->orderBy('kategori')->get()
            ->map(fn ($a) => ['id' => $a->id, 'nama' => $a->nama, 'kategori' => $a->kategori->value, 'url' => $a->url()]);

        return response()->json(['data' => [
            'tanggal' => $tanggal,
            'server_time' => Carbon::now('Asia/Jakarta')->format('H:i:s'),
            'events' => BellRingPlan::forDate($tanggal),
            'manual_audios' => $manual,
        ]]);
    }

    // ── POST /bel/heartbeat ──────────────────────────────────────────────────
    public function heartbeat(Request $request): JsonResponse
    {
        $device = $this->device($request);
        $device->update(['last_heartbeat_at' => now()]);

        return response()->json(['ok' => true, 'server_time' => Carbon::now('Asia/Jakarta')->format('H:i:s')]);
    }

    // ── POST /bel/ring-log ───────────────────────────────────────────────────
    public function ringLog(Request $request): JsonResponse
    {
        $device = $this->device($request);
        $data = $request->validate([
            'jenis_event' => ['required', Rule::in(BellEvent::values())],
            'waktu' => ['required', 'date_format:H:i:s'],
            'bell_audio_id' => ['nullable', 'integer', 'exists:bell_audios,id'],
            'status' => ['required', Rule::in(['berhasil', 'gagal', 'dilewati'])],
            'keterangan' => ['nullable', 'string', 'max:255'],
        ]);

        BellRingLog::create([
            'tanggal' => Carbon::now('Asia/Jakarta')->toDateString(),
            'waktu' => $data['waktu'],
            'jenis_event' => $data['jenis_event'],
            'bell_audio_id' => $data['bell_audio_id'] ?? null,
            'bell_device_id' => $device->id,
            'status' => $data['status'],
            'keterangan' => $data['keterangan'] ?? null,
        ]);

        return response()->json(['ok' => true]);
    }

    // ── POST /bel/manual — bel manual/darurat dari operator kiosk (audit) ─────
    public function manual(Request $request): JsonResponse
    {
        $device = $this->device($request);
        $data = $request->validate([
            'jenis_event' => ['required', Rule::in(BellEvent::values())],
            'bell_audio_id' => ['nullable', 'integer', 'exists:bell_audios,id'],
            'keterangan' => ['nullable', 'string', 'max:255'],
        ]);

        BellRingLog::create([
            'tanggal' => Carbon::now('Asia/Jakarta')->toDateString(),
            'waktu' => Carbon::now('Asia/Jakarta')->format('H:i:s'),
            'jenis_event' => $data['jenis_event'],
            'bell_audio_id' => $data['bell_audio_id'] ?? null,
            'bell_device_id' => $device->id,
            'status' => 'berhasil',
            'keterangan' => $data['keterangan'] ?? 'Bel manual',
        ]);

        return response()->json(['ok' => true, 'message' => 'Bel manual dicatat.']);
    }

    /** Perangkat terverifikasi dari token; 403 bila token tidak valid/nonaktif. */
    private function device(Request $request): BellDevice
    {
        $token = $request->input('device_token', $request->query('device_token'));
        $device = $token ? BellDevice::where('token', $token)->where('aktif', true)->first() : null;

        abort_if(! $device, 403, 'Perangkat pemutar tidak dikenali.');

        return $device;
    }
}
