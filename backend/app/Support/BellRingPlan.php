<?php

namespace App\Support;

use App\Enums\BellEvent;
use App\Models\BellAudioMap;
use Illuminate\Support\Carbon;

/**
 * "Jadwal bunyi" untuk sebuah tanggal: menerjemahkan periode bel (yang sudah digeser mode
 * & menghormati istirahat terkunci) menjadi daftar event bel + audio yang dipetakan.
 *
 * Aturan event di setiap batas periode:
 *   - awal periode pertama            -> masuk
 *   - awal periode istirahat          -> istirahat_mulai
 *   - awal periode setelah istirahat  -> istirahat_selesai
 *   - awal periode lain               -> pergantian
 *   - akhir periode terakhir          -> pulang
 *
 * Event upacara/khusus/murottal/darurat tidak dijadwalkan otomatis (bel manual).
 * Resolusi audio: pemetaan spesifik mode dulu, fallback pemetaan global (bell_mode_id null).
 */
class BellRingPlan
{
    /**
     * @return list<array{waktu:string, jenis_event:string, jenis_label:string, bell_audio_id:?int, audio_nama:?string, audio_url:?string}>
     */
    public static function forDate(string $tanggal): array
    {
        $periods = BellSchedule::periodsForDate($tanggal);
        if (empty($periods)) {
            return [];
        }

        $hari = Carbon::parse($tanggal)->locale('id')->dayName;
        $modeId = BellSchedule::modeIdFor(mb_strtolower($hari), $tanggal);
        $mapper = self::audioMapper($modeId);

        $events = [];
        $count = count($periods);

        foreach ($periods as $i => $p) {
            if ($p['jam_mulai'] !== null) {
                $jenis = match (true) {
                    $i === 0 => BellEvent::Masuk,
                    $p['is_istirahat'] => BellEvent::IstirahatMulai,
                    ($periods[$i - 1]['is_istirahat'] ?? false) => BellEvent::IstirahatSelesai,
                    default => BellEvent::Pergantian,
                };
                $events[] = self::event($p['jam_mulai'], $jenis, $mapper);
            }

            // Bel pulang hanya dari akhir periode terakhir.
            if ($i === $count - 1 && $p['jam_selesai'] !== null) {
                $events[] = self::event($p['jam_selesai'], BellEvent::Pulang, $mapper);
            }
        }

        return $events;
    }

    /** @return callable(BellEvent):?array{id:int,nama:string,url:?string} */
    private static function audioMapper(?int $modeId): callable
    {
        // Ambil semua map relevan (mode ini + global) sekali, resolusi in-memory.
        $maps = BellAudioMap::with('audio')
            ->where('aktif', true)
            ->where(fn ($q) => $q->whereNull('bell_mode_id')->when($modeId, fn ($q2) => $q2->orWhere('bell_mode_id', $modeId)))
            ->get();

        return function (BellEvent $event) use ($maps, $modeId): ?array {
            $specific = $maps->first(fn ($m) => $m->jenis_event === $event && $m->bell_mode_id === $modeId);
            $global = $maps->first(fn ($m) => $m->jenis_event === $event && $m->bell_mode_id === null);
            $map = $specific ?? $global;

            if (! $map || ! $map->audio || ! $map->audio->aktif) {
                return null;
            }

            return ['id' => $map->audio->id, 'nama' => $map->audio->nama, 'url' => $map->audio->url()];
        };
    }

    /** @return array{waktu:string, jenis_event:string, jenis_label:string, bell_audio_id:?int, audio_nama:?string, audio_url:?string} */
    private static function event(string $waktu, BellEvent $jenis, callable $mapper): array
    {
        $audio = $mapper($jenis);

        return [
            'waktu' => $waktu,
            'jenis_event' => $jenis->value,
            'jenis_label' => $jenis->label(),
            'bell_audio_id' => $audio['id'] ?? null,
            'audio_nama' => $audio['nama'] ?? null,
            'audio_url' => $audio['url'] ?? null,
        ];
    }
}
