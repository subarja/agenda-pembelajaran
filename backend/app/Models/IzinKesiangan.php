<?php

namespace App\Models;

use App\Enums\IzinKesianganStatus;
use App\Support\TahunAjaran;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IzinKesiangan extends Model
{
    use HasUuid;

    protected $fillable = [
        'academic_year_id', 'student_id', 'tanggal', 'alasan', 'status',
        'waktu_tiba', 'terlambat_menit', 'diverifikasi_oleh', 'character_input_id',
    ];

    protected function casts(): array
    {
        return [
            'tanggal' => 'date',
            'status' => IzinKesianganStatus::class,
            'waktu_tiba' => 'datetime',
            'terlambat_menit' => 'integer',
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

    public function verifikator(): BelongsTo
    {
        return $this->belongsTo(Teacher::class, 'diverifikasi_oleh');
    }

    public function characterInput(): BelongsTo
    {
        return $this->belongsTo(CharacterInput::class);
    }
}
