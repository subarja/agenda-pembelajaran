<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BellMode extends Model
{
    protected $fillable = ['nama', 'offset_menit', 'is_default'];

    protected function casts(): array
    {
        return [
            'offset_menit' => 'integer',
            'is_default'   => 'boolean',
        ];
    }
}
