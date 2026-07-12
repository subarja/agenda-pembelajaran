<?php

namespace Database\Seeders;

use App\Enums\Hari;
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
    private const SISWA_PER_KELAS  = 36;
    private const WEEKS_OF_HISTORY = 8;

    private array $namaDepanPria = [
        'Ahmad','Bagas','Cahyo','Dani','Eko','Farid','Gilang','Hendra','Ivan','Joko',
        'Kevin','Latif','Muhamad','Naufal','Oscar','Pandu','Rizki','Septian','Taufik','Umar',
        'Wahyu','Yusuf','Zaki','Arif','Bima','Candra','Dimas','Erlangga','Fauzan','Galih',
        'Hanif','Irfan','Jafar','Khoirul','Lukman','Adi',
    ];
    private array $namaDepanWanita = [
        'Alya','Bella','Citra','Dewi','Eka','Fani','Gita','Hesti','Intan','Jihan',
        'Kartika','Lusi','Maya','Nadia','Okta','Putri','Rani','Sari','Tika','Ulfa',
        'Vika','Wulan','Yuni','Zahra','Anisa','Bunga','Cintya','Dinda','Elvira','Fitri',
        'Hana','Indah','Jovanka','Kiki','Laili','Ayu',
    ];
    private array $namaBelakang = [
        'Saputra','Pratama','Permana','Wijaya','Kurniawan','Santoso','Nugroho','Setiawan',
        'Mahardika','Wibowo','Kusuma','Hidayat','Fauzi','Rahmad','Susilo',
        'Andrean','Putra','Ramadhan','Hakim','Akbar','Prayoga','Lesmana',
        'Firmansyah','Gunawan','Hartono','Iswanto','Jatmiko','Kartono','Lestari','Mulyadi',
    ];

    public function run(): void
    {
        $ay  = AcademicYear::where('aktif', true)->firstOrFail();
        $now = Carbon::now('Asia/Jakarta');

        $subjects  = $this->seedSubjects();
        $teachers  = $this->seedTeachers();
        $classes   = $this->seedClasses($ay, $teachers);
        $students  = $this->seedStudents($classes);
        $schedules = $this->seedSchedules($subjects, $teachers, $classes);
        $this->seedLearningObjectives($schedules, $ay);
        $this->seedAgendaHistory($schedules, $students, $now, $ay);
        $this->seedCharacterInputs($students, $teachers, $ay);
        $this->seedActionThresholds();
        $this->recalculateEws($ay, $students);
        $this->setupDemoTeacherAccounts();
    }

    // =========================================================================
    private function seedSubjects(): array
    {
        $defs = [
            // Normatif / Adaptif (lintas jurusan)
            ['kode' => 'MTK-001',  'nama' => 'Matematika',                      'kelompok' => SubjectKelompok::Adaptif],
            ['kode' => 'BI-001',   'nama' => 'Bahasa Indonesia',                'kelompok' => SubjectKelompok::Normatif],
            ['kode' => 'BIG-001',  'nama' => 'Bahasa Inggris',                  'kelompok' => SubjectKelompok::Adaptif],
            ['kode' => 'PKN-001',  'nama' => 'Pendidikan Pancasila',            'kelompok' => SubjectKelompok::Normatif],
            ['kode' => 'PJOK-001', 'nama' => 'PJOK',                           'kelompok' => SubjectKelompok::Normatif],
            // RPL
            ['kode' => 'RPL-001',  'nama' => 'Pemrograman Web',                 'kelompok' => SubjectKelompok::Produktif],
            ['kode' => 'BD-001',   'nama' => 'Basis Data',                      'kelompok' => SubjectKelompok::Produktif],
            ['kode' => 'PBO-001',  'nama' => 'Pemrograman Berorientasi Objek',  'kelompok' => SubjectKelompok::Produktif],
            // TKJ
            ['kode' => 'TKJ-001',  'nama' => 'Jaringan Komputer',               'kelompok' => SubjectKelompok::Produktif],
            ['kode' => 'ASJ-001',  'nama' => 'Administrasi Sistem Jaringan',    'kelompok' => SubjectKelompok::Produktif],
            ['kode' => 'TLJ-001',  'nama' => 'Teknologi Layanan Jaringan',      'kelompok' => SubjectKelompok::Produktif],
            // DKV
            ['kode' => 'DGP-001',  'nama' => 'Desain Grafis Percetakan',        'kelompok' => SubjectKelompok::Produktif],
            ['kode' => 'DKV-001',  'nama' => 'Desain Komunikasi Visual',        'kelompok' => SubjectKelompok::Produktif],
            ['kode' => 'ANM-001',  'nama' => 'Animasi 2D & 3D',                 'kelompok' => SubjectKelompok::Produktif],
        ];

        $map = [];
        foreach ($defs as $d) {
            $map[$d['kode']] = Subject::firstOrCreate(['kode' => $d['kode']], [
                'nama'     => $d['nama'],
                'kelompok' => $d['kelompok'],
                'aktif'    => true,
            ]);
        }
        return $map;
    }

    // =========================================================================
    private function seedTeachers(): array
    {
        $existing = [
            'kusman' => Teacher::find(1),
            'budi'   => Teacher::find(2),
            'siti'   => Teacher::find(3),
            // Teacher id=4 adalah Dewi (BK) — tidak dipakai di jadwal
        ];

        $defs = [
            // RPL
            'deni'   => ['nama' => 'Deni Pratama, S.T.',          'nip' => '199001012018011004', 'mapel' => 'Basis Data',                     'email' => 'deni@smkn2cimahi.sch.id'],
            'rina'   => ['nama' => 'Rina Wulandari, M.Kom.',      'nip' => '198811202016022005', 'mapel' => 'Pemrograman Berorientasi Objek', 'email' => 'rina@smkn2cimahi.sch.id'],
            'hendra' => ['nama' => 'Hendra Kusuma, S.Pd.',        'nip' => '197809142006011006', 'mapel' => 'Matematika',                     'email' => 'hendra@smkn2cimahi.sch.id'],
            'yuni'   => ['nama' => 'Yuni Astuti, S.Pd.',          'nip' => '198304082010012007', 'mapel' => 'Bahasa Indonesia',               'email' => 'yuni@smkn2cimahi.sch.id'],
            // TKJ
            'ahmad'  => ['nama' => 'Ahmad Yanuar, S.T.',          'nip' => '198901012016011008', 'mapel' => 'Jaringan Komputer',              'email' => 'ahmad.yanuar@smkn2cimahi.sch.id'],
            'wahyu'  => ['nama' => 'Wahyu Prasetyo, S.Kom.',      'nip' => '199201012018011009', 'mapel' => 'Adm Sistem Jaringan',            'email' => 'wahyu@smkn2cimahi.sch.id'],
            'eko'    => ['nama' => 'Eko Sulistyo, S.T.',          'nip' => '198701012014011010', 'mapel' => 'Teknologi Layanan Jaringan',     'email' => 'eko@smkn2cimahi.sch.id'],
            // DKV
            'tono'   => ['nama' => 'Tono Haryono, S.Ds.',         'nip' => '198501012013011011', 'mapel' => 'Desain Grafis Percetakan',       'email' => 'tono@smkn2cimahi.sch.id'],
            'sari'   => ['nama' => 'Sari Dewantari, S.Pd.',       'nip' => '199001012017012012', 'mapel' => 'Desain Komunikasi Visual',       'email' => 'sari@smkn2cimahi.sch.id'],
            'indah'  => ['nama' => 'Indah Sulistyowati, S.Ds.',   'nip' => '199101012017012013', 'mapel' => 'Animasi 2D',                     'email' => 'indah@smkn2cimahi.sch.id'],
            // Adaptif tambahan
            'fitri'  => ['nama' => 'Fitri Handayani, S.Pd.',      'nip' => '199301012019012014', 'mapel' => 'Bahasa Inggris',                 'email' => 'fitri.h@smkn2cimahi.sch.id'],
            'rudi'   => ['nama' => 'Rudi Hartono, S.Pd.',         'nip' => '198601012012011015', 'mapel' => 'PJOK',                           'email' => 'rudi@smkn2cimahi.sch.id'],
            'hani'   => ['nama' => 'Hani Kusumawati, S.Pd.',      'nip' => '199001012017012016', 'mapel' => 'Pendidikan Pancasila',           'email' => 'hani@smkn2cimahi.sch.id'],
        ];

        $new = [];
        foreach ($defs as $key => $d) {
            $user = User::firstOrCreate(['email' => $d['email']], [
                'nama'     => $d['nama'],
                'password' => Hash::make('password'),
                'role'     => UserRole::Guru,
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
        $existing['xi_rpl_a']->update(['wali_kelas_id' => $teachers['siti']->user_id]);

        $defs = [
            // RPL
            'xi_rpl_b'  => ['tingkat' => Tingkat::XI,  'jurusan' => 'Rekayasa Perangkat Lunak', 'rombel' => 'B', 'wali' => 'rina'],
            'xii_rpl_a' => ['tingkat' => Tingkat::XII, 'jurusan' => 'Rekayasa Perangkat Lunak', 'rombel' => 'A', 'wali' => 'kusman'],
            'xii_rpl_b' => ['tingkat' => Tingkat::XII, 'jurusan' => 'Rekayasa Perangkat Lunak', 'rombel' => 'B', 'wali' => 'deni'],
            'x_rpl_a'   => ['tingkat' => Tingkat::X,   'jurusan' => 'Rekayasa Perangkat Lunak', 'rombel' => 'A', 'wali' => 'yuni'],
            'x_rpl_b'   => ['tingkat' => Tingkat::X,   'jurusan' => 'Rekayasa Perangkat Lunak', 'rombel' => 'B', 'wali' => 'hendra'],
            // TKJ
            'xi_tkj_a'  => ['tingkat' => Tingkat::XI,  'jurusan' => 'Teknik Komputer Jaringan', 'rombel' => 'A', 'wali' => 'ahmad'],
            'xi_tkj_b'  => ['tingkat' => Tingkat::XI,  'jurusan' => 'Teknik Komputer Jaringan', 'rombel' => 'B', 'wali' => 'wahyu'],
            'xii_tkj_a' => ['tingkat' => Tingkat::XII, 'jurusan' => 'Teknik Komputer Jaringan', 'rombel' => 'A', 'wali' => 'eko'],
            'xii_tkj_b' => ['tingkat' => Tingkat::XII, 'jurusan' => 'Teknik Komputer Jaringan', 'rombel' => 'B', 'wali' => 'sari'],
            'x_tkj_a'   => ['tingkat' => Tingkat::X,   'jurusan' => 'Teknik Komputer Jaringan', 'rombel' => 'A', 'wali' => 'tono'],
            'x_tkj_b'   => ['tingkat' => Tingkat::X,   'jurusan' => 'Teknik Komputer Jaringan', 'rombel' => 'B', 'wali' => 'indah'],
            // DKV
            'xi_dkv_a'  => ['tingkat' => Tingkat::XI,  'jurusan' => 'Desain Komunikasi Visual', 'rombel' => 'A', 'wali' => 'fitri'],
            'xii_dkv_a' => ['tingkat' => Tingkat::XII, 'jurusan' => 'Desain Komunikasi Visual', 'rombel' => 'A', 'wali' => 'rudi'],
            'x_dkv_a'   => ['tingkat' => Tingkat::X,   'jurusan' => 'Desain Komunikasi Visual', 'rombel' => 'A', 'wali' => 'hani'],
        ];

        $new = [];
        foreach ($defs as $key => $d) {
            $new[$key] = SchoolClass::firstOrCreate(
                ['tingkat' => $d['tingkat'], 'jurusan' => $d['jurusan'], 'rombel' => $d['rombel'], 'academic_year_id' => $ay->id],
                ['wali_kelas_id' => $teachers[$d['wali']]->user_id]
            );
        }

        return array_merge($existing, $new);
    }

    // =========================================================================
    private function seedStudents(array $classes): array
    {
        // prefix = 4-digit angkatan code, start = NIS sequence start for this class
        // XI=angkatan2023, XII=angkatan2022, X=angkatan2025
        $nisConfig = [
            'xi_rpl_a'  => ['prefix' => '2324', 'start' => 1,   'angkatan' => 2023],
            'xi_rpl_b'  => ['prefix' => '2324', 'start' => 101, 'angkatan' => 2023],
            'xii_rpl_a' => ['prefix' => '2223', 'start' => 1,   'angkatan' => 2022],
            'xii_rpl_b' => ['prefix' => '2223', 'start' => 101, 'angkatan' => 2022],
            'x_rpl_a'   => ['prefix' => '2526', 'start' => 1,   'angkatan' => 2025],
            'x_rpl_b'   => ['prefix' => '2526', 'start' => 101, 'angkatan' => 2025],
            'xi_tkj_a'  => ['prefix' => '2324', 'start' => 201, 'angkatan' => 2023],
            'xi_tkj_b'  => ['prefix' => '2324', 'start' => 301, 'angkatan' => 2023],
            'xii_tkj_a' => ['prefix' => '2223', 'start' => 201, 'angkatan' => 2022],
            'xii_tkj_b' => ['prefix' => '2223', 'start' => 301, 'angkatan' => 2022],
            'x_tkj_a'   => ['prefix' => '2526', 'start' => 201, 'angkatan' => 2025],
            'x_tkj_b'   => ['prefix' => '2526', 'start' => 301, 'angkatan' => 2025],
            'xi_dkv_a'  => ['prefix' => '2324', 'start' => 401, 'angkatan' => 2023],
            'xii_dkv_a' => ['prefix' => '2223', 'start' => 401, 'angkatan' => 2022],
            'x_dkv_a'   => ['prefix' => '2526', 'start' => 401, 'angkatan' => 2025],
        ];

        $allStudents = [];
        $nisnCounter = 3000000; // base for auto-generated NISN (distinct from existing 001xxxxxxx)

        foreach ($nisConfig as $classKey => $cfg) {
            $kelas = $classes[$classKey] ?? null;
            if (! $kelas) continue;

            $allStudents[$classKey] = [];

            for ($i = 0; $i < self::SISWA_PER_KELAS; $i++) {
                $nis = $cfg['prefix'] . str_pad($cfg['start'] + $i, 3, '0', STR_PAD_LEFT);

                // Preserve existing students (e.g. from DatabaseSeeder)
                $existing = Student::where('nis', $nis)->first();
                if ($existing) {
                    $allStudents[$classKey][] = $existing;
                    $nisnCounter++;
                    continue;
                }

                $isPria   = ($i % 2 === 0);
                $bank     = $isPria ? $this->namaDepanPria : $this->namaDepanWanita;
                $firstName = $bank[$i % count($bank)];
                $lastName  = $this->namaBelakang[$i % count($this->namaBelakang)];
                $nama      = "$firstName $lastName";
                $nisn      = str_pad($nisnCounter++, 10, '0', STR_PAD_LEFT);
                $email     = "s{$nis}@smkn2cimahi.sch.id";

                $user = User::firstOrCreate(['email' => $email], [
                    'nama'     => $nama,
                    'password' => Hash::make('password'),
                    'role'     => UserRole::Siswa,
                    'status'   => UserStatus::Aktif,
                ]);

                $allStudents[$classKey][] = Student::create([
                    'user_id'  => $user->id,
                    'nis'      => $nis,
                    'nisn'     => $nisn,
                    'class_id' => $kelas->id,
                    'angkatan' => $cfg['angkatan'],
                ]);
            }
        }

        return $allStudents;
    }

    // =========================================================================
    private function seedSchedules(array $subjects, array $teachers, array $classes): array
    {
        // Tiap jurusan dapat slot jam berbeda agar tidak konflik guru normatif/adaptif
        // RPL: 08:00, TKJ: 10:00, DKV: 13:00
        $rpl = [
            [Hari::Senin,   '08:00', '09:30', 'RPL-001', 'budi'],
            [Hari::Selasa,  '08:00', '09:30', 'BD-001',  'siti'],
            [Hari::Rabu,    '08:00', '09:30', 'PBO-001', 'rina'],
            [Hari::Kamis,   '08:00', '09:30', 'MTK-001', 'hendra'],
            [Hari::Jumat,   '08:00', '09:30', 'BI-001',  'yuni'],
        ];
        $tkj = [
            [Hari::Senin,   '10:00', '11:30', 'TKJ-001', 'ahmad'],
            [Hari::Selasa,  '10:00', '11:30', 'ASJ-001', 'wahyu'],
            [Hari::Rabu,    '10:00', '11:30', 'TLJ-001', 'eko'],
            [Hari::Kamis,   '10:00', '11:30', 'MTK-001', 'hendra'],
            [Hari::Jumat,   '10:00', '11:30', 'BI-001',  'yuni'],
        ];
        $dkv = [
            [Hari::Senin,   '13:00', '14:30', 'DGP-001', 'tono'],
            [Hari::Selasa,  '13:00', '14:30', 'DKV-001', 'sari'],
            [Hari::Rabu,    '13:00', '14:30', 'ANM-001', 'indah'],
            [Hari::Kamis,   '13:00', '14:30', 'MTK-001', 'hendra'],
            [Hari::Jumat,   '13:00', '14:30', 'BI-001',  'yuni'],
        ];

        $templates = [
            'xi_rpl_a'  => $rpl, 'xi_rpl_b'  => $rpl,
            'xii_rpl_a' => $rpl, 'xii_rpl_b' => $rpl,
            'x_rpl_a'   => $rpl, 'x_rpl_b'   => $rpl,
            'xi_tkj_a'  => $tkj, 'xi_tkj_b'  => $tkj,
            'xii_tkj_a' => $tkj, 'xii_tkj_b' => $tkj,
            'x_tkj_a'   => $tkj, 'x_tkj_b'   => $tkj,
            'xi_dkv_a'  => $dkv, 'xii_dkv_a' => $dkv, 'x_dkv_a' => $dkv,
        ];

        $schedules = [];
        foreach ($templates as $classKey => $tpl) {
            $kelas = $classes[$classKey] ?? null;
            if (! $kelas) continue;

            foreach ($tpl as [$hari, $mulai, $selesai, $subjKode, $teacherKey]) {
                $key = "{$classKey}_{$hari->value}_{$teacherKey}";
                $schedules[$key] = Schedule::firstOrCreate(
                    ['class_id' => $kelas->id, 'hari' => $hari, 'jam_mulai' => $mulai],
                    [
                        'subject_id'  => $subjects[$subjKode]->id,
                        'teacher_id'  => $teachers[$teacherKey]->id,
                        'jam_selesai' => $selesai,
                        'aktif'       => true,
                    ]
                );
            }
        }

        return $schedules;
    }

    // =========================================================================
    private function seedLearningObjectives(array $schedules, AcademicYear $ay): void
    {
        $tpBySubject = [
            'RPL-001' => [
                ['kode' => 'TP-WEB-01', 'deskripsi' => 'Memahami konsep HTTP, request-response, dan arsitektur web', 'urutan' => 1],
                ['kode' => 'TP-WEB-02', 'deskripsi' => 'Membuat struktur halaman HTML5 semantik yang valid', 'urutan' => 2],
                ['kode' => 'TP-WEB-03', 'deskripsi' => 'Menerapkan CSS untuk tata letak dan styling halaman web responsif', 'urutan' => 3],
                ['kode' => 'TP-WEB-04', 'deskripsi' => 'Membangun form HTML dengan validasi input menggunakan JavaScript', 'urutan' => 4],
                ['kode' => 'TP-WEB-05', 'deskripsi' => 'Mengintegrasikan fetch API untuk komunikasi data asinkron', 'urutan' => 5],
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
            ],
            'MTK-001' => [
                ['kode' => 'TP-MTK-01', 'deskripsi' => 'Menguasai operasi bilangan riil dan eksponen', 'urutan' => 1],
                ['kode' => 'TP-MTK-02', 'deskripsi' => 'Menyelesaikan sistem persamaan linear dua variabel', 'urutan' => 2],
                ['kode' => 'TP-MTK-03', 'deskripsi' => 'Memahami konsep fungsi, domain, dan kodomain', 'urutan' => 3],
            ],
            'BI-001' => [
                ['kode' => 'TP-BI-01', 'deskripsi' => 'Memahami dan menganalisis teks laporan hasil observasi', 'urutan' => 1],
                ['kode' => 'TP-BI-02', 'deskripsi' => 'Menulis teks eksposisi dengan argumen yang logis', 'urutan' => 2],
                ['kode' => 'TP-BI-03', 'deskripsi' => 'Menyusun presentasi lisan yang efektif dan persuasif', 'urutan' => 3],
            ],
            'TKJ-001' => [
                ['kode' => 'TP-TKJ-01', 'deskripsi' => 'Memahami model OSI dan protokol jaringan TCP/IP', 'urutan' => 1],
                ['kode' => 'TP-TKJ-02', 'deskripsi' => 'Mengkonfigurasi perangkat jaringan (router, switch, AP)', 'urutan' => 2],
                ['kode' => 'TP-TKJ-03', 'deskripsi' => 'Merancang topologi jaringan LAN dan WAN', 'urutan' => 3],
                ['kode' => 'TP-TKJ-04', 'deskripsi' => 'Menerapkan subnetting dan VLSM pada desain jaringan', 'urutan' => 4],
                ['kode' => 'TP-TKJ-05', 'deskripsi' => 'Menganalisis dan menangani gangguan jaringan', 'urutan' => 5],
            ],
            'ASJ-001' => [
                ['kode' => 'TP-ASJ-01', 'deskripsi' => 'Menginstalasi dan mengkonfigurasi server Linux', 'urutan' => 1],
                ['kode' => 'TP-ASJ-02', 'deskripsi' => 'Mengelola layanan DNS, DHCP, dan web server', 'urutan' => 2],
                ['kode' => 'TP-ASJ-03', 'deskripsi' => 'Menerapkan keamanan sistem dengan firewall dan VPN', 'urutan' => 3],
                ['kode' => 'TP-ASJ-04', 'deskripsi' => 'Melakukan backup, monitoring, dan pemulihan sistem', 'urutan' => 4],
            ],
            'TLJ-001' => [
                ['kode' => 'TP-TLJ-01', 'deskripsi' => 'Memahami konsep dan teknologi VoIP', 'urutan' => 1],
                ['kode' => 'TP-TLJ-02', 'deskripsi' => 'Mengkonfigurasi VLAN dan inter-VLAN routing', 'urutan' => 2],
                ['kode' => 'TP-TLJ-03', 'deskripsi' => 'Menerapkan layanan streaming dan konferensi video', 'urutan' => 3],
            ],
            'DGP-001' => [
                ['kode' => 'TP-DGP-01', 'deskripsi' => 'Memahami prinsip desain grafis: komposisi, warna, tipografi', 'urutan' => 1],
                ['kode' => 'TP-DGP-02', 'deskripsi' => 'Mengoperasikan perangkat lunak desain vektor (CorelDRAW/Illustrator)', 'urutan' => 2],
                ['kode' => 'TP-DGP-03', 'deskripsi' => 'Membuat materi promosi: flyer, poster, banner digital', 'urutan' => 3],
            ],
            'DKV-001' => [
                ['kode' => 'TP-DKV-01', 'deskripsi' => 'Menganalisis identitas visual dan brand guidelines', 'urutan' => 1],
                ['kode' => 'TP-DKV-02', 'deskripsi' => 'Merancang tata letak (layout) publikasi cetak dan digital', 'urutan' => 2],
                ['kode' => 'TP-DKV-03', 'deskripsi' => 'Menerapkan tipografi profesional dalam karya desain', 'urutan' => 3],
            ],
            'ANM-001' => [
                ['kode' => 'TP-ANM-01', 'deskripsi' => 'Memahami 12 prinsip animasi dasar (Disney principles)', 'urutan' => 1],
                ['kode' => 'TP-ANM-02', 'deskripsi' => 'Membuat animasi frame-by-frame menggunakan software', 'urutan' => 2],
                ['kode' => 'TP-ANM-03', 'deskripsi' => 'Menerapkan tweening dan rigging karakter 2D', 'urutan' => 3],
            ],
        ];

        foreach ($schedules as $schedule) {
            if (! $schedule) continue;
            $schedule->loadMissing(['subject', 'schoolClass']);

            $kode = $schedule->subject?->kode;
            if (! $kode || ! isset($tpBySubject[$kode])) continue;

            $tingkat = $schedule->schoolClass?->tingkat?->value ?? '';
            $fase = $tingkat === 'X' ? 'E' : 'F';

            foreach ($tpBySubject[$kode] as $tp) {
                LearningObjective::firstOrCreate(
                    [
                        'subject_id'       => $schedule->subject_id,
                        'fase'             => $fase,
                        'semester'         => 'ganjil',
                        'academic_year_id' => $ay->id,
                        'kode'             => $tp['kode'],
                    ],
                    ['deskripsi' => $tp['deskripsi'], 'urutan' => $tp['urutan'], 'aktif' => true]
                );
            }
        }
    }

    // =========================================================================
    private function seedAgendaHistory(array $schedules, array $students, Carbon $now, AcademicYear $ay): void
    {
        $hariToDay = ['senin' => 1, 'selasa' => 2, 'rabu' => 3, 'kamis' => 4, 'jumat' => 5];

        $resumes = [
            'Siswa mempelajari konsep dasar dan melakukan praktik mandiri. Mayoritas siswa aktif dalam diskusi kelompok.',
            'Guru menjelaskan materi baru dengan metode demonstrasi. Dilanjutkan dengan latihan soal berpasangan.',
            'Review materi minggu lalu dan tes formatif singkat. Hasil tes menunjukkan pemahaman yang baik dari sebagian besar siswa.',
            'Praktik langsung menggunakan komputer. Siswa mengerjakan proyek kecil secara individu.',
            'Presentasi hasil kerja kelompok. Diskusi dan evaluasi bersama di kelas.',
            'Pendalaman materi dengan studi kasus nyata. Siswa diminta menganalisis dan mempresentasikan solusi.',
            'Pembelajaran berbasis proyek. Siswa bekerja dalam kelompok menyelesaikan tantangan nyata.',
            'Evaluasi formatif dan umpan balik langsung dari guru kepada setiap kelompok.',
        ];

        $classKeys = array_keys($students);

        foreach ($schedules as $scheduleKey => $schedule) {
            if (! $schedule) continue;

            // Temukan class key dari prefix schedule key
            $classKey = null;
            foreach ($classKeys as $ck) {
                if (str_starts_with($scheduleKey, $ck . '_')) {
                    $classKey = $ck;
                    break;
                }
            }
            if (! $classKey || empty($students[$classKey])) continue;

            $classStudents = $students[$classKey];
            $hariNum = $hariToDay[$schedule->hari->value] ?? null;
            if (! $hariNum) continue;

            // Ambil LO sekali di luar loop minggu
            $schedule->loadMissing('schoolClass');
            $tingkat = $schedule->schoolClass?->tingkat?->value ?? '';
            $fase = $tingkat === 'X' ? 'E' : 'F';

            $los = LearningObjective::where('subject_id', $schedule->subject_id)
                ->where('fase', $fase)
                ->where('academic_year_id', $ay->id)
                ->get();

            for ($week = self::WEEKS_OF_HISTORY; $week >= 1; $week--) {
                $date = $now->copy()->subWeeks($week)->startOfWeek()->addDays($hariNum - 1);
                if ($date->gte($now)) continue;

                if (Agenda::where('schedule_id', $schedule->id)->whereDate('tanggal', $date->toDateString())->exists()) {
                    continue;
                }

                $agenda = Agenda::create([
                    'schedule_id' => $schedule->id,
                    'tanggal'     => $date->toDateString(),
                    'resume_kbm'  => $resumes[($week + $schedule->id) % count($resumes)],
                    'status'      => 'submitted',
                ]);

                if ($los->isNotEmpty()) {
                    $agenda->learningObjectives()->attach(
                        $los->random(min(2, $los->count()))->pluck('id')
                    );
                }

                // Bulk insert presensi
                $rows = [];
                foreach ($classStudents as $idx => $student) {
                    $rows[] = [
                        'student_id'       => $student->id,
                        'agenda_id'        => $agenda->id,
                        'status'           => $this->randomAttendance($idx, $week),
                        'durasi_terlambat' => 0,
                        'created_at'       => now(),
                        'updated_at'       => now(),
                    ];
                }
                StudentAttendance::insert($rows);
            }
        }
    }

    private function randomAttendance(int $idx, int $week): string
    {
        // ~10% siswa punya masalah kehadiran (indeks mod 10 = 1)
        if ($idx % 10 === 1) {
            return match (rand(1, 10)) {
                1, 2, 3, 4 => 'alpha',
                5          => 'sakit',
                6          => 'izin',
                default    => 'hadir',
            };
        }
        // ~5% siswa sering sakit (indeks mod 10 = 3)
        if ($idx % 10 === 3) {
            return match (rand(1, 10)) {
                1, 2 => 'sakit',
                3    => 'alpha',
                default => 'hadir',
            };
        }
        // Normal: hadir ~92%
        return match (rand(1, 25)) {
            1       => 'alpha',
            2       => 'sakit',
            3       => 'izin',
            default => 'hadir',
        };
    }

    // =========================================================================
    private function seedCharacterInputs(array $students, array $teachers, AcademicYear $ay): void
    {
        $subitems = CharacterSubitem::all()->keyBy('kode');
        if ($subitems->isEmpty()) return;

        $positifKodes = $subitems->filter(fn($s) => $s->sifat->value === 'positif')->keys()->toArray();
        $negatifKodes = $subitems->filter(fn($s) => $s->sifat->value === 'negatif')->keys()->toArray();
        $teacherIds   = collect($teachers)->filter()->pluck('id')->toArray();

        $catatanPositif = [
            'Aktif bertanya dan berdiskusi di kelas',
            'Mengumpulkan tugas tepat waktu dan berkualitas',
            'Membantu teman yang kesulitan memahami materi',
            'Juara lomba tingkat sekolah',
            'Berseragam lengkap dan rapi setiap hari',
            'Selalu tepat waktu hadir ke sekolah',
            'Menjadi ketua kelompok yang efektif dalam proyek',
            'Menunjukkan kreativitas tinggi dalam hasil karya',
        ];
        $catatanNegatif = [
            'Terlambat masuk kelas tanpa keterangan',
            'Tidak mengerjakan tugas yang diberikan',
            'Bermain HP saat kegiatan belajar berlangsung',
            'Tidak berseragam lengkap tanpa izin',
            'Mengganggu teman saat praktikum',
            'Berkata tidak sopan kepada teman',
            'Tidak mengikuti kegiatan piket kelas',
            'Bolos pada jam pelajaran tertentu',
        ];

        $allStudents = array_merge(...array_values($students));
        $inputs      = [];

        foreach ($allStudents as $globalIdx => $student) {
            // ~40% siswa mendapat input karakter
            if ($globalIdx % 5 > 1 && rand(1, 10) > 4) continue;

            $teacherId = $teacherIds[array_rand($teacherIds)];
            $numInputs = rand(1, 5);

            for ($j = 0; $j < $numInputs; $j++) {
                $isPositif = rand(0, 2) > 0; // 67% positif

                if ($isPositif && ! empty($positifKodes)) {
                    $kode    = $positifKodes[array_rand($positifKodes)];
                    $catatan = $catatanPositif[array_rand($catatanPositif)];
                    $sign    = 'positif';
                } elseif (! empty($negatifKodes)) {
                    $kode    = $negatifKodes[array_rand($negatifKodes)];
                    $catatan = $catatanNegatif[array_rand($catatanNegatif)];
                    $sign    = 'negatif';
                } else {
                    continue;
                }

                $subitem = $subitems[$kode] ?? null;
                if (! $subitem) continue;

                $inputs[] = [
                    'academic_year_id' => $ay->id,
                    'student_id' => $student->id,
                    'subitem_id' => $subitem->id,
                    'teacher_id' => $teacherId,
                    'sign'       => $sign,
                    'catatan'    => $catatan,
                    'created_at' => now()->subDays(rand(1, 56)),
                    'updated_at' => now(),
                ];
            }
        }

        foreach (array_chunk($inputs, 200) as $chunk) {
            CharacterInput::insert($chunk);
        }
    }

    // =========================================================================
    private function seedActionThresholds(): void
    {
        if (ActionThreshold::count() > 0) return;

        $thresholds = [
            ['min' => -9999, 'max' => -50,  'sifat' => 'negatif', 'rek' => 'Segera panggil siswa dan orang tua untuk konseling bersama BK. Pertimbangkan surat peringatan formal.'],
            ['min' => -49,   'max' => -20,  'sifat' => 'negatif', 'rek' => 'Hubungi orang tua siswa melalui telepon atau pesan. Beri pembinaan intensif oleh wali kelas.'],
            ['min' => -19,   'max' => -10,  'sifat' => 'negatif', 'rek' => 'Panggil siswa untuk pembinaan langsung oleh wali kelas. Catat dalam buku kasus.'],
            ['min' => 30,    'max' => null, 'sifat' => 'positif', 'rek' => 'Berikan apresiasi formal di depan kelas dan rekomendasikan sebagai kandidat siswa berprestasi semester ini.'],
            ['min' => 15,    'max' => 29,   'sifat' => 'positif', 'rek' => 'Berikan pujian dan motivasi kepada siswa. Catat sebagai siswa teladan untuk laporan wali kelas.'],
        ];

        foreach ($thresholds as $t) {
            ActionThreshold::create([
                'character_category_id' => null,
                'min_point'   => $t['min'],
                'max_point'   => $t['max'],
                'sifat'       => $t['sifat'],
                'rekomendasi' => $t['rek'],
                'aktif'       => true,
            ]);
        }
    }

    // =========================================================================
    private function recalculateEws(AcademicYear $ay, array $students): void
    {
        $allStudents = array_merge(...array_values($students));

        foreach ($allStudents as $student) {
            EwsStatus::firstOrCreate(
                ['student_id' => $student->id, 'academic_year_id' => $ay->id],
                ['level' => EwsLevel::Hijau, 'kehadiran_score' => 100, 'karakter_score' => 0]
            );
        }

        // Hitung karakter score
        $inputs = CharacterInput::with('subitem')->get()->groupBy('student_id');
        foreach ($inputs as $studentId => $studentInputs) {
            $total = 0;
            foreach ($studentInputs as $inp) {
                $bobot  = $inp->subitem?->bobot ?? 0;
                $total += $inp->sign->value === 'positif' ? abs($bobot) : -abs($bobot);
            }
            EwsStatus::where('student_id', $studentId)->where('academic_year_id', $ay->id)
                ->update(['karakter_score' => $total]);
        }

        // Hitung kehadiran score dengan agregasi DB
        $rows = StudentAttendance::selectRaw(
            "student_id, COUNT(*) as total, SUM(CASE WHEN status = 'hadir' THEN 1 ELSE 0 END) as hadir"
        )->groupBy('student_id')->get();

        foreach ($rows as $row) {
            if (! $row->total) continue;
            EwsStatus::where('student_id', $row->student_id)->where('academic_year_id', $ay->id)
                ->update(['kehadiran_score' => round(($row->hadir / $row->total) * 100, 2)]);
        }

        // Tentukan level EWS
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
            $ews->last_calculated_at = now();
            $ews->save();
        });
    }

    // =========================================================================
    // Menyiapkan akun demo untuk guru nyata dari hasil import ASc XML.
    // Dibuat agar make reseed menjaga akun ini tetap aktif dengan password demo.
    private function setupDemoTeacherAccounts(): void
    {
        // Wulan Indah Pratiwi — Matematika (7 kelas, termasuk X DKV A & XI RPL B yg punya siswa)
        $wulan = User::where('email', 'wulan@smkn2cimahi.sch.id')
            ->orWhere('nama', 'Wulan Indah Pratiwi')
            ->first();
        if ($wulan) {
            $wulan->update(['email' => 'wulan@smkn2cimahi.sch.id', 'password' => Hash::make('password')]);
        }

        // Edy Santoso — KK Mekatronika-11 (XI Mekatronika A–D, siswa Dapodik asli)
        $edy = User::where('email', 'edy@smkn2cimahi.sch.id')
            ->orWhere('nama', 'Edy Santoso')
            ->whereHas('teacher')
            ->first();
        if ($edy) {
            $edy->update(['email' => 'edy@smkn2cimahi.sch.id', 'password' => Hash::make('password')]);
        }
    }
}
