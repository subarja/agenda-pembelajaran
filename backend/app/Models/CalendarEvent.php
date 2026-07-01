<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CalendarEvent extends Model
{
    protected $fillable = [
        'google_event_id', 'title', 'description',
        'start_date', 'end_date', 'color', 'all_day', 'source', 'synced_at',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date'   => 'date',
            'all_day'    => 'boolean',
            'synced_at'  => 'datetime',
        ];
    }

    public function nonEffectiveDays(): HasMany
    {
        return $this->hasMany(NonEffectiveDay::class, 'calendar_event_id');
    }
}
