<?php

namespace App\Services;

use App\Models\CalendarEvent;
use App\Models\CalendarSetting;
use Carbon\Carbon;
use GuzzleHttp\Client;

/**
 * Sync Google Calendar using Service Account + Guzzle (no google/apiclient dependency).
 * Auth flow: create JWT → exchange for OAuth2 access token → call Calendar API.
 */
class GoogleCalendarService
{
    private const OAUTH_ENDPOINT   = 'https://oauth2.googleapis.com/token';
    private const CALENDAR_SCOPE   = 'https://www.googleapis.com/auth/calendar.readonly';
    private const CALENDAR_API_BASE= 'https://www.googleapis.com/calendar/v3';

    public function sync(): array
    {
        $setting = CalendarSetting::instance();

        if (! $setting->isConfigured()) {
            throw new \RuntimeException('Google Calendar belum dikonfigurasi. Upload service account JSON dan isi Calendar ID di pengaturan.');
        }

        $sa          = json_decode($setting->service_account_json, true);
        $accessToken = $this->getAccessToken($sa);
        $http        = new Client(['headers' => ['Authorization' => "Bearer {$accessToken}"]]);

        $monthsAhead = $setting->sync_months_ahead ?: 6;
        $timeMin     = Carbon::now()->startOfMonth()->toRfc3339String();
        $timeMax     = Carbon::now()->addMonths($monthsAhead)->endOfMonth()->toRfc3339String();
        $calId       = urlencode($setting->calendar_id);

        $allItems = [];
        $pageToken = null;

        do {
            $params = [
                'timeMin'      => $timeMin,
                'timeMax'      => $timeMax,
                'singleEvents' => 'true',
                'orderBy'      => 'startTime',
                'maxResults'   => '2500',
            ];
            if ($pageToken) $params['pageToken'] = $pageToken;

            $resp  = $http->get(self::CALENDAR_API_BASE . "/calendars/{$calId}/events", ['query' => $params]);
            $body  = json_decode($resp->getBody()->getContents(), true);
            $items = $body['items'] ?? [];
            $allItems = array_merge($allItems, $items);
            $pageToken = $body['nextPageToken'] ?? null;
        } while ($pageToken);

        $synced = 0;
        $now    = now();

        foreach ($allItems as $item) {
            if ($item['status'] === 'cancelled') continue;

            $start   = $item['start'];
            $end     = $item['end'];
            $allDay  = isset($start['date']);

            $startDate = $allDay
                ? Carbon::parse($start['date'])->toDateString()
                : Carbon::parse($start['dateTime'])->toDateString();

            $endDate = $allDay
                // Google all-day end is exclusive → subtract 1 day
                ? Carbon::parse($end['date'])->subDay()->toDateString()
                : Carbon::parse($end['dateTime'])->toDateString();

            $color = $this->resolveColor($item['colorId'] ?? null);

            CalendarEvent::updateOrCreate(
                ['google_event_id' => $item['id']],
                [
                    'title'       => $item['summary'] ?? '(Tanpa Judul)',
                    'description' => $item['description'] ?? null,
                    'start_date'  => $startDate,
                    'end_date'    => $endDate,
                    'color'       => $color,
                    'all_day'     => $allDay,
                    'source'      => 'google',
                    'synced_at'   => $now,
                ]
            );
            $synced++;
        }

        $setting->update(['last_synced_at' => $now]);

        return [
            'synced'  => $synced,
            'message' => "Berhasil sync {$synced} event dari Google Calendar.",
        ];
    }

    // ── OAuth2 with service account JWT ──────────────────────────────────────

    private function getAccessToken(array $sa): string
    {
        $now = time();
        $payload = [
            'iss'   => $sa['client_email'],
            'scope' => self::CALENDAR_SCOPE,
            'aud'   => self::OAUTH_ENDPOINT,
            'iat'   => $now,
            'exp'   => $now + 3600,
        ];

        $jwt  = $this->createJwt($payload, $sa['private_key']);
        $http = new Client();
        $resp = $http->post(self::OAUTH_ENDPOINT, [
            'form_params' => [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion'  => $jwt,
            ],
        ]);

        $data = json_decode($resp->getBody()->getContents(), true);

        if (empty($data['access_token'])) {
            throw new \RuntimeException('Gagal mendapatkan access token dari Google: ' . ($data['error_description'] ?? json_encode($data)));
        }

        return $data['access_token'];
    }

    private function createJwt(array $payload, string $privateKey): string
    {
        $header = base64_encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $body   = base64_encode(json_encode($payload));

        $header = rtrim(strtr($header, '+/', '-_'), '=');
        $body   = rtrim(strtr($body,   '+/', '-_'), '=');

        $signingInput = "{$header}.{$body}";

        $key = openssl_pkey_get_private($privateKey);
        if (! $key) {
            throw new \RuntimeException('Private key service account tidak valid.');
        }

        openssl_sign($signingInput, $signature, $key, OPENSSL_ALGO_SHA256);
        $sig = rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');

        return "{$signingInput}.{$sig}";
    }

    // ── Color ID → hex ───────────────────────────────────────────────────────

    private function resolveColor(?string $colorId): ?string
    {
        return match ($colorId) {
            '1'  => '#7986cb',
            '2'  => '#33b679',
            '3'  => '#8e24aa',
            '4'  => '#e67c73',
            '5'  => '#f6bf26',
            '6'  => '#f4511e',
            '7'  => '#039be5',
            '8'  => '#616161',
            '9'  => '#3f51b5',
            '10' => '#0b8043',
            '11' => '#d50000',
            default => null,
        };
    }
}
