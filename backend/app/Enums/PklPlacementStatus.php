<?php

namespace App\Enums;

/**
 * Siklus hidup satu penempatan PKL. Disimpan sebagai string di kolom
 * pkl_placements.status. "berlangsung" = default (belum ditutup); tiga sisanya
 * adalah penutupan eksplisit oleh admin/pembimbing.
 *
 * Catatan: "selesai sesuai tanggal" TIDAK disimpan — diturunkan otomatis dari
 * tanggal (lihat PklPlacement::effectiveStatus). Nilai `Selesai` di sini hanya
 * dipakai saat penutupan MANUAL (mis. selesai lebih awal).
 */
enum PklPlacementStatus: string
{
    case Berlangsung = 'berlangsung';
    case Selesai = 'selesai';
    case MengundurkanDiri = 'mengundurkan_diri';
    case Dipindahkan = 'dipindahkan';

    public function label(): string
    {
        return match ($this) {
            self::Berlangsung => 'Berlangsung',
            self::Selesai => 'Selesai',
            self::MengundurkanDiri => 'Mengundurkan diri',
            self::Dipindahkan => 'Dipindahkan',
        };
    }

    /** Penempatan yang sudah DITUTUP manual (tak lagi menagih agenda/absen setelah tanggal berakhir). */
    public function isClosed(): bool
    {
        return $this !== self::Berlangsung;
    }
}
