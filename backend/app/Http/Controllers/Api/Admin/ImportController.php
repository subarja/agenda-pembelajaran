<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\CharacterSign;
use App\Enums\Hari;
use App\Enums\SubjectKelompok;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\ActionThreshold;
use App\Models\CharacterCategory;
use App\Models\CharacterSubitem;
use App\Models\EwsStatus;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use App\Traits\BuildsXlsxReports;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ImportController extends Controller
{
    use BuildsXlsxReports;

    // ── Template download ──────────────────────────────────────────────────────

    public function template(string $entity): BinaryFileResponse
    {
        $configs = [
            'karakter_kategori' => [
                'filename' => 'template_karakter_kategori.xlsx',
                'headers'  => ['nama', 'deskripsi'],
                'example'  => ['Kedisiplinan', 'Sikap disiplin dalam mengikuti aturan sekolah'],
                'notes'    => ['wajib', 'opsional'],
            ],
            'karakter_subitem' => [
                'filename' => 'template_karakter_subitem.xlsx',
                'headers'  => ['nama_kategori', 'kode', 'deskripsi', 'bobot', 'sifat'],
                'example'  => ['Kedisiplinan', 'KD-01', 'Hadir tepat waktu', '10', 'positif'],
                'notes'    => ['nama kategori yang sudah ada', 'wajib, unik (contoh: KD-01)', 'deskripsi perilaku', '1–100', 'positif / negatif / keduanya'],
            ],
            'ambang' => [
                'filename' => 'template_ambang.xlsx',
                'headers'  => ['min_point', 'max_point', 'sifat', 'rekomendasi'],
                'example'  => ['-100', '-50', 'negatif', 'Segera panggil siswa untuk konseling dengan BK'],
                'notes'    => ['bilangan bulat', 'bilangan bulat atau kosong (= tidak terbatas)', 'positif / negatif', 'teks rekomendasi tindakan'],
            ],
            'guru' => [
                'filename' => 'template_guru.xlsx',
                'headers'  => ['nama', 'email', 'nip', 'mapel_utama', 'role', 'nomor_hp'],
                'example'  => ['Budi Santoso, S.Kom.', 'budi@smkn2cimahi.sch.id', '199001012020011001', 'Pemrograman Web', 'guru', '08123456789'],
                'notes'    => ['wajib', 'wajib', 'wajib, unik', 'wajib', 'guru / wali_kelas / wakasek / bk', 'opsional'],
            ],
            'siswa' => [
                'filename' => 'template_siswa.xlsx',
                'headers'  => ['nama', 'nis', 'nisn', 'kelas', 'angkatan', 'wali_nama', 'wali_kontak', 'jenis_kelamin'],
                'example'  => ['Ahmad Fauzi', '2324001', '0012345678', 'XII Rekayasa Perangkat Lunak A', '2023', 'Bapak Fauzi', '081234567890', 'L'],
                'notes'    => ['wajib', 'wajib, unik', 'opsional', 'harus sama persis dgn menu Kelas, contoh: XII Rekayasa Perangkat Lunak A', 'tahun masuk', 'opsional', 'opsional', 'L / P, opsional'],
            ],
            'kelas' => [
                'filename' => 'template_kelas.xlsx',
                'headers'  => ['kelas', 'nip_wali_kelas'],
                'example'  => ['XII Rekayasa Perangkat Lunak A', '199001012020011001'],
                'notes'    => ['format: TINGKAT JURUSAN ROMBEL, contoh: XII RPL A', 'opsional — NIP guru wali kelas'],
            ],
            'wali_kelas' => [
                'filename' => 'template_wali_kelas.xlsx',
                'headers'  => ['kelas', 'nip_guru', 'nama_guru'],
                'example'  => ['XI Pengembangan Perangkat Lunak dan Gim A', '199001012020011001', 'Budi Santoso'],
                'notes'    => ['label kelas sesuai data — lihat tab Kelas di panel admin', 'NIP guru (utama, kosongkan jika tidak punya)', 'nama lengkap guru (fallback jika NIP kosong)'],
            ],
            'mapel' => [
                'filename' => 'template_mapel.xlsx',
                'headers'  => ['kode', 'nama', 'kelompok'],
                'example'  => ['RPL-001', 'Pemrograman Web', 'produktif'],
                'notes'    => ['wajib, unik', 'wajib', 'normatif / adaptif / produktif / muatan_lokal'],
            ],
            'jadwal' => [
                'filename' => 'template_jadwal.xlsx',
                'headers'  => ['kelas', 'kode_mapel', 'nip_guru', 'hari', 'jam_mulai', 'jam_selesai'],
                'example'  => ['XII Rekayasa Perangkat Lunak A', 'RPL-001', '199001012020011001', 'senin', '08:00', '09:30'],
                'notes'    => ['format: TINGKAT JURUSAN ROMBEL', 'kode mata pelajaran', 'NIP guru', 'senin/selasa/rabu/kamis/jumat/sabtu', 'HH:MM', 'HH:MM'],
            ],
        ];

        abort_if(! isset($configs[$entity]), 404, 'Template tidak ditemukan');
        $cfg = $configs[$entity];

        $tempFile = tempnam(sys_get_temp_dir(), 'tpl_');
        $writer   = new XlsxWriter();
        $writer->openToFile($tempFile);

        $colCount = count($cfg['headers']);
        $writer->getOptions()->setColumnWidthForRange(22, 1, $colCount);

        $writer->addRow(Row::fromValuesWithStyle($cfg['headers'], $this->xlsxHeaderStyle()));
        $writer->addRow(Row::fromValuesWithStyle($cfg['example'], $this->xlsxCellStyle()));
        $italicNote = (new Style())->withFontItalic(true)->withFontColor('6B7280');
        $writer->addRow(Row::fromValuesWithStyle($cfg['notes'], $italicNote));
        $writer->close();

        return response()->download($tempFile, $cfg['filename'], [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    // ── Import Guru ────────────────────────────────────────────────────────────

    public function importTeachers(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls', 'max:5120']]);

        $rows    = $this->readXlsx($request->file('file')->getRealPath());
        $success = 0;
        $errors  = [];

        foreach ($rows as $i => $row) {
            $rowNum = $i + 2;
            $nama   = trim((string) ($row[0] ?? ''));
            $email  = trim((string) ($row[1] ?? ''));
            $nip    = trim((string) ($row[2] ?? ''));
            $mapel  = trim((string) ($row[3] ?? ''));
            $role   = strtolower(trim((string) ($row[4] ?? 'guru')));
            $hp     = trim((string) ($row[5] ?? '')) ?: null;

            if ($nama === '' && $nip === '') continue;

            $v = Validator::make(
                compact('nama', 'email', 'nip', 'mapel', 'role'),
                [
                    'nama'  => 'required|string|max:100',
                    'email' => 'required|email|unique:users,email',
                    'nip'   => 'required|string|max:20|unique:teachers,nip',
                    'mapel' => 'required|string|max:100',
                    'role'  => 'required|in:guru,wali_kelas,wakasek,bk',
                ]
            );

            if ($v->fails()) {
                $errors[] = "Baris $rowNum: " . $v->errors()->first();
                continue;
            }

            try {
                DB::transaction(function () use ($nama, $email, $nip, $mapel, $role, $hp) {
                    $user = User::create([
                        'nama'     => $nama,
                        'email'    => $email,
                        'password' => 'password',
                        'role'     => UserRole::from($role),
                        'status'   => UserStatus::Aktif,
                        'nomor_hp' => $hp,
                    ]);
                    Teacher::create(['user_id' => $user->id, 'nip' => $nip, 'mapel_utama' => $mapel]);
                });
                $success++;
            } catch (\Throwable $e) {
                $errors[] = "Baris $rowNum: " . $e->getMessage();
            }
        }

        return response()->json(['success_count' => $success, 'error_count' => count($errors), 'errors' => $errors]);
    }

    // ── Import Siswa ───────────────────────────────────────────────────────────

    public function importStudents(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls', 'max:5120']]);

        $rows    = $this->readXlsx($request->file('file')->getRealPath());
        $ay      = AcademicYear::where('aktif', true)->first();
        $success = 0;
        $errors  = [];

        foreach ($rows as $i => $row) {
            $rowNum     = $i + 2;
            $nama       = trim((string) ($row[0] ?? ''));
            $nis        = trim((string) ($row[1] ?? ''));
            $nisn       = trim((string) ($row[2] ?? '')) ?: null;
            $kelasLabel = trim((string) ($row[3] ?? ''));
            $angkatan   = trim((string) ($row[4] ?? '')) ?: null;
            $waliNama   = trim((string) ($row[5] ?? '')) ?: null;
            $waliKontak = trim((string) ($row[6] ?? '')) ?: null;

            // Terima variasi umum: L/P, Laki-laki/Perempuan — dinormalkan ke huruf pertama.
            $jenisKelamin = strtoupper(trim((string) ($row[7] ?? ''))) ?: null;
            if ($jenisKelamin !== null) {
                $jenisKelamin = substr($jenisKelamin, 0, 1);
            }

            if ($nama === '' && $nis === '') continue;

            $class = null;
            if ($kelasLabel !== '') {
                [$class, $classErr] = $this->resolveClass($kelasLabel);
                if (! $class) {
                    $errors[] = "Baris $rowNum: $classErr";
                    continue;
                }
            }

            $resolvedEmail = $nis . '@smkn2cimahi.sch.id';
            $v = Validator::make(
                ['nama' => $nama, 'nis' => $nis, 'nisn' => $nisn, 'email' => $resolvedEmail, 'jenis_kelamin' => $jenisKelamin],
                [
                    'nama'  => 'required|string|max:100',
                    'nis'   => 'required|string|max:20|unique:students,nis',
                    'nisn'  => 'nullable|string|max:10|unique:students,nisn',
                    'email' => 'required|email|unique:users,email',
                    'jenis_kelamin' => 'nullable|in:L,P',
                ],
                ['jenis_kelamin.in' => 'Jenis kelamin harus L atau P.']
            );

            if ($v->fails()) {
                $errors[] = "Baris $rowNum: " . $v->errors()->first();
                continue;
            }

            try {
                DB::transaction(function () use ($nama, $nis, $nisn, $jenisKelamin, $resolvedEmail, $angkatan, $waliNama, $waliKontak, $class, $ay) {
                    $user = User::create([
                        'nama'     => $nama,
                        'email'    => $resolvedEmail,
                        'password' => 'password',
                        'role'     => UserRole::Siswa,
                        'status'   => UserStatus::Aktif,
                    ]);
                    $student = Student::create([
                        'user_id'       => $user->id,
                        'nis'           => $nis,
                        'nisn'          => $nisn,
                        'jenis_kelamin' => $jenisKelamin,
                        'class_id'      => $class?->id,
                        'angkatan'      => $angkatan,
                        'wali_nama'     => $waliNama,
                        'wali_kontak'   => $waliKontak,
                    ]);
                    if ($ay) {
                        EwsStatus::firstOrCreate(
                            ['student_id' => $student->id, 'academic_year_id' => $ay->id],
                            ['level' => 'hijau', 'kehadiran_score' => 100, 'karakter_score' => 0]
                        );
                    }
                });
                $success++;
            } catch (\Throwable $e) {
                $errors[] = "Baris $rowNum: " . $e->getMessage();
            }
        }

        return response()->json(['success_count' => $success, 'error_count' => count($errors), 'errors' => $errors]);
    }

    // ── Import Kelas ───────────────────────────────────────────────────────────

    public function importClasses(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls', 'max:5120']]);

        $rows    = $this->readXlsx($request->file('file')->getRealPath());
        $ay      = AcademicYear::where('aktif', true)->firstOrFail();
        $success = 0;
        $errors  = [];

        foreach ($rows as $i => $row) {
            $rowNum     = $i + 2;
            $kelasLabel = trim((string) ($row[0] ?? ''));  // "XII Rekayasa Perangkat Lunak A"
            $nipWali    = trim((string) ($row[1] ?? '')) ?: null;

            if ($kelasLabel === '') continue;

            // Parse "TINGKAT JURUSAN ROMBEL"
            $parts = explode(' ', $kelasLabel);
            if (count($parts) < 3) {
                $errors[] = "Baris $rowNum: Format kelas '$kelasLabel' tidak valid. Contoh: XII Rekayasa Perangkat Lunak A";
                continue;
            }
            $tingkat = strtoupper(array_shift($parts));
            $rombel  = array_pop($parts);
            $jurusan = implode(' ', $parts);

            if (! in_array($tingkat, ['X', 'XI', 'XII'])) {
                $errors[] = "Baris $rowNum: Tingkat '$tingkat' tidak valid (X/XI/XII).";
                continue;
            }

            $waliId = null;
            if ($nipWali) {
                $teacher = Teacher::where('nip', $nipWali)->first();
                if (! $teacher) {
                    $errors[] = "Baris $rowNum: NIP wali kelas '$nipWali' tidak ditemukan.";
                    continue;
                }
                $waliId = $teacher->user_id;
            }

            try {
                SchoolClass::create([
                    'tingkat'          => Tingkat::from($tingkat),
                    'jurusan'          => $jurusan,
                    'rombel'           => $rombel,
                    'wali_kelas_id'    => $waliId,
                    'academic_year_id' => $ay->id,
                ]);
                $success++;
            } catch (\Throwable $e) {
                $errors[] = "Baris $rowNum: " . $e->getMessage();
            }
        }

        return response()->json(['success_count' => $success, 'error_count' => count($errors), 'errors' => $errors]);
    }

    // ── Import Mapel ───────────────────────────────────────────────────────────

    public function importSubjects(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls', 'max:5120']]);

        $rows    = $this->readXlsx($request->file('file')->getRealPath());
        $success = 0;
        $errors  = [];

        foreach ($rows as $i => $row) {
            $rowNum   = $i + 2;
            $kode     = trim((string) ($row[0] ?? ''));
            $nama     = trim((string) ($row[1] ?? ''));
            $kelompok = strtolower(str_replace(' ', '_', trim((string) ($row[2] ?? 'produktif'))));

            if ($kode === '' && $nama === '') continue;

            $v = Validator::make(
                compact('kode', 'nama', 'kelompok'),
                [
                    'kode'     => 'required|string|max:20|unique:subjects,kode',
                    'nama'     => 'required|string|max:100',
                    'kelompok' => 'required|in:normatif,adaptif,produktif,muatan_lokal',
                ]
            );

            if ($v->fails()) {
                $errors[] = "Baris $rowNum: " . $v->errors()->first();
                continue;
            }

            try {
                Subject::create(['kode' => $kode, 'nama' => $nama, 'kelompok' => SubjectKelompok::from($kelompok), 'aktif' => true]);
                $success++;
            } catch (\Throwable $e) {
                $errors[] = "Baris $rowNum: " . $e->getMessage();
            }
        }

        return response()->json(['success_count' => $success, 'error_count' => count($errors), 'errors' => $errors]);
    }

    // ── Import Jadwal ──────────────────────────────────────────────────────────

    public function importSchedules(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls', 'max:5120']]);

        $rows    = $this->readXlsx($request->file('file')->getRealPath());
        $success = 0;
        $errors  = [];

        foreach ($rows as $i => $row) {
            $rowNum     = $i + 2;
            $kelasLabel = trim((string) ($row[0] ?? ''));  // "XII Rekayasa Perangkat Lunak A"
            $kodeMapel  = trim((string) ($row[1] ?? ''));
            $nipGuru    = trim((string) ($row[2] ?? ''));
            $hari       = strtolower(trim((string) ($row[3] ?? '')));
            $jamMulai   = trim((string) ($row[4] ?? ''));
            $jamSelesai = trim((string) ($row[5] ?? ''));

            if ($kelasLabel === '' && $kodeMapel === '') continue;

            [$class, $classErr] = $this->resolveClass($kelasLabel);
            if (! $class) {
                $errors[] = "Baris $rowNum: $classErr";
                continue;
            }

            $subject = Subject::where('kode', $kodeMapel)->first();
            if (! $subject) {
                $errors[] = "Baris $rowNum: Mapel kode '$kodeMapel' tidak ditemukan.";
                continue;
            }

            $teacher = Teacher::where('nip', $nipGuru)->first();
            if (! $teacher) {
                $errors[] = "Baris $rowNum: Guru NIP '$nipGuru' tidak ditemukan.";
                continue;
            }

            if (! in_array($hari, ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'])) {
                $errors[] = "Baris $rowNum: Hari '$hari' tidak valid.";
                continue;
            }

            try {
                Schedule::create([
                    'class_id'   => $class->id,
                    'subject_id' => $subject->id,
                    'teacher_id' => $teacher->id,
                    'hari'       => Hari::from($hari),
                    'jam_mulai'  => $jamMulai,
                    'jam_selesai'=> $jamSelesai,
                    'aktif'      => true,
                ]);
                $success++;
            } catch (\Throwable $e) {
                $errors[] = "Baris $rowNum: " . $e->getMessage();
            }
        }

        return response()->json(['success_count' => $success, 'error_count' => count($errors), 'errors' => $errors]);
    }

    // ── Import Karakter Kategori ───────────────────────────────────────────────

    public function importCharacterCategories(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls', 'max:5120']]);

        $rows    = $this->readXlsx($request->file('file')->getRealPath());
        $success = 0;
        $errors  = [];

        foreach ($rows as $i => $row) {
            $rowNum    = $i + 2;
            $nama      = trim((string) ($row[0] ?? ''));
            $deskripsi = trim((string) ($row[1] ?? '')) ?: null;

            if ($nama === '') continue;

            $v = Validator::make(
                ['nama' => $nama],
                ['nama' => 'required|string|max:100']
            );

            if ($v->fails()) {
                $errors[] = "Baris $rowNum: " . $v->errors()->first();
                continue;
            }

            try {
                CharacterCategory::create(['nama' => $nama, 'deskripsi' => $deskripsi, 'aktif' => true]);
                $success++;
            } catch (\Throwable $e) {
                $errors[] = "Baris $rowNum: " . $e->getMessage();
            }
        }

        return response()->json(['success_count' => $success, 'error_count' => count($errors), 'errors' => $errors]);
    }

    // ── Import Karakter Sub-item ───────────────────────────────────────────────

    public function importCharacterSubitems(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls', 'max:5120']]);

        $rows    = $this->readXlsx($request->file('file')->getRealPath());
        $success = 0;
        $errors  = [];

        foreach ($rows as $i => $row) {
            $rowNum       = $i + 2;
            $namaKategori = trim((string) ($row[0] ?? ''));
            $kode         = trim((string) ($row[1] ?? ''));
            $deskripsi    = trim((string) ($row[2] ?? ''));
            $bobot        = trim((string) ($row[3] ?? ''));
            $sifat        = strtolower(trim((string) ($row[4] ?? '')));

            if ($kode === '' && $deskripsi === '') continue;

            $category = CharacterCategory::where('nama', $namaKategori)->first();
            if (! $category) {
                $errors[] = "Baris $rowNum: Kategori '$namaKategori' tidak ditemukan.";
                continue;
            }

            $v = Validator::make(
                ['kode' => $kode, 'deskripsi' => $deskripsi, 'bobot' => $bobot, 'sifat' => $sifat],
                [
                    'kode'     => 'required|string|max:20|unique:character_subitems,kode',
                    'deskripsi'=> 'required|string|max:255',
                    'bobot'    => 'required|integer|min:1|max:100',
                    'sifat'    => 'required|in:positif,negatif,keduanya',
                ]
            );

            if ($v->fails()) {
                $errors[] = "Baris $rowNum: " . $v->errors()->first();
                continue;
            }

            try {
                CharacterSubitem::create([
                    'category_id' => $category->id,
                    'kode'        => $kode,
                    'deskripsi'   => $deskripsi,
                    'bobot'       => (int) $bobot,
                    'sifat'       => $sifat,
                    'aktif'       => true,
                ]);
                $success++;
            } catch (\Throwable $e) {
                $errors[] = "Baris $rowNum: " . $e->getMessage();
            }
        }

        return response()->json(['success_count' => $success, 'error_count' => count($errors), 'errors' => $errors]);
    }

    // ── Import Ambang Tindakan ─────────────────────────────────────────────────

    public function importThresholds(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls', 'max:5120']]);

        $rows    = $this->readXlsx($request->file('file')->getRealPath());
        $success = 0;
        $errors  = [];

        foreach ($rows as $i => $row) {
            $rowNum      = $i + 2;
            $minPoint    = trim((string) ($row[0] ?? ''));
            $maxPoint    = trim((string) ($row[1] ?? '')) ?: null;
            $sifat       = strtolower(trim((string) ($row[2] ?? '')));
            $rekomendasi = trim((string) ($row[3] ?? ''));

            if ($minPoint === '' && $rekomendasi === '') continue;

            $v = Validator::make(
                ['min_point' => $minPoint, 'max_point' => $maxPoint, 'sifat' => $sifat, 'rekomendasi' => $rekomendasi],
                [
                    'min_point'   => 'required|integer',
                    'max_point'   => 'nullable|integer',
                    'sifat'       => 'required|in:positif,negatif',
                    'rekomendasi' => 'required|string',
                ]
            );

            if ($v->fails()) {
                $errors[] = "Baris $rowNum: " . $v->errors()->first();
                continue;
            }

            try {
                ActionThreshold::create([
                    'min_point'   => (int) $minPoint,
                    'max_point'   => $maxPoint !== null ? (int) $maxPoint : null,
                    'sifat'       => CharacterSign::from($sifat),
                    'rekomendasi' => $rekomendasi,
                    'aktif'       => true,
                ]);
                $success++;
            } catch (\Throwable $e) {
                $errors[] = "Baris $rowNum: " . $e->getMessage();
            }
        }

        return response()->json(['success_count' => $success, 'error_count' => count($errors), 'errors' => $errors]);
    }

    // ── Import Wali Kelas ──────────────────────────────────────────────────────

    public function importWaliKelas(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls', 'max:5120']]);

        $rows    = $this->readXlsx($request->file('file')->getRealPath());
        $success = 0;
        $errors  = [];
        $skipped = 0;

        foreach ($rows as $i => $row) {
            $rowNum    = $i + 2;
            $kelasLabel = trim((string) ($row[0] ?? ''));
            $nipGuru    = trim((string) ($row[1] ?? '')) ?: null;
            $namaGuru   = trim((string) ($row[2] ?? '')) ?: null;

            if ($kelasLabel === '') { $skipped++; continue; }
            if (! $nipGuru && ! $namaGuru) {
                $errors[] = "Baris $rowNum: Harus ada NIP atau nama guru.";
                continue;
            }

            [$class, $classErr] = $this->resolveClass($kelasLabel);
            if (! $class) {
                $errors[] = "Baris $rowNum: $classErr";
                continue;
            }

            // Cari teacher: NIP dulu, lalu nama (case-insensitive, strip gelar)
            $teacher = null;
            if ($nipGuru) {
                $teacher = Teacher::where('nip', $nipGuru)->first();
                if (! $teacher) {
                    $errors[] = "Baris $rowNum: Guru NIP '$nipGuru' tidak ditemukan.";
                    continue;
                }
            } else {
                $normTarget = mb_strtolower(trim(preg_replace('/,\s*[A-Z][A-Za-z.]+.*$/', '', $namaGuru)));
                $teacher = Teacher::with('user')
                    ->get()
                    ->first(function ($t) use ($normTarget) {
                        $normDb = mb_strtolower(trim(preg_replace('/,\s*[A-Z][A-Za-z.]+.*$/', '', $t->user->nama ?? '')));
                        return $normDb === $normTarget;
                    });
                if (! $teacher) {
                    $errors[] = "Baris $rowNum: Guru '$namaGuru' tidak ditemukan.";
                    continue;
                }
            }

            try {
                $class->update(['wali_kelas_id' => $teacher->user_id]);
                // Naikan role ke wali_kelas jika masih 'guru'
                if ($teacher->user->role->value === 'guru') {
                    $teacher->user->update(['role' => UserRole::WaliKelas]);
                }
                $success++;
            } catch (\Throwable $e) {
                $errors[] = "Baris $rowNum: " . $e->getMessage();
            }
        }

        return response()->json([
            'success_count' => $success,
            'error_count'   => count($errors),
            'skipped'       => $skipped,
            'errors'        => $errors,
        ]);
    }

    // ── Export Wali Kelas (data saat ini) ─────────────────────────────────────

    public function exportWaliKelas(): BinaryFileResponse
    {
        $classes = SchoolClass::with(['waliKelas', 'academicYear'])
            ->whereHas('academicYear', fn ($q) => $q->where('aktif', true))
            ->orderBy('tingkat')->orderBy('jurusan')->orderBy('rombel')
            ->get();

        $tempFile = tempnam(sys_get_temp_dir(), 'wk_');
        $writer   = new XlsxWriter();
        $writer->openToFile($tempFile);

        $this->xlsxSetColumnWidths($writer, [1 => 30, 2 => 20, 3 => 26, 4 => 24]);

        // Header row
        $writer->addRow(Row::fromValuesWithStyle(['kelas', 'nip_guru', 'nama_guru', 'catatan'], $this->xlsxHeaderStyle()));

        $cellStyle = $this->xlsxCellStyle();
        foreach ($classes as $class) {
            $label    = "{$class->tingkat->value} {$class->jurusan} {$class->rombel}";
            $teacher  = $class->waliKelas ? Teacher::where('user_id', $class->waliKelas->id)->first() : null;
            $nip      = $teacher?->nip ?? '';
            $nama     = $class->waliKelas?->nama ?? '';
            $catatan  = $class->waliKelas ? '' : '← belum ada wali kelas';

            $writer->addRow(Row::fromValuesWithStyle([$label, $nip, $nama, $catatan], $cellStyle));
        }

        $writer->close();

        return response()->download($tempFile, 'daftar_wali_kelas.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /**
     * Parse "XII Rekayasa Perangkat Lunak A" → SchoolClass model.
     * Returns [SchoolClass|null, errorMessage|null].
     */
    private function resolveClass(string $label): array
    {
        $parts = explode(' ', trim($label));
        if (count($parts) < 3) {
            return [null, "Format kelas '$label' tidak valid. Contoh: XII Rekayasa Perangkat Lunak A"];
        }
        $tingkat = strtoupper(array_shift($parts));
        $rombel  = array_pop($parts);
        $jurusan = implode(' ', $parts);

        $class = SchoolClass::whereHas('academicYear', fn ($q) => $q->where('aktif', true))
            ->where('tingkat', $tingkat)->where('jurusan', $jurusan)->where('rombel', $rombel)
            ->first();

        if ($class) {
            return [$class, null];
        }

        // Nama jurusan harus sama persis dengan menu Kelas — kesalahan paling sering
        // adalah varian nama (mis. Excel menulis "Teknik Mekatronika" padahal di menu
        // Kelas tercatat "Mekatronika"). Sarankan padanannya supaya admin tahu harus
        // menulis apa, tapi JANGAN dicocokkan otomatis (pelajaran dari duplikat akun
        // guru akibat fuzzy match).
        $mirip = SchoolClass::whereHas('academicYear', fn ($q) => $q->where('aktif', true))
            ->where('tingkat', $tingkat)->where('rombel', $rombel)
            ->get()
            ->first(fn ($c) => str_contains(strtolower($jurusan), strtolower($c->jurusan))
                || str_contains(strtolower($c->jurusan), strtolower($jurusan)));

        $saran = $mirip
            ? " Mungkin maksudnya '{$tingkat} {$mirip->jurusan} {$rombel}' — nama jurusan harus sama persis dengan di menu Kelas."
            : '';

        return [null, "Kelas '$label' tidak ditemukan di tahun ajaran aktif.".$saran];
    }

    private function readXlsx(string $path): array
    {
        $reader     = new XlsxReader();
        $reader->open($path);
        $rows       = [];
        $sheetCount = 0;

        foreach ($reader->getSheetIterator() as $sheet) {
            if ($sheetCount++ > 0) break; // hanya sheet pertama

            $firstRow = true;
            foreach ($sheet->getRowIterator() as $row) {
                if ($firstRow) { $firstRow = false; continue; } // skip header

                $values = $row->toArray();

                if (empty(array_filter($values, fn ($v) => $v !== '' && $v !== null))) continue;

                $rows[] = $values;
            }
        }

        $reader->close();
        return $rows;
    }
}
