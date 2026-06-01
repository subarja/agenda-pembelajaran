<?php

namespace Database\Seeders;

use App\Enums\Hari;
use App\Enums\Semester;
use App\Enums\SubjectKelompok;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\EwsLevel;
use App\Models\ActionThreshold;
use App\Models\Agenda;
use App\Models\AcademicYear;
use App\Models\CharacterInput;
use App\Models\CharacterSubitem;
use App\Models\EwsStatus;
use App\Models\LearningObjective;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\StudentAttendance;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Carbon;

class FullDemoSeeder extends Seeder
{
    public function run(): void
    {
        $ay  = AcademicYear::where('aktif', true)->firstOrFail();
        $now = Carbon::now('Asia/Jakarta');

        // ─────────────────────────────────────────────────────────────────────
        // 1. MATA PELAJARAN TAMBAHAN
        // ─────────────────────────────────────────────────────────────────────
        $subjects = $this->seedSubjects();

        // ─────────────────────────────────────────────────────────────────────
        // 2. GURU BARU
        // ─────────────────────────────────────────────────────────────────────
        $teachers = $this->seedTeachers();

        // ─────────────────────────────────────────────────────────────────────
        // 3. KELAS BARU
        // ─────────────────────────────────────────────────────────────────────
        $classes = $this->seedClasses($ay, $teachers);

        // ─────────────────────────────────────────────────────────────────────
        // 4. SISWA BARU (tambah ke kelas lama + isi kelas baru)
        // ─────────────────────────────────────────────────────────────────────
        $studentsPerClass = $this->seedStudents($ay, $classes);

        // ─────────────────────────────────────────────────────────────────────
        // 5. JADWAL (tambah ke kelas lama + kelas baru)
        // ─────────────────────────────────────────────────────────────────────
        $schedules = $this->seedSchedules($subjects, $teachers, $classes);

        // ─────────────────────────────────────────────────────────────────────
        // 6. TUJUAN PEMBELAJARAN (TP)
        // ─────────────────────────────────────────────────────────────────────
        $this->seedLearningObjectives($schedules, $teachers);

        // ─────────────────────────────────────────────────────────────────────
        // 7. HISTORI AGENDA (4 minggu lalu)
        // ─────────────────────────────────────────────────────────────────────
        $this->seedAgendaHistory($schedules, $studentsPerClass, $now);

        // ─────────────────────────────────────────────────────────────────────
        // 8. KARAKTER INPUT (positif & negatif untuk variasi EWS)
        // ─────────────────────────────────────────────────────────────────────
        $this->seedCharacterInputs($ay, $studentsPerClass, $teachers);

        // ─────────────────────────────────────────────────────────────────────
        // 9. ACTION THRESHOLDS (aturan EWS)
        // ─────────────────────────────────────────────────────────────────────
        $this->seedActionThresholds();

        // ─────────────────────────────────────────────────────────────────────
        // 10. RECALCULATE EWS
        // ─────────────────────────────────────────────────────────────────────
        $this->recalculateEws($ay, $studentsPerClass);
    }

    // =========================================================================
    private function seedSubjects(): array
    {
        $defs = [
            ['kode' => 'BD-001',  'nama' => 'Basis Data',                       'kelompok' => SubjectKelompok::Produktif],
            ['kode' => 'PBO-001', 'nama' => 'Pemrograman Berorientasi Objek',   'kelompok' => SubjectKelompok::Produktif],
            ['kode' => 'DGP-001', 'nama' => 'Desain Grafis Percetakan',         'kelompok' => SubjectKelompok::Produktif],
            ['kode' => 'MTK-001', 'nama' => 'Matematika',                       'kelompok' => SubjectKelompok::Adaptif],
            ['kode' => 'BI-001',  'nama' => 'Bahasa Indonesia',                 'kelompok' => SubjectKelompok::Normatif],
            ['kode' => 'BIG-001', 'nama' => 'Bahasa Inggris',                   'kelompok' => SubjectKelompok::Adaptif],
        ];

        $map = [];
        foreach ($defs as $d) {
            $map[$d['kode']] = Subject::firstOrCreate(['kode' => $d['kode']], [
                'nama'     => $d['nama'],
                'kelompok' => $d['kelompok'],
                'aktif'    => true,
            ]);
        }

        // Juga ambil subject yang sudah ada
        $map['RPL-001'] = Subject::where('kode', 'RPL-001')->first();

        return $map;
    }

