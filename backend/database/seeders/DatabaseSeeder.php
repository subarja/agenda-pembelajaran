<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AcademicYear;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Subject;
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

        // ── Wakasek Kurikulum ──────────────────────────────────────────────────
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

        // ── Guru utama (akun mudah untuk demo) ────────────────────────────────
        $guru = User::create([
            'nama'     => 'Budi Santoso, S.Kom.',
            'email'    => 'guru@smkn2cimahi.sch.id',
            'password' => Hash::make('password'),
            'role'     => UserRole::Guru,
            'status'   => UserStatus::Aktif,
        ]);
        Teacher::create([
            'user_id'     => $guru->id,
            'nip'         => '198003152010011002',
            'mapel_utama' => 'Pemrograman Web',
        ]);

        // ── Wali Kelas demo — role=guru, kapabilitas dari SchoolClass.wali_kelas_id ──
        $wali = User::create([
            'nama'     => 'Siti Rahayu, S.Pd.',
            'email'    => 'walikelas@smkn2cimahi.sch.id',
            'password' => Hash::make('password'),
            'role'     => UserRole::Guru,
            'status'   => UserStatus::Aktif,
        ]);
        Teacher::create([
            'user_id'     => $wali->id,
            'nip'         => '198506202012012003',
            'mapel_utama' => 'Basis Data',
        ]);

        // ── Mata Pelajaran dasar ───────────────────────────────────────────────
        $rpl = Subject::create([
            'kode'     => 'RPL-001',
            'nama'     => 'Pemrograman Web',
            'kelompok' => 'produktif',
            'aktif'    => true,
        ]);

        // ── Kelas ──────────────────────────────────────────────────────────────
        $kelas = SchoolClass::create([
            'tingkat'          => 'XI',
            'jurusan'          => 'Rekayasa Perangkat Lunak',
            'rombel'           => 'A',
            'wali_kelas_id'    => $wali->id,
            'academic_year_id' => $ay->id,
        ]);

        // ── Siswa utama (akun mudah untuk demo) ───────────────────────────────
        $siswaUser = User::create([
            'nama'     => 'Ahmad Fauzi',
            'email'    => 'siswa@smkn2cimahi.sch.id',
            'password' => Hash::make('password'),
            'role'     => UserRole::Siswa,
            'status'   => UserStatus::Aktif,
        ]);
        Student::create([
            'user_id'  => $siswaUser->id,
            'nis'      => '2324001',
            'nisn'     => '0012345678',
            'class_id' => $kelas->id,
            'angkatan' => 2023,
        ]);

        // ── Tambahan siswa awal XI RPL A ───────────────────────────────────────
        $siswaLain = [
            ['nama' => 'Budi Prasetyo',  'nis' => '2324002', 'nisn' => '0012345679', 'email' => 'budi2324002@smkn2cimahi.sch.id'],
            ['nama' => 'Citra Dewi',     'nis' => '2324003', 'nisn' => '0012345680', 'email' => 'citra2324003@smkn2cimahi.sch.id'],
            ['nama' => 'Dani Hermawan',  'nis' => '2324004', 'nisn' => '0012345681', 'email' => 'dani2324004@smkn2cimahi.sch.id'],
            ['nama' => 'Eka Putri',      'nis' => '2324005', 'nisn' => '0012345682', 'email' => 'eka2324005@smkn2cimahi.sch.id'],
            ['nama' => 'Fani Wijaya',    'nis' => '2324006', 'nisn' => '0012345683', 'email' => 'fani2324006@smkn2cimahi.sch.id'],
        ];
        foreach ($siswaLain as $s) {
            $u = User::create([
                'nama'     => $s['nama'],
                'email'    => $s['email'],
                'password' => Hash::make('password'),
                'role'     => UserRole::Siswa,
                'status'   => UserStatus::Aktif,
            ]);
            Student::create([
                'user_id'  => $u->id,
                'nis'      => $s['nis'],
                'nisn'     => $s['nisn'],
                'class_id' => $kelas->id,
                'angkatan' => 2023,
            ]);
        }

        // ── Wali Kelas sekarang role=guru (kapabilitas dari SchoolClass.wali_kelas_id)
        // Ubah role wali di atas agar konsisten (wali sudah create sebagai WaliKelas, migration nanti yg migrate)

        // ── Guru BK demo — role=guru, is_bk=true ──────────────────────────────
        $bkUser = User::create([
            'nama'     => 'Dewi Rahayu, S.Pd.',
            'email'    => 'bk@smkn2cimahi.sch.id',
            'password' => Hash::make('password'),
            'role'     => UserRole::Guru,
            'status'   => UserStatus::Aktif,
            'nomor_hp' => '081234567892',
        ]);
        Teacher::create([
            'user_id'        => $bkUser->id,
            'nip'            => '198803152015042001',
            'mapel_utama'    => 'Bimbingan Konseling',
            'gelar_belakang' => 'S.Pd.',
            'is_bk'          => true,
        ]);

        // ── Orang Tua (linked ke Ahmad Fauzi, dibuat setelah student tersedia) ─
        // Dihubungkan di FullDemoSeeder agar student ID sudah ada

        // ── Data karakter, kelas tambahan, siswa, agenda, EWS ─────────────────
        $this->call([
            CharacterSeeder::class,
            KokurikulerDimensionSeeder::class,
            FullDemoSeeder::class,
        ]);

        // ── Orang Tua demo (linked ke siswa utama Ahmad Fauzi) ────────────────
        $siswaUtama = Student::where('nis', '2324001')->first();
        User::create([
            'nama'               => 'Orang Tua Ahmad',
            'email'              => 'orangtua@smkn2cimahi.sch.id',
            'password'           => Hash::make('password'),
            'role'               => UserRole::OrangTua,
            'status'             => UserStatus::Aktif,
            'linked_student_id'  => $siswaUtama?->id,
        ]);
    }
}
