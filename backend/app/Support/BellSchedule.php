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
    /** @var array<string, array<int, array{mulai: string, selesai: string, terkunci: bool}>>|null */
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

        $mulaiP = self::period($hari, $schedule->jam_ke_mulai);
        $selesaiP = self::period($hari, $schedule->jam_ke_selesai);

        $mulai = $mulaiP['mulai'] ?? $schedule->jam_mulai;
        $selesai = $selesaiP['selesai'] ?? $schedule->jam_selesai;

        $offset = self::offsetFor($hari, $tanggal);

        // Periode terkunci (istirahat) tidak digeser oleh mode — jam dinding tetap.
        return [
            'jam_mulai' => self::shift($mulai, ($mulaiP['terkunci'] ?? false) ? 0 : $offset),
            'jam_selesai' => self::shift($selesai, ($selesaiP['terkunci'] ?? false) ? 0 : $offset),
        ];
    }

    /**
     * Pukul masuk sekolah efektif untuk sebuah tanggal = jam mulai jam ke-1 pada mode
     * hari itu (07.30 Apel / 06.30 Tanpa Apel). Basis hitung keterlambatan (modul kesiangan).
     * Mengembalikan null bila hari itu tidak punya bel jam ke-1 (mis. Minggu).
     */
    public static function jamMasukSekolah(string $tanggal): ?string
    {
        $hari = self::hariDari($tanggal);
        if ($hari === null) {
            return null;
        }

        $periode = self::period($hari, 1);
        if ($periode === null) {
            return null;
        }

        // Jam ke-1 tidak pernah periode terkunci; offset mode selalu berlaku.
        return self::shift($periode['mulai'], self::offsetFor($hari, $tanggal));
    }

    /** Nama hari (senin..sabtu) dari tanggal Y-m-d; null untuk Minggu / tanggal invalid. */
    private static function hariDari(string $tanggal): ?string
    {
        try {
            $iso = Carbon::parse($tanggal)->dayOfWeekIso;   // 1=Senin .. 7=Minggu
        } catch (\Throwable) {
            return null;
        }

        return [1 => 'senin', 2 => 'selasa', 3 => 'rabu', 4 => 'kamis', 5 => 'jumat', 6 => 'sabtu'][$iso] ?? null;
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

    /** Id BellMode yang berlaku: override tanggal → default hari → default global (null bila tak ada). */
    public static function modeIdFor(Hari|string $hari, ?string $tanggal = null): ?int
    {
        $hari = $hari instanceof Hari ? $hari->value : $hari;

        if ($tanggal !== null) {
            $id = BellModeOverride::where('tanggal', $tanggal)->value('bell_mode_id');
            if ($id !== null) {
                return (int) $id;
            }
        }

        $id = BellDayDefault::where('hari', $hari)->value('bell_mode_id');
        if ($id !== null) {
            return (int) $id;
        }

        $id = BellMode::where('is_default', true)->value('id');

        return $id !== null ? (int) $id : null;
    }

    /**
     * Periode bel satu hari (dari tanggal), sudah digeser mode & menghormati terkunci_offset.
     * Diurutkan naik berdasarkan jam mulai efektif.
     *
     * @return list<array{jam_ke:int, jam_mulai:string, jam_selesai:string, is_istirahat:bool}>
     */
    public static function periodsForDate(string $tanggal): array
    {
        $hari = self::hariDari($tanggal);
        if ($hari === null) {
            return [];
        }

        $offset = self::offsetFor($hari, $tanggal);

        $rows = BellPeriod::where('hari', $hari)->orderBy('jam_ke')->get()
            ->map(fn ($p) => [
                'jam_ke' => (int) $p->jam_ke,
                'jam_mulai' => self::shift($p->jam_mulai, $p->terkunci_offset ? 0 : $offset),
                'jam_selesai' => self::shift($p->jam_selesai, $p->terkunci_offset ? 0 : $offset),
                'is_istirahat' => (bool) $p->is_istirahat,
            ])
            ->all();

        usort($rows, fn ($a, $b) => strcmp((string) $a['jam_mulai'], (string) $b['jam_mulai']));

        return $rows;
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

    /**
     * Baris bel jam-ke tertentu (mulai/selesai + apakah terkunci offset), atau null
     * bila tak ada jam-ke / tak ada barisnya.
     *
     * @return array{mulai: string, selesai: string, terkunci: bool}|null
     */
    private static function period(string $hari, ?int $jamKe): ?array
    {
        if ($jamKe === null) {
            return null;
        }

        self::$periods ??= BellPeriod::all()
            ->groupBy(fn ($p) => $p->hari->value)
            ->map(fn ($rows) => $rows->keyBy('jam_ke')->map(fn ($p) => [
                'mulai' => $p->jam_mulai,
                'selesai' => $p->jam_selesai,
                'terkunci' => (bool) $p->terkunci_offset,
            ])->all())
            ->all();

        return self::$periods[$hari][$jamKe] ?? null;
    }

    public static function flush(): void
    {
        self::$periods = null;
        self::$defaultOffset = null;
        self::$dayOffsets = null;
        self::$dateOffsets = [];
    }
}
