<?php

namespace App\Support;

use App\Enums\Hari;
use App\Models\BellDayDefault;
use App\Models\BellMode;
use App\Models\BellModeOverride;
use App\Models\BellPeriod;
use App\Models\Schedule;
use Illuminate\Support\Carbon;

/**
 * Satu-satunya sumber kebenaran "sesi ini pukul berapa" untuk sebuah tanggal.
 *
 * Jadwal (schedules) menyimpan JAM KE- (dari import XML); pukul konkretnya diselesaikan
 * di sini dari dua lapisan:
 *   1. bell_periods per hari  → menangani hari berdurasi beda (mis. Jumat, yang tidak
 *      pernah ada di XML aSc dan diisi manual oleh admin).
 *   2. mode pergeseran menit  → Apel (0) / Tanpa Apel (-60), diselesaikan dengan prioritas
 *      override per-tanggal → default per-hari → default global.
 *
 * Jadwal tanpa jam-ke (input manual/Excel) tetap memakai jam_mulai/jam_selesai tersimpan
 * sebagai basis, tapi pergeseran mode tetap berlaku — kalau seluruh sekolah masuk 1 jam
 * lebih awal, sesi manual ikut bergeser.
 *
 * Semua lookup di-cache statis per request; panggil flush() setelah mengubah data bel
 * (dilakukan BellScheduleController & dibutuhkan di test).
 */
class BellSchedule
{
    /** @var array<string, array<int, array{mulai: string, selesai: string}>>|null */
    private static ?array $periods = null;

    private static ?int $defaultOffset = null;

    /** @var array<string, int>|null */
    private static ?array $dayOffsets = null;

    /** @var array<string, int|null> */
    private static array $dateOffsets = [];

    /**
     * Pukul mulai/selesai efektif jadwal ini. Tanpa $tanggal (mis. kisi jadwal mingguan
     * tanpa konteks hari spesifik), override per-tanggal tidak ikut — hanya bel per hari
     * dan default mode.
     *
     * @return array{jam_mulai: ?string, jam_selesai: ?string} format H:i:s
     */
    public static function resolve(Schedule $schedule, ?string $tanggal = null): array
    {
        $hari = $schedule->hari instanceof Hari ? $schedule->hari->value : (string) $schedule->hari;

        $mulai   = self::periodTime($hari, $schedule->jam_ke_mulai, 'mulai') ?? $schedule->jam_mulai;
        $selesai = self::periodTime($hari, $schedule->jam_ke_selesai, 'selesai') ?? $schedule->jam_selesai;

        $offset = self::offsetFor($hari, $tanggal);

        return [
            'jam_mulai'   => self::shift($mulai, $offset),
            'jam_selesai' => self::shift($selesai, $offset),
        ];
    }

    /** Pergeseran menit yang berlaku: override tanggal → default hari → default global. */
    public static function offsetFor(Hari|string $hari, ?string $tanggal = null): int
    {
        $hari = $hari instanceof Hari ? $hari->value : $hari;

        if ($tanggal !== null) {
            if (! array_key_exists($tanggal, self::$dateOffsets)) {
                self::$dateOffsets[$tanggal] = BellModeOverride::where('tanggal', $tanggal)
                    ->first()?->mode?->offset_menit;
            }
            if (self::$dateOffsets[$tanggal] !== null) {
                return self::$dateOffsets[$tanggal];
            }
        }

        self::$dayOffsets ??= BellDayDefault::with('mode')->get()
            ->mapWithKeys(fn ($d) => [$d->hari->value => (int) $d->mode->offset_menit])
            ->all();

        if (isset(self::$dayOffsets[$hari])) {
            return self::$dayOffsets[$hari];
        }

        self::$defaultOffset ??= (int) (BellMode::where('is_default', true)->value('offset_menit') ?? 0);

        return self::$defaultOffset;
    }

    /** Geser string waktu H:i[:s] sekian menit (negatif = lebih awal). */
    public static function shift(?string $time, int $menit): ?string
    {
        if (! $time) {
            return $time;
        }
        if ($menit === 0) {
            return strlen($time) === 5 ? $time.':00' : $time;
        }

        return Carbon::parse($time)->addMinutes($menit)->format('H:i:s');
    }

    private static function periodTime(string $hari, ?int $jamKe, string $field): ?string
    {
        if ($jamKe === null) {
            return null;
        }

        self::$periods ??= BellPeriod::all()
            ->groupBy(fn ($p) => $p->hari->value)
            ->map(fn ($rows) => $rows->keyBy('jam_ke')->map(fn ($p) => [
                'mulai'   => $p->jam_mulai,
                'selesai' => $p->jam_selesai,
            ])->all())
            ->all();

        return self::$periods[$hari][$jamKe][$field] ?? null;
    }

    public static function flush(): void
    {
        self::$periods       = null;
        self::$defaultOffset = null;
        self::$dayOffsets    = null;
        self::$dateOffsets   = [];
    }
}