    // =========================================================================
    private function seedTeachers(): array
    {
        // Ambil teacher yang sudah ada
        $existing = [
            'kusman' => Teacher::find(1),
            'budi'   => Teacher::find(2),
            'siti'   => Teacher::find(3),
        ];

        $defs = [
            'deni'  => ['nama' => 'Deni Pratama, S.T.',        'nip' => '199001012018011004', 'mapel' => 'Basis Data',                     'email' => 'deni@smkn2cimahi.sch.id',   'role' => UserRole::Guru],
            'rina'  => ['nama' => 'Rina Wulandari, M.Kom.',    'nip' => '198811202016022005', 'mapel' => 'Pemrograman Berorientasi Objek', 'email' => 'rina@smkn2cimahi.sch.id',   'role' => UserRole::Guru],
            'hendra'=> ['nama' => 'Hendra Kusuma, S.Pd.',      'nip' => '197809142006011006', 'mapel' => 'Matematika',                     'email' => 'hendra@smkn2cimahi.sch.id', 'role' => UserRole::Guru],
            'yuni'  => ['nama' => 'Yuni Astuti, S.Pd.',        'nip' => '198304082010012007', 'mapel' => 'Bahasa Indonesia',               'email' => 'yuni@smkn2cimahi.sch.id',   'role' => UserRole::WaliKelas],
        ];

        $new = [];
        foreach ($defs as $key => $d) {
            $user = User::firstOrCreate(['email' => $d['email']], [
                'nama'     => $d['nama'],
                'password' => Hash::make('password'),
                'role'     => $d['role'],
                'status'   => UserStatus::Aktif,
            ]);
            $new[$key] = Teacher::firstOrCreate(['user_id' => $user->id], [
                'nip'         => $d['nip'],
                'mapel_utama' => $d['mapel'],
            ]);
        }

        return array_merge($existing, $new);
    }

    // =========================================================================
    private function seedClasses(AcademicYear $ay, array $teachers): array
    {
        $existing = ['xi_rpl_a' => SchoolClass::find(1)];

        // Update wali kelas XI RPL A ke Siti (sudah benar)
        $existing['xi_rpl_a']->update(['wali_kelas_id' => $teachers['siti']->user_id]);

        $defs = [
            'xi_rpl_b'  => ['tingkat' => Tingkat::XI,  'jurusan' => 'Rekayasa Perangkat Lunak', 'rombel' => 'B', 'wali' => $teachers['budi']->user_id],
            'xii_rpl_a' => ['tingkat' => Tingkat::XII, 'jurusan' => 'Rekayasa Perangkat Lunak', 'rombel' => 'A', 'wali' => $teachers['kusman']->user_id],
            'x_rpl_a'   => ['tingkat' => Tingkat::X,   'jurusan' => 'Rekayasa Perangkat Lunak', 'rombel' => 'A', 'wali' => $teachers['yuni']->user_id],
        ];

        $new = [];
        foreach ($defs as $key => $d) {
            $new[$key] = SchoolClass::firstOrCreate(
                ['tingkat' => $d['tingkat'], 'jurusan' => $d['jurusan'], 'rombel' => $d['rombel'], 'academic_year_id' => $ay->id],
                ['wali_kelas_id' => $d['wali']]
            );
        }

        return array_merge($existing, $new);
    }

