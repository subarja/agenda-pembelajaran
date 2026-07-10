<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Penempatan PKL satu siswa (tempat magang + rentang + guru pembimbing).
 */
class PklPlacement extends Model
{
    use HasAuditTrail, HasUuid, SoftDeletes;

    protected $fillable = [
        'student_id', 'class_id', 'academic_year_id', 'pembimbing_teacher_id',
        'tempat_pkl', 'alamat_pkl', 'tanggal_mulai', 'tanggal_selesai',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'tanggal_mulai'   => 'date',
            'tanggal_selesai' => 'date',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function pembimbing(): BelongsTo
    {
        return $this->belongsTo(Teacher::class, 'pembimbing_teacher_id');
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }
}
