<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgendaStudentScore extends Model
{
    protected $fillable = [
        'agenda_id', 'student_id', 'teacher_id', 'nilai', 'catatan',
    ];

    protected function casts(): array
    {
        return ['nilai' => 'integer'];
    }

    public function agenda(): BelongsTo
    {
        return $this->belongsTo(Agenda::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }
}
