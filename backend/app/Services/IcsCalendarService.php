<?php

namespace App\Services;

use App\Models\CalendarEvent;
use App\Models\CalendarSetting;
use Carbon\Carbon;
use GuzzleHttp\Client;

/**
 * Sync kalender via ICS/iCal feed URL.
 * Tidak butuh Google Cloud, Service Account, atau library pihak ketiga.
 * Cukup URL secret dari Google Calendar (atau Outlook, Apple Calendar, dll).
 */
class IcsCalendarService
{
    public function sync(): array
    {
        $setting = CalendarSetting::instance();

        if (empty($setting->ics_url)) {
            throw new \RuntimeException('ICS URL belum diisi. Masukkan URL iCal dari pengaturan kalender Google.');
        }

        $http = new Client(['timeout' => 30]);

        try {
            $resp = $http->get($setting->ics_url);
        } catch (\Exception $e) {
            throw new \RuntimeException('Gagal mengambil ICS feed: ' . $e->getMessage());
        }

        $icsContent = $resp->getBody()->getContents();
        $events     = $this->parseIcs($icsContent);

        $synced = 0;
        $now    = now();

        foreach ($events as $ev) {
            if (empty($ev['start'])) continue;

            CalendarEvent::updateOrCreate(
                ['google_event_id' => $ev['uid']],
                [
                    'title'       => $ev['summary']     ?? '(Tanpa Judul)',
                    'description' => $ev['description'] ?? null,
                    'start_date'  => $ev['start'],
                    'end_date'    => $ev['end'] ?? $ev['start'],
                    'color'       => null,
                    'all_day'     => $ev['all_day'],
                    'source'      => 'google',
                    'synced_at'   => $now,
                ]
            );
            $synced++;
        }

        $setting->update(['last_synced_at' => $now]);

        return [
            'synced'  => $synced,
            'message' => "Berhasil sync {$synced} event dari ICS feed.",
        ];
    }

    // ── ICS Parser ────────────────────────────────────────────────────────────

    private function parseIcs(string $ics): array
    {
        // Unfold long lines (RFC 5545: continuation lines start with space/tab)
        $ics = preg_replace('/\r\n[ \t]/', '', $ics);
        $ics = str_replace("\r\n", "\n", $ics);

        $events = [];
        $current = null;

        foreach (explode("\n", $ics) as $rawLine) {
            $line = trim($rawLine);
            if ($line === '') continue;

            if ($line === 'BEGIN:VEVENT') {
                $current = [];
                continue;
            }

            if ($line === 'END:VEVENT') {
                if ($current !== null) {
                    $events[] = $current;
                }
                $current = null;
                continue;
            }

            if ($current === null) continue;

            // Split property name/params from value at first ':'
            $colonPos = strpos($line, ':');
            if ($colonPos === false) continue;

            $prop  = strtoupper(substr($line, 0, $colonPos));
            $value = substr($line, $colonPos + 1);

            // Property name (strip params like ;TZID=Asia/Jakarta)
            $propName = explode(';', $prop)[0];

            match ($propName) {
                'UID'         => $current['uid']         = $value,
                'SUMMARY'     => $current['summary']     = $this->unescapeIcs($value),
                'DESCRIPTION' => $current['description'] = $this->unescapeIcs($value),
                'STATUS'      => $current['status']      = $value,
                'DTSTART'     => [$current['start'], $current['all_day']] = $this->parseDate($prop, $value),
                'DTEND'       => [$current['end']]       = [$this->parseDateOnly($prop, $value)],
                default       => null,
            };
        }

        return array_filter($events, fn ($e) =>
            ! empty($e['uid']) &&
            ! empty($e['start']) &&
            ($e['status'] ?? '') !== 'CANCELLED'
        );
    }

    /**
     * Parse DTSTART (or DTEND) and return [date_string, is_all_day].
     * Handles: DATE (all-day), DATETIME with/without timezone.
     */
    private function parseDate(string $prop, string $value): array
    {
        $isAllDay = str_contains($prop, 'VALUE=DATE') || (strlen($value) === 8 && ctype_digit($value));

        if ($isAllDay) {
            // Format: YYYYMMDD
            $date = Carbon::createFromFormat('Ymd', substr($value, 0, 8))->toDateString();
            return [$date, true];
        }

        // DATETIME: 20260617T090000Z or 20260617T090000
        try {
            $dt = Carbon::parse($value);
            return [$dt->toDateString(), false];
        } catch (\Exception) {
            return [null, false];
        }
    }

    private function parseDateOnly(string $prop, string $value): ?string
    {
        [$date] = $this->parseDate($prop, $value);

        // For all-day DTEND, Google Calendar uses exclusive end date (next day)
        if ($date && (str_contains($prop, 'VALUE=DATE') || (strlen($value) === 8 && ctype_digit($value)))) {
            return Carbon::parse($date)->subDay()->toDateString();
        }

        return $date;
    }

    private function unescapeIcs(string $value): string
    {
        return str_replace(['\\n', '\\,', '\\;', '\\\\'], ["\n", ',', ';', '\\'], $value);
    }
}
