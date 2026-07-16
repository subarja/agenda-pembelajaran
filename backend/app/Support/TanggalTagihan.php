<?php

namespace App\Support;

use App\Models\AcademicYear;
use App\Models\NonEffectiveDay;

/**
 * Satu-satunya jawaban "tanggal ini layak ditagih agenda atau tidak":
 *  - harus di DALAM rentang semester/TA aktif (jadwal TA baru jangan menagih tanggal
 *    sebelum semester mulai — kasus nyata: semester mulai 15 Jul, sesi 13–14 Jul ikut
 *    tertagih karena jendela perlu-diisi mundur menembus batas semester), dan
 *  - bukan hari tidak efektif (libur/kegiatan di kalender pendidikan).
 *
 * Dipakai perlu-diisi & EWS Guru. Cache statis per request — flush() di test.
 */
class TanggalTagihan
{
    /** @var array{0:string,1:string}|false|null rentang TA aktif; false = tidak ada TA */
    private static array|false|null $rentang = null;

    /** @var array<string, true>|null tanggal-tanggal tidak efektif */
    private static ?array $nonEfektif = null;

    public static function ditagih(string $tanggal): bool
    {
        if (self::$rentang === null) {
            $ay = \App\Support\TahunAjaran::current();
            self::$rentang = $ay
                ? [$ay->tanggal_mulai->toDateString(), $ay->tanggal_selesai->toDateString()]
                : false;
        }

        if (self::$rentang !== false
            && ($tanggal < self::$rentang[0] || $tanggal > self::$rentang[1])) {
            return false;
        }

        self::$nonEfektif ??= NonEffectiveDay::pluck('tanggal')
            ->map(fn ($t) => substr((string) $t, 0, 10))
            ->flip()
            ->all();

        return ! isset(self::$nonEfektif[$tanggal]);
    }

    public static function flush(): void
    {
        self::$rentang = null;
        self::$nonEfektif = null;
    }
}
