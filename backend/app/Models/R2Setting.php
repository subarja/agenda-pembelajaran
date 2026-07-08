<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class R2Setting extends Model
{
    protected $fillable = [
        'access_key_id', 'secret_access_key', 'account_id', 'bucket', 'public_url', 'aktif',
    ];

    protected $casts = [
        // Dienkripsi pakai APP_KEY (Laravel encrypted cast) — beda dari CalendarSetting::api_key
        // yang plain text, krn kredensial R2 ini akses baca+tulis penuh ke seluruh bucket.
        'access_key_id'     => 'encrypted',
        'secret_access_key' => 'encrypted',
        'aktif'             => 'boolean',
    ];

    public static function instance(): self
    {
        return static::firstOrCreate([], ['aktif' => false]);
    }

    public function endpoint(): ?string
    {
        return $this->account_id ? "https://{$this->account_id}.r2.cloudflarestorage.com" : null;
    }

    public function isConfigured(): bool
    {
        return (bool) ($this->access_key_id && $this->secret_access_key && $this->account_id && $this->bucket && $this->public_url);
    }

    // Config disk 'public' siap pakai Storage::build()/config(['filesystems.disks.public' => ...]).
    public function diskConfig(): array
    {
        return [
            'driver' => 's3',
            'key' => $this->access_key_id,
            'secret' => $this->secret_access_key,
            'region' => 'auto',
            'bucket' => $this->bucket,
            'endpoint' => $this->endpoint(),
            'use_path_style_endpoint' => true,
            'url' => $this->public_url,
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ];
    }
}
