<?php

namespace App\Models;

use App\Enums\Hari;
use App\Support\TahunAjaran;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Shift piket per hari-dalam-seminggu (scope tahun ajaran). Petugas tetap via pivot
 * piket_shift_teacher. Batas jam diperlakukan [jam_mulai, jam_selesai) di App\Support\PiketAccess.
 */
class PiketShift extends Model
{
    protected $fillable = ['academic_year_id', 'hari', 'nama_shift', 'jam_mulai', 'jam_selesai', 'urutan'];

    protected function casts(): array
    {
        return [
            'hari' => Hari::class,
            'urutan' => 'integer',
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

    public function teachers(): BelongsToMany
    {
        return $this->belongsToMany(Teacher::class, 'piket_shift_teacher')->withTimestamps();
    }
}
