<?php

namespace App\Models;

use App\Enums\BellEvent;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BellRingLog extends Model
{
    protected $fillable = [
        'tanggal', 'waktu', 'jenis_event', 'bell_audio_id', 'bell_device_id', 'status', 'keterangan',
    ];

    protected function casts(): array
    {
        return [
            'tanggal' => 'date',
            'jenis_event' => BellEvent::class,
        ];
    }

    public function audio(): BelongsTo
    {
        return $this->belongsTo(BellAudio::class, 'bell_audio_id');
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(BellDevice::class, 'bell_device_id');
    }
}
