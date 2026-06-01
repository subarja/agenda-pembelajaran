<?php

namespace App\Models;

use App\Enums\Semester;
use App\Traits\HasAuditTrail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AcademicYear extends Model
{
    use HasAuditTrail, HasUuid, SoftDeletes;

    protected $fillable = [
        'tahun', 'semester', 'aktif',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'semester' => Semester::class,
            'aktif'    => 'boolean',
        ];
    }

    public function classes(): HasMany
    {
        return $this->hasMany(SchoolClass::class);
    }

    public function ewsStatuses(): HasMany
    {
        return $this->hasMany(EwsStatus::class);
    }
}
