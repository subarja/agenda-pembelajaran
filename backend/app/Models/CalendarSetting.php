<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CalendarSetting extends Model
{
    protected $fillable = [
        'calendar_id', 'ics_url', 'sync_method', 'api_key',
        'service_account_json',
        'last_synced_at', 'sync_months_ahead',
    ];

    protected function casts(): array
    {
        return [
            'last_synced_at'    => 'datetime',
            'sync_months_ahead' => 'integer',
        ];
    }

    public static function instance(): self
    {
        return static::firstOrCreate([], [
            'calendar_id'       => '',
            'sync_months_ahead' => 6,
        ]);
    }

    public function isConfigured(): bool
    {
        if ($this->sync_method === 'ics') {
            return ! empty($this->ics_url);
        }
        return ! empty($this->calendar_id) && ! empty($this->service_account_json);
    }

    public function useIcs(): bool
    {
        return $this->sync_method === 'ics';
    }

    public function useApiKey(): bool
    {
        return $this->sync_method === 'api_key';
    }
}
