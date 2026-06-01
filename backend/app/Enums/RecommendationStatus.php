<?php

namespace App\Enums;

enum RecommendationStatus: string
{
    case Pending             = 'pending';
    case Proses              = 'proses';
    case MenungguVerifikasi  = 'menunggu_verifikasi';
    case Selesai             = 'selesai';
    case Diabaikan           = 'diabaikan';
}
