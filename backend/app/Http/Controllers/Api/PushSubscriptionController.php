<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FcmSetting;
use App\Models\PushSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PushSubscriptionController extends Controller
{
    /**
     * GET /push/config
     *
     * Konfigurasi web Firebase untuk frontend. Nilai-nilainya memang publik (ikut
     * terkirim ke browser setiap pengguna), tapi endpoint tetap di balik auth supaya
     * proyek Firebase sekolah tidak mudah dipetakan orang luar.
     *
     * `enabled:false` bukan kondisi error — aplikasi harus tetap jalan normal dengan
     * lonceng in-app saja selama admin belum menyetel Firebase.
     */
    public function config(): JsonResponse
    {
        $fcm = FcmSetting::instance();

        if (! $fcm->aktif || ! $fcm->isClientConfigured()) {
            return response()->json(['data' => ['enabled' => false]]);
        }

        return response()->json([
            'data' => [
                'enabled'          => true,
                'firebase'         => $fcm->webConfig(),
                'vapid_public_key' => $fcm->vapid_public_key,
            ],
        ]);
    }

    /** GET /push/devices — daftar perangkat yang menerima push untuk akun ini. */
    public function index(Request $request): JsonResponse
    {
        $devices = $request->user()->pushSubscriptions()->latest('last_used_at')->get()
            ->map(fn (PushSubscription $d) => [
                'id'           => $d->id,
                'device_label' => $d->device_label ?: 'Perangkat tidak dikenal',
                'last_used_at' => $d->last_used_at?->diffForHumans(),
                // Supaya frontend bisa menandai "perangkat ini" tanpa pernah menerima
                // token milik perangkat lain kembali dari server.
                'token_hint'   => substr($d->token, -12),
            ]);

        return response()->json(['data' => $devices]);
    }

    /** POST /push/devices — browser melapor token FCM-nya (juga dipanggil saat token dirotasi). */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token'        => ['required', 'string', 'max:512'],
            'device_label' => ['nullable', 'string', 'max:100'],
        ]);

        PushSubscription::remember(
            $request->user(),
            $data['token'],
            $data['device_label'] ?? null,
            $request->userAgent(),
        );

        return response()->json(['message' => 'Perangkat ini akan menerima notifikasi.']);
    }

    /**
     * DELETE /push/devices/{id} — cabut satu perangkat dari halaman Pengaturan.
     * Dibatasi ke perangkat milik sendiri lewat relasi, bukan lookup global.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $request->user()->pushSubscriptions()->where('id', $id)->delete();

        return response()->json(['message' => 'Perangkat dicabut dari notifikasi.']);
    }

    /**
     * POST /push/devices/unsubscribe — perangkat mencabut DIRINYA SENDIRI (tombol
     * matikan notifikasi, atau logout). Memakai token, bukan id, karena browser hanya
     * mengetahui tokennya sendiri.
     */
    public function unsubscribe(Request $request): JsonResponse
    {
        $data = $request->validate(['token' => ['required', 'string', 'max:512']]);

        $request->user()->pushSubscriptions()->where('token', $data['token'])->delete();

        return response()->json(['message' => 'Notifikasi di perangkat ini dimatikan.']);
    }
}
