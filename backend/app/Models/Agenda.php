<?php

namespace App\Models;

use App\Enums\AgendaStatus;
use App\Traits\HasAuditTrail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Agenda extends Model
{
    use HasAuditTrail, HasUuid, SoftDeletes;

    protected $fillable = [
        'schedule_id', 'tanggal', 'resume_kbm', 'status',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'tanggal' => 'date',
            'status'  => AgendaStatus::class,
        ];
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(Schedule::class);
    }

    public function learningObjectives(): BelongsToMany
    {
        return $this->belongsToMany(LearningObjective::class, 'agenda_learning_objectives');
    }

    public function teacherAttendance(): HasOne
    {
        return $this->hasOne(TeacherAttendance::class);
    }

    public function studentAttendances(): HasMany
    {
        return $this->hasMany(StudentAttendance::class);
    }

    public function characterInputs(): HasMany
    {
        return $this->hasMany(CharacterInput::class);
    }

    public function studentScores(): HasMany
    {
        return $this->hasMany(AgendaStudentScore::class);
    }
}
