<?php

namespace App\Enums;

/**
 * Siklus izin keluar: diajukan -> disetujui|ditolak; disetujui -> keluar (scan sekuriti) ->
 * kembali (scan lagi); disetujui -> dibatalkan (sebelum keluar). String lowercase.
 */
enum IzinKeluarStatus: string
{
    case Diajukan = 'diajukan';
    case Disetujui = 'disetujui';
    case Ditolak = 'ditolak';
    case Keluar = 'keluar';
    case Kembali = 'kembali';
    case Dibatalkan = 'dibatalkan';

    public function label(): string
    {
        return match ($this) {
            self::Diajukan => 'Menunggu persetujuan',
            self::Disetujui => 'Disetujui',
            self::Ditolak => 'Ditolak',
            self::Keluar => 'Sedang di luar',
            self::Kembali => 'Sudah kembali',
            self::Dibatalkan => 'Dibatalkan',
        };
    }
}