    // =========================================================================
    private function seedStudents(AcademicYear $ay, array $classes): array
    {
        // Siswa sudah ada untuk xi_rpl_a (6 siswa, id 1-6)
        $allStudents = [];
        $allStudents['xi_rpl_a'] = Student::where('class_id', $classes['xi_rpl_a']->id)->get()->all();

        // Tambah siswa ke XI RPL A (sampai 15)
        $moreXiA = [
            ['nama' => 'Gilang Saputra',    'nis' => '2324007', 'nisn' => '0012345684'],
            ['nama' => 'Hani Rahmawati',    'nis' => '2324008', 'nisn' => '0012345685'],
            ['nama' => 'Irfan Maulana',     'nis' => '2324009', 'nisn' => '0012345686'],
            ['nama' => 'Jihan Putri',       'nis' => '2324010', 'nisn' => '0012345687'],
            ['nama' => 'Kevin Andrean',     'nis' => '2324011', 'nisn' => '0012345688'],
            ['nama' => 'Lusi Anggraeni',    'nis' => '2324012', 'nisn' => '0012345689'],
            ['nama' => 'Muhamad Rizki',     'nis' => '2324013', 'nisn' => '0012345690'],
            ['nama' => 'Nadia Safitri',     'nis' => '2324014', 'nisn' => '0012345691'],
            ['nama' => 'Oscar Firdaus',     'nis' => '2324015', 'nisn' => '0012345692'],
        ];
        foreach ($moreXiA as $s) {
            $u  = User::firstOrCreate(['email' => strtolower(explode(' ', $s['nama'])[0]) . $s['nis'] . '@smkn2cimahi.sch.id'], [
                'nama' => $s['nama'], 'password' => Hash::make('password'),
                'role' => UserRole::Siswa, 'status' => UserStatus::Aktif,
            ]);
            $st = Student::firstOrCreate(['nis' => $s['nis']], [
                'user_id' => $u->id, 'nisn' => $s['nisn'],
                'class_id' => $classes['xi_rpl_a']->id, 'angkatan' => 2023,
            ]);
            $allStudents['xi_rpl_a'][] = $st;
        }

        // XI RPL B (15 siswa)
        $xiB = [
            ['nama' => 'Agus Supriyanto',   'nis' => '2324101', 'nisn' => '0023456001'],
            ['nama' => 'Bella Anggraini',   'nis' => '2324102', 'nisn' => '0023456002'],
            ['nama' => 'Cahya Permana',     'nis' => '2324103', 'nisn' => '0023456003'],
            ['nama' => 'Dewi Kartika',      'nis' => '2324104', 'nisn' => '0023456004'],
            ['nama' => 'Eko Prasetyo',      'nis' => '2324105', 'nisn' => '0023456005'],
            ['nama' => 'Fitri Handayani',   'nis' => '2324106', 'nisn' => '0023456006'],
            ['nama' => 'Galih Nugroho',     'nis' => '2324107', 'nisn' => '0023456007'],
            ['nama' => 'Hesti Rahayu',      'nis' => '2324108', 'nisn' => '0023456008'],
            ['nama' => 'Ivan Setiawan',     'nis' => '2324109', 'nisn' => '0023456009'],
            ['nama' => 'Junaidi Pratama',   'nis' => '2324110', 'nisn' => '0023456010'],
            ['nama' => 'Kiki Amelia',       'nis' => '2324111', 'nisn' => '0023456011'],
            ['nama' => 'Lukman Hakim',      'nis' => '2324112', 'nisn' => '0023456012'],
            ['nama' => 'Maya Susanti',      'nis' => '2324113', 'nisn' => '0023456013'],
            ['nama' => 'Naufal Akbar',      'nis' => '2324114', 'nisn' => '0023456014'],
            ['nama' => 'Okta Wulandari',    'nis' => '2324115', 'nisn' => '0023456015'],
        ];
        $allStudents['xi_rpl_b'] = [];
        foreach ($xiB as $s) {
            $u  = User::firstOrCreate(['email' => strtolower(explode(' ', $s['nama'])[0]) . $s['nis'] . '@smkn2cimahi.sch.id'], [
                'nama' => $s['nama'], 'password' => Hash::make('password'),
                'role' => UserRole::Siswa, 'status' => UserStatus::Aktif,
            ]);
            $st = Student::firstOrCreate(['nis' => $s['nis']], [
                'user_id' => $u->id, 'nisn' => $s['nisn'],
                'class_id' => $classes['xi_rpl_b']->id, 'angkatan' => 2023,
            ]);
            $allStudents['xi_rpl_b'][] = $st;
        }

        // XII RPL A (12 siswa — angkatan 2022)
        $xiiA = [
            ['nama' => 'Andika Putra',      'nis' => '2223101', 'nisn' => '0034567001'],
            ['nama' => 'Bunga Melati',      'nis' => '2223102', 'nisn' => '0034567002'],
            ['nama' => 'Chandra Wijaya',    'nis' => '2223103', 'nisn' => '0034567003'],
            ['nama' => 'Dinda Permata',     'nis' => '2223104', 'nisn' => '0034567004'],
            ['nama' => 'Erlangga Putra',    'nis' => '2223105', 'nisn' => '0034567005'],
            ['nama' => 'Fanny Kurnia',      'nis' => '2223106', 'nisn' => '0034567006'],
            ['nama' => 'Guntur Sasongko',   'nis' => '2223107', 'nisn' => '0034567007'],
            ['nama' => 'Hari Wibowo',       'nis' => '2223108', 'nisn' => '0034567008'],
            ['nama' => 'Intan Permata',     'nis' => '2223109', 'nisn' => '0034567009'],
            ['nama' => 'Joko Susilo',       'nis' => '2223110', 'nisn' => '0034567010'],
            ['nama' => 'Kartika Sari',      'nis' => '2223111', 'nisn' => '0034567011'],
            ['nama' => 'Luqman Fathoni',    'nis' => '2223112', 'nisn' => '0034567012'],
        ];
        $allStudents['xii_rpl_a'] = [];
        foreach ($xiiA as $s) {
            $u  = User::firstOrCreate(['email' => strtolower(explode(' ', $s['nama'])[0]) . $s['nis'] . '@smkn2cimahi.sch.id'], [
                'nama' => $s['nama'], 'password' => Hash::make('password'),
                'role' => UserRole::Siswa, 'status' => UserStatus::Aktif,
            ]);
            $st = Student::firstOrCreate(['nis' => $s['nis']], [
                'user_id' => $u->id, 'nisn' => $s['nisn'],
                'class_id' => $classes['xii_rpl_a']->id, 'angkatan' => 2022,
            ]);
            $allStudents['xii_rpl_a'][] = $st;
        }

        // X RPL A (12 siswa — angkatan 2025)
        $xA = [
            ['nama' => 'Alif Ramadhan',     'nis' => '2526001', 'nisn' => '0045678001'],
            ['nama' => 'Bella Cahyani',     'nis' => '2526002', 'nisn' => '0045678002'],
            ['nama' => 'Candra Dinata',     'nis' => '2526003', 'nisn' => '0045678003'],
            ['nama' => 'Desty Amalia',      'nis' => '2526004', 'nisn' => '0045678004'],
            ['nama' => 'Evan Mahardika',    'nis' => '2526005', 'nisn' => '0045678005'],
            ['nama' => 'Farida Hanum',      'nis' => '2526006', 'nisn' => '0045678006'],
            ['nama' => 'Gilang Wirawan',    'nis' => '2526007', 'nisn' => '0045678007'],
            ['nama' => 'Hilda Pratiwi',     'nis' => '2526008', 'nisn' => '0045678008'],
            ['nama' => 'Imam Fauzi',        'nis' => '2526009', 'nisn' => '0045678009'],
            ['nama' => 'Jovanka Putri',     'nis' => '2526010', 'nisn' => '0045678010'],
            ['nama' => 'Khoirul Anwar',     'nis' => '2526011', 'nisn' => '0045678011'],
            ['nama' => 'Laili Rahmah',      'nis' => '2526012', 'nisn' => '0045678012'],
        ];
        $allStudents['x_rpl_a'] = [];
        foreach ($xA as $s) {
            $u  = User::firstOrCreate(['email' => strtolower(explode(' ', $s['nama'])[0]) . $s['nis'] . '@smkn2cimahi.sch.id'], [
                'nama' => $s['nama'], 'password' => Hash::make('password'),
                'role' => UserRole::Siswa, 'status' => UserStatus::Aktif,
            ]);
            $st = Student::firstOrCreate(['nis' => $s['nis']], [
                'user_id' => $u->id, 'nisn' => $s['nisn'],
                'class_id' => $classes['x_rpl_a']->id, 'angkatan' => 2025,
            ]);
            $allStudents['x_rpl_a'][] = $st;
        }

        return $allStudents;
    }

