<?php

namespace App\Http\Controllers\Api;

use App\Enums\EwsLevel;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\AgendaStudentScore;
use App\Models\CharacterInput;
use App\Models\EwsStatus;
use App\Models\Note;
use App\Models\Recommendation;
use App\Models\Student;
use App\Models\StudentAttendance;
use App\Services\CharacterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class EwsController extends Controller
{
    // Threshold peringatan (bisa dikonfigurasikan nanti via tabel settings)
    private const THRESHOLD_KEHADIRAN = 80.0;   // % minimum
    private const THRESHOLD_KARAKTER  = 0;       // poin minimum
    private const THRESHOLD_CATATAN   = 3;       // jumlah maksimum
    private const THRESHOLD_NILAI     = 70.0;    // rata-rata minimum

    // GET /ews?level=kuning&class_id=xxx
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $ay   = AcademicYear::where('aktif', true)->first();

        if (! $ay) {
            return response()->json(['data' => [], 'meta' => ['total' => 0]]);
        }

        $query = Student::with(['user:id,nama', 'schoolClass'])
            ->whereHas('schoolClass', fn ($q) => $q->where('academic_year_id', $ay->id));

        // Scope berdasarkan role
        match ($user->role) {
            UserRole::WaliKelas => $query->whereHas(
                'schoolClass', fn ($q) => $q->where('wali_kelas_id', $user->id),
            ),
            UserRole::Guru => $query->whereHas('schoolClass.schedules', fn ($q) =>
                $q->whereHas('teacher', fn ($q2) => $q2->where('user_id', $user->id)),
            ),
            default => null, // admin, wakasek, BK: semua siswa
        };

        if ($request->filled('class_id')) {
            $query->whereHas('schoolClass', fn ($q) => $q->where('uuid', $request->class_id));
        }

        $students = $query->get();

        // Kalkulasi + upsert EWS
        $results = $students->map(fn ($s) => $this->buildStudentEws($s, $ay->id));

        // Ringkasan per level (sebelum filter)
        $summary = [
            'hijau'  => $results->where('level', 'hijau')->count(),
            'kuning' => $results->where('level', 'kuning')->count(),
            'oranye' => $results->where('level', 'oranye')->count(),
            'merah'  => $results->where('level', 'merah')->count(),
        ];

        // Filter by level
        if ($request->filled('level')) {
            $results = $results->filter(fn ($r) => $r['level'] === $request->level)->values();
        }

        // Urutkan: merah → oranye → kuning → hijau, lalu warning_count DESC, lalu kehadiran ASC
        $levelOrder = ['merah' => 0, 'oranye' => 1, 'kuning' => 2, 'hijau' => 3];
        $results = $results->sortBy([
            fn ($a, $b) => ($levelOrder[$a['level']] ?? 9) <=> ($levelOrder[$b['level']] ?? 9),
            fn ($a, $b) => $b['warning_count'] <=> $a['warning_count'],
            fn ($a, $b) => $a['kehadiran_score'] <=> $b['kehadiran_score'],
        ])->values();

        return response()->json([
            'data' => $results,
            'meta' => ['total' => $results->count(), 'summary' => $summary],
        ]);
    }

    // GET /ews/{studentUuid}
    public function show(Request $request, string $uuid): JsonResponse
    {
        $student = Student::where('uuid', $uuid)
            ->with(['user:id,nama', 'schoolClass'])
            ->firstOrFail();

        $ay = AcademicYear::where('aktif', true)->first();

        $kehadiran = $this->calcKehadiran($student->id);
        $karakter  = $this->calcKarakter($student->id);
        $catatan   = $this->calcCatatan($student->id);
        $nilai     = $this->calcNilai($student->id);
        $level     = $this->determineLevel($kehadiran, $karakter, $catatan, $nilai);

        if ($ay) {
            EwsStatus::updateOrCreate(
                ['student_id' => $student->id, 'academic_year_id' => $ay->id],
                [
                    'level'              => EwsLevel::from($level),
                    'kehadiran_score'    => $kehadiran['score'],
                    'karakter_score'     => $karakter['score'],
                    'catatan_count'      => $catatan['count'],
                    'nilai_score'        => $nilai['score'],
                    'last_calculated_at' => now(),
                ],
            );
        }

        // Riwayat karakter terbaru
        $recentKarakter = CharacterInput::where('student_id', $student->id)
            ->with(['subitem.category', 'teacher.user'])
            ->orderByDesc('created_at')
            ->limit(10)
            ->get()
            ->map(fn ($i) => [
                'kategori' => $i->subitem->category->nama,
                'subitem'  => $i->subitem->deskripsi,
                'poin'     => $i->sign->value === 'positif' ? abs($i->subitem->bobot) : -abs($i->subitem->bobot),
                'guru'     => $i->teacher->user->nama,
                'tanggal'  => $i->created_at->format('Y-m-d H:i'),
            ]);

        // Rekomendasi tindakan berdasarkan ambang poin
        $rekomendasi = Recommendation::where('student_id', $student->id)
            ->with(['threshold', 'assignedTo'])
            ->orderByRaw("CASE status WHEN 'pending' THEN 0 WHEN 'proses' THEN 1 ELSE 2 END")
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($r) => [
                'id'             => $r->uuid,
                'rekomendasi'    => $r->threshold->rekomendasi,
                'sifat'          => $r->threshold->sifat->value,
                'akumulasi'      => $r->akumulasi_saat_trigger,
                'status'         => $r->status->value,
                'ditugaskan_ke'  => $r->assignedTo?->nama,
                'hasil'          => $r->hasil_tindak_lanjut,
                'dibuat_pada'    => $r->created_at->format('Y-m-d'),
            ]);

        return response()->json([
            'data' => [
                'student' => [
                    'id'    => $student->uuid,
                    'nama'  => $student->user->nama,
                    'nis'   => $student->nis,
                    'kelas' => $student->schoolClass
                        ? "{$student->schoolClass->tingkat->value} {$student->schoolClass->jurusan} - {$student->schoolClass->rombel}"
                        : null,
                ],
                'level'      => $level,
                'dimensions' => [
                    'kehadiran' => $kehadiran,
                    'karakter'  => $karakter,
                    'catatan'   => $catatan,
                    'nilai'     => $nilai,
                ],
                'recent_karakter' => $recentKarakter,
                'rekomendasi'     => $rekomendasi,
            ],
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function buildStudentEws(Student $student, int $ayId): array
    {
        $kehadiran = $this->calcKehadiran($student->id);
        $karakter  = $this->calcKarakter($student->id);
        $catatan   = $this->calcCatatan($student->id);
        $nilai     = $this->calcNilai($student->id);
        $level     = $this->determineLevel($kehadiran, $karakter, $catatan, $nilai);

        // Cek ambang & buat rekomendasi jika terlewat (jaring pengaman untuk data lama/seeder)
        app(CharacterService::class)->checkThresholdsAndRecommend(
            $student->loadMissing(['schoolClass', 'user']),
            $karakter['score']
        );

        EwsStatus::updateOrCreate(
            ['student_id' => $student->id, 'academic_year_id' => $ayId],
            [
                'level'              => EwsLevel::from($level),
                'kehadiran_score'    => $kehadiran['score'],
                'karakter_score'     => $karakter['score'],
                'catatan_count'      => $catatan['count'],
                'nilai_score'        => $nilai['score'],
                'last_calculated_at' => now(),
            ],
        );

        return [
            'student_id'      => $student->uuid,
            'nama'            => $student->user->nama,
            'nis'             => $student->nis,
            'kelas'           => $student->schoolClass
                                    ? "{$student->schoolClass->tingkat->value} {$student->schoolClass->jurusan} - {$student->schoolClass->rombel}"
                                    : null,
            'level'           => $level,
            'kehadiran_score' => round($kehadiran['score'], 1),
            'karakter_score'  => $karakter['score'],
            'catatan_count'   => $catatan['count'],
            'nilai_score'     => $nilai['score'] !== null ? round($nilai['score'], 1) : null,
            'warning_count'   => $kehadiran['warning'] + $karakter['warning'] + $catatan['warning'] + $nilai['warning'],
        ];
    }

    private function calcKehadiran(int $studentId): array
    {
        $total = StudentAttendance::where('student_id', $studentId)->count();
        $hadir = StudentAttendance::where('student_id', $studentId)->where('status', 'hadir')->count();
        $alpha = StudentAttendance::where('student_id', $studentId)->where('status', 'alpha')->count();
        $sakit = StudentAttendance::where('student_id', $studentId)->where('status', 'sakit')->count();
        $izin  = StudentAttendance::where('student_id', $studentId)->where('status', 'izin')->count();

        $score   = $total > 0 ? ($hadir / $total) * 100 : 100.0;
        $warning = $score < self::THRESHOLD_KEHADIRAN ? 1 : 0;

        return compact('score', 'total', 'hadir', 'alpha', 'sakit', 'izin', 'warning');
    }

    private function calcKarakter(int $studentId): array
    {
        $inputs = CharacterInput::where('student_id', $studentId)->with('subitem')->get();
        $score  = $inputs->sum(fn ($i) =>
            $i->sign->value === 'positif' ? abs($i->subitem->bobot) : -abs($i->subitem->bobot)
        );
        $count   = $inputs->count();
        $warning = $score < self::THRESHOLD_KARAKTER ? 1 : 0;

        return compact('score', 'count', 'warning');
    }

    private function calcCatatan(int $studentId): array
    {
        $count   = Note::where('target_type', Student::class)->where('target_id', $studentId)->count();
        $warning = $count >= self::THRESHOLD_CATATAN ? 1 : 0;

        return compact('count', 'warning');
    }

    private function calcNilai(int $studentId): array
    {
        $scores = AgendaStudentScore::where('student_id', $studentId)->pluck('nilai');
        $score  = $scores->count() > 0 ? $scores->avg() : null;
        $count  = $scores->count();
        $warning = ($score !== null && $score < self::THRESHOLD_NILAI) ? 1 : 0;

        return compact('score', 'count', 'warning');
    }

    private function determineLevel(array $k, array $kar, array $c, array $n): string
    {
        $warnings = $k['warning'] + $kar['warning'] + $c['warning'] + $n['warning'];
        return match (true) {
            $warnings >= 3 => 'merah',
            $warnings === 2 => 'oranye',
            $warnings === 1 => 'kuning',
            default        => 'hijau',
        };
    }
}
