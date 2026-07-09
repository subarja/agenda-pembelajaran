<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FcmSetting extends Model
{
    protected $fillable = [
        'service_account_json', 'project_id',
        'web_api_key', 'web_app_id', 'messaging_sender_id', 'vapid_public_key',
        'aktif',
    ];

    protected $casts = [
        // Berisi private key yang boleh mengirim push ke seluruh perangkat proyek —
        // dienkripsi APP_KEY, sama seperti R2Setting::secret_access_key. Field klien
        // (web_api_key dll.) sengaja TIDAK dienkripsi: nilainya memang dikirim ke
        // browser setiap pengguna, mengenkripsinya cuma menyulitkan tanpa menambah aman.
        'service_account_json' => 'encrypted',
        'aktif'                => 'boolean',
    ];

    public static function instance(): self
    {
        return static::firstOrCreate([], ['aktif' => false]);
    }

    /**
     * Service account terurai. null kalau kosong, bukan JSON valid, atau tidak bisa
     * didekripsi.
     *
     * DecryptException ditelan di sini dengan sengaja: kalau APP_KEY server pernah
     * berubah sejak kredensial disimpan, satu-satunya akibat yang benar adalah push mati
     * sampai admin mengisi ulang — bukan setiap request yang memicu notifikasi ikut
     * runtuh (insiden 2026-07-08 pada R2Setting).
     */
    public function credentials(): ?array
    {
        try {
            if (! $this->service_account_json) {
                return null;
            }

            $decoded = json_decode($this->service_account_json, true);
        } catch (\Throwable $e) {
            report($e);

            return null;
        }

        return is_array($decoded) && isset($decoded['client_email'], $decoded['private_key'])
            ? $decoded
            : null;
    }

    /** Cukup untuk MENGIRIM push dari server. */
    public function isServerConfigured(): bool
    {
        return (bool) ($this->project_id && $this->credentials());
    }

    /** Cukup untuk browser MENDAFTARKAN diri & memperoleh token. */
    public function isClientConfigured(): bool
    {
        return (bool) ($this->web_api_key && $this->web_app_id && $this->messaging_sender_id && $this->vapid_public_key && $this->project_id);
    }

    public function isConfigured(): bool
    {
        return $this->isServerConfigured() && $this->isClientConfigured();
    }

    /** Dikirim apa adanya ke frontend untuk firebase.initializeApp(). */
    public function webConfig(): array
    {
        return [
            'apiKey'            => $this->web_api_key,
            'authDomain'        => $this->project_id ? "{$this->project_id}.firebaseapp.com" : null,
            'projectId'         => $this->project_id,
            'messagingSenderId' => $this->messaging_sender_id,
            'appId'             => $this->web_app_id,
        ];
    }
}
