<?php

namespace App\Models;

use App\Enums\BellEvent;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BellAudioMap extends Model
{
    protected $fillable = ['bell_mode_id', 'jenis_event', 'bell_audio_id', 'aktif'];

    protected function casts(): array
    {
        return [
            'jenis_event' => BellEvent::class,
            'aktif' => 'boolean',
        ];
    }

    public function audio(): BelongsTo
    {
        return $this->belongsTo(BellAudio::class, 'bell_audio_id');
    }

    public function mode(): BelongsTo
    {
        return $this->belongsTo(BellMode::class, 'bell_mode_id');
    }
}
