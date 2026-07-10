<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Tujuan Pembelajaran khusus PKL. jurusan NULL = berlaku semua jurusan.
 */
class PklObjective extends Model
{
    use HasAuditTrail, HasUuid, SoftDeletes;

    protected $fillable = [
        'deskripsi', 'jurusan', 'academic_year_id', 'aktif',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return ['aktif' => 'boolean'];
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    /** TP yang berlaku untuk sebuah jurusan: yang umum (NULL) ATAU cocok jurusannya. */
    public function scopeForJurusan(Builder $query, string $jurusan): Builder
    {
        return $query->where(fn ($q) => $q->whereNull('jurusan')->orWhere('jurusan', $jurusan));
    }
}
