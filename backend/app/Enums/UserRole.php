<?php

namespace App\Enums;

enum UserRole: string
{
    case Admin      = 'admin';
    case Guru       = 'guru';
    case WaliKelas  = 'wali_kelas';
    case Siswa      = 'siswa';
    case Wakasek    = 'wakasek';
    case BK         = 'bk';
    case OrangTua   = 'orang_tua';
}