    // =========================================================================
    private function seedSchedules(array $subjects, array $teachers, array $classes): array
    {
        // Jadwal sudah ada: id=1 (XI RPL A, Senin, Budi, RPL-001)
        $existing = ['xi_rpl_a_senin_budi' => Schedule::find(1)];

        $defs = [
            // XI RPL A — tambahan jadwal
            ['class' => 'xi_rpl_a',  'subject' => 'BD-001',  'teacher' => 'siti',   'hari' => Hari::Selasa, 'mulai' => '08:00', 'selesai' => '09:30'],
            ['class' => 'xi_rpl_a',  'subject' => 'PBO-001', 'teacher' => 'rina',   'hari' => Hari::Rabu,   'mulai' => '08:00', 'selesai' => '09:30'],
            ['class' => 'xi_rpl_a',  'subject' => 'MTK-001', 'teacher' => 'hendra', 'hari' => Hari::Kamis,  'mulai' => '10:00', 'selesai' => '11:30'],
            ['class' => 'xi_rpl_a',  'subject' => 'BI-001',  'teacher' => 'yuni',   'hari' => Hari::Jumat,  'mulai' => '08:00', 'selesai' => '09:30'],
            ['class' => 'xi_rpl_a',  'subject' => 'RPL-001', 'teacher' => 'budi',   'hari' => Hari::Rabu,   'mulai' => '10:00', 'selesai' => '11:30'],

            // XI RPL B
            ['class' => 'xi_rpl_b',  'subject' => 'RPL-001', 'teacher' => 'budi',   'hari' => Hari::Senin,  'mulai' => '10:00', 'selesai' => '11:30'],
            ['class' => 'xi_rpl_b',  'subject' => 'BD-001',  'teacher' => 'siti',   'hari' => Hari::Selasa, 'mulai' => '10:00', 'selesai' => '11:30'],
            ['class' => 'xi_rpl_b',  'subject' => 'PBO-001', 'teacher' => 'rina',   'hari' => Hari::Rabu,   'mulai' => '13:00', 'selesai' => '14:30'],
            ['class' => 'xi_rpl_b',  'subject' => 'MTK-001', 'teacher' => 'hendra', 'hari' => Hari::Kamis,  'mulai' => '08:00', 'selesai' => '09:30'],
            ['class' => 'xi_rpl_b',  'subject' => 'BI-001',  'teacher' => 'yuni',   'hari' => Hari::Jumat,  'mulai' => '10:00', 'selesai' => '11:30'],

            // XII RPL A
            ['class' => 'xii_rpl_a', 'subject' => 'PBO-001', 'teacher' => 'rina',   'hari' => Hari::Senin,  'mulai' => '08:00', 'selesai' => '09:30'],
            ['class' => 'xii_rpl_a', 'subject' => 'BD-001',  'teacher' => 'deni',   'hari' => Hari::Selasa, 'mulai' => '08:00', 'selesai' => '09:30'],
            ['class' => 'xii_rpl_a', 'subject' => 'RPL-001', 'teacher' => 'budi',   'hari' => Hari::Rabu,   'mulai' => '08:00', 'selesai' => '09:30'],
            ['class' => 'xii_rpl_a', 'subject' => 'MTK-001', 'teacher' => 'hendra', 'hari' => Hari::Kamis,  'mulai' => '13:00', 'selesai' => '14:30'],
            ['class' => 'xii_rpl_a', 'subject' => 'BIG-001', 'teacher' => 'kusman', 'hari' => Hari::Jumat,  'mulai' => '08:00', 'selesai' => '09:30'],

            // X RPL A
            ['class' => 'x_rpl_a',   'subject' => 'DGP-001', 'teacher' => 'deni',   'hari' => Hari::Senin,  'mulai' => '13:00', 'selesai' => '14:30'],
            ['class' => 'x_rpl_a',   'subject' => 'MTK-001', 'teacher' => 'hendra', 'hari' => Hari::Selasa, 'mulai' => '08:00', 'selesai' => '09:30'],
            ['class' => 'x_rpl_a',   'subject' => 'BI-001',  'teacher' => 'yuni',   'hari' => Hari::Rabu,   'mulai' => '08:00', 'selesai' => '09:30'],
            ['class' => 'x_rpl_a',   'subject' => 'BIG-001', 'teacher' => 'kusman', 'hari' => Hari::Kamis,  'mulai' => '08:00', 'selesai' => '09:30'],
            ['class' => 'x_rpl_a',   'subject' => 'RPL-001', 'teacher' => 'budi',   'hari' => Hari::Jumat,  'mulai' => '13:00', 'selesai' => '14:30'],
        ];

        $new = [];
        foreach ($defs as $d) {
            $classId   = $classes[$d['class']]->id;
            $subjectId = $subjects[$d['subject']]->id;
            $teacherId = $teachers[$d['teacher']]->id;

            $key = $d['class'] . '_' . $d['hari']->value . '_' . $d['teacher'];
            $new[$key] = Schedule::firstOrCreate(
                ['class_id' => $classId, 'hari' => $d['hari'], 'jam_mulai' => $d['mulai']],
                [
                    'subject_id'  => $subjectId,
                    'teacher_id'  => $teacherId,
                    'jam_selesai' => $d['selesai'],
                    'aktif'       => true,
                ]
            );
        }

        return array_merge($existing, $new);
    }

