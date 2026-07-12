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
        abort_if(
            $ay !== null && $ay->locked,
            423,
            "Tahun ajaran {$ay?->tahun} " . ucfirst($ay?->semester->value ?? '') .
            ' terkunci (arsip read-only). Buka kuncinya di Panel Admin → Tahun Ajaran bila memang perlu mengubah data lama.',
        );
    }
}
