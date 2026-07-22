<?php

namespace App\Support;

use App\Models\PiketShift;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Otorisasi piket berbasis KAPABILITAS (meniru App\Support\ClassAccess & PklMode::isPembimbing):
 * guru piket = guru yang PUNYA shift pada hari-dalam-seminggu itu (scope TA aktif). Bukan cek role.
 *
 * Pemisahan penting:
 *  - Akses menu/aksi (isPetugas) = berbasis HARI (toleran: sepanjang hari bertugas, jam tak dilihat).
 *  - Target notifikasi (petugasUsers) = berbasis HARI + JAM shift aktif (presisi ke yang sedang jaga),
 *    dengan fallback ke seluruh petugas hari itu bila jam kejadian di luar semua shift.
 *
 * Batas shift: [jam_mulai, jam_selesai) — mulai inklusif, selesai eksklusif. Zona Asia/Jakarta.
 */
class PiketAccess
{
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

    /** Normalisasi jam ke 'H:i:s' untuk perbandingan string yang aman. */
    private static function normJam(?string $jam): string
    {
        if ($jam === null || $jam === '') {
            return '00:00:00';
        }
        try {
            return Carbon::parse($jam)->format('H:i:s');
        } catch (\Throwable) {
            return '00:00:00';
        }
    }

    /** Tanggal default = hari ini (Asia/Jakarta). Akses per HARI (jam tidak dibatasi). */
    public static function isPetugas(User $user, ?string $tanggal = null): bool
    {
        $teacher = $user->teacher ?? Teacher::where('user_id', $user->id)->first();
        if (! $teacher) {
            return false;
        }

        $tanggal ??= Carbon::now('Asia/Jakarta')->toDateString();
        $hari = self::hariDari($tanggal);
        if (! $hari) {
            return false;
        }

        return PiketShift::tahunAjaran()
            ->where('hari', $hari)
            ->whereHas('teachers', fn ($q) => $q->where('teachers.id', $teacher->id))
            ->exists();
    }

    /**
     * Akun user (guru) target notifikasi = petugas shift yang AKTIF pada jam kejadian.
     * Fallback bila jam di luar semua shift → seluruh petugas hari itu (jangan ada notif hilang).
     */
    public static function petugasUsers(?string $tanggal = null, ?string $jam = null): Collection
    {
        $tanggal ??= Carbon::now('Asia/Jakarta')->toDateString();
        $jam ??= Carbon::now('Asia/Jakarta')->format('H:i:s');
        $hari = self::hariDari($tanggal);
        if (! $hari) {
            return collect();
        }

        $shifts = PiketShift::tahunAjaran()
            ->where('hari', $hari)
            ->with('teachers.user')
            ->get();
        if ($shifts->isEmpty()) {
            return collect();
        }

        $jamN = self::normJam($jam);
        $aktif = $shifts->filter(
            fn ($s) => self::normJam($s->jam_mulai) <= $jamN && $jamN < self::normJam($s->jam_selesai)
        );

        $sumber = $aktif->isNotEmpty() ? $aktif : $shifts;   // fallback ke seluruh petugas hari itu

        return $sumber
            ->flatMap(fn ($s) => $s->teachers)
            ->map(fn ($t) => $t->user)
            ->filter()
            ->unique('id')
            ->values();
    }

    /** Id shift piket milik user pada hari itu (untuk kapabilitas & audit). */
    public static function assignmentIds(User $user, ?string $tanggal = null): array
    {
        $teacher = $user->teacher ?? Teacher::where('user_id', $user->id)->first();
        if (! $teacher) {
            return [];
        }

        $tanggal ??= Carbon::now('Asia/Jakarta')->toDateString();
        $hari = self::hariDari($tanggal);
        if (! $hari) {
            return [];
        }

        return PiketShift::tahunAjaran()
            ->where('hari', $hari)
            ->whereHas('teachers', fn ($q) => $q->where('teachers.id', $teacher->id))
            ->pluck('id')->all();
    }
}
