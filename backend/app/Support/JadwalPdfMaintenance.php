<?php

namespace App\Support;

use App\Models\SchoolClass;
use App\Models\Teacher;
use Illuminate\Support\Facades\Storage;

/**
 * Pemeliharaan berkas PDF jadwal (upload masal aSc). Berkas disimpan dengan nama
 * DETERMINISTIK & jelas tautannya (guru-{nip}.pdf, kelas-{ta}-{tingkat}-{kode}-{rombel}.pdf)
 * supaya mudah ditelusuri. Kelas ini menyapu berkas "yatim" — yang tak lagi direferensikan
 * guru/kelas mana pun (mis. sisa setelah reset/re-import DB) — agar tak menumpuk di server.
 */
class JadwalPdfMaintenance
{
    /** Direktori penyimpanan PDF jadwal pada disk 'public'. */
    private const DIRS = ['jadwal_guru', 'jadwal_kelas'];

    /**
     * Hapus berkas PDF jadwal yang tidak lagi direferensikan guru/kelas mana pun.
     *
     * @return array{dihapus:int, dipakai:int, freed_kb:int, files:array<int,string>}
     */
    public static function pruneOrphans(bool $dryRun = false): array
    {
        $disk = Storage::disk('public');

        // withTrashed: jangan hapus berkas yang masih dipegang record soft-deleted.
        $referenced = Teacher::withTrashed()->whereNotNull('jadwal_pdf')->pluck('jadwal_pdf')
            ->merge(SchoolClass::withTrashed()->whereNotNull('jadwal_pdf')->pluck('jadwal_pdf'))
            ->filter()
            ->unique()
            ->flip();

        $dihapus = 0;
        $dipakai = 0;
        $freed = 0;
        $files = [];

        foreach (self::DIRS as $dir) {
            foreach ($disk->files($dir) as $path) {
                if ($referenced->has($path)) {
                    $dipakai++;

                    continue;
                }
                $freed += $disk->size($path);
                $files[] = $path;
                if (! $dryRun) {
                    $disk->delete($path);
                }
                $dihapus++;
            }
        }

        return [
            'dihapus' => $dihapus,
            'dipakai' => $dipakai,
            'freed_kb' => (int) round($freed / 1024),
            'files' => $files,
        ];
    }
}
