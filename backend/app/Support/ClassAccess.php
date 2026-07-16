<?php

namespace App\Support;

use App\Enums\UserRole;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Satu-satunya sumber kebenaran untuk "kelas mana yang boleh diakses seorang pengguna".
 *
 * Sebelum ini, jawabannya hidup sebagai method privat di EwsController dan dipakai ulang
 * dengan cara ditulis ulang — atau, lebih sering, tidak ditulis sama sekali. Audit
 * 2026-07-09 menemukan tiga endpoint yang memeriksa KAPABILITAS ("apakah orang ini wali
 * kelas?") lalu memperlakukannya sebagai IZIN ("berarti boleh lihat siswa mana pun"),
 * sehingga wali kelas satu rombel bisa membaca catatan konseling siswa rombel lain.
 *
 * Aturan yang harus dipegang setiap pemanggil:
 *
 *   `null`             = tanpa batas (admin & wakasek — konsumen data tingkat sekolah)
 *   Collection<int>    = hanya class_id di dalamnya
 *   Collection kosong  = tidak boleh kelas mana pun
 *
 * `null` sengaja dipilih untuk "semua", bukan koleksi berisi seluruh class_id, supaya
 * pemanggil yang lupa menanganinya gagal keras (whereIn(null)) alih-alih diam-diam
 * membocorkan segalanya.
 */
class ClassAccess
{
    /** Admin & wakasek membaca lintas sekolah — EWS, rekap perkembangan, laporan. */
    public static function isSchoolWide(User $user): bool
    {
        return in_array($user->role, [UserRole::Admin, UserRole::Wakasek], true);
    }

    /**
     * Kelas yang diwalikelasi pengguna ini. Berbasis data, bukan role literal.
     *
     * Dibatasi ke tahun ajaran aktif: seorang guru yang tahun lalu wali kelas XII dan
     * tahun ini tidak, tidak boleh terus membaca catatan pembinaan angkatan lamanya.
     */
    public static function waliClassIds(User $user): Collection
    {
        return SchoolClass::where('wali_kelas_id', $user->id)
            ->where('academic_year_id', \App\Support\TahunAjaran::id())
            ->pluck('id')
            ->unique()
            ->values();
    }

    /** Kelas yang diampu sebagai guru BK. Kosong kalau ia bukan BK. */
    public static function bkClassIds(User $user): Collection
    {
        $teacher = Teacher::where('user_id', $user->id)->first();

        return $teacher && $teacher->is_bk
            ? self::scheduleClassIds($teacher)
            : collect();
    }

    /** Kelas tempat ia mengajar (jadwal aktif), terlepas dari status wali kelas/BK. */
    public static function taughtClassIds(User $user): Collection
    {
        $teacher = Teacher::where('user_id', $user->id)->first();

        return $teacher ? self::scheduleClassIds($teacher) : collect();
    }

    /**
     * Kelas yang ia BINA: perwalian ∪ kelas yang diampu sebagai BK.
     *
     * Ini batas untuk data pribadi & pembinaan — rekap siswa, catatan konseling, EWS.
     * Guru mata pelajaran biasa mendapat koleksi KOSONG di sini, dan itu disengaja: ia
     * boleh memberi poin karakter kepada siapa pun (prinsip "karakter sebagai aset
     * kolektif"), tapi tidak boleh membaca riwayat pembinaan siswa yang bukan binaannya.
     */
    public static function pastoralClassIds(User $user): ?Collection
    {
        if (self::isSchoolWide($user)) {
            return null;
        }

        return self::waliClassIds($user)->merge(self::bkClassIds($user))->unique()->values();
    }

    /**
     * Kelas yang ia AJAR atau bina: jadwal aktif ∪ perwalian.
     *
     * Batas yang lebih longgar, untuk data operasional kelas — daftar siswa per kelas
     * (presensi, grid karakter), rekap hari efektif. Guru mapel termasuk di sini karena
     * ia memang perlu daftar absen kelas yang ia ajar.
     */
    public static function teachingClassIds(User $user): ?Collection
    {
        if (self::isSchoolWide($user)) {
            return null;
        }

        return self::taughtClassIds($user)->merge(self::waliClassIds($user))->unique()->values();
    }

    /** Bolehkah $user mengakses kelas $classId dalam batas $allowed? */
    public static function allows(?Collection $allowed, ?int $classId): bool
    {
        if ($allowed === null) {
            return true;
        }

        return $classId !== null && $allowed->contains($classId);
    }

    /**
     * Siswa ini adalah dirinya sendiri (akun siswa) atau anaknya (akun orang tua).
     * Dipakai sebelum pemeriksaan kelas — dua peran ini tidak punya kelas "yang diampu".
     */
    public static function isOwnStudent(User $user, Student $student): bool
    {
        if ($user->role === UserRole::Siswa) {
            return Student::where('user_id', $user->id)->value('id') === $student->id;
        }

        if ($user->role === UserRole::OrangTua) {
            return $user->linked_student_id !== null && $user->linked_student_id === $student->id;
        }

        return false;
    }

    /** Peran yang tidak pernah boleh melihat data siswa selain dirinya/anaknya. */
    public static function isStudentSide(User $user): bool
    {
        return in_array($user->role, [UserRole::Siswa, UserRole::OrangTua], true);
    }

    private static function scheduleClassIds(Teacher $teacher): Collection
    {
        // tahunAjaran(): alasan yang sama dengan waliClassIds — akses mengikuti jadwal
        // TA aktif, bukan jadwal arsip tahun-tahun sebelumnya.
        return Schedule::tahunAjaran()
            ->where('teacher_id', $teacher->id)
            ->where('aktif', true)
            ->pluck('class_id')
            ->unique()
            ->values();
    }
}
