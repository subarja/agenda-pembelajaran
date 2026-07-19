<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\ProgramKeahlian;
use App\Models\PasswordDefaultSetting;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Traits\BuildsXlsxReports;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class DapodikImportController extends Controller
{
    use BuildsXlsxReports;

    // Kode jurusan singkat → nama lengkap
    // HARUS identik dengan AscXmlImportController::JURUSAN_MAP agar pencarian kelas sesuai
    private const JURUSAN_MAP = [
        'MEKA' => 'Mekatronika',
        'DKV' => 'Desain Komunikasi Visual',
        'RPL' => 'Rekayasa Perangkat Lunak',
        'PPLG' => 'Rekayasa Perangkat Lunak',
        'ANM' => 'Animasi',
        'ANIMASI' => 'Animasi', // Dapodik pakai 'ANIMASI', aSc pakai 'ANM'
        'KI' => 'Teknik Kimia Industri',
        'TKI' => 'Teknik Kimia Industri', // Dapodik pakai 'TKI', aSc pakai 'KI'
        'TP' => 'Teknik Pemesinan',
        'MES' => 'Teknik Pemesinan',
    ];

    // ── POST /admin/import/dapodik-guru ───────────────────────────────────────
    // Format: "Format Import Data Guru.xlsx" — 3 sheet dalam satu file:
    // "Data Program Keahlian", "Daftar Guru", "Wali Kelas".

    public function importGuru(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
            'decisions' => 'nullable|string',
        ]);

        if (! \App\Support\TahunAjaran::current()) {
            return response()->json([
                'message' => 'Belum ada tahun ajaran aktif. Buat atau aktifkan tahun ajaran terlebih dahulu di tab Tahun Ajaran sebelum import.',
            ], 422);
        }

        // decisions: { "guru:<row>": "merge"|"create", "wali_kelas:<row>": "merge"|"create" }
        // — dikirim balik oleh frontend setelah admin mengonfirmasi baris yang cuma
        // cocok lewat ejaan mirip (bukan sama persis) pada pemanggilan sebelumnya.
        $decisions = json_decode($request->input('decisions', '{}'), true) ?: [];

        $sheets = $this->readNamedSheets($request->file('file')->getRealPath(), [
            'Data Program Keahlian' => 3,
            'Daftar Guru' => 4,
            'Wali Kelas' => 4,
        ]);

        $actor = $request->user();
        // Password default akun guru — dari panel admin/.env, TIDAK di-hardcode:
        // nilai lama 'password' sudah tercatat di riwayat git.
        $defaultPassword = Hash::make(PasswordDefaultSetting::resolveOrFail('guru'));
        $errors = [];
        $pendingMatches = [];

        $result = DB::transaction(function () use ($sheets, $actor, $defaultPassword, &$errors, &$pendingMatches, $decisions) {
            return [
                'program_keahlian' => $this->importProgramKeahlianRows($sheets['Data Program Keahlian'], $errors),
                'guru' => $this->importGuruRows($sheets['Daftar Guru'], $actor, $defaultPassword, $errors, $decisions, $pendingMatches),
                'wali_kelas' => $this->importWaliKelasRows($sheets['Wali Kelas'], $actor, $errors, $decisions, $pendingMatches),
            ];
        });

        return response()->json([
            'message' => 'Import guru berhasil.',
            'data' => $result,
            'errors' => $errors,
            'pending_matches' => $pendingMatches,
        ]);
    }

    // ── GET /admin/import/dapodik-guru/template ─────────────────────────────────
    // Unduh format kosong "Format Import Data Guru.xlsx" — 3 sheet dengan header &
    // baris judul yang sama seperti yang dibaca oleh importGuru()/readNamedSheets().

    public function downloadTemplate(): BinaryFileResponse
    {
        $tempFile = tempnam(sys_get_temp_dir(), 'tpl_guru_');
        $writer = new XlsxWriter;
        $writer->openToFile($tempFile);

        $titleStyle  = $this->xlsxTitleStyle();
        $headerStyle = $this->xlsxHeaderStyle();
        $cellStyle   = $this->xlsxCellStyle();

        // openToFile() sudah membuat sheet pertama secara otomatis — cukup ganti namanya.
        $writer->getCurrentSheet()->setName('Daftar Guru');
        $this->xlsxSetColumnWidths($writer, [1 => 5, 2 => 26, 3 => 18, 4 => 6, 5 => 16, 6 => 14, 7 => 20, 8 => 18, 9 => 14, 10 => 10, 11 => 15, 12 => 24, 13 => 18]);
        $writer->addRow(Row::fromValuesWithStyle(['IMPORT DATA GURU'], $titleStyle));
        $writer->addRow(Row::fromValues(['SMK NEGERI 2 CIMAHI']));
        $writer->addRow(Row::fromValuesWithStyle([
            'No', 'Nama', 'NUPTK', 'JK', 'Tempat Lahir', 'Tanggal Lahir', 'NIP',
            'Status Kepegawaian', 'Jenis PTK', 'Agama', 'HP', 'Email', 'NIK',
        ], $headerStyle));
        $writer->addRow(Row::fromValuesWithStyle([
            1, 'Nama Lengkap Guru', '1234567890123456', 'L', 'Bandung', '1990-01-01',
            '199001012020011001', 'PNS', 'Guru', 'Islam', '081234567890',
            'guru@contoh.sch.id', '3277010101900001',
        ], $cellStyle));

        $writer->addNewSheetAndMakeItCurrent()->setName('Data Program Keahlian');
        $this->xlsxSetColumnWidths($writer, [1 => 5, 2 => 30, 3 => 30, 4 => 16]);
        $writer->addRow(Row::fromValuesWithStyle(['DATA PROGRAM KEAHLIAN'], $titleStyle));
        $writer->addRow(Row::fromValuesWithStyle(['No', 'Program Keahlian', 'Konsentrasi Keahlian', 'Inisial Kelas'], $headerStyle));
        $writer->addRow(Row::fromValuesWithStyle([1, 'Rekayasa Perangkat Lunak', 'Rekayasa Perangkat Lunak', 'RPL'], $cellStyle));

        $writer->addNewSheetAndMakeItCurrent()->setName('Wali Kelas');
        $this->xlsxSetColumnWidths($writer, [1 => 5, 2 => 26, 3 => 20, 4 => 20]);
        $writer->addRow(Row::fromValuesWithStyle(['DAFTAR WALI KELAS'], $titleStyle));
        $writer->addRow(Row::fromValues(['TAHUN PELAJARAN (isi sesuai tahun ajaran aktif)']));
        $writer->addRow(Row::fromValuesWithStyle(['NO', 'NAMA', 'NIP', 'KELAS'], $headerStyle));
        $writer->addRow(Row::fromValuesWithStyle([1, 'Nama Lengkap Guru', '199001012020011001', 'X RPL A'], $cellStyle));

        $writer->close();

        return response()->download($tempFile, 'Format Import Data Guru.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    private function importProgramKeahlianRows(array $rows, array &$errors): array
    {
        $created = $updated = $skipped = 0;

        foreach ($rows as $entry) {
            $rowNum = $entry['row'];
            $row = $entry['values'];

            $programKeahlian = $this->strVal($row, 1);
            $konsentrasi = $this->strVal($row, 2);
            $kode = Str::upper($this->strVal($row, 3));

            if (! $kode || ! $konsentrasi) {
                $skipped++;

                continue;
            }

            try {
                DB::transaction(function () use ($kode, $programKeahlian, $konsentrasi, &$created, &$updated) {
                    $existing = ProgramKeahlian::where('kode', $kode)->first();
                    if ($existing) {
                        $existing->update([
                            'program_keahlian' => $programKeahlian,
                            'konsentrasi' => $konsentrasi,
                        ]);
                        $updated++;
                    } else {
                        ProgramKeahlian::create([
                            'kode' => $kode,
                            'program_keahlian' => $programKeahlian,
                            'konsentrasi' => $konsentrasi,
                        ]);
                        $created++;
                    }
                });
            } catch (\Throwable $e) {
                $errors[] = "Baris $rowNum (Data Program Keahlian): $kode — {$e->getMessage()}";
                $skipped++;
            }
        }

        return compact('created', 'updated', 'skipped');
    }

    private function importGuruRows(array $rows, User $actor, string $defaultPassword, array &$errors, array $decisions, array &$pendingMatches): array
    {
        $created = $updated = $skipped = 0;

        foreach ($rows as $entry) {
            $rowNum = $entry['row'];
            $row = $entry['values'];

            // Kolom (header baris 3): 0=No,1=Nama,2=NUPTK,3=JK,4=TempatLahir,
            // 5=TanggalLahir,6=NIP,7=StatusKepegawaian,8=JenisPTK,9=Agama,10=HP,11=Email,12=NIK
            $nama = $this->strVal($row, 1);
            $nuptk = $this->digitVal($row, 2);
            $jk = $this->strVal($row, 3);
            $tempatLahir = $this->strVal($row, 4);
            $tanggalLahir = $this->dateVal($row, 5);
            $nip = $this->digitVal($row, 6);
            $statusKepeg = $this->strVal($row, 7);
            $jenisPtk = $this->strVal($row, 8);
            $agama = $this->strVal($row, 9);
            $hp = $this->digitVal($row, 10);
            $email = $this->strVal($row, 11);
            $nik = $this->digitVal($row, 12, padLen: 16);

            if (! $nama) {
                $skipped++;
                $errors[] = "Baris $rowNum (Daftar Guru): nama kosong, dilewati.";

                continue;
            }

            try {
                DB::transaction(function () use (
                    $rowNum, $nama, $nuptk, $jk, $tempatLahir, $tanggalLahir, $nip, $statusKepeg,
                    $jenisPtk, $agama, $hp, $email, $nik, $actor, $defaultPassword, $decisions,
                    &$created, &$updated, &$skipped, &$errors, &$pendingMatches
                ) {
                    $namaNorm = $this->normalizeName($nama);
                    $parsed = $this->parseGelar($nama);
                    $isBk = str_contains(mb_strtolower($jenisPtk), 'bk');

                    // Cocokkan guru yang sudah ada: NIP → NUPTK → nama (tanpa gelar)
                    $teacher = null;
                    if ($nip) {
                        $teacher = Teacher::where('nip', $nip)->first();
                    }
                    if (! $teacher && $nuptk) {
                        $teacher = Teacher::where('nuptk', $nuptk)->first();
                    }
                    if (! $teacher) {
                        $matchedVia = null;
                        $existingUser = $this->findTeacherUser($namaNorm, $matchedVia);
                        if ($existingUser && $matchedVia === 'fuzzy') {
                            $decisionKey = "guru:{$rowNum}";
                            $decision = $decisions[$decisionKey] ?? null;
                            if ($decision === 'merge') {
                                $teacher = $existingUser->teacher;
                            } elseif ($decision === 'create') {
                                $teacher = null; // abaikan saran, lanjut buat akun baru
                            } else {
                                // Belum ada keputusan admin — tahan baris ini, jangan ubah
                                // apa pun untuk guru ini sampai dikonfirmasi.
                                $pendingMatches[] = [
                                    'key' => $decisionKey,
                                    'nama_baru' => $nama,
                                    'matched_nama' => $existingUser->nama,
                                    'matched_uuid' => $existingUser->uuid,
                                ];
                                $skipped++;

                                return;
                            }
                        } else {
                            $teacher = $existingUser?->teacher;
                        }
                    }

                    // Gelar diisi belakangan dari import aSc XML timetable (langkah 2), BUKAN
                    // dari sheet "Daftar Guru" — nama di sheet ini polos tanpa gelar, jadi
                    // gelar_depan/gelar_belakang sengaja TIDAK disertakan di $teacherFields
                    // supaya tidak menimpa gelar yang sudah benar dari aSc.
                    $teacherFields = [
                        'nip' => $nip ?: null,
                        'nuptk' => $nuptk ?: null,
                        'jk' => $jk ?: null,
                        'tempat_lahir' => $tempatLahir ?: null,
                        'tanggal_lahir' => $tanggalLahir,
                        'status_kepegawaian' => $statusKepeg ?: null,
                        'jenis_ptk' => $jenisPtk ?: null,
                        'agama' => $agama ?: null,
                        'nik' => $nik ?: null,
                        'is_bk' => $isBk,
                    ];

                    if ($teacher) {
                        $user = $teacher->user;
                        $userUpdate = ['nama' => $parsed['nama']];
                        if ($hp) {
                            $userUpdate['nomor_hp'] = $hp;
                        }
                        if ($email && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                            $emailFree = ! User::where('email', $email)->where('id', '!=', $user->id)->exists();
                            if ($emailFree) {
                                $userUpdate['email'] = $email;
                            }
                        }
                        $user->update($userUpdate);

                        $teacher->update($teacherFields + ['updated_by' => $actor->id]);
                        $updated++;
                    } else {
                        // Guru baru — gelar biasanya belum terisi di sini karena sheet
                        // "Daftar Guru" menulis nama polos tanpa gelar. Itu wajar di langkah 1;
                        // gelar & mapel utama dilengkapi otomatis saat import aSc XML (langkah 2).
                        $finalEmail = $this->resolveEmail($email, $nip, $nuptk, $namaNorm);

                        $newUser = User::create([
                            'nama' => $parsed['nama'],
                            'email' => $finalEmail,
                            'password' => $defaultPassword,
                            'role' => UserRole::Guru,
                            'status' => UserStatus::Aktif,
                            'nomor_hp' => $hp ?: null,
                            // Password default dipakai bersama seluruh guru hasil import —
                            // wajib diganti sendiri saat login pertama.
                            'must_change_password' => true,
                        ]);

                        Teacher::create($teacherFields + [
                            'gelar_depan' => $parsed['gelar_depan'],
                            'gelar_belakang' => $parsed['gelar_belakang'],
                            'user_id' => $newUser->id,
                            'created_by' => $actor->id,
                        ]);
                        $created++;
                    }
                });
            } catch (\Throwable $e) {
                $errors[] = "Baris $rowNum (Daftar Guru): $nama — {$e->getMessage()}";
                $skipped++;
            }
        }

        return compact('created', 'updated', 'skipped');
    }

    private function importWaliKelasRows(array $rows, User $actor, array &$errors, array $decisions, array &$pendingMatches): array
    {
        $created = $updated = $skipped = 0;

        if (empty($rows)) {
            return compact('created', 'updated', 'skipped');
        }

        $ay = \App\Support\TahunAjaran::current();
        if (! $ay) {
            $errors[] = 'Wali Kelas dilewati: tidak ada tahun ajaran aktif.';
            $skipped = count($rows);

            return compact('created', 'updated', 'skipped');
        }

        $kelasCache = SchoolClass::where('academic_year_id', $ay->id)->get();

        foreach ($rows as $entry) {
            $rowNum = $entry['row'];
            $row = $entry['values'];

            // Kolom (header baris 3): 0=No,1=Nama,2=NIP,3=Kelas
            $nama = $this->strVal($row, 1);
            $nip = $this->digitVal($row, 2);
            $kelasLabel = $this->strVal($row, 3);

            if (! $kelasLabel) {
                $skipped++;

                continue;
            }

            try {
                DB::transaction(function () use (
                    $rowNum, $nama, $nip, $kelasLabel, $kelasCache, $ay, $actor, $decisions,
                    &$created, &$updated, &$skipped, &$errors, &$pendingMatches
                ) {
                    $kelas = $this->resolveKelas($kelasLabel, $kelasCache, $ay);
                    if (! $kelas) {
                        throw new \RuntimeException("kelas '$kelasLabel' tidak ditemukan/tidak valid");
                    }

                    $teacher = null;
                    if ($nip) {
                        $teacher = Teacher::where('nip', $nip)->first();
                    }
                    if (! $teacher && $nama) {
                        $matchedVia = null;
                        $existingUser = $this->findTeacherUser($this->normalizeName($nama), $matchedVia);
                        if ($existingUser && $matchedVia === 'fuzzy') {
                            $decisionKey = "wali_kelas:{$rowNum}";
                            $decision = $decisions[$decisionKey] ?? null;
                            if ($decision === 'merge') {
                                $teacher = $existingUser->teacher;
                            } elseif ($decision !== 'create') {
                                $pendingMatches[] = [
                                    'key' => $decisionKey,
                                    'nama_baru' => $nama,
                                    'matched_nama' => $existingUser->nama,
                                    'matched_uuid' => $existingUser->uuid,
                                ];
                                $skipped++;

                                return;
                            }
                            // decision === 'create' → $teacher tetap null, jatuh ke error di bawah
                            // (Wali Kelas tidak bisa "buat guru baru", assignment ini memang perlu
                            // guru yang sudah ada — pilihan 'create' di sini berarti "bukan orang
                            // yang sama, jangan assign").
                        } else {
                            $teacher = $existingUser?->teacher;
                        }
                    }
                    if (! $teacher) {
                        throw new \RuntimeException("guru '$nama' (NIP $nip) tidak ditemukan");
                    }

                    $isNew = $kelas->wali_kelas_id === null;
                    $kelas->update(['wali_kelas_id' => $teacher->user_id, 'updated_by' => $actor->id]);

                    $isNew ? $created++ : $updated++;
                });
            } catch (\Throwable $e) {
                $errors[] = "Baris $rowNum (Wali Kelas): $nama — {$e->getMessage()}";
                $skipped++;
            }
        }

        return compact('created', 'updated', 'skipped');
    }

    // ── POST /admin/import/dapodik-siswa ──────────────────────────────────────

    public function importSiswa(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:20480',
        ]);

        $rows = $this->readXlsxFromRow($request->file('file')->getRealPath(), startRow: 7);
        $actor = $request->user();
        $ay = \App\Support\TahunAjaran::current();

        if (! $ay) {
            return response()->json(['message' => 'Tidak ada tahun ajaran aktif.'], 422);
        }

        // Cache semua kelas aktif
        $kelasCache = SchoolClass::where('academic_year_id', $ay->id)->get();

        set_time_limit(300); // 1700+ siswa butuh waktu lebih
        // Password default akun siswa — dari panel admin/.env, TIDAK di-hardcode.
        $defaultPassword = Hash::make(PasswordDefaultSetting::resolveOrFail('siswa'));

        $stats = DB::transaction(function () use ($rows, $actor, $ay, $kelasCache, $defaultPassword) {
            $created = $updated = $skipped = 0;

            foreach ($rows as $row) {
                // Kolom: 1=Nama, 2=NIPD(NIS), 3=JK, 4=NISN, 5=TmptLahir, 6=TglLahir,
                // 19=HP, 20=Email, 24=NamaAyah, 30=NamaIbu, 42=Rombel
                $nama = $this->strVal($row, 1);
                $nipd = $this->strVal($row, 2); // NIS lokal (NIPD)
                $jk = strtoupper(substr($this->strVal($row, 3), 0, 1)) ?: null; // 'L'/'P'
                if (! in_array($jk, ['L', 'P'], true)) {
                    $jk = null;
                }
                $nisn = $this->nisnVal($row, 4);
                $hp = $this->strVal($row, 19);
                $email = $this->strVal($row, 20);
                $namaAyah = $this->strVal($row, 24);
                $namaIbu = $this->strVal($row, 30);
                $rombel = $this->strVal($row, 42);

                if (! $nama || (! $nisn && ! $nipd)) {
                    $skipped++;

                    continue;
                }

                // Parse rombel: "XI RPL A" → class_id
                $kelas = $this->resolveKelas($rombel, $kelasCache, $ay);
                $angkatan = $this->calcAngkatan($rombel, $ay);

                // Cari student yang sudah ada (by NISN atau NIS)
                $student = null;
                if ($nisn) {
                    $student = Student::where('nisn', $nisn)->first();
                }
                if (! $student && $nipd) {
                    $student = Student::where('nis', $nipd)->first();
                }

                if ($student) {
                    // Update data
                    $stuUpdate = [];
                    if ($nisn) {
                        $stuUpdate['nisn'] = $nisn;
                    }
                    if ($nipd) {
                        $stuUpdate['nis'] = $nipd;
                    }
                    if ($kelas) {
                        $stuUpdate['class_id'] = $kelas->id;
                    }
                    if ($angkatan) {
                        $stuUpdate['angkatan'] = $angkatan;
                    }
                    if ($namaAyah) {
                        $stuUpdate['nama_ayah'] = $namaAyah;
                    }
                    if ($namaIbu) {
                        $stuUpdate['nama_ibu'] = $namaIbu;
                    }
                    // Melengkapi saja — jenis kelamin yang sudah diisi manual tidak ditimpa.
                    if ($jk && ! $student->jenis_kelamin) {
                        $stuUpdate['jenis_kelamin'] = $jk;
                    }
                    $stuUpdate['updated_by'] = $actor->id;
                    $student->update($stuUpdate);

                    // Update user
                    $uUpdate = ['nama' => $nama];
                    if ($hp) {
                        $uUpdate['nomor_hp'] = $hp;
                    }
                    if ($email && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                        $emailFree = ! User::where('email', $email)
                            ->where('id', '!=', $student->user_id)
                            ->exists();
                        if ($emailFree) {
                            $uUpdate['email'] = $email;
                        }
                    }
                    $student->user->update($uUpdate);

                    $updated++;
                } else {
                    // Buat user + student baru
                    $finalEmail = $this->resolveStudentEmail($email, $nisn, $nipd);

                    $newUser = User::create([
                        'nama' => $nama,
                        'email' => $finalEmail,
                        'password' => $defaultPassword,
                        'role' => UserRole::Siswa,
                        'status' => UserStatus::Aktif,
                        'nomor_hp' => $hp ?: null,
                        'must_change_password' => true,
                    ]);

                    Student::create([
                        'user_id' => $newUser->id,
                        'nis' => $nipd ?: null,
                        'nisn' => $nisn ?: null,
                        'jenis_kelamin' => $jk,
                        'class_id' => $kelas?->id,
                        'angkatan' => $angkatan,
                        'nama_ayah' => $namaAyah ?: null,
                        'nama_ibu' => $namaIbu ?: null,
                        'created_by' => $actor->id,
                    ]);
                    $created++;
                }
            }

            return compact('created', 'updated', 'skipped');
        });

        return response()->json(['message' => 'Import siswa berhasil.', 'data' => ['siswa' => $stats]]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function readXlsxFromRow(string $path, int $startRow): array
    {
        $reader = new XlsxReader;
        $reader->open($path);
        $rows = [];
        $rowNum = 0;
        $sheetDone = false;

        foreach ($reader->getSheetIterator() as $sheet) {
            if ($sheetDone) {
                break;
            }
            foreach ($sheet->getRowIterator() as $row) {
                $rowNum++;
                if ($rowNum < $startRow) {
                    continue;
                }

                $values = $row->toArray();

                // Skip baris kosong
                if (empty(array_filter($values, fn ($v) => $v !== null && $v !== ''))) {
                    continue;
                }

                $rows[] = $values;
            }
            $sheetDone = true;
        }

        $reader->close();

        return $rows;
    }

    /**
     * Baca beberapa sheet sekaligus dari satu file dalam satu kali buka, dicocokkan
     * berdasarkan nama (case-insensitive). $sheetStartRows: ['Nama Sheet' => startRow].
     * Tiap baris dikembalikan sebagai ['row' => nomor baris excel, 'values' => array].
     */
    private function readNamedSheets(string $path, array $sheetStartRows): array
    {
        $reader = new XlsxReader;
        $reader->open($path);
        $result = array_fill_keys(array_keys($sheetStartRows), []);

        foreach ($reader->getSheetIterator() as $sheet) {
            $sheetName = mb_strtolower(trim($sheet->getName()));
            $matchKey = null;
            foreach ($sheetStartRows as $key => $startRow) {
                if (mb_strtolower(trim($key)) === $sheetName) {
                    $matchKey = $key;
                    break;
                }
            }
            if ($matchKey === null) {
                continue;
            }

            $startRow = $sheetStartRows[$matchKey];
            $rowNum = 0;
            foreach ($sheet->getRowIterator() as $row) {
                $rowNum++;
                if ($rowNum < $startRow) {
                    continue;
                }

                $values = $row->toArray();
                if (empty(array_filter($values, fn ($v) => $v !== null && $v !== ''))) {
                    continue;
                }

                $result[$matchKey][] = ['row' => $rowNum, 'values' => $values];
            }
        }

        $reader->close();

        return $result;
    }

    private function strVal(array $row, int $idx): string
    {
        $v = $row[$idx] ?? null;
        if ($v === null || $v === '') {
            return '';
        }

        return trim((string) $v);
    }

    /**
     * Nilai berupa digit (NIP, NUPTK, NIK, HP, NISN, dll). Excel kadang menyimpan
     * kolom seperti ini sebagai angka sehingga muncul artefak desimal (mis.
     * "12345678.0"). Pembersihan dilakukan lewat regex string, BUKAN round-trip
     * lewat floatval() — angka panjang seperti NIP/NIK (16–19 digit) melebihi
     * presisi double PHP (~15-17 digit) dan akan berubah nilainya kalau dibulatkan
     * lewat float. $padLen mengisi ulang nol di depan untuk field yang panjangnya
     * tetap (mis. NISN 10 digit, NIK 16 digit) kalau digit itu sampai hilang.
     */
    private function digitVal(array $row, int $idx, ?int $padLen = null): string
    {
        $v = $row[$idx] ?? null;
        if ($v === null || $v === '') {
            return '';
        }
        $str = trim((string) $v);
        if (preg_match('/^-?\d+\.0+$/', $str)) {
            $str = substr($str, 0, strpos($str, '.'));
        }

        return $padLen ? str_pad($str, $padLen, '0', STR_PAD_LEFT) : $str;
    }

    private function nisnVal(array $row, int $idx): string
    {
        return $this->digitVal($row, $idx, padLen: 10);
    }

    private function dateVal(array $row, int $idx): ?string
    {
        $v = $row[$idx] ?? null;
        if ($v === null || $v === '') {
            return null;
        }
        if ($v instanceof \DateTimeInterface) {
            return $v->format('Y-m-d');
        }
        $str = trim((string) $v);

        return $str !== '' ? $str : null;
    }

    private function parseGelar(string $namaLengkap): array
    {
        $nama = trim($namaLengkap);

        // Gelar belakang: semua setelah koma pertama
        $gelarBelakang = null;
        if (($pos = strpos($nama, ',')) !== false) {
            $gelarBelakang = trim(substr($nama, $pos + 1)) ?: null;
            $nama = trim(substr($nama, 0, $pos));
        }

        // Gelar depan: kata-kata awal yang ada dalam daftar gelar
        $known = ['Prof.', 'Dr.', 'Drs.', 'Drh.', 'Ir.', 'Ns.', 'H.', 'Hj.'];
        $prefixParts = [];
        $words = preg_split('/\s+/', $nama);
        while (! empty($words) && in_array($words[0], $known)) {
            $prefixParts[] = array_shift($words);
        }
        $gelarDepan = ! empty($prefixParts) ? implode(' ', $prefixParts) : null;
        $namaBersih = ! empty($words) ? implode(' ', $words) : $nama;

        return [
            'gelar_depan' => $gelarDepan,
            'nama' => $namaBersih,
            'gelar_belakang' => $gelarBelakang,
        ];
    }

    private function normalizeName(string $name): string
    {
        // "Yana Cahya Kusumah, S.Kom., MT." → "yana cahya kusumah"
        $name = preg_replace('/,\s*[A-Z][A-Za-z.]+.*$/', '', $name);

        return mb_strtolower(trim(preg_replace('/\s+/', ' ', $name)));
    }

    // $matchedVia diisi 'exact' atau 'fuzzy' supaya caller bisa memperingatkan
    // admin saat hasil hanya cocok karena kemiripan nama (typo), bukan sama persis.
    private function findTeacherUser(string $namaNorm, ?string &$matchedVia = null): ?User
    {
        $candidates = User::whereIn('role', [
            UserRole::Guru, UserRole::WaliKelas, UserRole::Wakasek, UserRole::BK,
        ])->get();

        $exact = $candidates->first(fn ($u) => $this->normalizeName($u->nama) === $namaNorm);
        if ($exact) {
            $matchedVia = 'exact';

            return $exact;
        }

        // Fallback: kemiripan nama (typo kecil seperti "Marsita" vs "Marsitha", atau
        // "Moch" vs "Moch.") supaya re-import tidak membuat akun duplikat hanya
        // karena beda ejaan tipis antar sumber data (aSc XML vs Excel Dapodik).
        $fuzzy = $this->fuzzyMatchName($namaNorm, $candidates->pluck('nama', 'id'));
        if ($fuzzy !== null) {
            $matchedVia = 'fuzzy';

            return $candidates->firstWhere('id', $fuzzy);
        }

        return null;
    }

    // Levenshtein <= 2 & selisih panjang <= 2 karakter. Ambang ini divalidasi
    // terhadap data guru asli sekolah dan tidak menghasilkan false positive.
    // Kalau ada lebih dari satu kandidat dengan jarak minimum yang sama, dianggap
    // ambigu dan tidak dicocokkan otomatis (lebih aman biarkan admin cek manual).
    private function fuzzyMatchName(string $namaNorm, Collection $candidateNamesById): ?int
    {
        $bestId = null;
        $bestDist = null;
        $ambiguous = false;

        foreach ($candidateNamesById as $id => $candNama) {
            $candNorm = $this->normalizeName($candNama);
            if (abs(mb_strlen($candNorm) - mb_strlen($namaNorm)) > 2) {
                continue;
            }
            $dist = levenshtein($candNorm, $namaNorm);
            if ($dist === 0 || $dist > 2) {
                continue;
            }

            if ($bestDist === null || $dist < $bestDist) {
                $bestDist = $dist;
                $bestId = $id;
                $ambiguous = false;
            } elseif ($dist === $bestDist) {
                $ambiguous = true;
            }
        }

        return $ambiguous ? null : $bestId;
    }

    private function resolveEmail(string $email, string $nip, string $nuptk, string $namaNorm): string
    {
        if ($email && filter_var($email, FILTER_VALIDATE_EMAIL)) {
            if (! User::where('email', $email)->exists()) {
                return $email;
            }
        }
        // Email kosong/tidak valid → sintesis dari identitas: NIP → NUPTK → nama
        $identity = $nip ?: ($nuptk ?: $namaNorm);
        $slug = Str::slug($identity, '.');
        $base = "{$slug}@smkn2cimahi.sch.id";
        $final = $base;
        $i = 2;
        while (User::where('email', $final)->exists()) {
            $final = Str::beforeLast($base, '@').$i.'@'.Str::afterLast($base, '@');
            $i++;
        }

        return $final;
    }

    private function resolveStudentEmail(string $email, string $nisn, string $nipd): string
    {
        if ($email && filter_var($email, FILTER_VALIDATE_EMAIL) && ! User::where('email', $email)->exists()) {
            return $email;
        }
        $key = $nisn ?: $nipd;

        return "{$key}@siswa.smkn2cimahi.sch.id";
    }

    private function resolveKelas(string $rombel, $kelasCache, AcademicYear $ay): ?SchoolClass
    {
        if (! $rombel) {
            return null;
        }
        // Format Dapodik: "XI RPL A" atau "X ANIMASI A"
        $parts = preg_split('/\s+/', trim($rombel));
        if (count($parts) < 3) {
            return null;
        }

        $tingkat = $parts[0]; // "X", "XI", "XII"
        $jurusanKode = strtoupper($parts[1]);
        $rombelHuruf = strtoupper($parts[2]); // "A", "B", "C", "D"

        $jurusanNama = self::JURUSAN_MAP[$jurusanKode] ?? null;

        // Filter kelas yang tingkat & rombel-nya cocok terlebih dulu
        $candidates = $kelasCache->filter(fn ($k) => $k->tingkat->value === $tingkat
            && strtoupper($k->rombel) === $rombelHuruf
        );

        if ($candidates->isNotEmpty()) {
            // 1. Exact match via JURUSAN_MAP
            if ($jurusanNama) {
                $match = $candidates->first(fn ($k) => $k->jurusan === $jurusanNama);
                if ($match) {
                    return $match;
                }
            }

            // 2. Jurusan di DB sama persis dengan kode (case-insensitive)
            $match = $candidates->first(
                fn ($k) => mb_strtolower($k->jurusan) === mb_strtolower($jurusanKode)
            );
            if ($match) {
                return $match;
            }

            // 3. Jurusan di DB mengandung kode sebagai substring
            $match = $candidates->first(
                fn ($k) => str_contains(mb_strtolower($k->jurusan), mb_strtolower($jurusanKode))
            );
            if ($match) {
                return $match;
            }

            // 4. Fallback inisial (skip kata penghubung)
            $match = $candidates->first(function ($k) use ($jurusanKode) {
                $kata = preg_split('/\s+/', mb_strtolower($k->jurusan));
                $skipWords = ['dan', 'the', 'of', 'de'];
                $inisial = implode('', array_map(
                    fn ($w) => strtoupper($w[0]),
                    array_filter($kata, fn ($w) => ! in_array($w, $skipWords))
                ));

                return $inisial === $jurusanKode;
            });
            if ($match) {
                return $match;
            }
        }

        // 5. Kelas belum ada di DB → buat otomatis dari data Dapodik
        try {
            $tingkatEnum = Tingkat::from($tingkat);
        } catch (\ValueError) {
            return null;
        }

        $namaJurusan = $jurusanNama ?? ucwords(mb_strtolower($jurusanKode));

        $newKelas = SchoolClass::create([
            'tingkat' => $tingkatEnum,
            'jurusan' => $namaJurusan,
            'rombel' => $rombelHuruf,
            'academic_year_id' => $ay->id,
        ]);

        // Tambah ke cache agar rombel yang sama pada baris berikutnya langsung match
        $kelasCache->push($newKelas);

        return $newKelas;
    }

    private function calcAngkatan(string $rombel, AcademicYear $ay): ?int
    {
        if (! $rombel) {
            return null;
        }
        $parts = preg_split('/\s+/', trim($rombel));
        $tingkat = $parts[0] ?? null;
        // Ambil tahun awal dari "2025/2026"
        $tahunMulai = (int) Str::before($ay->tahun, '/');

        return match ($tingkat) {
            'X' => $tahunMulai,
            'XI' => $tahunMulai - 1,
            'XII' => $tahunMulai - 2,
            default => null,
        };
    }
}
