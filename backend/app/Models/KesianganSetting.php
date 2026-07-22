<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Singleton: sub-karakter yang dipakai untuk poin negatif kesiangan otomatis. Admin memilih
 * dari daftar sub-karakter yang ada (kode per sekolah beda) — bukan hardcode 'KD-04'.
 */
class KesianganSetting extends Model
{
    protected $fillable = ['subitem_id'];

    protected function casts(): array
    {
        return ['subitem_id' => 'integer'];
    }

    public static function instance(): self
    {
        return self::firstOrCreate([], ['subitem_id' => null]);
    }

    public function subitem(): BelongsTo
    {
        return $this->belongsTo(CharacterSubitem::class, 'subitem_id');
    }
}
