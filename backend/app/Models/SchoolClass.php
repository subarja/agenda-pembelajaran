<?php

namespace App\Models;

use App\Enums\Tingkat;
use App\Traits\HasAuditTrail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SchoolClass extends Model
{
    use HasAuditTrail, HasUuid, SoftDeletes;

    protected $table = 'classes';

    protected $fillable = [
        'tingkat', 'jurusan', 'rombel',
        'wali_kelas_id', 'academic_year_id',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'tingkat' => Tingkat::class,
        ];
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function waliKelas(): BelongsTo
    {
        return $this->belongsTo(User::class, 'wali_kelas_id');
    }

    public function students(): HasMany
    {
        return $this->hasMany(Student::class, 'class_id');
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(Schedule::class, 'class_id');
    }

    public function learningObjectives(): HasMany
    {
        return $this->hasMany(LearningObjective::class, 'class_id');
    }
}
