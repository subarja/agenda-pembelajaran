<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\FcmSetting;
use App\Models\PushSubscription;
use App\Services\FcmClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FcmSettingController extends Controller
{
    /**
     * GET /admin/fcm/settings
     *
     * service_account_json TIDAK PERNAH dikirim balik — isinya private key yang bisa
     * mengirim push ke seluruh perangkat proyek. Yang dikembalikan hanya `client_email`
     * di dalamnya, cukup bagi admin untuk mengenali service account mana yang terpasang.
     * Field klien (web_api_key dll.) dikirim apa adanya: nilainya memang publik dan
     * admin perlu melihatnya untuk mencocokkan dengan Firebase Console.
     */
    public function show(): JsonResponse
    {
        $fcm         = FcmSetting::instance();
        $credentials = $fcm->credentials();

        return response()->json([
            'data' => [
                'service_account_set'   => (bool) $credentials,
                'service_account_email' => $credentials['client_email'] ?? null,
                'project_id'            => $fcm->project_id,
                'web_api_key'           => $fcm->web_api_key,
                'web_app_id'            => $fcm->web_app_id,
                'messaging_sender_id'   => $fcm->messaging_sender_id,
                'vapid_public_key'      => $fcm->vapid_public_key,
                'aktif'                 => $fcm->aktif,
                'is_configured'         => $fcm->isConfigured(),
                'total_perangkat'       => PushSubscription::count(),
            ],
        ]);
    }

    /** PUT /admin/fcm/settings */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'service_account_json' => ['sometimes', 'nullable', 'string', 'max:8000'],
            'web_api_key'          => ['sometimes', 'nullable', 'string', 'max:200'],
            'web_app_id'           => ['sometimes', 'nullable', 'string', 'max:200'],
            'messaging_sender_id'  => ['sometimes', 'nullable', 'string', 'max:50'],
            'vapid_public_key'     => ['sometimes', 'nullable', 'string', 'max:500'],
            'aktif'                => ['sometimes', 'boolean'],
        ]);

        $fcm = FcmSetting::instance();

        // Field rahasia: dikosongkan di form = "jangan diubah" (bukan "hapus"), karena
        // frontend tidak pernah menerima nilai aslinya untuk diisi ulang. Pola sama
        // dengan R2SettingController dan form ganti password pada umumnya.
        if (! empty($data['service_account_json'])) {
            $parsed = json_decode($data['service_account_json'], true);

            if (! is_array($parsed) || ! isset($parsed['client_email'], $parsed['private_key'], $parsed['project_id'])) {
                return response()->json([
                    'message' => 'Service account tidak valid. Tempelkan seluruh isi file JSON dari Firebase Console > Project Settings > Service Accounts > Generate new private key.',
                ], 422);
            }

            $fcm->service_account_json = $data['service_account_json'];
            // project_id diambil dari JSON, tidak diketik manual — salah ketik di sini
            // menghasilkan 404 dari FCM yang sangat sulit didiagnosis dari sisi admin.
            $fcm->project_id = $parsed['project_id'];
        }

        $fcm->fill(array_intersect_key($data, array_flip([
            'web_api_key', 'web_app_id', 'messaging_sender_id', 'vapid_public_key', 'aktif',
        ])));

        if (($data['aktif'] ?? $fcm->aktif) && ! $fcm->isConfigured()) {
            return response()->json([
                'message' => 'Lengkapi service account JSON, Web API Key, App ID, Sender ID, dan VAPID public key sebelum mengaktifkan push.',
            ], 422);
        }

        $fcm->save();

        return response()->json(['message' => 'Pengaturan Firebase disimpan.']);
    }

    /**
     * POST /admin/fcm/test — kirim push percobaan ke perangkat admin yang sedang login.
     *
     * Sengaja MELEWATI preferensi & jam tenang: ini aksi eksplisit yang baru saja
     * diminta admin, menahannya karena kebetulan sekarang pukul 22:00 hanya akan
     * terlihat seperti fitur yang rusak.
     */
    public function test(Request $request): JsonResponse
    {
        $fcm = FcmSetting::instance();

        abort_unless($fcm->isServerConfigured(), 422, 'Simpan service account Firebase yang valid dulu sebelum tes.');
        abort_unless($fcm->aktif, 422, 'Aktifkan push notification dulu sebelum tes.');

        $tokens = $request->user()->pushSubscriptions()->pluck('token')->all();

        if ($tokens === []) {
            return response()->json([
                'message' => 'Belum ada perangkat terdaftar untuk akun Anda. Buka Pengaturan Notifikasi dan izinkan notifikasi di browser ini dulu.',
            ], 422);
        }

        $result = (new FcmClient($fcm))->send($tokens, [
            'type'  => 'info',
            'title' => 'Tes notifikasi berhasil',
            'body'  => 'Push notification dari Agenda Pembelajaran sudah aktif di perangkat ini.',
            'url'   => '/pengaturan/notifikasi',
        ]);

        if ($result['pruned'] !== []) {
            PushSubscription::whereIn('token', $result['pruned'])->delete();
        }

        if ($result['sent'] === 0) {
            return response()->json([
                'message' => "Push gagal terkirim ke {$result['failed']} perangkat. Periksa kembali service account & Sender ID, lalu lihat log aplikasi.",
            ], 422);
        }

        return response()->json([
            'message' => "Push terkirim ke {$result['sent']} perangkat.".
                ($result['failed'] > 0 ? " {$result['failed']} perangkat gagal/kedaluwarsa dan sudah dibersihkan." : ''),
        ]);
    }
}
