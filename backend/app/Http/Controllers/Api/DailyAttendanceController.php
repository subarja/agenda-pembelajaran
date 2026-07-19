<?php

namespace App\Http\Controllers\Api;

use App\Support\ClassAccess;
use App\Support\SemesterLock;
use App\Support\TahunAjaran;
use App\Http\Controllers\Controller;
use App\Models\DailyAttendance;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Traits\RejectsFutureDate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class DailyAttendanceController extends Controller
{
    use RejectsFutureDate;

    // GET /daily-attendance?tanggal=YYYY-MM-DD
    public function index(Request $request): JsonResponse
    {
        $user   = $request->user();
        $tanggal = $request->input('tanggal', today()->toDateString());

        $kelas = $this->resolveClass($user, $request->input('class_id'));

        if (! $kelas) {
            return response()->json(['message' => 'Kelas tidak ditemukan atau akses ditolak.'], 403);
        }

        $students = Student::where('class_id', $kelas->id)
            ->with('user:id,nama')
            ->orderBy('user_id')
            ->get();

        $existing = DailyAttendance::where('class_id', $kelas->id)
            ->where('tanggal', $tanggal)
            ->get()
            ->keyBy('student_id');

        $data = $students->map(fn ($s) => [
            'student_id' => $s->uuid,
            'nama'       => $s->user->nama,
            'nis'        => $s->nis,
            'status'     => $existing[$s->id]?->status ?? 'hadir',
            'catatan'    => $existing[$s->id]?->catatan ?? null,
        ]);

        return response()->json([
            'data' => [
                'tanggal'    => $tanggal,
                'kelas'      => [
                    'id'    => $kelas->uuid,
                    'label' => $kelas->label(),
                ],
                'is_filled'  => $existing->isNotEmpty(),
                'siswa'      => $data,
            ],
        ]);
    }

    // POST /daily-attendance — bulk upsert
    public function bulkStore(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'tanggal'          => ['required', 'date', $this->notFutureDateRule()],
            'class_id'         => 'nullable|string',
            'records'          => 'required|array|min:1',
            'records.*.student_id' => 'required|string',
            'records.*.status'     => ['required', Rule::in(['hadir', 'sakit', 'izin', 'alpha'])],
            'records.*.catatan'    => 'nullable|string|max:500',
        ], $this->notFutureDateMessages());

        $kelas = $this->resolveClass($user, $request->input('class_id'));

        if (! $kelas) {
            return response()->json(['message' => 'Kelas tidak ditemukan atau akses ditolak.'], 403);
        }
        SemesterLock::assertClassWritable($kelas->id);

        // Build student UUID → DB id map for this class
        $studentMap = Student::where('class_id', $kelas->id)
            ->pluck('id', 'uuid');

        DB::transaction(function () use ($validated, $kelas, $user, $studentMap) {
            foreach ($validated['records'] as $rec) {
                $studentId = $studentMap[$rec['student_id']] ?? null;
                if (! $studentId) continue;

                DailyAttendance::updateOrCreate(
                    ['student_id' => $studentId, 'tanggal' => $validated['tanggal']],
                    [
                        'class_id'    => $kelas->id,
                        'status'      => $rec['status'],
                        'catatan'     => $rec['catatan'] ?? null,
                        'recorded_by' => $user->id,
                    ],
                );
            }
        });

        $summary = DailyAttendance::where('class_id', $kelas->id)
            ->where('tanggal', $validated['tanggal'])
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return response()->json([
            'message' => 'Presensi harian berhasil disimpan.',
            'data'    => [
                'hadir' => $summary['hadir'] ?? 0,
                'sakit' => $summary['sakit'] ?? 0,
                'izin'  => $summary['izin']  ?? 0,
                'alpha' => $summary['alpha'] ?? 0,
            ],
        ]);
    }

    // GET /daily-attendance/rekap?month=YYYY-MM — rekap bulanan 1 kelas
    public function rekap(Request $request): JsonResponse
    {
        $user  = $request->user();
        $month = $request->input('month', today()->format('Y-m'));

        $kelas = $this->resolveClass($user, $request->input('class_id'));

        if (! $kelas) {
            return response()->json(['message' => 'Kelas tidak ditemukan atau akses ditolak.'], 403);
        }

        [$year, $mon] = explode('-', $month);

        $records = DailyAttendance::where('class_id', $kelas->id)
            ->whereYear('tanggal', $year)
            ->whereMonth('tanggal', $mon)
            ->with('student.user:id,nama')
            ->get();

        // Group by student
        $byStudent = $records->groupBy('student_id');
        $students  = Student::where('class_id', $kelas->id)->with('user:id,nama')->get();

        $data = $students->map(function ($s) use ($byStudent) {
            $rows   = $byStudent[$s->id] ?? collect();
            return [
                'student_id' => $s->uuid,
                'nama'       => $s->user->nama,
                'nis'        => $s->nis,
                'hadir'      => $rows->where('status', 'hadir')->count(),
                'sakit'      => $rows->where('status', 'sakit')->count(),
                'izin'       => $rows->where('status', 'izin')->count(),
                'alpha'      => $rows->where('status', 'alpha')->count(),
            ];
        });

        return response()->json([
            'data' => [
                'bulan'  => $month,
                'kelas'  => $kelas->label(),
                'siswa'  => $data,
            ],
        ]);
    }

    // ── Resolve class ─────────────────────────────────────────────────────────

    /**
     * Kelas yang boleh dipresensi pengguna ini, atau null kalau tidak berhak.
     *
     * Dulu bercabang pada role literal dan salah di tiga hal sekaligus (audit 2026-07-19):
     *
     * 1. Cabang `UserRole::WaliKelas` adalah DEAD CODE — wali kelas adalah *kapabilitas*
     *    di atas `guru`, rolenya tetap `guru`. Wali jatuh ke cabang Guru yang hanya
     *    mengizinkan kelas yang ia AJAR, sehingga 19 dari 35 wali (yang tidak mengajar
     *    di kelas perwaliannya) tertolak dari presensi kelasnya sendiri.
     * 2. `UserRole::BK` disamakan dengan admin/wakasek — lintas sekolah, padahal BK hanya
     *    berhak atas kelas yang ia ampu.
     * 3. Tidak ada scope tahun ajaran, sehingga default-nya bisa mengembalikan kelas TA
     *    lama yang rosternya sudah kosong.
     *
     * Sekarang satu sumber kebenaran: ClassAccess::teachingClassIds (DIAJAR ∪ perwalian),
     * batas yang memang ditujukan untuk data operasional kelas seperti presensi.
     */
    private function resolveClass($user, ?string $classUuid): ?SchoolClass
    {
        $allowed = ClassAccess::teachingClassIds($user); // null = lintas sekolah

        $dalamTahunAjaran = SchoolClass::query()
            ->where('academic_year_id', TahunAjaran::id())
            ->when($allowed !== null, fn ($q) => $q->whereIn('id', $allowed ?? collect()));

        if ($classUuid) {
            return (clone $dalamTahunAjaran)->where('uuid', $classUuid)->first();
        }

        // Tanpa class_id: dahulukan kelas perwalian — itu yang dicari wali kelas saat
        // membuka halaman presensi harian, bukan kelas pertama yang kebetulan ia ajar.
        $perwalian = (clone $dalamTahunAjaran)->where('wali_kelas_id', $user->id)->first();

        return $perwalian ?: (clone $dalamTahunAjaran)->orderBy('tingkat')->orderBy('jurusan')->orderBy('rombel')->first();
    }
}
