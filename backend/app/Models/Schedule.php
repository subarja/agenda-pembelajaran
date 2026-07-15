<?php

namespace App\Models;

use App\Enums\Hari;
use App\Traits\HasAuditTrail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Schedule extends Model
{
    use HasAuditTrail, HasUuid, SoftDeletes;

    protected $fillable = [
        'class_id', 'subject_id', 'teacher_id',
        'hari', 'jam_ke_mulai', 'jam_ke_selesai', 'jam_mulai', 'jam_selesai', 'aktif',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'hari'           => Hari::class,
            'jam_ke_mulai'   => 'integer',
            'jam_ke_selesai' => 'integer',
            'aktif'          => 'boolean',
        ];
    }

    /**
     * Scope ke tahun ajaran tertentu (default: TA aktif) lewat kelasnya.
     *
     * Jadwal menempel ke kelas dan kelas menempel ke tahun ajaran — tanpa scope ini,
     * setelah pergantian tahun ajaran jadwal TA lama (masih aktif=true sebagai arsip)
     * ikut terbaca oleh dashboard guru/EWS/otorisasi dan menghasilkan sesi ganda.
     * SEMUA query operasional jadwal wajib memakai scope ini.
     */
    public function scopeTahunAjaran(Builder $q, ?int $academicYearId = null): Builder
    {
        $ayId = $academicYearId ?? AcademicYear::where('aktif', true)->value('id');

        // Instalasi baru tanpa TA sama sekali: jangan menyaring apa pun (tidak ada
        // data lintas tahun yang mungkin bocor).
        if ($ayId === null) {
            return $q;
        }

        return $q->whereHas('schoolClass', fn ($c) => $c->where('academic_year_id', $ayId));
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }

    public function agendas(): HasMany
    {
        return $this->hasMany(Agenda::class);
    }
}
