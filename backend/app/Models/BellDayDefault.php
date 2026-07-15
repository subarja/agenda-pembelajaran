<?php

namespace App\Models;

use App\Enums\Hari;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BellDayDefault extends Model
{
    protected $fillable = ['hari', 'bell_mode_id'];

    protected function casts(): array
    {
        return ['hari' => Hari::class];
    }

    public function mode(): BelongsTo
    {
        return $this->belongsTo(BellMode::class, 'bell_mode_id');
    }
}
