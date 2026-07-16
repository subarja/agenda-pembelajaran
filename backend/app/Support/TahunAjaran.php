<?php

namespace App\Support;

use App\Models\AcademicYear;

/**
 * Resolusi tahun ajaran KONTEKS REQUEST: TA yang dipilih user saat login
 * (users.current_academic_year_id), fallback ke TA aktif global untuk job
 * antrean/console/user tanpa pilihan. Dengan ini "login memilih semester X"
 * benar-benar memindahkan seluruh tampilan aplikasi ke semester itu.
 *
 * SEMUA query operasional per-TA wajib lewat sini — jangan lagi memanggil
 * AcademicYear::where('aktif', true) langsung, kecuali yang memang butuh TA
 * aktif GLOBAL (login, pemilihan TA, manajemen TA di Panel Admin).
 */
class TahunAjaran
{
    public static function current(): ?AcademicYear
    {
        $user = auth()->user();

        if ($user && $user->current_academic_year_id) {
            $selected = AcademicYear::find($user->current_academic_year_id);
            if ($selected) {
                return $selected;
            }
            // Pilihan login menunjuk TA yang sudah dihapus admin → fallback aktif.
        }

        return AcademicYear::where('aktif', true)->first();
    }

    public static function id(): ?int
    {
        return self::current()?->id;
    }

    /** TA terpilih BUKAN TA aktif global — mode arsip (default baca-saja). */
    public static function isArsip(): bool
    {
        $current = self::current();

        return $current !== null && ! $current->aktif;
    }
}
