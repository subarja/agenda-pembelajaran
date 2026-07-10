<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Agenda PKL mingguan (pengganti agenda reguler kelas XII saat Mode PKL).
 */
class PklAgenda extends Model
{
    use HasAuditTrail, HasUuid, SoftDeletes;

    protected $fillable = [
        'pembimbing_teacher_id', 'class_id', 'academic_year_id', 'minggu_mulai', 'catatan',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return ['minggu_mulai' => 'date'];
    }

    public function pembimbing(): BelongsTo
    {
        return $this->belongsTo(Teacher::class, 'pembimbing_teacher_id');
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function objectives(): BelongsToMany
    {
        return $this->belongsToMany(PklObjective::class, 'pkl_agenda_objective');
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(PklAttendance::class);
    }
}