    // =========================================================================
    private function seedLearningObjectives(array $schedules, array $teachers): void
    {
        $tpBySubject = [
            'RPL-001' => [
                ['kode' => 'TP-WEB-01', 'deskripsi' => 'Memahami konsep HTTP, request-response, dan arsitektur web', 'urutan' => 1],
                ['kode' => 'TP-WEB-02', 'deskripsi' => 'Membuat struktur halaman HTML5 semantik yang valid', 'urutan' => 2],
                ['kode' => 'TP-WEB-03', 'deskripsi' => 'Menerapkan CSS untuk tata letak dan styling halaman web responsif', 'urutan' => 3],
                ['kode' => 'TP-WEB-04', 'deskripsi' => 'Membangun form HTML dengan validasi input menggunakan JavaScript', 'urutan' => 4],
                ['kode' => 'TP-WEB-05', 'deskripsi' => 'Mengintegrasikan fetch API untuk komunikasi data asinkron', 'urutan' => 5],
                ['kode' => 'TP-WEB-06', 'deskripsi' => 'Membangun aplikasi web dinamis dengan framework frontend modern', 'urutan' => 6],
            ],
            'BD-001' => [
                ['kode' => 'TP-BD-01', 'deskripsi' => 'Memahami konsep basis data relasional dan ERD', 'urutan' => 1],
                ['kode' => 'TP-BD-02', 'deskripsi' => 'Merancang skema basis data dengan normalisasi hingga 3NF', 'urutan' => 2],
                ['kode' => 'TP-BD-03', 'deskripsi' => 'Menulis query SQL dasar (SELECT, INSERT, UPDATE, DELETE)', 'urutan' => 3],
                ['kode' => 'TP-BD-04', 'deskripsi' => 'Menggunakan JOIN, subquery, dan agregasi dalam SQL', 'urutan' => 4],
                ['kode' => 'TP-BD-05', 'deskripsi' => 'Mengimplementasikan stored procedure, trigger, dan view', 'urutan' => 5],
            ],
            'PBO-001' => [
                ['kode' => 'TP-PBO-01', 'deskripsi' => 'Memahami paradigma pemrograman berorientasi objek (OOP)', 'urutan' => 1],
                ['kode' => 'TP-PBO-02', 'deskripsi' => 'Menerapkan konsep class, object, atribut, dan method', 'urutan' => 2],
                ['kode' => 'TP-PBO-03', 'deskripsi' => 'Mengimplementasikan inheritance dan polymorphism', 'urutan' => 3],
                ['kode' => 'TP-PBO-04', 'deskripsi' => 'Menerapkan interface, abstract class, dan encapsulation', 'urutan' => 4],
                ['kode' => 'TP-PBO-05', 'deskripsi' => 'Membangun aplikasi desktop sederhana berbasis OOP', 'urutan' => 5],
            ],
            'MTK-001' => [
                ['kode' => 'TP-MTK-01', 'deskripsi' => 'Menguasai operasi bilangan riil dan eksponen', 'urutan' => 1],
                ['kode' => 'TP-MTK-02', 'deskripsi' => 'Menyelesaikan sistem persamaan linear dua variabel', 'urutan' => 2],
                ['kode' => 'TP-MTK-03', 'deskripsi' => 'Memahami konsep fungsi, domain, dan kodomain', 'urutan' => 3],
                ['kode' => 'TP-MTK-04', 'deskripsi' => 'Menghitung limit, turunan, dan integral dasar', 'urutan' => 4],
            ],
            'BI-001' => [
                ['kode' => 'TP-BI-01', 'deskripsi' => 'Memahami dan menganalisis teks laporan hasil observasi', 'urutan' => 1],
                ['kode' => 'TP-BI-02', 'deskripsi' => 'Menulis teks eksposisi dengan argumen yang logis', 'urutan' => 2],
                ['kode' => 'TP-BI-03', 'deskripsi' => 'Menyusun presentasi lisan yang efektif dan persuasif', 'urutan' => 3],
            ],
            'BIG-001' => [
                ['kode' => 'TP-BIG-01', 'deskripsi' => 'Memahami teks deskriptif dan naratif dalam bahasa Inggris', 'urutan' => 1],
                ['kode' => 'TP-BIG-02', 'deskripsi' => 'Menulis paragraf akademik dalam bahasa Inggris', 'urutan' => 2],
                ['kode' => 'TP-BIG-03', 'deskripsi' => 'Berkomunikasi lisan dalam konteks profesional (job interview)', 'urutan' => 3],
            ],
            'DGP-001' => [
                ['kode' => 'TP-DGP-01', 'deskripsi' => 'Memahami prinsip desain grafis: komposisi, warna, tipografi', 'urutan' => 1],
                ['kode' => 'TP-DGP-02', 'deskripsi' => 'Mengoperasikan perangkat lunak desain vektor (CorelDRAW/Illustrator)', 'urutan' => 2],
                ['kode' => 'TP-DGP-03', 'deskripsi' => 'Membuat materi promosi: flyer, poster, banner digital', 'urutan' => 3],
            ],
        ];

        $teacherBySubjectKey = [
            'RPL-001' => 'budi',
            'BD-001'  => 'siti',
            'PBO-001' => 'rina',
            'MTK-001' => 'hendra',
            'BI-001'  => 'yuni',
            'BIG-001' => 'kusman',
            'DGP-001' => 'deni',
        ];

        foreach ($schedules as $schedule) {
            if (! $schedule) continue;
            $schedule->load(['subject', 'schoolClass', 'teacher']);

            $subjectKode = $schedule->subject?->kode;
            if (! $subjectKode || ! isset($tpBySubject[$subjectKode])) continue;

            $teacherKey = $teacherBySubjectKey[$subjectKode] ?? null;
            if (! $teacherKey) continue;

            $teacherId = $teachers[$teacherKey]->id;

            foreach ($tpBySubject[$subjectKode] as $tp) {
                LearningObjective::firstOrCreate(
                    [
                        'class_id'   => $schedule->class_id,
                        'subject_id' => $schedule->subject_id,
                        'kode'       => $tp['kode'],
                        'semester'   => 'ganjil',
                    ],
                    [
                        'teacher_id'  => $teacherId,
                        'deskripsi'   => $tp['deskripsi'],
                        'urutan'      => $tp['urutan'],
                        'aktif'       => true,
                    ]
                );
            }
        }
    }

