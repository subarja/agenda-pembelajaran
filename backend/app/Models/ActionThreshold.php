<?php

namespace App\Models;

use App\Enums\CharacterSign;
use App\Traits\HasAuditTrail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ActionThreshold extends Model
{
    use HasAuditTrail, HasUuid, SoftDeletes;

    protected $fillable = [
        'character_category_id', 'min_point', 'max_point',
        'sifat', 'rekomendasi', 'aktif',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'sifat'     => CharacterSign::class,
            'min_point' => 'integer',
            'max_point' => 'integer',
            'aktif'     => 'boolean',
        ];
    }

    public function characterCategory(): BelongsTo
    {
        return $this->belongsTo(CharacterCategory::class, 'character_category_id');
    }

    public function recommendations(): HasMany
    {
        return $this->hasMany(Recommendation::class, 'threshold_id');
    }
}
