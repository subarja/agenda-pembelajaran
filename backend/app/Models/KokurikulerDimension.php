<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Master Dimensi Profil Lulusan (8 dimensi Permendikdasmen 10/2025, di-seed;
 * nama/deskripsi/sub-dimensi boleh diedit admin).
 */
class KokurikulerDimension extends Model
{
    protected $fillable = ['kode', 'nama', 'deskripsi', 'urutan', 'aktif'];

    protected function casts(): array
    {
        return ['aktif' => 'boolean'];
    }

    public function subdimensions(): HasMany
    {
        return $this->hasMany(KokurikulerSubdimension::class, 'dimension_id')->orderBy('urutan');
    }
}