    // =========================================================================
    private function seedAgendaHistory(array $schedules, array $studentsPerClass, Carbon $now): void
    {
        // Mapping kelas ke schedule keys
        $classScheduleMap = [
            'xi_rpl_a'  => ['xi_rpl_a_senin_budi', 'xi_rpl_a_selasa_siti', 'xi_rpl_a_rabu_rina', 'xi_rpl_a_kamis_hendra'],
            'xi_rpl_b'  => ['xi_rpl_b_senin_budi', 'xi_rpl_b_selasa_siti', 'xi_rpl_b_rabu_rina'],
            'xii_rpl_a' => ['xii_rpl_a_senin_rina', 'xii_rpl_a_selasa_deni', 'xii_rpl_a_rabu_budi'],
            'x_rpl_a'   => ['x_rpl_a_selasa_hendra', 'x_rpl_a_rabu_yuni'],
        ];

        $hariToNumber = [
            'senin' => 1, 'selasa' => 2, 'rabu' => 3,
            'kamis' => 4, 'jumat' => 5, 'sabtu' => 6,
        ];

        $resumeSamples = [
            'Siswa mempelajari konsep dasar dan melakukan praktik mandiri. Mayoritas siswa aktif dalam diskusi kelompok.',
            'Guru menjelaskan materi baru dengan metode demonstrasi. Dilanjutkan dengan latihan soal berpasangan.',
            'Review materi minggu lalu dan tes formatif singkat. Hasil tes menunjukkan pemahaman yang baik dari sebagian besar siswa.',
            'Praktik langsung menggunakan komputer. Siswa mengerjakan proyek kecil secara individu.',
            'Presentasi hasil kerja kelompok. Diskusi dan evaluasi bersama di kelas.',
            'Pendalaman materi dengan studi kasus nyata. Siswa diminta menganalisis dan mempresentasikan solusi.',
        ];

        foreach ($schedules as $scheduleKey => $schedule) {
            if (! $schedule) continue;

            // Temukan kelas dari schedule key
            $kelasKey = null;
            foreach ($classScheduleMap as $kelas => $keys) {
                if (in_array($scheduleKey, $keys)) {
                    $kelasKey = $kelas;
                    break;
                }
            }
            if (! $kelasKey || ! isset($studentsPerClass[$kelasKey])) continue;

            $students = $studentsPerClass[$kelasKey];
            if (empty($students)) continue;

            $hariNum = $hariToNumber[$schedule->hari->value] ?? null;
            if (! $hariNum) continue;

            // Buat agenda untuk 4 minggu lalu
            for ($week = 4; $week >= 1; $week--) {
                $date = $now->copy()->subWeeks($week)->startOfWeek()->addDays($hariNum - 1);

                // Skip jika tanggal di masa depan
                if ($date->gte($now)) continue;

                // Hindari duplikat
                if (Agenda::where('schedule_id', $schedule->id)->whereDate('tanggal', $date->toDateString())->exists()) {
                    continue;
                }

                $los = LearningObjective::where('subject_id', $schedule->subject_id)
                    ->where('class_id', $schedule->class_id)
                    ->inRandomOrder()
                    ->limit(2)
                    ->get();

                $agenda = Agenda::create([
                    'schedule_id' => $schedule->id,
                    'tanggal'     => $date->toDateString(),
                    'resume_kbm'  => $resumeSamples[array_rand($resumeSamples)],
                    'status'      => 'submitted',
                ]);

                if ($los->isNotEmpty()) {
                    $agenda->learningObjectives()->attach($los->pluck('id'));
                }

                // Presensi siswa
                foreach ($students as $idx => $student) {
                    // Siswa tertentu punya pola alpha tinggi untuk trigger EWS
                    $status = $this->resolveAttendanceStatus($idx, $week);

                    StudentAttendance::firstOrCreate(
                        ['student_id' => $student->id, 'agenda_id' => $agenda->id],
                        ['status' => $status, 'durasi_terlambat' => $status === 'hadir' && rand(0, 5) === 0 ? rand(5, 20) : 0]
                    );
                }
            }
        }
    }

