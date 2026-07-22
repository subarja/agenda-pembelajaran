<?php

namespace App\Enums;

/**
 * Asal input karakter: `guru` (penilaian manual guru) atau `sistem` (poin otomatis,
 * mis. kesiangan). Baris sistem memakai poin_override & tanggal_kejadian untuk idempotensi.
 */
enum CharacterSumber: string
{
    case Guru = 'guru';
    case Sistem = 'sistem';
}
