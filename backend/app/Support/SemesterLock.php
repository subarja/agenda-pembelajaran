<?php

namespace App\Support;

use App\Models\AcademicYear;
use App\Models\SchoolClass;

/**
 * Penjaga kunci semester: semua endpoint TULIS yang datanya menempel ke kelas
 * (agenda, presensi, jadwal, promosi) wajib memanggil salah satu assert di bawah.
 * TA terkunci = arsip beku; tulisan ditolak 423 (Locked) dengan pesan jelas.
 */
class SemesterLock
{
    public static function assertClassWritable(?int $classId): void
    {
        if ($classId === null) {
            return;
        }

        $ay = SchoolClass::with('academicYear')->find($classId)?->academicYear;
        self::assertAyWritable($ay);
    }

    public static function assertAyWritable(?AcademicYear $ay): void
    {
        self::assertAyNotLocked($ay);

        // TA non-aktif = arsip baca-saja secara default. Admin bisa membuka akses
        // tulis sewaktu-waktu lewat saklar Panel Admin > Pengaturan (koreksi data
        // susulan), lalu menutupnya kembali.
        abort_if(
            $ay !== null && ! $ay->aktif && ! \App\Models\ArchiveWriteSetting::instance()->izinkan_tulis,
            423,
            "Tahun ajaran {$ay?->tahun} " . ucfirst($ay?->semester->value ?? '') .
            ' bukan tahun ajaran aktif (arsip baca-saja). Minta admin membuka saklar' .
            ' "Izinkan tulis di TA arsip" di Panel Admin → Pengaturan bila memang perlu mengubah data lama.',
        );
    }

    /**
     * Hanya cek kunci — dipakai alur transisi tahun ajaran (wizard Naik Kelas)
     * yang memang harus menulis ke TA baru yang BELUM diaktifkan.
     */
    public static function assertAyNotLocked(?AcademicYear $ay): void
    {
        abort_if(
            $ay !== null && $ay->locked,
            423,
            "Tahun ajaran {$ay?->tahun} " . ucfirst($ay?->semester->value ?? '') .
            ' terkunci (arsip read-only). Buka kuncinya di Panel Admin → Tahun Ajaran bila memang perlu mengubah data lama.',
        );
    }
}
