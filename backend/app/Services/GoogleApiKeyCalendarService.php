<?php

namespace App\Services;

use App\Models\CalendarEvent;
use App\Models\CalendarSetting;
use Carbon\Carbon;
use GuzzleHttp\Client;

/**
 * Sync kalender via Google Calendar API v3 menggunakan API Key.
 *
 * Keunggulan vs ICS: menampilkan detail event asli (judul, deskripsi, warna).
 * Syarat: calendar harus PUBLIC dan API Key aktif untuk Calendar API.
 *
 * Cara mendapatkan API Key:
 * 1. Buka console.cloud.google.com
 * 2. Buat project → Enable "Google Calendar API"
 * 3. Credentials → Create Credentials → API Key
 * 4. (Opsional) Restrict key ke IP atau referrer
 */
class GoogleApiKeyCalendarService
{
    private const BASE_URL = 'https://www.googleapis.com/calendar/v3';

    // Peta colorId Google Calendar → hex warna
    private const COLOR_MAP = [
        '1'  => '#a4bdfc', '2'  => '#7ae7bf', '3'  => '#dbadff',
        '4'  => '#ff887c', '5'  => '#fbd75b', '6'  => '#ffb878',
        '7'  => '#46d6db', '8'  => '#e1e1e1', '9'  => '#5484ed',
        '10' => '#51b749', '11' => '#dc2127',
    ];

    public function sync(): array
    {
        $setting = CalendarSetting::instance();

        if (empty($setting->api_key)) {
            throw new \RuntimeException('API Key belum diisi. Masukkan Google Calendar API Key di pengaturan.');
        }
        if (empty($setting->calendar_id)) {
            throw new \RuntimeException('Calendar ID belum diisi.');
        }

        $http  = new Client(['timeout' => 30]);
        $ahead = max(1, (int) $setting->sync_months_ahead);
        $from  = Carbon::now()->startOfMonth();
        $to    = Carbon::now()->addMonths($ahead)->endOfMonth();

        $pageToken = null;
        $synced    = 0;
        $now       = now();

        do {
            $params = [
                'key'          => $setting->api_key,
                'timeMin'      => $from->toIso8601String(),
                'timeMax'      => $to->toIso8601String(),
                'singleEvents' => 'true',
                'orderBy'      => 'startTime',
                'maxResults'   => 250,
            ];
            if ($pageToken) {
                $params['pageToken'] = $pageToken;
            }

            $calId = urlencode($setting->calendar_id);
            $resp  = $http->get(self::BASE_URL . "/calendars/{$calId}/events", [
                'query' => $params,
            ]);

            $body = json_decode($resp->getBody()->getContents(), true);

            foreach ($body['items'] ?? [] as $item) {
                if (($item['status'] ?? '') === 'cancelled') continue;

                $startRaw = $item['start']['date']     ?? $item['start']['dateTime'] ?? null;
                $endRaw   = $item['end']['date']       ?? $item['end']['dateTime']   ?? null;

                if (! $startRaw) continue;

                $allDay = isset($item['start']['date']);

                $start = Carbon::parse($startRaw)->toDateString();
                $end   = Carbon::parse($endRaw ?? $startRaw)->toDateString();

                // All-day DTEND is exclusive (Google Calendar v3)
                if ($allDay && $end > $start) {
                    $end = Carbon::parse($end)->subDay()->toDateString();
                }

                $colorId = $item['colorId'] ?? null;
                $color   = $colorId ? (self::COLOR_MAP[$colorId] ?? null) : null;

                CalendarEvent::updateOrCreate(
                    ['google_event_id' => $item['id']],
                    [
                        'title'       => $item['summary']     ?? '(Tanpa Judul)',
                        'description' => $item['description'] ?? null,
                        'start_date'  => $start,
                        'end_date'    => $end,
                        'color'       => $color,
                        'all_day'     => $allDay,
                        'source'      => 'google',
                        'synced_at'   => $now,
                    ]
                );
                $synced++;
            }

            $pageToken = $body['nextPageToken'] ?? null;

        } while ($pageToken);

        $setting->update(['last_synced_at' => $now]);

        return [
            'synced'  => $synced,
            'message' => "Berhasil sync {$synced} event dari Google Calendar API.",
        ];
    }
}
