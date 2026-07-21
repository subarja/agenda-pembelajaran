<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NonEffectiveDay extends Model
{
    protected $fillable = [
        'tanggal', 'status', 'keterangan', 'libur_nasional',
        'calendar_event_id', 'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'tanggal' => 'date',
            'libur_nasional' => 'boolean',
        ];
    }

    public function calendarEvent(): BelongsTo
    {
        return $this->belongsTo(CalendarEvent::class, 'calendar_event_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
