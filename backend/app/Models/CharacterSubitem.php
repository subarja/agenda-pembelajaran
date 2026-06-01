<?php

namespace App\Models;

use App\Enums\CharacterSifat;
use App\Traits\HasAuditTrail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class CharacterSubitem extends Model
{
    use HasAuditTrail, HasUuid, SoftDeletes;

    protected $fillable = [
        'category_id', 'kode', 'deskripsi', 'bobot', 'sifat', 'aktif',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'sifat'  => CharacterSifat::class,
            'bobot'  => 'integer',
            'aktif'  => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(CharacterCategory::class, 'category_id');
    }

    public function inputs(): HasMany
    {
        return $this->hasMany(CharacterInput::class, 'subitem_id');
    }
}
