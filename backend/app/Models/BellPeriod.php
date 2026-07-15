<?php

namespace App\Models;

use App\Enums\Hari;
use Illuminate\Database\Eloquent\Model;

class BellPeriod extends Model
{
    protected $fillable = ['hari', 'jam_ke', 'jam_mulai', 'jam_selesai'];

    protected function casts(): array
    {
        return [
            'hari'   => Hari::class,
            'jam_ke' => 'integer',
        ];
    }
}
