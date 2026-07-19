<?php

namespace App\Enums;

enum EwsLevel: string
{
    case Hijau = 'hijau';
    case Kuning = 'kuning';
    case Oranye = 'oranye';
    case Merah = 'merah';

    // Ambang tiap indikator. Nilainya diambil dari EwsController, yang perhitungannya
    // dipakai halaman EWS — itulah angka yang selama ini dilihat pengguna.
    public const AMBANG_KEHADIRAN = 80.0;

    public const AMBANG_KARAKTER = 0;

    public const AMBANG_CATATAN = 3;

    public const AMBANG_NILAI = 70.0;

    /**
     * Satu-satunya aturan penentuan level EWS siswa.
     *
     * Sebelum 2026-07-19 ada TIGA rumus berbeda yang menulis kolom `ews_statuses.level`
     * yang sama — EwsController (4 indikator), AlphaAlertService (3 indikator, membuang
     * `nilai`), dan CharacterService (ambang absolut kehadiran 85/75/50). Level yang
     * tersimpan jadi bergantung pada layanan mana yang kebetulan jalan paling akhir:
     * siswa dengan kehadiran 78% dan karakter −15 bisa tercatat `oranye` atau `kuning`
     * untuk kondisi yang sama persis. Melanggar prinsip "satu perilaku = satu sumber
     * kebenaran".
     *
     * Rumus EwsController yang dipakai sebagai acuan karena paling lengkap dan paling
     * dekat dengan yang tampil di layar: hitung berapa indikator yang menyala.
     *
     * `nilai` boleh null (siswa belum punya nilai aktivitas sama sekali) — kondisi itu
     * bukan peringatan, hanya "belum ada data".
     */
    public static function dariKomponen(float $kehadiran, int $karakter, int $catatan, ?float $nilai): self
    {
        $peringatan = ($kehadiran < self::AMBANG_KEHADIRAN ? 1 : 0)
            + ($karakter < self::AMBANG_KARAKTER ? 1 : 0)
            + ($catatan >= self::AMBANG_CATATAN ? 1 : 0)
            + ($nilai !== null && $nilai < self::AMBANG_NILAI ? 1 : 0);

        return match (true) {
            $peringatan >= 3 => self::Merah,
            $peringatan === 2 => self::Oranye,
            $peringatan === 1 => self::Kuning,
            default => self::Hijau,
        };
    }
}
