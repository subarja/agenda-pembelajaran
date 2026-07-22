<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Tier poin keterlambatan: rentang menit -> poin negatif. Dikelola admin.
 */
class KesianganPointTier extends Model
{
    protected $fillable = ['menit_min', 'menit_max', 'poin', 'aktif'];

    protected function casts(): array
    {
        return [
            'menit_min' => 'integer',
            'menit_max' => 'integer',
            'poin' => 'integer',
            'aktif' => 'boolean',
        ];
    }

    /** Poin negatif untuk keterlambatan sekian menit; 0 bila tak ada tier cocok / <= 0 menit. */
    public static function poinUntuk(int $menit): int
    {
        if ($menit <= 0) {
            return 0;
        }

        $tier = self::where('aktif', true)
            ->where('menit_min', '<=', $menit)
            ->where(fn ($q) => $q->whereNull('menit_max')->orWhere('menit_max', '>=', $menit))
            ->orderByDesc('menit_min')
            ->first();

        return $tier?->poin ?? 0;
    }
}
