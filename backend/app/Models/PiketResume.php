<?php

namespace App\Models;

use App\Support\TahunAjaran;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Resume Piket harian (gabungan per tanggal). Petugas jamak menyunting bersama;
 * teacher_id menandai penyunting terakhir.
 */
class PiketResume extends Model
{
    protected $fillable = ['academic_year_id', 'tanggal', 'teacher_id', 'ringkasan', 'kejadian_penting'];

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
}
