<?php

namespace App\Enums;

enum ReportJenis: string
{
    case Agenda            = 'agenda';
    case Kehadiran         = 'kehadiran';
    case Karakter          = 'karakter';
    case Ews               = 'ews';
    case RekapitulasiSiswa = 'rekapitulasi_siswa';
}
