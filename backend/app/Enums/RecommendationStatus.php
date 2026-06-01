<?php

namespace App\Enums;

enum RecommendationStatus: string
{
    case Pending  = 'pending';
    case Proses   = 'proses';
    case Selesai  = 'selesai';
    case Diabaikan = 'diabaikan';
}
