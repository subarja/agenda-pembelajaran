<?php

namespace App\Models;

use App\Enums\Semester;
use App\Traits\HasAuditTrail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class LearningObjective extends Model
{
    use HasAuditTrail, HasUuid, SoftDeletes;

    protected $fillable = [
        'subject_id', 'fase', 'academic_year_id',
        'kode', 'deskripsi', 'urutan', 'semester', 'aktif',
        'created_by', 'updated_by',
    ];

    // Kolom generated MySQL-only (lihat migrasi restructure_learning_objectives_by_fase)
    // untuk emulasi partial unique index — murni teknis, tidak relevan untuk konsumen API.
    protected $hidden = ['active_unique_flag'];

    protected function casts(): array
    {
        return [
            'semester' => Semester::class,
            'urutan'   => 'integer',
            'aktif'    => 'boolean',
        ];
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class, 'academic_year_id');
    }

    public function updatedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function agendas(): BelongsToMany
    {
        return $this->belongsToMany(Agenda::class, 'agenda_learning_objectives');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(LearningObjectiveLog::class);
    }
}
