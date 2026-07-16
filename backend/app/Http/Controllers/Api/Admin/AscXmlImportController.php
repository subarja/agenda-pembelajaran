<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\BellPeriod;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use App\Support\BellSchedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AscXmlImportController extends Controller
{
    // Kode singkat kelas → nama jurusan lengkap
    // HARUS identik dengan DapodikImportController::JURUSAN_MAP
    private const JURUSAN_MAP = [
        'MEKA' => 'Mekatronika',
        'DKV' => 'Desain Komunikasi Visual',
        'RPL' => 'Rekayasa Perangkat Lunak',
        'PPLG' => 'Rekayasa Perangkat Lunak',
        'ANM' => 'Animasi',
        'ANIMASI' => 'Animasi', // alias Dapodik untuk ANM
        'KI' => 'Teknik Kimia Industri',
        'TKI' => 'Teknik Kimia Industri',
        'TP' => 'Teknik Pemesinan',
        'MES' => 'Teknik Pemesinan',
    ];

    // Kata kunci → kelompok mapel
    private const KELOMPOK_RULES = [
        'normatif' => ['PAI', 'Budi Pekerti', 'Pancasila', 'Agama'],
        'muatan_lokal' => ['B.Sunda', 'Sunda', 'PLH', 'Jepang', 'Bimbingan Konseling'],
        'adaptif' => ['Matematika', 'B.Indonesia', 'B.Inggris', 'Sejarah', 'IPAS',
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
            'decisions' => 'nullable|string',
        ]);

        // decisions: { "guru:<xml teacher id>": "merge"|"create" } — dikirim balik oleh
        // frontend setelah admin mengonfirmasi guru yang cuma cocok lewat ejaan mirip.
        $decisions = json_decode($request->input('decisions', '{}'), true) ?: [];

        // Baca file & konversi encoding Windows-1252 → UTF-8
        $raw = file_get_contents($request->file('file')->getRealPath());
        if (! mb_check_encoding($raw, 'UTF-8')) {
            $raw = mb_convert_encoding($raw, 'UTF-8', 'Windows-1252');
        }
        // Ganti deklarasi encoding di header XML supaya parser tidak protes
        $raw = preg_replace('/encoding="[^"]*"/i', 'encoding="UTF-8"', $raw, 1);

        libxml_use_internal_errors(true);
        $xml = simplexml_load_string($raw);
        if (! $xml) {
            $errors = array_map(fn ($e) => trim($e->message), libxml_get_errors());
            libxml_clear_errors();

            return response()->json(['message' => 'File XML tidak valid.', 'errors' => $errors], 422);
        }
        libxml_clear_errors();

        $ay = \App\Support\TahunAjaran::current();
        if (! $ay) {
            return response()->json([
                'message' => 'Tidak ada tahun ajaran aktif. Buat tahun ajaran terlebih dahulu di tab Tahun Ajaran.',
            ], 422);
        }

        $actor = $request->user();
        $errors = [];
        $pendingMatches = [];

        $stats = DB::transaction(function () use ($xml, $ay, $actor, &$errors, &$pendingMatches, $decisions) {
            $xmlTeacherIdMap = [];
            $subjectStats = $this->importSubjects($xml, $actor);
            $teacherStats = $this->importTeachers($xml, $actor, $errors, $xmlTeacherIdMap, $decisions, $pendingMatches);
            $classStats = $this->importClasses($xml, $ay, $actor);
            $scheduleStats = $this->importSchedules($xml, $ay, $actor, $xmlTeacherIdMap);

            return [
                'mata_pelajaran' => $subjectStats,
                'guru' => $teacherStats,
                'kelas' => $classStats,
                'jadwal' => $scheduleStats,
            ];
        });

        return response()->json([
            'message' => 'Import berhasil.',
            'data' => $stats,
            'errors' => $errors,
            'pending_matches' => $pendingMatches,
        ]);
    }

    // ── 1. Mata Pelajaran ─────────────────────────────────────────────────────

    private function importSubjects(\SimpleXMLElement $xml, User $actor): array
    {
        $created = $updated = $skipped = 0;

        foreach ($xml->subjects->subject as $s) {
            $nama = trim((string) $s['name']);
            $kode = Str::upper(trim((string) $s['short']));
            if (! $nama || ! $kode) {
                $skipped++;

                continue;
            }

            $kode = Str::limit($kode, 20, '');
            $kelompok = $this->determineKelompok($nama);

            // Cari berdasarkan nama (termasuk trashed)
            $subject = Subject::withTrashed()->where('nama', $nama)->first();

            if ($subject) {
                if ($subject->trashed()) {
                    $subject->restore();
                }
                $subject->update([
                    'kode' => $this->uniqueKode($kode, $subject->id),
                    'kelompok' => $kelompok,
                    'aktif' => true,
                    'updated_by' => $actor->id,
                ]);
                $updated++;
            } else {
                Subject::create([
                    'kode' => $this->uniqueKode($kode),
                    'nama' => $nama,
                    'kelompok' => $kelompok,
                    'aktif' => true,
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
            $kode = Str::limit($base, 18, '').$i++;
        }

        return $kode;
    }

    // ── 2. Guru ───────────────────────────────────────────────────────────────

    // $xmlIdMap diisi [xml teacher id => teacher.id DB] supaya importSchedules() pakai
    // hasil pencocokan nama yang SAMA (termasuk fallback ejaan mirip), bukan mencocokkan
    // ulang dari nol dengan lookup exact-match sendiri yang bisa berbeda hasil.
    private function importTeachers(\SimpleXMLElement $xml, User $actor, array &$errors, array &$xmlIdMap, array $decisions, array &$pendingMatches): array
    {
        $created = $updated = $skipped = 0;

        // Kode singkat mapel (mis. "MTK", "ING") → nama lengkap, dari daftar <subjects> di
        // XML yang sama. Fallback untuk guru yang tidak punya jadwal mengajar sama sekali
        // (mis. BK) — short guru "BPK-..." memang match langsung ke subject short "BPK".
        $subjectNameByShort = [];
        $subjectNameById = [];
        foreach ($xml->subjects->subject as $s) {
            $subjectNameByShort[Str::upper(trim((string) $s['short']))] = trim((string) $s['name']);
            $subjectNameById[(string) $s['id']] = trim((string) $s['name']);
        }

        // Kode singkat yang tertanam di short guru (mis. "TMK", "RPL", "ORG") seringkali
        // kode KOMPETENSI KEAHLIAN, bukan kode mapel — tidak match langsung ke <subjects>.
        // Cara akurat: lihat mapel apa yang BENAR-BENAR diajar guru itu di <lessons>, ambil
        // yang jam/minggunya paling banyak sebagai mapel utama.
        $teacherSubjectWeight = [];
        foreach ($xml->lessons->lesson as $lesson) {
            $subjectId = (string) $lesson['subjectid'];
            $periodsPerWeek = (float) $lesson['periodsperweek'];
            foreach (array_filter(explode(',', (string) $lesson['teacherids'])) as $tid) {
                $tid = trim($tid);
                $teacherSubjectWeight[$tid][$subjectId] = ($teacherSubjectWeight[$tid][$subjectId] ?? 0) + $periodsPerWeek;
            }
        }

        foreach ($xml->teachers->teacher as $t) {
            $xmlId = (string) $t['id'];
            $nama = trim((string) $t['name']);
            $short = trim((string) $t['short']);
            if (! $nama || $nama === 'A') {
                $skipped++;

                continue;
            } // skip placeholder

            $email = $this->generateEmail($short ?: $nama);
            $mapelKode = Str::before($short, '-'); // "PAI-Salim" → "PAI", dipakai email & fallback
            $mapelKey = $this->resolvePrimarySubjectName($xmlId, $teacherSubjectWeight, $subjectNameById)
                ?? $subjectNameByShort[Str::upper($mapelKode)] ?? $mapelKode;
            $parsed = $this->parseGelar($nama);

            // Cari User yang sudah ada — cocokkan nama bersih atau nama lengkap, tidak
            // peduli besar/kecil huruf (mis. XML "ACA" vs Excel "Aca" harus tetap cocok).
            $namaNormRaw = $this->normalizeCase($nama);
            $namaNormParsed = $this->normalizeCase($parsed['nama']);
            $user = User::whereIn('role', [UserRole::Guru, UserRole::WaliKelas, UserRole::Wakasek])
                ->get()
                ->first(fn ($u) => in_array($this->normalizeCase($u->nama), [$namaNormRaw, $namaNormParsed], true));

            if (! $user) {
                // Fallback: kemiripan nama (typo kecil) supaya re-import tidak
                // membuat akun duplikat hanya karena beda ejaan tipis dengan
                // akun yang sudah dibuat lewat import Excel Dapodik sebelumnya.
                $candidate = $this->findSimilarTeacherUser($parsed['nama']);
                if ($candidate) {
                    $decisionKey = "guru:{$xmlId}";
                    $decision = $decisions[$decisionKey] ?? null;
                    if ($decision === 'merge') {
                        $user = $candidate;
                    } elseif ($decision !== 'create') {
                        // Belum ada keputusan admin — tahan guru ini (termasuk jadwalnya,
                        // karena $xmlIdMap tidak diisi) sampai dikonfirmasi.
                        $pendingMatches[] = [
                            'key' => $decisionKey,
                            'nama_baru' => $nama,
                            'matched_nama' => $candidate->nama,
                            'matched_uuid' => $candidate->uuid,
                        ];
                        $skipped++;

                        continue;
                    }
                    // decision === 'create' → $user tetap null, lanjut buat akun baru di bawah
                }
            }

            if (! $user) {
                // Pastikan email unik
                $baseEmail = $email;
                $suffix = 2;
                while (User::where('email', $email)->exists()) {
                    $email = Str::beforeLast($baseEmail, '@').$suffix.'@'.Str::afterLast($baseEmail, '@');
                    $suffix++;
                }

                $user = User::create([
                    'nama' => $parsed['nama'],
                    'email' => $email,
                    'password' => Hash::make('password'),
                    'role' => UserRole::Guru,
                    'status' => UserStatus::Aktif,
                ]);
                $teacher = Teacher::create([
                    'user_id' => $user->id,
                    'nip' => null,
                    'mapel_utama' => $mapelKey ?: null,
                    'gelar_depan' => $parsed['gelar_depan'],
                    'gelar_belakang' => $parsed['gelar_belakang'],
                    'created_by' => $actor->id,
                ]);
                $created++;
            } else {
                $teacher = $user->teacher;
                $tUpdate = ['updated_by' => $actor->id];
                if ($teacher && ! $teacher->mapel_utama && $mapelKey) {
                    $tUpdate['mapel_utama'] = $mapelKey;
                }
                // Hanya update gelar jika belum ada
                if ($teacher && ! $teacher->gelar_depan) {
                    $tUpdate['gelar_depan'] = $parsed['gelar_depan'];
                }
                if ($teacher && ! $teacher->gelar_belakang) {
                    $tUpdate['gelar_belakang'] = $parsed['gelar_belakang'];
                }
                if ($teacher) {
                    $teacher->update($tUpdate);
                }
                $updated++;
            }

            $xmlIdMap[$xmlId] = $teacher?->id;
        }

        return compact('created', 'updated', 'skipped');
    }

    // Levenshtein <= 2 & selisih panjang <= 2 karakter — menangkap typo tipis
    // seperti "Marsita" vs "Marsitha" tanpa mencocokkan nama yang benar-benar
    // berbeda. Kalau ada lebih dari satu kandidat dengan jarak minimum sama,
    // dianggap ambigu dan tidak dicocokkan otomatis.
    // Lowercase + rapikan spasi — dipakai untuk pencocokan nama case-insensitive
    // (mis. XML "ACA" vs Excel "Aca" harus dianggap identik, bukan typo).
    private function normalizeCase(string $nama): string
    {
        return mb_strtolower(trim(preg_replace('/\s+/', ' ', $nama)));
    }

    // Nama mapel dengan bobot (jam/minggu) terbesar dari yang benar-benar diajar guru ini —
    // null kalau guru tidak punya lesson sama sekali (mis. BK tanpa jam mengajar).
    private function resolvePrimarySubjectName(string $xmlTeacherId, array $teacherSubjectWeight, array $subjectNameById): ?string
    {
        $weights = $teacherSubjectWeight[$xmlTeacherId] ?? [];
        if (empty($weights)) {
            return null;
        }
        arsort($weights);
        $topSubjectId = array_key_first($weights);

        return $subjectNameById[$topSubjectId] ?? null;
    }

    private function findSimilarTeacherUser(string $nama): ?User
    {
        $namaNorm = $this->normalizeCase($nama);

        $candidates = User::whereIn('role', [UserRole::Guru, UserRole::WaliKelas, UserRole::Wakasek])->get();

        $best = null;
        $bestDist = null;
        $ambiguous = false;

        foreach ($candidates as $u) {
            $candNorm = $this->normalizeCase($u->nama);
            if (abs(mb_strlen($candNorm) - mb_strlen($namaNorm)) > 2) {
                continue;
            }
            $dist = levenshtein($candNorm, $namaNorm);
            if ($dist === 0 || $dist > 2) {
                continue;
            }

            if ($bestDist === null || $dist < $bestDist) {
                $bestDist = $dist;
                $best = $u;
                $ambiguous = false;
            } elseif ($dist === $bestDist) {
                $ambiguous = true;
            }
        }

        return $ambiguous ? null : $best;
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
            if (! $name) {
                $skipped++;

                continue;
            }

            [$tingkatStr, $jurusanKode, $rombel] = $this->parseClassName($name);
            if (! $tingkatStr || ! $jurusanKode || ! $rombel) {
                $skipped++;

                continue;
            }

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
                if ($kelas->trashed()) {
                    $kelas->restore();
                }
                $kelas->update(['updated_by' => $actor->id]);
                $updated++;
            } else {
                SchoolClass::create([
                    'tingkat' => $tingkat->value,
                    'jurusan' => $jurusan,
                    'rombel' => $rombel,
                    'wali_kelas_id' => null,
                    'academic_year_id' => $ay->id,
                    'created_by' => $actor->id,
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
        if (count($parts) < 3) {
            return [null, null, null];
        }

        return [$parts[0], $parts[1], $parts[2]];
    }

    // ── 4. Jadwal ─────────────────────────────────────────────────────────────

    // $xmlTeacherMap = [xml teacher id => teacher.id DB], dibangun oleh importTeachers()
    // yang jalan sebelum ini di transaksi yang sama — supaya guru dengan nama yang
    // dicocokkan lewat fallback ejaan mirip (mis. typo tanda baca di XML) tetap
    // dapat jadwalnya, bukan silently dilewati karena lookup exact-match terpisah.
    private function importSchedules(\SimpleXMLElement $xml, AcademicYear $ay, User $actor, array $xmlTeacherMap): array
    {
        $created = $updated = $skipped = 0;

        // Build period → waktu map
        $periods = [];
        foreach ($xml->periods->period as $p) {
            $num = (int) $p['period'];
            $periods[$num] = [
                'start' => (string) $p['starttime'],
                'end' => (string) $p['endtime'],
            ];
        }

        // Semai tabel bel (jam-ke → pukul) per hari dari slot XML. firstOrCreate supaya
        // re-import TIDAK menimpa bel yang sudah dikustom admin — mis. Jumat yang
        // durasinya beda dan memang tidak pernah ada di XML aSc.
        foreach (array_values(self::DAY_MAP) as $hari) {
            foreach ($periods as $num => $waktu) {
                BellPeriod::firstOrCreate(
                    ['hari' => $hari, 'jam_ke' => $num],
                    ['jam_mulai' => $waktu['start'], 'jam_selesai' => $waktu['end']],
                );
            }
        }
        BellSchedule::flush();

        // Build XML ID → DB ID maps
        $subjectMap = Subject::withTrashed()->get()->keyBy(fn ($s) => $s->nama);
        $xmlSubjectMap = [];
        foreach ($xml->subjects->subject as $s) {
            $nama = trim((string) $s['name']);
            $xmlSubjectMap[(string) $s['id']] = $subjectMap->get($nama)?->id;
        }

        $classMap = SchoolClass::where('academic_year_id', $ay->id)->get();
        $xmlClassMap = [];
        foreach ($xml->classes->class as $c) {
            $name = trim((string) $c['name']);
            [$tingkatStr, $jurusanKode, $rombel] = $this->parseClassName($name);
            if (! $tingkatStr) {
                continue;
            }
            $jurusan = self::JURUSAN_MAP[$jurusanKode] ?? $jurusanKode;
            $kelas = $classMap->first(fn ($k) => $k->tingkat->value === $tingkatStr
                && $k->jurusan === $jurusan
                && $k->rombel === $rombel
            );
            $xmlClassMap[(string) $c['id']] = $kelas?->id;
        }

        // Kartu → hari konkret. Bitmask `days` aSc bisa multi-hari ('11100' = Sen–Rab)
        // dan bisa 6 digit (mencakup Sabtu) — dulu hanya one-hot 5 hari yang dikenali,
        // selain itu di-skip diam-diam sehingga sebagian jadwal hilang tanpa jejak.
        $lessonCards = [];
        foreach ($xml->cards->card as $card) {
            $lessonId = (string) $card['lessonid'];
            $period = (int) $card['period'];
            foreach ($this->daysFromMask((string) $card['days']) as $hari) {
                $lessonCards[$lessonId][$hari][] = $period;
            }
        }

        $skipDetail = [
            'mapel_tak_dikenal' => 0,
            'kelas_tak_dikenal' => 0,
            'tanpa_guru'        => 0,
            'guru_tak_dikenal'  => 0,
            'jam_tak_dikenal'   => 0,
        ];
        $dinonaktifkan = 0;

        // Process each lesson
        foreach ($xml->lessons->lesson as $lesson) {
            $lessonId = (string) $lesson['id'];
            $classIds = explode(',', (string) $lesson['classids']);
            $subjectId = (string) $lesson['subjectid'];
            $teacherIds = array_filter(explode(',', (string) $lesson['teacherids']));

            if (empty($lessonCards[$lessonId])) {
                continue;
            }

            $dbSubjectId = $xmlSubjectMap[$subjectId] ?? null;
            if (! $dbSubjectId) {
                $skipped++;
                $skipDetail['mapel_tak_dikenal']++;

                continue;
            }

            // Semua guru lesson ini sekaligus — satu baris jadwal per guru, karena satu
            // slot bisa dipegang beberapa guru (team teaching, lazim di mapel kejuruan).
            $dbTeacherIds = [];
            foreach ($teacherIds as $teacherId) {
                $dbTeacherId = $xmlTeacherMap[trim($teacherId)] ?? null;
                if ($dbTeacherId) {
                    $dbTeacherIds[] = $dbTeacherId;
                } else {
                    $skipDetail['guru_tak_dikenal']++;
                }
            }

            foreach ($classIds as $classId) {
                $classId = trim($classId);
                $dbClassId = $xmlClassMap[$classId] ?? null;
                if (! $dbClassId) {
                    $skipped++;
                    $skipDetail['kelas_tak_dikenal']++;

                    continue;
                }

                // Jika tidak ada guru → tetap buat jadwal tapi tanpa guru (skip)
                if (empty($dbTeacherIds)) {
                    $skipped++;
                    $skipDetail['tanpa_guru']++;

                    continue;
                }

                foreach ($lessonCards[$lessonId] as $hari => $periodNums) {
                    sort($periodNums);
                    $jamKeMulai = min($periodNums);
                    $jamKeSelesai = max($periodNums);
                    $jamMulai = $periods[$jamKeMulai]['start'] ?? null;
                    $jamSelesai = $periods[$jamKeSelesai]['end'] ?? null;
                    if (! $jamMulai || ! $jamSelesai) {
                        $skipped++;
                        $skipDetail['jam_tak_dikenal']++;

                        continue;
                    }

                    // Baris yang ada di slot ini (termasuk soft-deleted), per guru.
                    // Dulu lookup TANPA teacher_id: guru kedua pada lesson yang sama
                    // MENIMPA guru pertama, sehingga beban rekan team-teaching hilang.
                    $slotRows = Schedule::withTrashed()->where([
                        'class_id' => $dbClassId,
                        'hari' => $hari,
                        'jam_mulai' => $jamMulai,
                    ])->get()->keyBy('teacher_id');

                    foreach ($dbTeacherIds as $dbTeacherId) {
                        $existing = $slotRows->get($dbTeacherId);

                        if ($existing) {
                            if ($existing->trashed()) {
                                $existing->restore();
                            }
                            $existing->update([
                                'subject_id' => $dbSubjectId,
                                'jam_ke_mulai' => $jamKeMulai,
                                'jam_ke_selesai' => $jamKeSelesai,
                                'jam_selesai' => $jamSelesai,
                                'aktif' => true,
                                'updated_by' => $actor->id,
                            ]);
                            $updated++;
                        } else {
                            Schedule::create([
                                'class_id' => $dbClassId,
                                'subject_id' => $dbSubjectId,
                                'teacher_id' => $dbTeacherId,
                                'hari' => $hari,
                                'jam_ke_mulai' => $jamKeMulai,
                                'jam_ke_selesai' => $jamKeSelesai,
                                'jam_mulai' => $jamMulai,
                                'jam_selesai' => $jamSelesai,
                                'aktif' => true,
                                'created_by' => $actor->id,
                            ]);
                            $created++;
                        }
                    }

                    // Baris slot ber-mapel SAMA dengan guru di luar daftar XML = sisa
                    // import lama (guru diganti di aSc) → nonaktifkan agar tidak ganda.
                    // Mapel lain di slot yang sama dibiarkan — kelas terbelah dua
                    // kelompok (mapel & guru berbeda pada jam yang sama) itu sah.
                    foreach ($slotRows as $teacherIdLama => $row) {
                        if ($row->subject_id === $dbSubjectId
                            && ! in_array($teacherIdLama, $dbTeacherIds)
                            && ! $row->trashed()) {
                            $row->delete();
                            $dinonaktifkan++;
                        }
                    }
                }
            }
        }

        return compact('created', 'updated', 'skipped', 'dinonaktifkan') + ['skip_detail' => $skipDetail];
    }

    /**
     * Bitmask hari kartu aSc → daftar nama hari. Mendukung mask multi-hari ('11100' =
     * Senin–Rabu) dan panjang 5–7 digit; digit ke-7 (Minggu) tidak dipakai sekolah.
     */
    private function daysFromMask(string $mask): array
    {
        $urutan = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
        $hasil = [];
        foreach (str_split($mask) as $i => $bit) {
            if ($bit === '1' && isset($urutan[$i])) {
                $hasil[] = $urutan[$i];
            }
        }

        return $hasil;
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private function determineKelompok(string $nama): string
    {
        foreach (self::KELOMPOK_RULES as $kelompok => $keywords) {
            foreach ($keywords as $kw) {
                if (str_contains($nama, $kw)) {
                    return $kelompok;
                }
            }
        }

        return 'produktif';
    }
}