    private function resolveAttendanceStatus(int $studentIndex, int $weekAgo): string
    {
        // Siswa index 1 (Budi Prasetyo) — sering alpha → EWS kuning
        if ($studentIndex === 1 && in_array($weekAgo, [2, 3, 4])) return 'alpha';
        // Siswa index 3 (Dani) — sering sakit
        if ($studentIndex === 3 && in_array($weekAgo, [3, 4])) return 'sakit';
        // Siswa index 4 — pernah izin
        if ($studentIndex === 4 && $weekAgo === 4) return 'izin';

        return rand(0, 10) === 0 ? 'alpha' : 'hadir';
    }

    // =========================================================================
    private function seedCharacterInputs(AcademicYear $ay, array $studentsPerClass, array $teachers): void
    {
        $subitems  = CharacterSubitem::all()->keyBy('kode');
        $teacherId = $teachers['budi']->id;

        // XI RPL A — variasi input untuk tiap siswa
        $xiAStudents = $studentsPerClass['xi_rpl_a'];
        if (empty($xiAStudents)) return;

        $scenarios = [
            // [student_idx, kode, catatan]
            [0, 'KP-01', 'Sangat aktif bertanya di awal semester'],
            [0, 'KP-02', 'Menjawab pertanyaan tentang HTTP dengan tepat'],
            [0, 'KD-01', 'Selalu tepat waktu dan siap belajar'],
            [0, 'TJ-01', 'Mengumpulkan semua tugas tepat waktu'],
            [0, 'SS-01', 'Sopan dan menghormati semua guru'],

            [1, 'KD-04', 'Terlambat 15 menit tanpa keterangan'],
            [1, 'KD-05', 'Kedapatan bermain HP saat pelajaran'],
            [1, 'KP-05', 'Tidak aktif dan terlihat tidak fokus'],
            [1, 'SS-04', 'Mengganggu teman saat praktikum'],
            [1, 'KD-06', 'Tidak mengerjakan tugas pemrograman web'],

            [2, 'KP-01', 'Aktif berdiskusi tentang CSS framework'],
            [2, 'TJ-01', 'Mengumpulkan proyek sebelum deadline'],
            [2, 'KD-02', 'Berseragam lengkap dan rapi setiap hari'],

            [3, 'KD-03', 'Tidak berseragam lengkap tanpa keterangan'],
            [3, 'TJ-04', 'Tidak menyelesaikan tugas kelompok bagiannya'],
            [3, 'KD-04', 'Terlambat masuk praktikum'],

            [4, 'KP-03', 'Juara 2 lomba web design tingkat sekolah'],
            [4, 'KP-01', 'Aktif membantu teman yang kesulitan'],
            [4, 'SS-02', 'Sukarela membantu teman yang tertinggal materi'],
            [4, 'TJ-02', 'Selalu ikut menjaga kebersihan ruang lab'],

            [5, 'KD-05', 'Bermain game di laptop saat pelajaran'],
            [5, 'SS-03', 'Berkata tidak sopan kepada teman sekelas'],
            [5, 'TJ-03', 'Merusak kabel keyboard lab'],

            [6, 'KP-01', 'Aktif berdiskusi tentang JavaScript'],
            [6, 'KD-01', 'Tepat waktu hadir di semua sesi'],

            [7, 'TJ-01', 'Mengumpulkan proyek tepat waktu'],
            [7, 'SS-02', 'Membantu teman debug kode'],

            [8, 'KP-04', 'Juara 1 lomba web design tingkat kota Cimahi'],
            [8, 'KP-03', 'Juara harapan lomba IoT tingkat sekolah'],
        ];

        foreach ($scenarios as [$idx, $kode, $catatan]) {
            if (! isset($xiAStudents[$idx])) continue;
            $subitem = $subitems[$kode] ?? null;
            if (! $subitem) continue;

            $sign = $subitem->sifat->value === 'positif' ? 'positif' : 'negatif';

            CharacterInput::create([
                'student_id' => $xiAStudents[$idx]->id,
                'subitem_id' => $subitem->id,
                'teacher_id' => $teacherId,
                'sign'       => $sign,
                'catatan'    => $catatan,
            ]);
        }

        // XI RPL B — beberapa input
        $xiBStudents = $studentsPerClass['xi_rpl_b'] ?? [];
        if (! empty($xiBStudents)) {
            $bScenarios = [
                [0, 'KP-01', 'Aktif berdiskusi'],
                [2, 'KD-04', 'Terlambat masuk'],
                [4, 'KP-02', 'Menjawab dengan tepat'],
                [6, 'SS-03', 'Berkata kasar kepada teman'],
                [9, 'TJ-01', 'Mengumpulkan tugas tepat waktu'],
            ];
            foreach ($bScenarios as [$idx, $kode, $catatan]) {
                if (! isset($xiBStudents[$idx])) continue;
                $subitem = $subitems[$kode] ?? null;
                if (! $subitem) continue;
                $sign = $subitem->sifat->value === 'positif' ? 'positif' : 'negatif';
                CharacterInput::create([
                    'student_id' => $xiBStudents[$idx]->id,
                    'subitem_id' => $subitem->id,
                    'teacher_id' => $teacherId,
                    'sign'       => $sign,
                    'catatan'    => $catatan,
                ]);
            }
        }
    }

