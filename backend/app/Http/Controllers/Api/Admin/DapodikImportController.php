<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;

class DapodikImportController extends Controller
{
    // Kode jurusan singkat → nama lengkap (sama dengan AscXmlImportController)
    private const JURUSAN_MAP = [
        'MEKA' => 'Mekatronika',
        'DKV'  => 'Desain Komunikasi Visual',
        'RPL'  => 'Rekayasa Perangkat Lunak',
        'PPLG' => 'Pengembangan Perangkat Lunak dan Gim',
        'ANM'  => 'Animasi',
        'KI'   => 'Teknik Kimia Industri',
        'TKI'  => 'Teknik Kimia Industri',
        'TP'   => 'Teknik Pemesinan',
        'MES'  => 'Teknik Pemesinan',
    ];

    // ── POST /admin/import/dapodik-guru ───────────────────────────────────────

    public function importGuru(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
        ]);

        $rows  = $this->readXlsxFromRow($request->file('file')->getRealPath(), startRow: 7);
        $actor = $request->user();
        $defaultPassword = Hash::make('password');

        $stats = DB::transaction(function () use ($rows, $actor, $defaultPassword) {
            $created = $updated = $skipped = 0;

            foreach ($rows as $row) {
                // Kolom index (0-based): 0=No, 1=Nama, 2=NUPTK, 3=JK, 4=TmptLahir,
                // 5=TglLahir, 6=NIP, 7=StatusKepeg, 18=HP, 19=Email, 20=TugasTambahan
                $nama           = $this->strVal($row, 1);
                $nuptk          = $this->strVal($row, 2);
                $nip            = $this->strVal($row, 6);
                $statusKepeg    = $this->strVal($row, 7);
                $hp             = $this->strVal($row, 18);
                $email          = $this->strVal($row, 19);
                $tugasTambahan  = $this->strVal($row, 20);

                if (!$nama) { $skipped++; continue; }

                // Normalisasi nama untuk pencocokan (strip gelar akademik)
                $namaNorm = $this->normalizeName($nama);

                // Cari user yang sudah ada (dari import aSc XML sebelumnya)
                $user = $this->findTeacherUser($namaNorm);

                // Tentukan role
                $role = $this->determineRole($tugasTambahan);

                $parsed = $this->parseGelar($nama);

                if ($user) {
                    // Update data yang ada
                    $updateData = ['role' => $role, 'nama' => $parsed['nama']];
                    if ($hp)    $updateData['nomor_hp'] = $hp;
                    if ($email && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                        if (Str::endsWith($user->email, '@smkn2cimahi.sch.id')) {
                            $updateData['email'] = $email;
                        }
                    }
                    $user->update($updateData);

                    // Update teacher record
                    $teacher = $user->teacher;
                    if ($teacher) {
                        $tUpdate = [
                            'gelar_depan'    => $parsed['gelar_depan'],
                            'gelar_belakang' => $parsed['gelar_belakang'],
                            'updated_by'     => $actor->id,
                        ];
                        if ($nip   && ! $teacher->nip)   $tUpdate['nip']   = $nip;
                        if ($nuptk && ! $teacher->nuptk) $tUpdate['nuptk'] = $nuptk;
                        $teacher->update($tUpdate);
                    }
                    $updated++;
                } else {
                    // Buat akun baru
                    $finalEmail = $this->resolveEmail($email, $namaNorm);

                    $newUser = User::create([
                        'nama'     => $parsed['nama'],
                        'email'    => $finalEmail,
                        'password' => $defaultPassword,
                        'role'     => $role,
                        'status'   => UserStatus::Aktif,
                        'nomor_hp' => $hp ?: null,
                    ]);

                    Teacher::create([
                        'user_id'        => $newUser->id,
                        'nip'            => $nip   ?: null,
                        'nuptk'          => $nuptk ?: null,
                        'gelar_depan'    => $parsed['gelar_depan'],
                        'gelar_belakang' => $parsed['gelar_belakang'],
                        'created_by'     => $actor->id,
                    ]);
                    $created++;
                }
            }

            return compact('created', 'updated', 'skipped');
        });

        return response()->json(['message' => 'Import guru berhasil.', 'data' => ['guru' => $stats]]);
    }

    // ── POST /admin/import/dapodik-siswa ──────────────────────────────────────

    public function importSiswa(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:20480',
        ]);

        $rows  = $this->readXlsxFromRow($request->file('file')->getRealPath(), startRow: 7);
        $actor = $request->user();
        $ay    = AcademicYear::where('aktif', true)->first();

        if (!$ay) {
            return response()->json(['message' => 'Tidak ada tahun ajaran aktif.'], 422);
        }

        // Cache semua kelas aktif
        $kelasCache = SchoolClass::where('academic_year_id', $ay->id)->get();

        set_time_limit(300); // 1700+ siswa butuh waktu lebih
        $defaultPassword = Hash::make('password');

        $stats = DB::transaction(function () use ($rows, $actor, $ay, $kelasCache, $defaultPassword) {
            $created = $updated = $skipped = 0;

            foreach ($rows as $row) {
                // Kolom: 1=Nama, 2=NIPD(NIS), 3=JK, 4=NISN, 5=TmptLahir, 6=TglLahir,
                // 19=HP, 20=Email, 24=NamaAyah, 30=NamaIbu, 42=Rombel
                $nama     = $this->strVal($row, 1);
                $nipd     = $this->strVal($row, 2); // NIS lokal (NIPD)
                $nisn     = $this->strVal($row, 4);
                $hp       = $this->strVal($row, 19);
                $email    = $this->strVal($row, 20);
                $namaAyah = $this->strVal($row, 24);
                $namaIbu  = $this->strVal($row, 30);
                $rombel   = $this->strVal($row, 42);

                if (!$nama || (!$nisn && !$nipd)) { $skipped++; continue; }

                // Parse rombel: "XI RPL A" → class_id
                $kelas   = $this->resolveKelas($rombel, $kelasCache, $ay);
                $angkatan = $this->calcAngkatan($rombel, $ay);

                // Cari student yang sudah ada (by NISN atau NIS)
                $student = null;
                if ($nisn) $student = Student::where('nisn', $nisn)->first();
                if (!$student && $nipd) $student = Student::where('nis', $nipd)->first();

                if ($student) {
                    // Update data
                    $stuUpdate = [];
                    if ($nisn)    $stuUpdate['nisn']      = $nisn;
                    if ($nipd)    $stuUpdate['nis']       = $nipd;
                    if ($kelas)   $stuUpdate['class_id']  = $kelas->id;
                    if ($angkatan) $stuUpdate['angkatan'] = $angkatan;
                    if ($namaAyah) $stuUpdate['nama_ayah'] = $namaAyah;
                    if ($namaIbu)  $stuUpdate['nama_ibu']  = $namaIbu;
                    $stuUpdate['updated_by'] = $actor->id;
                    $student->update($stuUpdate);

                    // Update user
                    $uUpdate = ['nama' => $nama];
                    if ($hp) $uUpdate['nomor_hp'] = $hp;
                    if ($email && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                        $emailFree = !User::where('email', $email)
                            ->where('id', '!=', $student->user_id)
                            ->exists();
                        if ($emailFree) $uUpdate['email'] = $email;
                    }
                    $student->user->update($uUpdate);

                    $updated++;
                } else {
                    // Buat user + student baru
                    $finalEmail = $this->resolveStudentEmail($email, $nisn, $nipd);

                    $newUser = User::create([
                        'nama'     => $nama,
                        'email'    => $finalEmail,
                        'password' => $defaultPassword,
                        'role'     => UserRole::Siswa,
                        'status'   => UserStatus::Aktif,
                        'nomor_hp' => $hp ?: null,
                    ]);

                    Student::create([
                        'user_id'    => $newUser->id,
                        'nis'        => $nipd ?: null,
                        'nisn'       => $nisn ?: null,
                        'class_id'   => $kelas?->id,
                        'angkatan'   => $angkatan,
                        'nama_ayah'  => $namaAyah ?: null,
                        'nama_ibu'   => $namaIbu  ?: null,
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
        $reader   = new XlsxReader();
        $reader->open($path);
        $rows     = [];
        $rowNum   = 0;
        $sheetDone = false;

        foreach ($reader->getSheetIterator() as $sheet) {
            if ($sheetDone) break;
            foreach ($sheet->getRowIterator() as $row) {
                $rowNum++;
                if ($rowNum < $startRow) continue;

                $values = $row->toArray();

                // Skip baris kosong
                if (empty(array_filter($values, fn ($v) => $v !== null && $v !== ''))) continue;

                $rows[] = $values;
            }
            $sheetDone = true;
        }

        $reader->close();
        return $rows;
    }

    private function strVal(array $row, int $idx): string
    {
        $v = $row[$idx] ?? null;
        if ($v === null || $v === '') return '';
        return trim((string) $v);
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
            'gelar_depan'    => $gelarDepan,
            'nama'           => $namaBersih,
            'gelar_belakang' => $gelarBelakang,
        ];
    }

    private function normalizeName(string $name): string
    {
        // "Yana Cahya Kusumah, S.Kom., MT." → "yana cahya kusumah"
        $name = preg_replace('/,\s*[A-Z][A-Za-z.]+.*$/', '', $name);
        return mb_strtolower(trim(preg_replace('/\s+/', ' ', $name)));
    }

    private function findTeacherUser(string $namaNorm): ?User
    {
        // Exact match pada nama yang sudah dinormalisasi
        return User::whereIn('role', [
                UserRole::Guru, UserRole::WaliKelas, UserRole::Wakasek, UserRole::BK,
            ])
            ->get()
            ->first(fn ($u) => $this->normalizeName($u->nama) === $namaNorm);
    }

    private function determineRole(string $tugas): UserRole
    {
        $t = mb_strtolower($tugas);
        if (str_contains($t, 'wali') && str_contains($t, 'kelas')) return UserRole::WaliKelas;
        if (str_contains($t, 'wakil kepala') || str_contains($t, 'waka'))  return UserRole::Wakasek;
        if (str_contains($t, 'bimbingan') || str_contains($t, 'konseling')) return UserRole::BK;
        return UserRole::Guru;
    }

    private function resolveEmail(string $email, string $namaNorm): string
    {
        if ($email && filter_var($email, FILTER_VALIDATE_EMAIL)) {
            if (!User::where('email', $email)->exists()) return $email;
        }
        // Generate dari nama
        $slug = Str::slug($namaNorm, '.');
        $base = "{$slug}@smkn2cimahi.sch.id";
        $final = $base;
        $i = 2;
        while (User::where('email', $final)->exists()) {
            $final = Str::beforeLast($base, '@') . $i . '@' . Str::afterLast($base, '@');
            $i++;
        }
        return $final;
    }

    private function resolveStudentEmail(string $email, string $nisn, string $nipd): string
    {
        if ($email && filter_var($email, FILTER_VALIDATE_EMAIL) && !User::where('email', $email)->exists()) {
            return $email;
        }
        $key = $nisn ?: $nipd;
        return "{$key}@siswa.smkn2cimahi.sch.id";
    }

    private function resolveKelas(string $rombel, $kelasCache, AcademicYear $ay): ?SchoolClass
    {
        if (!$rombel) return null;
        // Format: "XI RPL A" → parts[0]=XI, parts[1]=RPL, parts[2]=A
        $parts = preg_split('/\s+/', trim($rombel));
        if (count($parts) < 3) return null;

        $tingkat     = $parts[0]; // "X", "XI", "XII"
        $jurusanKode = strtoupper($parts[1]);
        $rombelHuruf = strtoupper($parts[2]); // "A", "B", "C", "D"

        $jurusan = self::JURUSAN_MAP[$jurusanKode] ?? null;

        // Coba exact match dengan JURUSAN_MAP
        if ($jurusan) {
            $match = $kelasCache->first(fn ($k) =>
                $k->tingkat->value === $tingkat
                && $k->jurusan    === $jurusan
                && strtoupper($k->rombel) === $rombelHuruf
            );
            if ($match) return $match;
        }

        // Fallback: cari kelas yang rombel-nya cocok dan tingkat cocok,
        // jurusan cocok secara case-insensitive atau mengandung kode sebagai inisial
        return $kelasCache->first(function ($k) use ($tingkat, $jurusanKode, $rombelHuruf) {
            if ($k->tingkat->value !== $tingkat) return false;
            if (strtoupper($k->rombel) !== $rombelHuruf) return false;
            // Coba inisial kata-kata jurusan: "Rekayasa Perangkat Lunak" → "RPL"
            $inisial = implode('', array_map(
                fn ($w) => strtoupper($w[0]),
                preg_split('/\s+/', $k->jurusan)
            ));
            return $inisial === $jurusanKode;
        });
    }

    private function calcAngkatan(string $rombel, AcademicYear $ay): ?int
    {
        if (!$rombel) return null;
        $parts  = preg_split('/\s+/', trim($rombel));
        $tingkat = $parts[0] ?? null;
        // Ambil tahun awal dari "2025/2026"
        $tahunMulai = (int) Str::before($ay->tahun, '/');
        return match ($tingkat) {
            'X'    => $tahunMulai,
            'XI'   => $tahunMulai - 1,
            'XII'  => $tahunMulai - 2,
            default => null,
        };
    }
}
