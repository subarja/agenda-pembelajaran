<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\EwsStatus;
use App\Models\SchoolClass;
use App\Models\Student;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Wizard "Naik Kelas" — memindahkan siswa dari kelas-kelas TA sumber (TA aktif) ke
 * kelas padanannya di TA target dalam satu aksi:
 *
 *   X  → XI   (jurusan & rombel sama)     XII → status "lulus" (arsip, akun dinonaktifkan)
 *   XI → XII                              siswa tinggal kelas → kelas TINGKAT SAMA di TA target
 *
 * Kelas target dibuat otomatis bila belum ada (wali kelas dicopy sebagai default — bisa
 * diubah kapan pun di tab Kelas). Kelas & jadwal TA sumber TIDAK disentuh: mereka arsip.
 * Menjalankan wizard dua kali aman — siswa yang sudah pindah tidak lagi terdaftar di
 * kelas sumber, jadi preview berikutnya hanya menampilkan sisanya.
 */
class PromotionController extends Controller
{
    private const NEXT_TINGKAT = ['X' => 'XI', 'XI' => 'XII', 'XII' => null]; // null = lulus

    // GET /admin/promotion/preview?target_academic_year_id=<uuid>
    public function preview(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        [$source, $target] = $this->resolveYears($request);

        $classes = SchoolClass::where('academic_year_id', $source->id)
            ->with(['waliKelas:id,nama', 'students' => fn ($q) => $q->aktif()->with('user:id,nama')->orderBy('nis')])
            ->orderBy('tingkat')->orderBy('jurusan')->orderBy('rombel')
            ->get()
            ->map(function (SchoolClass $c) use ($target) {
                $next = self::NEXT_TINGKAT[$c->tingkat->value];
                $targetExists = $next === null ? null : SchoolClass::where([
                    'academic_year_id' => $target->id,
                    'tingkat' => $next, 'jurusan' => $c->jurusan, 'rombel' => $c->rombel,
                ])->exists();

                return [
                    'id'            => $c->uuid,
                    'label'         => "{$c->tingkat->value} {$c->jurusan} - {$c->rombel}",
                    'tingkat'       => $c->tingkat->value,
                    'wali_kelas'    => $c->waliKelas?->nama,
                    'tujuan'        => $next === null ? 'LULUS' : "{$next} {$c->jurusan} - {$c->rombel}",
                    'tujuan_ada'    => $targetExists,
                    'jumlah_siswa'  => $c->students->count(),
                    'students'      => $c->students->map(fn ($s) => [
                        'id' => $s->uuid, 'nama' => $s->user->nama, 'nis' => $s->nis,
                    ])->values(),
                ];
            });

        return response()->json(['data' => [
            'source' => ['id' => $source->uuid, 'label' => "{$source->tahun} " . ucfirst($source->semester->value)],
            'target' => ['id' => $target->uuid, 'label' => "{$target->tahun} " . ucfirst($target->semester->value)],
            'classes' => $classes,
        ]]);
    }

