<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AscXmlImportController extends Controller
{
    // Kode singkat kelas → nama jurusan lengkap
    private const JURUSAN_MAP = [
        'MEKA' => 'Mekatronika',
        'DKV'  => 'Desain Komunikasi Visual',
        'RPL'  => 'Pengembangan Perangkat Lunak dan Gim',
        'PPLG' => 'Pengembangan Perangkat Lunak dan Gim',
        'ANM'  => 'Animasi',
        'KI'   => 'Teknik Kimia Industri',
        'TKI'  => 'Teknik Kimia Industri',
        'TP'   => 'Teknik Pemesinan',
        'MES'  => 'Teknik Pemesinan',
    ];

    // Kata kunci → kelompok mapel
    private const KELOMPOK_RULES = [
        'normatif'    => ['PAI', 'Budi Pekerti', 'Pancasila', 'Agama'],
        'muatan_lokal'=> ['B.Sunda', 'Sunda', 'PLH', 'Jepang', 'Bimbingan Konseling'],
        'adaptif'     => ['Matematika', 'B.Indonesia', 'B.Inggris', 'Sejarah', 'IPAS',
                          'PJOK', 'SENBUD', 'Seni Budaya', 'Informatika'],
    ];

    // Hari dari string biner 5-digit
    private const DAY_MAP = [
        '10000' => 'senin',
        '01000' => 'selasa',
        '00100' => 'rabu',
        '00010' => 'kamis',
        '00001' => 'jumat',
    ];

    // POST /admin/import/asc-xml
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|max:20480', // 20 MB max
        ]);

        // Baca file & konversi encoding Windows-1252 → UTF-8
        $raw = file_get_contents($request->file('file')->getRealPath());
        if (!mb_check_encoding($raw, 'UTF-8')) {
            $raw = mb_convert_encoding($raw, 'UTF-8', 'Windows-1252');
        }
        // Ganti deklarasi encoding di header XML supaya parser tidak protes
        $raw = preg_replace('/encoding="[^"]*"/i', 'encoding="UTF-8"', $raw, 1);

        libxml_use_internal_errors(true);
        $xml = simplexml_load_string($raw);
        if (!$xml) {
            $errors = array_map(fn ($e) => trim($e->message), libxml_get_errors());
            libxml_clear_errors();
            return response()->json(['message' => 'File XML tidak valid.', 'errors' => $errors], 422);
        }
        libxml_clear_errors();

        $ay = AcademicYear::where('aktif', true)->first();
        if (!$ay) {
            return response()->json([
                'message' => 'Tidak ada tahun ajaran aktif. Buat tahun ajaran terlebih dahulu di tab Tahun Ajaran.',
            ], 422);
        }

        $actor = $request->user();

        $stats = DB::transaction(function () use ($xml, $ay, $actor) {
            $subjectStats  = $this->importSubjects($xml, $actor);
            $teacherStats  = $this->importTeachers($xml, $actor);
            $classStats    = $this->importClasses($xml, $ay, $actor);
            $scheduleStats = $this->importSchedules($xml, $ay, $actor);

            return [
                'mata_pelajaran' => $subjectStats,
                'guru'           => $teacherStats,
                'kelas'          => $classStats,
                'jadwal'         => $scheduleStats,
            ];
        });

        return response()->json([
            'message' => 'Import berhasil.',
            'data'    => $stats,
        ]);
    }

    // ── 1. Mata Pelajaran ─────────────────────────────────────────────────────

    private function importSubjects(\SimpleXMLElement $xml, User $actor): array
    {
        $created = $updated = $skipped = 0;

        foreach ($xml->subjects->subject as $s) {
            $nama = trim((string) $s['name']);
            $kode = Str::upper(trim((string) $s['short']));
            if (!$nama || !$kode) { $skipped++; continue; }

            $kode = Str::limit($kode, 20, '');
            $kelompok = $this->determineKelompok($nama);

            // Cari berdasarkan nama (termasuk trashed)
            $subject = Subject::withTrashed()->where('nama', $nama)->first();

            if ($subject) {
                if ($subject->trashed()) $subject->restore();
                $subject->update([
                    'kode'       => $this->uniqueKode($kode, $subject->id),
                    'kelompok'   => $kelompok,
                    'aktif'      => true,
                    'updated_by' => $actor->id,
                ]);
                $updated++;
            } else {
                Subject::create([
                    'kode'       => $this->uniqueKode($kode),
                    'nama'       => $nama,
                    'kelompok'   => $kelompok,
                    'aktif'      => true,
                    'created_by' => $actor->id,
                ]);
                $created++;
            }
        }

        return compact('created', 'updated', 'skipped');
    }

    private function uniqueKode(string $kode, ?int $excludeId = null): string
    {
        $base = $kode;
        $i = 2;
        while (
            Subject::withTrashed()
                ->where('kode', $kode)
                ->when($excludeId, fn ($q) => $q->where('id', '!=', $excludeId))
                ->exists()
        ) {
            $kode = Str::limit($base, 18, '') . $i++;
        }
        return $kode;
    }

    // ── 2. Guru ───────────────────────────────────────────────────────────────

    private function importTeachers(\SimpleXMLElement $xml, User $actor): array
    {
        $created = $updated = $skipped = 0;

        foreach ($xml->teachers->teacher as $t) {
            $nama  = trim((string) $t['name']);
            $short = trim((string) $t['short']);
            if (!$nama || $nama === 'A') { $skipped++; continue; } // skip placeholder

            $email    = $this->generateEmail($short ?: $nama);
            $mapelKey = Str::before($short, '-'); // "PAI-Salim" → "PAI"
            $parsed   = $this->parseGelar($nama);

            // Cari User yang sudah ada — cocokkan nama bersih atau nama lengkap
            $user = User::whereIn('role', [UserRole::Guru, UserRole::WaliKelas, UserRole::Wakasek])
                ->where(fn ($q) => $q->where('nama', $nama)->orWhere('nama', $parsed['nama']))
                ->first();

            if (!$user) {
                // Pastikan email unik
                $baseEmail = $email;
                $suffix = 2;
                while (User::where('email', $email)->exists()) {
                    $email = Str::beforeLast($baseEmail, '@') . $suffix . '@' . Str::afterLast($baseEmail, '@');
                    $suffix++;
                }

                $user = User::create([
                    'nama'     => $parsed['nama'],
                    'email'    => $email,
                    'password' => Hash::make('password'),
                    'role'     => UserRole::Guru,
                    'status'   => UserStatus::Aktif,
                ]);
                Teacher::create([
                    'user_id'        => $user->id,
                    'nip'            => null,
                    'mapel_utama'    => $mapelKey ?: null,
                    'gelar_depan'    => $parsed['gelar_depan'],
                    'gelar_belakang' => $parsed['gelar_belakang'],
                    'created_by'     => $actor->id,
                ]);
                $created++;
            } else {
                $teacher = $user->teacher;
                $tUpdate = ['updated_by' => $actor->id];
                if ($teacher && ! $teacher->mapel_utama && $mapelKey) $tUpdate['mapel_utama'] = $mapelKey;
                // Hanya update gelar jika belum ada
                if ($teacher && ! $teacher->gelar_depan)    $tUpdate['gelar_depan']    = $parsed['gelar_depan'];
                if ($teacher && ! $teacher->gelar_belakang) $tUpdate['gelar_belakang'] = $parsed['gelar_belakang'];
                if ($teacher) $teacher->update($tUpdate);
                $updated++;
            }
        }

        return compact('created', 'updated', 'skipped');
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

    private function generateEmail(string $short): string
    {
        // "PAI-Salim" → "pai.salim@smkn2cimahi.sch.id"
        $slug = Str::lower(preg_replace('/[^a-zA-Z0-9]+/', '.', $short));
        $slug = trim($slug, '.');
        return "{$slug}@smkn2cimahi.sch.id";
    }

    // ── 3. Kelas ──────────────────────────────────────────────────────────────

    private function importClasses(\SimpleXMLElement $xml, AcademicYear $ay, User $actor): array
    {
        $created = $updated = $skipped = 0;

        foreach ($xml->classes->class as $c) {
            $name = trim((string) $c['name']); // contoh: "XI-RPL-A"
            if (!$name) { $skipped++; continue; }

            [$tingkatStr, $jurusanKode, $rombel] = $this->parseClassName($name);
            if (!$tingkatStr || !$jurusanKode || !$rombel) { $skipped++; continue; }

            try {
                $tingkat = Tingkat::from($tingkatStr);
            } catch (\ValueError) {
                $skipped++;
                continue;
            }

            $jurusan = self::JURUSAN_MAP[$jurusanKode] ?? $jurusanKode;

            $kelas = SchoolClass::withTrashed()
                ->where('tingkat', $tingkat->value)
                ->where('jurusan', $jurusan)
                ->where('rombel', $rombel)
                ->where('academic_year_id', $ay->id)
                ->first();

            if ($kelas) {
                if ($kelas->trashed()) $kelas->restore();
                $kelas->update(['updated_by' => $actor->id]);
                $updated++;
            } else {
                SchoolClass::create([
                    'tingkat'          => $tingkat->value,
                    'jurusan'          => $jurusan,
                    'rombel'           => $rombel,
                    'wali_kelas_id'    => null,
                    'academic_year_id' => $ay->id,
                    'created_by'       => $actor->id,
                ]);
                $created++;
            }
        }

        return compact('created', 'updated', 'skipped');
    }

    private function parseClassName(string $name): array
    {
        // "XI-RPL-A" → ["XI", "RPL", "A"]
        $parts = explode('-', $name, 3);
        if (count($parts) < 3) return [null, null, null];
        return [$parts[0], $parts[1], $parts[2]];
    }

    // ── 4. Jadwal ─────────────────────────────────────────────────────────────

    private function importSchedules(\SimpleXMLElement $xml, AcademicYear $ay, User $actor): array
    {
        $created = $updated = $skipped = 0;

        // Build period → waktu map
        $periods = [];
        foreach ($xml->periods->period as $p) {
            $num = (int) $p['period'];
            $periods[$num] = [
                'start' => (string) $p['starttime'],
                'end'   => (string) $p['endtime'],
            ];
        }

        // Build XML ID → DB ID maps
        $subjectMap = Subject::withTrashed()->get()->keyBy(fn ($s) => $s->nama);
        $xmlSubjectMap = [];
        foreach ($xml->subjects->subject as $s) {
            $nama = trim((string) $s['name']);
            $xmlSubjectMap[(string) $s['id']] = $subjectMap[$nama]?->id;
        }

        $teacherMap = User::with('teacher')
            ->whereIn('role', [UserRole::Guru, UserRole::WaliKelas, UserRole::Wakasek])
            ->get()
            ->keyBy('nama');
        $xmlTeacherMap = [];
        foreach ($xml->teachers->teacher as $t) {
            $nama = trim((string) $t['name']);
            $xmlTeacherMap[(string) $t['id']] = $teacherMap[$nama]?->teacher?->id;
        }

        $classMap = SchoolClass::where('academic_year_id', $ay->id)->get();
        $xmlClassMap = [];
        foreach ($xml->classes->class as $c) {
            $name = trim((string) $c['name']);
            [$tingkatStr, $jurusanKode, $rombel] = $this->parseClassName($name);
            if (!$tingkatStr) continue;
            $jurusan = self::JURUSAN_MAP[$jurusanKode] ?? $jurusanKode;
            $kelas = $classMap->first(fn ($k) =>
                $k->tingkat->value === $tingkatStr
                && $k->jurusan === $jurusan
                && $k->rombel === $rombel
            );
            $xmlClassMap[(string) $c['id']] = $kelas?->id;
        }

        // Group cards by lessonid → [days → [periods]]
        $lessonCards = [];
        foreach ($xml->cards->card as $card) {
            $lessonId = (string) $card['lessonid'];
            $days     = (string) $card['days'];
            $period   = (int)   $card['period'];
            $lessonCards[$lessonId][$days][] = $period;
        }

        // Process each lesson
        foreach ($xml->lessons->lesson as $lesson) {
            $lessonId   = (string) $lesson['id'];
            $classIds   = explode(',', (string) $lesson['classids']);
            $subjectId  = (string) $lesson['subjectid'];
            $teacherIds = array_filter(explode(',', (string) $lesson['teacherids']));

            if (empty($lessonCards[$lessonId])) continue;

            $dbSubjectId = $xmlSubjectMap[$subjectId] ?? null;
            if (!$dbSubjectId) { $skipped++; continue; }

            foreach ($classIds as $classId) {
                $classId    = trim($classId);
                $dbClassId  = $xmlClassMap[$classId] ?? null;
                if (!$dbClassId) { $skipped++; continue; }

                // Jika tidak ada guru → tetap buat jadwal tapi tanpa guru (skip)
                if (empty($teacherIds)) { $skipped++; continue; }

                foreach ($teacherIds as $teacherId) {
                    $teacherId    = trim($teacherId);
                    $dbTeacherId  = $xmlTeacherMap[$teacherId] ?? null;
                    if (!$dbTeacherId) { $skipped++; continue; }

                    foreach ($lessonCards[$lessonId] as $daysStr => $periodNums) {
                        $hari = self::DAY_MAP[$daysStr] ?? null;
                        if (!$hari) { $skipped++; continue; }

                        sort($periodNums);
                        $jamMulai   = $periods[min($periodNums)]['start'] ?? null;
                        $jamSelesai = $periods[max($periodNums)]['end']   ?? null;
                        if (!$jamMulai || !$jamSelesai) { $skipped++; continue; }

                        // Cari jadwal yang ada (termasuk soft-deleted)
                        $existing = Schedule::withTrashed()->where([
                            'class_id'  => $dbClassId,
                            'hari'      => $hari,
                            'jam_mulai' => $jamMulai,
                        ])->first();

                        if ($existing) {
                            if ($existing->trashed()) $existing->restore();
                            $existing->update([
                                'subject_id'  => $dbSubjectId,
                                'teacher_id'  => $dbTeacherId,
                                'jam_selesai' => $jamSelesai,
                                'aktif'       => true,
                                'updated_by'  => $actor->id,
                            ]);
                            $updated++;
                        } else {
                            Schedule::create([
                                'class_id'   => $dbClassId,
                                'subject_id' => $dbSubjectId,
                                'teacher_id' => $dbTeacherId,
                                'hari'       => $hari,
                                'jam_mulai'  => $jamMulai,
                                'jam_selesai'=> $jamSelesai,
                                'aktif'      => true,
                                'created_by' => $actor->id,
                            ]);
                            $created++;
                        }
                    }
                }
            }
        }

        return compact('created', 'updated', 'skipped');
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private function determineKelompok(string $nama): string
    {
        foreach (self::KELOMPOK_RULES as $kelompok => $keywords) {
            foreach ($keywords as $kw) {
                if (str_contains($nama, $kw)) return $kelompok;
            }
        }
        return 'produktif';
    }
}
