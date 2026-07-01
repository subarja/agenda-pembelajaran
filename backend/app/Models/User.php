<?php

namespace App\Models;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, HasUuid, Notifiable, SoftDeletes;

    protected $fillable = [
        'nama', 'email', 'password', 'role', 'status', 'nomor_hp',
        'linked_student_id', 'current_academic_year_id', 'created_by', 'updated_by',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed',
            'role'              => UserRole::class,
            'status'            => UserStatus::class,
        ];
    }

    public function teacher(): HasOne
    {
        return $this->hasOne(Teacher::class);
    }

    public function student(): HasOne
    {
        return $this->hasOne(Student::class);
    }

    // Untuk orang_tua: siswa yang dipantau
    public function linkedStudent(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Student::class, 'linked_student_id');
    }

    public function currentAcademicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class, 'current_academic_year_id');
    }

    public function managedClasses(): HasMany
    {
        return $this->hasMany(SchoolClass::class, 'wali_kelas_id');
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class);
    }

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class, 'generated_by');
    }

    public function recommendations(): HasMany
    {
        return $this->hasMany(Recommendation::class, 'ditugaskan_ke');
    }

    public function loadProfileRelation(): static
    {
        $this->load('currentAcademicYear');

        return match ($this->role) {
            UserRole::Guru,
            UserRole::WaliKelas,
            UserRole::BK,
            UserRole::Wakasek => $this->load('teacher'),
            UserRole::Siswa   => $this->load(['student', 'student.schoolClass']),
            UserRole::OrangTua => $this->load(['linkedStudent', 'linkedStudent.schoolClass']),
            default           => $this,
        };
    }
}
