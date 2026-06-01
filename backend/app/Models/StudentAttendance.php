<?php

namespace App\Models;

use App\Enums\AttendanceStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentAttendance extends Model
{
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
