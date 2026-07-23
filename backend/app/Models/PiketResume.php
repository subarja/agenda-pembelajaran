<?php

namespace App\Models;

use App\Support\TahunAjaran;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Resume Piket PER SHIFT (sesi petugas), unik per (tanggal, piket_shift_id). Petugas satu
 * shift menyunting bersama; teacher_id = penyunting terakhir. `rekap` = snapshot JSON rekap
 * kehadiran/agenda/presensi sampai waktu resume dibuat.
 */
class PiketResume extends Model
{
    protected $fillable = ['academic_year_id', 'tanggal', 'piket_shift_id', 'teacher_id', 'ringkasan', 'kejadian_penting', 'rekap'];

    protected function casts(): array
    {
        return ['tanggal' => 'date', 'rekap' => 'array'];
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

    public function shift(): BelongsTo
    {
        return $this->belongsTo(PiketShift::class, 'piket_shift_id');
    }
}
