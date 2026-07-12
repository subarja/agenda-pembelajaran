<?php

namespace App\Models;

use App\Enums\AttendanceStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentAttendance extends Model
{
    /**
     * Scope ke TA tertentu (default TA aktif) lewat agenda → jadwal → kelas.
     * Persentase kehadiran EWS/rekap dihitung per semester, bukan seumur hidup.
     */
    public function scopeTahunAjaran(Builder $q, ?int $academicYearId = null): Builder
    {
        $ayId = $academicYearId ?? AcademicYear::where('aktif', true)->value('id');

        if ($ayId === null) {
            return $q;
        }

        return $q->whereHas('agenda.schedule.schoolClass', fn ($c) => $c->where('academic_year_id', $ayId));
    }

    protected $fillable = [
        'student_id', 'agenda_id', 'status',
        'durasi_terlambat', 'catatan', 'lampiran_url',
    ];

    protected function casts(): array
    {
        return [
            'status'           => AttendanceStatus::class,
            'durasi_terlambat' => 'integer',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function agenda(): BelongsTo
    {
        return $this->belongsTo(Agenda::class);
    }
}
