<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\CalendarSetting;
use App\Models\FcmSetting;
use App\Models\R2Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Ekspor/impor kredensial pengaturan (Penyimpanan R2, Notifikasi Push FCM, Kalender)
 * sebagai satu file JSON.
 *
 * Latar belakang: kredensial R2 & FCM disimpan TERENKRIPSI dengan APP_KEY. Kalau
 * proses update server sampai mengganti APP_KEY (mis. `cpanel-deploy.php?action=all`
 * yang ikut menjalankan `key:generate`), seluruh kredensial itu tidak bisa didekripsi
 * lagi dan tampak "hilang/kosong" — admin harus mengetik ulang semuanya dari dashboard
 * Cloudflare/Firebase. Dengan fitur ini admin cukup ekspor sekali sebelum update, lalu
 * impor lagi setelahnya: nilai dienkripsi ulang otomatis dengan APP_KEY yang sekarang.
 */
class CredentialTransferController extends Controller
{
    private const FILE_TYPE = 'agenda-pembelajaran-credentials';
    private const VERSION   = 1;

    // GET /admin/credentials/export — file JSON berisi kredensial DALAM BENTUK ASLI
    // (terdekripsi). Itu memang tujuannya: file harus tetap bisa diimpor ke server
    // dengan APP_KEY berbeda. Konsekuensinya file ini rahasia penuh — admin-only,
    // tidak pernah disimpan di server, dan frontend menamainya dengan jelas.
    public function export(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === UserRole::Admin, 403, 'Hanya admin yang dapat mengekspor kredensial.');

        $r2  = R2Setting::instance();
        $fcm = FcmSetting::instance();
        $cal = CalendarSetting::instance();

        return response()->json([
            'type'        => self::FILE_TYPE,
            'version'     => self::VERSION,
            'exported_at' => now()->toIso8601String(),
            'r2' => [
                'access_key_id'     => $this->readSecret(fn () => $r2->access_key_id),
                'secret_access_key' => $this->readSecret(fn () => $r2->secret_access_key),
                'account_id'        => $r2->account_id,
                'bucket'            => $r2->bucket,
                'public_url'        => $r2->public_url,
                'aktif'             => $r2->aktif,
            ],
            'fcm' => [
                'service_account_json' => $this->readSecret(fn () => $fcm->service_account_json),
                'project_id'           => $fcm->project_id,
                'web_api_key'          => $fcm->web_api_key,
                'web_app_id'           => $fcm->web_app_id,
                'messaging_sender_id'  => $fcm->messaging_sender_id,
                'vapid_public_key'     => $fcm->vapid_public_key,
                'aktif'                => $fcm->aktif,
            ],
            'calendar' => [
                'calendar_id'          => $cal->calendar_id,
                'ics_url'              => $cal->ics_url,
                'sync_method'          => $cal->sync_method,
                'api_key'              => $cal->api_key,
                'service_account_json' => $cal->service_account_json,
                'sync_months_ahead'    => $cal->sync_months_ahead,
            ],
        ]);
    }

    // POST /admin/credentials/import — terima file hasil export() dan tulis kembali.
    // Enkripsi ulang terjadi otomatis lewat cast 'encrypted' di model saat save.
    public function import(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === UserRole::Admin, 403, 'Hanya admin yang dapat mengimpor kredensial.');

        $request->validate([
            'file' => ['required', 'file', 'max:2048'], // JSON kredensial, jauh di bawah 2 MB
        ]);

        $payload = json_decode($request->file('file')->get(), true);

        if (! is_array($payload) || ($payload['type'] ?? null) !== self::FILE_TYPE) {
            return response()->json([
                'message' => 'File tidak dikenali. Gunakan file JSON hasil tombol "Ekspor Kredensial" dari aplikasi ini.',
            ], 422);
        }

        $imported = [];

        if (is_array($payload['r2'] ?? null)) {
            $this->importSection(R2Setting::instance(), $payload['r2'], [
                'access_key_id', 'secret_access_key', 'account_id', 'bucket', 'public_url',
            ]);
            $imported[] = 'Penyimpanan R2';
        }

        if (is_array($payload['fcm'] ?? null)) {
            $this->importSection(FcmSetting::instance(), $payload['fcm'], [
                'service_account_json', 'project_id', 'web_api_key', 'web_app_id',
                'messaging_sender_id', 'vapid_public_key',
            ]);
            $imported[] = 'Notifikasi Push';
        }

        if (is_array($payload['calendar'] ?? null)) {
            $this->importSection(CalendarSetting::instance(), $payload['calendar'], [
                'calendar_id', 'ics_url', 'sync_method', 'api_key',
                'service_account_json', 'sync_months_ahead',
            ], hasAktif: false);
            $imported[] = 'Kalender';
        }

        if (! $imported) {
            return response()->json(['message' => 'File valid tapi tidak berisi satu pun bagian kredensial.'], 422);
        }

        Log::info('Impor kredensial dijalankan', [
            'user_id'    => $request->user()->id,
            'user_email' => $request->user()->email,
            'sections'   => $imported,
        ]);

        return response()->json([
            'message' => 'Kredensial berhasil diimpor: ' . implode(', ', $imported) . '. Silakan cek kembali tab terkait lalu jalankan tes koneksi.',
        ]);
    }

    // Nilai kunci null/'' di file dilewati (bukan menghapus nilai tersimpan) — konsisten
    // dgn pola "kosong = jangan diubah" di form R2/FCM, dan menjaga file export dari
    // server yang APP_KEY-nya sudah berubah (field rahasianya null) tidak mengosongkan
    // kredensial yang masih sehat di server tujuan.
    private function importSection(R2Setting|FcmSetting|CalendarSetting $model, array $section, array $fields, bool $hasAktif = true): void
    {
        // Sembuhkan dulu kolom terenkripsi lama yang tak terdekripsi (APP_KEY server
        // sudah berganti — justru skenario utama fitur impor ini): save() Eloquent
        // MENDEKRIPSI nilai asli saat menghitung dirty (originalIsEquivalent), jadi
        // menimpa nilainya saja tidak cukup — kolom rusak di-null-kan langsung di DB
        // (query builder, tanpa cast) sebelum diisi nilai dari file.
        foreach ($fields as $field) {
            try {
                $model->{$field};
            } catch (\Throwable $e) {
                report($e);
                $model->newQuery()->whereKey($model->getKey())->update([$field => null]);
                $model->refresh();
            }
        }

        foreach ($fields as $field) {
            $value = $section[$field] ?? null;
            if ($value !== null && $value !== '') {
                $model->{$field} = $value;
            }
        }

        if ($hasAktif && array_key_exists('aktif', $section)) {
            $model->aktif = (bool) $section['aktif'];
            // isConfigured() membaca atribut terenkripsi — nilai LAMA yang tersisa di
            // server ini bisa saja tak terdekripsi (APP_KEY sudah berganti), jadi
            // kegagalannya disamakan dengan "belum lengkap".
            try {
                $configured = $model->isConfigured();
            } catch (\Throwable $e) {
                report($e);
                $configured = false;
            }
            if ($model->aktif && ! $configured) {
                $model->aktif = false;
            }
        }

        $model->save();
    }

    // Baca atribut terenkripsi tanpa meneruskan DecryptException — kalau APP_KEY server
    // ini sudah berubah sejak kredensial disimpan, bagian itu diekspor null saja
    // (yang masih terbaca tetap ikut), bukan seluruh export gagal 500.
    private function readSecret(callable $reader): ?string
    {
        try {
            return $reader();
        } catch (\Throwable $e) {
            report($e);

            return null;
        }
    }
}
