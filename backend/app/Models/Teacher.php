<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Teacher extends Model
{
    use HasAuditTrail, HasUuid, SoftDeletes;

    protected $fillable = [
        'user_id', 'gelar_depan', 'gelar_belakang',
        'nip', 'nuptk', 'mapel_utama', 'nomor_hp', 'is_bk',
        'jk', 'tempat_lahir', 'tanggal_lahir', 'status_kepegawaian',
        'jenis_ptk', 'agama', 'nik',
        'created_by', 'updated_by',
    ];

    protected $casts = [
        'is_bk'         => 'boolean',
        'tanggal_lahir' => 'date',
    ];

    public function getNamaLengkapAttribute(): string
    {
        $nama = $this->user->nama ?? '';
        $full = $this->gelar_depan ? $this->gelar_depan . ' ' . $nama : $nama;
        return $this->gelar_belakang ? $full . ', ' . $this->gelar_belakang : $full;
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(Schedule::class);
    }

    public function learningObjectives(): HasMany
    {
        return $this->hasMany(LearningObjective::class);
    }

    public function characterInputs(): HasMany
    {
        return $this->hasMany(CharacterInput::class);
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(TeacherAttendance::class);
    }
}
