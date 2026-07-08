<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
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
                    'label' => "{$kelas->tingkat->value} {$kelas->jurusan} - {$kelas->rombel}",
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
                'kelas'  => "{$kelas->tingkat->value} {$kelas->jurusan} - {$kelas->rombel}",
                'siswa'  => $data,
            ],
        ]);
    }

    // ── Resolve class ─────────────────────────────────────────────────────────

    private function resolveClass($user, ?string $classUuid): ?SchoolClass
    {
        $role = $user->role;

        if (in_array($role, [UserRole::Admin, UserRole::Wakasek, UserRole::BK])) {
            if ($classUuid) {
                return SchoolClass::where('uuid', $classUuid)->first();
            }
            return SchoolClass::first(); // fallback
        }

        if ($role === UserRole::WaliKelas) {
            $q = SchoolClass::where('wali_kelas_id', $user->id);
            if ($classUuid) $q->where('uuid', $classUuid);
            return $q->first();
        }

        if ($role === UserRole::Guru) {
            // Guru hanya bisa lihat kelas yang ia mengajar
            $q = SchoolClass::whereHas('schedules', fn ($sq) =>
                $sq->whereHas('teacher', fn ($tq) => $tq->where('user_id', $user->id))
            );
            if ($classUuid) $q->where('uuid', $classUuid);
            return $q->first();
        }

        return null;
    }
}
