<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\R2Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class R2SettingController extends Controller
{
    // ── GET /admin/r2/settings ────────────────────────────────────────────────
    // access_key_id & secret_access_key TIDAK PERNAH dikirim mentah balik ke frontend
    // (beda dari CalendarSetting::api_key) — kredensial R2 ini akses baca+tulis penuh
    // ke seluruh bucket, bukan sekadar API key baca-saja Google Calendar.
    public function show(): JsonResponse
    {
        $r2 = $this->healRecoverInstance();
        [$accessKey, $secretKey] = $this->readCredentials($r2);

        return response()->json([
            'data' => [
                'access_key_id_masked' => $this->mask($accessKey),
                'secret_access_key_set' => (bool) $secretKey,
                'account_id' => $r2->account_id,
                'bucket' => $r2->bucket,
                'public_url' => $r2->public_url,
                'aktif' => $r2->aktif,
                'is_configured' => $r2->isConfigured(),
            ],
        ]);
    }

    // ── PUT /admin/r2/settings ────────────────────────────────────────────────
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'access_key_id' => ['sometimes', 'nullable', 'string', 'max:200'],
            'secret_access_key' => ['sometimes', 'nullable', 'string', 'max:500'],
            'account_id' => ['sometimes', 'nullable', 'string', 'max:100'],
            'bucket' => ['sometimes', 'nullable', 'string', 'max:200'],
            'public_url' => ['sometimes', 'nullable', 'url', 'max:500'],
            'aktif' => ['sometimes', 'boolean'],
        ]);

        $r2 = $this->healRecoverInstance();

        // Field rahasia: kosongkan input di form = "tidak diubah" (bukan dihapus) —
        // krn frontend tidak pernah menerima nilai aslinya balik utk ditampilkan ulang.
        // Pola sama dgn form ganti password pada umumnya.
        if (! empty($data['access_key_id'])) {
            $r2->access_key_id = $data['access_key_id'];
        }
        if (! empty($data['secret_access_key'])) {
            $r2->secret_access_key = $data['secret_access_key'];
        }
        $r2->fill(array_intersect_key($data, array_flip(['account_id', 'bucket', 'public_url', 'aktif'])));

        if (($data['aktif'] ?? $r2->aktif) && ! $r2->isConfigured()) {
            return response()->json(['message' => 'Lengkapi semua field (Access Key ID, Secret, Account ID, Bucket, Public URL) sebelum mengaktifkan R2.'], 422);
        }

        $r2->save();

        return response()->json(['message' => 'Pengaturan R2 disimpan.']);
    }

    // ── POST /admin/r2/test ───────────────────────────────────────────────────
    // Upload + hapus file kecil ke bucket pakai kredensial yang TERSIMPAN (bukan yang
    // baru diketik di form dan belum disimpan) — admin harus Simpan dulu baru Tes.
    public function test(): JsonResponse
    {
        $r2 = $this->healRecoverInstance();
        abort_unless($r2->isConfigured(), 422, 'Lengkapi & simpan semua field dulu sebelum tes koneksi.');

        try {
            $disk = Storage::build($r2->diskConfig());
            $path = 'connection-test/'.now()->timestamp.'.txt';
            $disk->put($path, 'agenda-pembelajaran connection test');
            $ok = $disk->exists($path);
            $disk->delete($path);

            abort_unless($ok, 422, 'File tes tidak ditemukan setelah diupload.');

            return response()->json(['message' => 'Koneksi ke R2 berhasil — upload & hapus file tes berjalan lancar.']);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Koneksi gagal: '.$e->getMessage()], 422);
        }
    }

    // Baca access_key_id/secret_access_key TANPA melempar exception ke pemanggil —
    // kalau APP_KEY server pernah berubah sejak kredensial disimpan, DecryptException
    // muncul di sini, ditangkap, dan baris rahasia otomatis direset (bukan seluruh app
    // ikut down seperti insiden 2026-07-08). Dipanggil dari show() sebelum is_configured().
    private function readCredentials(R2Setting $r2): array
    {
        try {
            return [$r2->access_key_id, $r2->secret_access_key];
        } catch (\Throwable $e) {
            report($e);

            return [null, null];
        }
    }

    // Kalau kredensial tersimpan sudah tidak bisa didekripsi, reset field rahasia +
    // nonaktifkan R2 (bukan hapus account_id/bucket/public_url — itu bukan rahasia,
    // tidak ada gunanya diisi ulang) supaya request berikutnya tidak crash lagi.
    private function healRecoverInstance(): R2Setting
    {
        $r2 = R2Setting::instance();

        try {
            $r2->isConfigured();

            return $r2;
        } catch (\Throwable $e) {
            report($e);
            R2Setting::query()->where('id', $r2->id)->update([
                'access_key_id' => null, 'secret_access_key' => null, 'aktif' => false,
            ]);

            return $r2->fresh();
        }
    }

    private function mask(?string $value): ?string
    {
        if (! $value) {
            return null;
        }

        return strlen($value) <= 4 ? str_repeat('•', strlen($value)) : str_repeat('•', strlen($value) - 4).substr($value, -4);
    }
}
