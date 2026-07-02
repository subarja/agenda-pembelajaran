<?php

namespace App\Enums;

enum BkStatus: string
{
    case None     = 'none';
    case Diajukan = 'diajukan';
    case Diterima = 'diterima';
    case Selesai  = 'selesai';
}
