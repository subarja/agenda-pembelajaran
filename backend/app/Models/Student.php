<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Student extends Model
{
    use HasAuditTrail, HasUuid, SoftDeletes;

    protected $fillable = [
        'user_id', 'nis', 'nisn', 'class_id', 'angkatan',
        'status', 'tanggal_keluar',
        'nama_ayah', 'nama_ibu', 'hp_ortu',
        'wali_nama', 'wali_kontak', 'foto',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'angkatan'       => 'integer',
            'tanggal_keluar' => 'date',
        ];
    }

    /** Hanya siswa berstatus aktif — daftar operasional (bukan arsip alumni/pindahan). */
    public function scopeAktif(\Illuminate\Database\Eloquent\Builder $q): \Illuminate\Database\Eloquent\Builder
    {
        return $q->where('students.status', 'aktif');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(StudentAttendance::class);
    }

    public function pklPlacements(): HasMany
    {
        return $this->hasMany(PklPlacement::class);
    }

    public function characterInputs(): HasMany
    {
        return $this->hasMany(CharacterInput::class);
    }

    public function recommendations(): HasMany
    {
        return $this->hasMany(Recommendation::class);
    }

    public function ewsStatus(): HasOne
    {
        return $this->hasOne(EwsStatus::class);
    }

    public function notes(): MorphMany
    {
        return $this->morphMany(Note::class, 'target');
    }
}