    // POST /admin/promotion/execute
    // body: { target_academic_year_id, tinggal: { "<class uuid>": ["<student uuid>", ...] } }
    // Semua siswa aktif kelas sumber diproses: yang TIDAK ada di daftar tinggal → naik/lulus,
    // yang ada di daftar tinggal → pindah ke kelas tingkat sama di TA target.
    public function execute(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $request->validate([
            'target_academic_year_id' => ['required', 'string'],
            'tinggal'                 => ['sometimes', 'array'],
            'tinggal.*'               => ['array'],
            'tinggal.*.*'             => ['string'],
        ]);

        [$source, $target] = $this->resolveYears($request);
        // Naik kelas menulis ke dua TA sekaligus (status enrollment di sumber, kelas
        // & siswa di tujuan) — dua-duanya harus tidak terkunci.
        \App\Support\SemesterLock::assertAyNotLocked($source);
        \App\Support\SemesterLock::assertAyNotLocked($target);
        $tinggalMap = collect($request->input('tinggal', []));

        $stats = DB::transaction(function () use ($source, $target, $tinggalMap) {
            $naik = 0; $tinggal = 0; $lulus = 0; $kelasBaru = 0;

            $classes = SchoolClass::where('academic_year_id', $source->id)
                ->with(['students' => fn ($q) => $q->aktif()])
                ->get();

            // Cache kelas target: satu kelas tujuan bisa dibutuhkan oleh dua sumber
            // (naik dari tingkat bawah + tinggal dari tingkat sama).
            $targetCache = [];
            $resolveTarget = function (string $tingkat, SchoolClass $c) use ($target, &$targetCache, &$kelasBaru): SchoolClass {
                $key = "{$tingkat}|{$c->jurusan}|{$c->rombel}";
                if (! isset($targetCache[$key])) {
                    $kelas = SchoolClass::firstOrCreate(
                        [
                            'academic_year_id' => $target->id,
                            'tingkat' => $tingkat, 'jurusan' => $c->jurusan, 'rombel' => $c->rombel,
                        ],
                        ['wali_kelas_id' => $c->wali_kelas_id],
                    );
                    if ($kelas->wasRecentlyCreated) $kelasBaru++;
                    $targetCache[$key] = $kelas;
                }

                return $targetCache[$key];
            };

            foreach ($classes as $c) {
                $next = self::NEXT_TINGKAT[$c->tingkat->value];
                $tinggalIds = collect($tinggalMap->get($c->uuid, []))->flip();

                foreach ($c->students as $s) {
                    if ($tinggalIds->has($s->uuid)) {
                        // Tinggal kelas = tetap di tingkat yang sama, tapi di TA BARU —
                        // bukan dibiarkan menunjuk kelas arsip TA lama.
                        $kelas = $resolveTarget($c->tingkat->value, $c);
                        $s->update(['class_id' => $kelas->id]);
                        $this->tandaiEnrollment($s->id, $c->id, 'tinggal');
                        $this->ensureEws($s->id, $target->id);
                        $tinggal++;
                    } elseif ($next === null) {
                        // XII lulus: kelasnya TIDAK diubah (arsip menunjuk kelas terakhirnya),
                        // akun dimatikan supaya tidak bisa login lagi.
                        $s->update(['status' => 'lulus', 'tanggal_keluar' => now('Asia/Jakarta')->toDateString()]);
                        $s->user()->update(['status' => UserStatus::Nonaktif]);
                        $this->tandaiEnrollment($s->id, $c->id, 'lulus');
                        $lulus++;
                    } else {
                        $kelas = $resolveTarget($next, $c);
                        $s->update(['class_id' => $kelas->id]);
                        $this->tandaiEnrollment($s->id, $c->id, 'naik');
                        $this->ensureEws($s->id, $target->id);
                        $naik++;
                    }
                }
            }

            return compact('naik', 'tinggal', 'lulus', 'kelasBaru');
        });

        return response()->json([
            'message' => "Naik kelas selesai: {$stats['naik']} siswa naik, {$stats['tinggal']} tinggal kelas, "
                . "{$stats['lulus']} lulus, {$stats['kelasBaru']} kelas baru dibuat di {$target->tahun}.",
            'data'    => $stats,
        ]);
    }

    /**
     * Hook Student menutup keanggotaan lama dengan status generik 'pindah' — di sini
     * ditimpa dengan alasan yang sebenarnya (naik/tinggal/lulus) untuk arsip roster.
     */
    private function tandaiEnrollment(int $studentId, int $classId, string $status): void
    {
        \App\Models\ClassEnrollment::updateOrCreate(
            ['class_id' => $classId, 'student_id' => $studentId],
            ['status' => $status],
        );
    }

    private function ensureEws(int $studentId, int $ayId): void
    {
        EwsStatus::firstOrCreate(
            ['student_id' => $studentId, 'academic_year_id' => $ayId],
            ['level' => 'hijau', 'kehadiran_score' => 100, 'karakter_score' => 0],
        );
    }

    /** @return array{0: AcademicYear, 1: AcademicYear} */
    private function resolveYears(Request $request): array
    {
        $request->validate([
            'target_academic_year_id' => ['required', 'string'],
            'source_academic_year_id' => ['sometimes', 'string'],
        ]);

        // Sumber eksplisit dari wizard — supaya urutan "aktifkan TA baru dulu atau
        // naik kelas dulu" tidak menjebak. Default: TA aktif.
        $source = $request->filled('source_academic_year_id')
            ? AcademicYear::where('uuid', $request->source_academic_year_id)->first()
            : \App\Support\TahunAjaran::current();
        abort_if(! $source, 422, 'Tahun ajaran sumber tidak ditemukan.');

        $target = AcademicYear::where('uuid', $request->target_academic_year_id)->first();
        abort_if(! $target, 404, 'Tahun ajaran tujuan tidak ditemukan.');
        abort_if($target->id === $source->id, 422, 'Tahun ajaran tujuan harus berbeda dari tahun ajaran aktif.');

        return [$source, $target];
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()->role === UserRole::Admin, 403, 'Hanya admin yang dapat menjalankan naik kelas.');
    }
}
