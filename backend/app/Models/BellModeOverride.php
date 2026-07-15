<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BellModeOverride extends Model
{
    protected $fillable = ['tanggal', 'bell_mode_id', 'keterangan', 'created_by'];

    protected function casts(): array
    {
        return ['tanggal' => 'date'];
    }

    public function mode(): BelongsTo
    {
        return $this->belongsTo(BellMode::class, 'bell_mode_id');
    }
}
