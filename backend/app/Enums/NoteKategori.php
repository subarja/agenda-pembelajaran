<?php

namespace App\Enums;

enum NoteKategori: string
{
    case Akademik  = 'akademik';
    case Karakter  = 'karakter';
    case Presensi  = 'presensi';
    case Kesehatan = 'kesehatan';
    case Lainnya   = 'lainnya';
}
