<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class BellDevice extends Model
{
    use HasUuid;

    protected $fillable = ['nama', 'token', 'last_heartbeat_at', 'aktif'];

    protected function casts(): array
    {
        return [
            'last_heartbeat_at' => 'datetime',
            'aktif' => 'boolean',
        ];
    }
}
