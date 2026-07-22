<?php

namespace App\Models;

use App\Support\TahunAjaran;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Penugasan guru piket per tanggal (scope tahun ajaran). Satu hari boleh >1 petugas.
 */
class PiketAssignment extends Model
{
    protected $fillable = ['academic_year_id', 'tanggal', 'teacher_id', 'dibuat_oleh'];

    protected function casts(): array
    {
        return ['tanggal' => 'date'];
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

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }

    public function pembuat(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dibuat_oleh');
    }
}
