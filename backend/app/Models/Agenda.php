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

    /**
     * Agenda yang menjadi tanggung jawab seorang guru — jadwalnya sendiri DIKURANGI sesi
     * yang ia alihkan lewat guru inval, DITAMBAH sesi guru lain yang dialihkan kepadanya.
     *
     * Ditulis sebagai scope (bukan disaring di PHP) supaya paginasi, penghitungan, dan
     * filter kelas tetap terjadi di database. Pencocokannya persis kunci yang sama dengan
     * `SessionTeacher`: pasangan (schedule_id, tanggal).
     */
    public function scopeUntukGuru(\Illuminate\Database\Eloquent\Builder $query, int $teacherId): \Illuminate\Database\Eloquent\Builder
    {
        $sesiInval = fn (string $kolomGuru) => function ($sub) use ($teacherId, $kolomGuru) {
            $sub->selectRaw('1')
                ->from('substitution_sessions as ss')
                ->join('substitution_requests as sr', 'sr.id', '=', 'ss.request_id')
                ->whereColumn('ss.schedule_id', 'agendas.schedule_id')
                ->whereColumn('ss.tanggal', 'agendas.tanggal')
                ->where('sr.status', 'disetujui')
                ->whereNull('sr.deleted_at')
                ->where("sr.{$kolomGuru}", $teacherId);
        };

        return $query->where(function ($q) use ($teacherId, $sesiInval) {
            $q->where(function ($milikSendiri) use ($teacherId, $sesiInval) {
                $milikSendiri
                    ->whereHas('schedule', fn ($s) => $s->where('teacher_id', $teacherId))
                    ->whereNotExists($sesiInval('requester_teacher_id'));
            })->orWhereExists($sesiInval('substitute_teacher_id'));
        });
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
