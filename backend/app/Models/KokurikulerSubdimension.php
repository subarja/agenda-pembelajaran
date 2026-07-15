<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KokurikulerSubdimension extends Model
{
    protected $fillable = ['dimension_id', 'nama', 'urutan'];

    public function dimension(): BelongsTo
    {
        return $this->belongsTo(KokurikulerDimension::class, 'dimension_id');
    }
}
