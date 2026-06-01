<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class CharacterCategory extends Model
{
    use HasAuditTrail, HasUuid, SoftDeletes;

    protected $fillable = [
        'nama', 'deskripsi', 'aktif',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'aktif' => 'boolean',
        ];
    }

    public function subitems(): HasMany
    {
        return $this->hasMany(CharacterSubitem::class, 'category_id');
    }

    public function actionThresholds(): HasMany
    {
        return $this->hasMany(ActionThreshold::class, 'character_category_id');
    }
}
