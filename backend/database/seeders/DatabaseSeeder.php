<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AcademicYear;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ── Tahun Ajaran aktif ─────────────────────────────────────────────────
        $ay = AcademicYear::create([
            'tahun'    => '2025/2026',
            'semester' => 'ganjil',
            'aktif'    => true,
        ]);

        // ── Admin ──────────────────────────────────────────────────────────────
        User::create([
            'nama'     => 'Administrator',
            'email'    => 'admin@smkn2cimahi.sch.id',
            'password' => Hash::make('password'),
            'role'     => UserRole::Admin,
            'status'   => UserStatus::Aktif,
        ]);

        // ── Wakasek Kurikulum (Product Owner) ──────────────────────────────────
        $wakasek = User::create([
            'nama'     => 'Kusman Subarja, S.Pd., M.T.',
            'email'    => 'kusman@smkn2cimahi.sch.id',
            'password' => Hash::make('password'),
            'role'     => UserRole::Wakasek,
            'status'   => UserStatus::Aktif,
        ]);
        Teacher::create([
            'user_id'     => $wakasek->id,
            'nip'         => '197501012005011001',
            'mapel_utama' => 'Rekayasa Perangkat Lunak',
        ]);

        // ── Guru ───────────────────────────────────────────────────────────────
        $guru = User::create([
            'nama'     => 'Budi Santoso, S.Kom.',
            'email'    => 'budi@smkn2cimahi.sch.id',
            'password' => Hash::make('password'),
            'role'     => UserRole::Guru,
            'status'   => UserStatus::Aktif,
        ]);
        Teacher::create([
            'user_id'     => $guru->id,
            'nip'         => '198003152010011002',
            'mapel_utama' => 'Pemrograman Web',
        ]);

        // ── Wali Kelas ─────────────────────────────────────────────────────────
        $wali = User::create([
            'nama'     => 'Siti Rahayu, S.Pd.',
            'email'    => 'siti@smkn2cimahi.sch.id',
            'password' => Hash::make('password'),
            'role'     => UserRole::WaliKelas,
            'status'   => UserStatus::Aktif,
        ]);
        Teacher::create([
            'user_id'     => $wali->id,
            'nip'         => '198506202012012003',
            'mapel_utama' => 'Basis Data',
        ]);

        // ── Kelas ──────────────────────────────────────────────────────────────
        $kelas = SchoolClass::create([
            'tingkat'          => 'XI',
            'jurusan'          => 'Rekayasa Perangkat Lunak',
            'rombel'           => 'A',
            'wali_kelas_id'    => $wali->id,
            'academic_year_id' => $ay->id,
        ]);

        // ── Siswa ──────────────────────────────────────────────────────────────
        $siswaUser = User::create([
            'nama'     => 'Ahmad Fauzi',
            'email'    => 'ahmad@smkn2cimahi.sch.id',
            'password' => Hash::make('password'),
            'role'     => UserRole::Siswa,
            'status'   => UserStatus::Aktif,
        ]);
        Student::create([
            'user_id'   => $siswaUser->id,
            'nis'       => '2324001',
            'nisn'      => '0012345678',
            'class_id'  => $kelas->id,
            'angkatan'  => 2023,
        ]);
    }
}
