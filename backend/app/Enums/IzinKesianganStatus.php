<?php

namespace App\Enums;

/**
 * Status verifikasi izin masuk kesiangan oleh guru piket. Poin negatif tetap dikenakan
 * baik disetujui maupun ditolak (keputusan user); status hanya menandai berizin/tidak.
 */
enum IzinKesianganStatus: string
{
    case Diajukan = 'diajukan';
    case Disetujui = 'disetujui';
    case Ditolak = 'ditolak';

    public function label(): string
    {
        return match ($this) {
            self::Diajukan => 'Menunggu verifikasi',
            self::Disetujui => 'Disetujui (berizin)',
            self::Ditolak => 'Ditolak (tanpa izin)',
        };
    }
}
