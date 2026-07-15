<?php

namespace App\Models;

use App\Enums\AttendanceStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Absensi harian siswa selama projek kokurikuler — satu status per
 * (projek, siswa, tanggal), diisi fasilitator seperti presensi reguler.
 */
class KokurikulerAttendance extends Model
{
    protected $fillable = ['project_id', 'class_id', 'student_id', 'tanggal', 'status', 'recorded_by'];

    protected function casts(): array
    {
        return [
            'tanggal' => 'date',
            'status'  => AttendanceStatus::class,
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(KokurikulerProject::class, 'project_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