    // =========================================================================
    private function seedActionThresholds(): void
    {
        if (ActionThreshold::count() > 0) return;

        $thresholds = [
            // Poin negatif global
            ['min' => PHP_INT_MIN, 'max' => -50, 'sifat' => 'negatif', 'rek' => 'Segera panggil siswa dan orang tua untuk konseling bersama BK. Pertimbangkan surat peringatan formal.'],
            ['min' => -49,         'max' => -20, 'sifat' => 'negatif', 'rek' => 'Hubungi orang tua siswa melalui telepon atau pesan. Beri pembinaan intensif oleh wali kelas.'],
            ['min' => -19,         'max' => -10, 'sifat' => 'negatif', 'rek' => 'Panggil siswa untuk pembinaan langsung oleh wali kelas. Catat dalam buku kasus.'],
            // Poin positif global
            ['min' => 30,          'max' => null, 'sifat' => 'positif', 'rek' => 'Berikan apresiasi formal di depan kelas dan rekomendasikan sebagai kandidat siswa berprestasi semester ini.'],
            ['min' => 15,          'max' => 29,  'sifat' => 'positif', 'rek' => 'Berikan pujian dan motivasi kepada siswa. Catat sebagai siswa teladan untuk laporan wali kelas.'],
        ];

        foreach ($thresholds as $t) {
            ActionThreshold::create([
                'character_category_id' => null,
                'min_point'   => $t['min'] === PHP_INT_MIN ? -9999 : $t['min'],
                'max_point'   => $t['max'],
                'sifat'       => $t['sifat'],
                'rekomendasi' => $t['rek'],
                'aktif'       => true,
            ]);
        }
    }

    // =========================================================================
    private function recalculateEws(AcademicYear $ay, array $studentsPerClass): void
    {
        $allStudents = array_merge(...array_values($studentsPerClass));

        // Buat EwsStatus untuk siswa yang belum punya
        foreach ($allStudents as $student) {
            EwsStatus::firstOrCreate(
                ['student_id' => $student->id, 'academic_year_id' => $ay->id],
                ['level' => EwsLevel::Hijau, 'kehadiran_score' => 100, 'karakter_score' => 0]
            );
        }

        // Hitung karakter score: positif tambah bobot, negatif kurangi
        $inputs = CharacterInput::with('subitem')->get()->groupBy('student_id');
        foreach ($inputs as $studentId => $studentInputs) {
            $total = 0;
            foreach ($studentInputs as $inp) {
                $bobot = $inp->subitem?->bobot ?? 0;
                $total += $inp->sign->value === 'positif' ? abs($bobot) : -abs($bobot);
            }
            $ews = EwsStatus::where('student_id', $studentId)->where('academic_year_id', $ay->id)->first();
            if (! $ews) continue;
            $ews->karakter_score = $total;
            $ews->save();
        }

        // Hitung kehadiran score dari StudentAttendance
        foreach ($allStudents as $student) {
            $total = StudentAttendance::where('student_id', $student->id)->count();
            $hadir = StudentAttendance::where('student_id', $student->id)->where('status', 'hadir')->count();
            if ($total === 0) continue;

            $score = round(($hadir / $total) * 100, 2);
            $ews   = EwsStatus::where('student_id', $student->id)->where('academic_year_id', $ay->id)->first();
            if (! $ews) continue;
            $ews->kehadiran_score = $score;
            $ews->save();
        }

        // Tentukan level EWS berdasarkan kombinasi skor
        EwsStatus::where('academic_year_id', $ay->id)->get()->each(function ($ews) {
            if ($ews->karakter_score <= -50 || $ews->kehadiran_score < 50) {
                $ews->level = EwsLevel::Merah;
            } elseif ($ews->karakter_score <= -20 || $ews->kehadiran_score < 75) {
                $ews->level = EwsLevel::Oranye;
            } elseif ($ews->karakter_score <= -10 || $ews->kehadiran_score < 85) {
                $ews->level = EwsLevel::Kuning;
            } else {
                $ews->level = EwsLevel::Hijau;
            }
            $ews->last_calculated_at  = now();
            $ews->save();
        });
    }
}
