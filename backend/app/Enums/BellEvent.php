<?php

namespace App\Enums;

/**
 * Jenis kejadian bel (dipakai sebagai kategori audio DAN jenis event pemetaan).
 * String lowercase; hindari em-dash/double-hyphen pada label yang tampil ke user.
 */
enum BellEvent: string
{
    case Masuk = 'masuk';
    case Pergantian = 'pergantian';
    case IstirahatMulai = 'istirahat_mulai';
    case IstirahatSelesai = 'istirahat_selesai';
    case Pulang = 'pulang';
    case Upacara = 'upacara';
    case Khusus = 'khusus';
    case Murottal = 'murottal';
    case Darurat = 'darurat';

    public function label(): string
    {
        return match ($this) {
            self::Masuk => 'Bel Masuk',
            self::Pergantian => 'Pergantian Jam',
            self::IstirahatMulai => 'Istirahat Mulai',
            self::IstirahatSelesai => 'Istirahat Selesai',
            self::Pulang => 'Bel Pulang',
            self::Upacara => 'Upacara',
            self::Khusus => 'Khusus',
            self::Murottal => 'Murottal',
            self::Darurat => 'Darurat',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(fn (self $c) => $c->value, self::cases());
    }
}
