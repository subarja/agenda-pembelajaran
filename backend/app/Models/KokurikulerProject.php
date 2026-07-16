<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Projek kokurikuler ringkas: absen harian, laporan fasilitator, refleksi siswa,
 * dan tautan dokumen hasil per tim. Status: draft (belum terlihat peserta),
 * aktif (berjalan), selesai (read-only untuk peserta).
 */
class KokurikulerProject extends Model
{
    use HasAuditTrail, HasUuid, SoftDeletes;

    protected $fillable = [
        'academic_year_id', 'judul', 'tema', 'tingkat', 'tujuan', 'deskripsi',
        'tanggal_mulai', 'tanggal_selesai', 'status',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'tanggal_mulai'   => 'date',
            'tanggal_selesai' => 'date',
        ];
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function projectClasses(): HasMany
    {
        return $this->hasMany(KokurikulerProjectClass::class, 'project_id');
    }

    public function teams(): HasMany
    {
        return $this->hasMany(KokurikulerTeam::class, 'project_id');
    }

    public function projectDimensions(): HasMany
    {
        return $this->hasMany(KokurikulerProjectDimension::class, 'project_id')->orderBy('urutan');
    }

    /** Projek berstatus aktif pada tahun ajaran yang aktif. */
    public function scopeBerjalan(Builder $q): Builder
    {
        $ayId = \App\Support\TahunAjaran::id();

        return $q->where('status', 'aktif')
            ->when($ayId, fn ($qq) => $qq->where('academic_year_id', $ayId));
    }
}
