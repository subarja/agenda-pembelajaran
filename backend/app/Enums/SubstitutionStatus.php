<?php

namespace App\Enums;

enum SubstitutionStatus: string
{
    /** Menunggu jawaban guru pengganti. Kewajiban agenda MASIH pada pengaju. */
    case Diajukan = 'diajukan';

    /** Disetujui pengganti. Kewajiban agenda pindah — satu-satunya status yang mengalihkan. */
    case Disetujui = 'disetujui';

    case Ditolak = 'ditolak';

    /** Ditarik kembali oleh pengaju sebelum dijawab. */
    case Dibatalkan = 'dibatalkan';

    /** Tidak dijawab sampai sesi terakhir lewat. Kewajiban tetap/kembali ke pengaju. */
    case Kedaluwarsa = 'kedaluwarsa';

    /** Masih "hidup": mengunci sesi agar tidak diajukan dua kali. */
    public function aktif(): bool
    {
        return in_array($this, [self::Diajukan, self::Disetujui], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Diajukan    => 'Menunggu jawaban',
            self::Disetujui   => 'Disetujui',
            self::Ditolak     => 'Ditolak',
            self::Dibatalkan  => 'Dibatalkan',
            self::Kedaluwarsa => 'Kedaluwarsa',
        };
    }
}
