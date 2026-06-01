<?php

namespace App\Enums;

enum TeacherAttendanceStatus: string
{
    case Hadir      = 'hadir';
    case TidakHadir = 'tidak_hadir';
    case Izin       = 'izin';
    case Sakit      = 'sakit';
}
