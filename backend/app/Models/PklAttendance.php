<?php

namespace App\Models;

use App\Enums\AttendanceStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Presensi PKL harian satu siswa pada satu tanggal.
 */
class PklAttendance extends Model
{
    protected $fillable = ['pkl_agenda_id', 'student_id', 'tanggal', 'status'];

    protected function casts(): array
    {
        return [
            'tanggal' => 'date',
            'status'  => AttendanceStatus::class,
        ];
    }

    public function agenda(): BelongsTo
    {
        return $this->belongsTo(PklAgenda::class, 'pkl_agenda_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
