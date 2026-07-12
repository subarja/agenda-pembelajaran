<?php

namespace App\Models;

use App\Enums\CharacterSign;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CharacterInput extends Model
{
    protected $fillable = [
        'academic_year_id', 'student_id', 'subitem_id', 'teacher_id',
        'agenda_id', 'sign', 'catatan',
    ];

    protected function casts(): array
    {
        return [
            'sign' => CharacterSign::class,
        ];
    }

    // Poin karakter dihitung & dilaporkan per semester (selaras ews_statuses per TA).
    // Default diisi di model, bukan di tiap controller, supaya jalur input mana pun
    // (guru, inval, seeder Eloquent) tidak bisa lupa menandainya.
    protected static function booted(): void
    {
        static::creating(function (self $m) {
            $m->academic_year_id ??= AcademicYear::where('aktif', true)->value('id');
        });
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    /** Scope ke TA tertentu (default TA aktif) — semua tampilan/laporan poin per semester. */
    public function scopeTahunAjaran(Builder $q, ?int $academicYearId = null): Builder
    {
        $ayId = $academicYearId ?? AcademicYear::where('aktif', true)->value('id');

        return $ayId === null ? $q : $q->where('academic_year_id', $ayId);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function subitem(): BelongsTo
    {
        return $this->belongsTo(CharacterSubitem::class, 'subitem_id');
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }

    public function agenda(): BelongsTo
    {
        return $this->belongsTo(Agenda::class);
    }
}
