<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class ProgramKeahlian extends Model
{
    use HasUuid;

    protected $fillable = [
        'kode', 'program_keahlian', 'konsentrasi',
    ];
}
