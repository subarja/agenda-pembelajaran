<?php

namespace App\Models;

use App\Enums\IzinKeluarStatus;
use App\Support\TahunAjaran;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class IzinKeluar extends Model
{
    use HasUuid;

    protected $fillable = [
        'academic_year_id', 'student_id', 'tanggal', 'keperluan', 'alasan', 'status',
        'diproses_oleh', 'berlaku_dari', 'berlaku_sampai', 'qr_token',
        'waktu_keluar', 'scan_keluar_oleh', 'waktu_masuk', 'scan_masuk_oleh', 'catatan_piket',
        'terlambat_dinotifikasi',
    ];

    protected function casts(): array
    {
        return [
            'tanggal' => 'date',
            'status' => IzinKeluarStatus::class,
            'berlaku_dari' => 'datetime',
            'berlaku_sampai' => 'datetime',
            'waktu_keluar' => 'datetime',
            'waktu_masuk' => 'datetime',
            'terlambat_dinotifikasi' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $m) {
            $m->academic_year_id ??= TahunAjaran::id();
        });
    }

    public function scopeTahunAjaran(Builder $q): Builder
    {
        return $q->where('academic_year_id', TahunAjaran::id());
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function pemroses(): BelongsTo
    {
        return $this->belongsTo(Teacher::class, 'diproses_oleh');
    }

    public function scanKeluar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'scan_keluar_oleh');
    }

    public function scanMasuk(): BelongsTo
    {
        return $this->belongsTo(User::class, 'scan_masuk_oleh');
    }

    /**
     * QR token ditandatangani server (HMAC) & terikat (izin, siswa, nonce). Tidak bisa
     * dipalsukan tanpa APP_KEY, dan karena disimpan unik di DB juga tak bisa dipakai
     * dua izin/dua siswa. Dipanggil piket saat menyetujui.
     */
    public function generateQrToken(): string
    {
        $nonce = Str::random(16);
        $payload = "{$this->uuid}|{$this->student->uuid}|{$nonce}";

        return hash_hmac('sha256', $payload, (string) config('app.key'));
    }
}
