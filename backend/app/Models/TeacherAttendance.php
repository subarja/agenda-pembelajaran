<?php

namespace App\Models;

use App\Enums\TeacherAttendanceStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TeacherAttendance extends Model
{
    protected $fillable = [
        'teacher_id', 'agenda_id', 'status', 'bukti_url', 'catatan',
    ];

    protected function casts(): array
    {
        return [
            'status' => TeacherAttendanceStatus::class,
        ];
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
