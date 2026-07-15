<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Dimensi yang dinilai pada sebuah projek + "Aspek yang Dinilai" + sub-dimensi
 * yang diamati. Nilai diberikan per DIMENSI; sub-dimensi hanya panduan mengamati.
 */
class KokurikulerProjectDimension extends Model
{
    use HasUuid;

    protected $fillable = ['project_id', 'dimension_id', 'aspek', 'urutan'];

    public function project(): BelongsTo
    {
        return $this->belongsTo(KokurikulerProject::class, 'project_id');
    }

    public function dimension(): BelongsTo
    {
        return $this->belongsTo(KokurikulerDimension::class, 'dimension_id');
    }

    public function subdimensions(): BelongsToMany
    {
        return $this->belongsToMany(
            KokurikulerSubdimension::class,
            'kokurikuler_project_subdimensions',
            'project_dimension_id',
            'subdimension_id',
        );
    }
}
