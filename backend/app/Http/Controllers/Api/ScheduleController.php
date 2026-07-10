<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ScheduleResource;
use App\Models\Schedule;
use App\Traits\ServesStoredPdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class ScheduleController extends Controller
{
    use ServesStoredPdf;

    // GET /schedules/my-pdf — jadwal PDF milik guru/siswa yang login (?preview=1 = JSON base64)
    public function myPdf(Request $request)
    {
        $user = $request->user();

        if ($user->role->value === 'guru') {
            $teacher = $user->teacher;
            if (! $teacher || ! $teacher->jadwal_pdf) {
                abort(404, 'Jadwal PDF belum diunggah admin.');
            }
            $filename = 'Jadwal - '.Str::slug($teacher->user->nama).'.pdf';
            return $this->storedPdfResponse($teacher->jadwal_pdf, $filename, $request);
        }

        if ($user->role->value === 'siswa') {
            $student = $user->student;
            $class   = $student?->schoolClass;
            if (! $class || ! $class->jadwal_pdf) {
                abort(404, 'Jadwal PDF belum diunggah admin.');
            }
            $filename = 'Jadwal - '.Str::slug("{$class->tingkat->value} {$class->jurusan} {$class->rombel}").'.pdf';
            return $this->storedPdfResponse($class->jadwal_pdf, $filename, $request);
        }

        abort(403, 'Hanya guru dan siswa yang punya jadwal PDF pribadi.');
    }

    public function today(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;

        if (! $teacher) {
            return response()->json(['data' => []]);
        }

        $hariMap = [
            0 => 'minggu', 1 => 'senin', 2 => 'selasa',
            3 => 'rabu',   4 => 'kamis', 5 => 'jumat', 6 => 'sabtu',
        ];
        $today = $hariMap[Carbon::now('Asia/Jakarta')->dayOfWeek];
        $todayDate = Carbon::now('Asia/Jakarta')->toDateString();

        $schedules = $teacher->schedules()
            ->where('hari', $today)
            ->where('aktif', true)
            // Mode PKL: kelas XII tidak lagi menuntut agenda harian per-sesi — kewajibannya
            // pindah ke agenda PKL mingguan, jadi sesinya disembunyikan dari daftar "hari ini".
            ->when(\App\Support\PklMode::isActive(), fn ($q) => $q->whereHas('schoolClass',
                fn ($c) => $c->where('tingkat', '!=', \App\Enums\Tingkat::XII->value)))
            ->with([
                'subject',
                'schoolClass',
                'agendas' => fn ($q) => $q->whereDate('tanggal', $todayDate),
            ])
            ->orderBy('jam_mulai')
            ->get();

        return response()->json([
            'data' => ScheduleResource::collection($schedules),
        ]);
    }

    // GK17: widget dashboard "Jadwal Minggu Ini" — beda dari today() yang cuma hari
    // ini, ini mengembalikan seluruh jadwal aktif guru Senin-Sabtu minggu berjalan
    // beserta tanggal konkretnya masing-masing.
    public function thisWeek(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;

        if (! $teacher) {
            return response()->json(['data' => []]);
        }

        $hariOrder   = ['senin' => 0, 'selasa' => 1, 'rabu' => 2, 'kamis' => 3, 'jumat' => 4, 'sabtu' => 5, 'minggu' => 6];
        $startOfWeek = Carbon::now('Asia/Jakarta')->startOfWeek(Carbon::MONDAY);

        $schedules = $teacher->schedules()
            ->where('aktif', true)
            ->with(['subject', 'schoolClass'])
            ->get()
            ->sortBy(fn ($s) => sprintf('%d-%s', $hariOrder[$s->hari->value] ?? 9, $s->jam_mulai))
            ->values()
            ->map(function ($s) use ($startOfWeek, $hariOrder) {
                $tanggal = $startOfWeek->copy()->addDays($hariOrder[$s->hari->value] ?? 0);

                return [
                    'id'          => $s->uuid,
                    'hari'        => $s->hari->value,
                    'tanggal'     => $tanggal->toDateString(),
                    'jam_mulai'   => $s->jam_mulai,
                    'jam_selesai' => $s->jam_selesai,
                    'subject'     => ['id' => $s->subject->uuid, 'kode' => $s->subject->kode, 'nama' => $s->subject->nama],
                    'class'       => [
                        'id'    => $s->schoolClass->uuid,
                        'label' => "{$s->schoolClass->tingkat->value} {$s->schoolClass->jurusan} - {$s->schoolClass->rombel}",
                    ],
                ];
            });

        return response()->json(['data' => $schedules->values()]);
    }

    // Jadwal hari ini untuk siswa — berdasarkan kelas yang dimiliki
    public function todayStudent(Request $request): JsonResponse
    {
        $student = $request->user()->student;

        if (! $student || ! $student->class_id) {
            return response()->json(['data' => []]);
        }

        $hariMap = [
            0 => 'minggu', 1 => 'senin', 2 => 'selasa',
            3 => 'rabu',   4 => 'kamis', 5 => 'jumat', 6 => 'sabtu',
        ];
        $today     = $hariMap[Carbon::now('Asia/Jakarta')->dayOfWeek];
        $todayDate = Carbon::now('Asia/Jakarta')->toDateString();

        $schedules = Schedule::where('class_id', $student->class_id)
            ->where('hari', $today)
            ->where('aktif', true)
            ->with([
                'subject',
                'schoolClass',
                'teacher.user:id,nama',
                'agendas' => fn ($q) => $q->whereDate('tanggal', $todayDate)
                    ->with('learningObjectives'),
            ])
            ->orderBy('jam_mulai')
            ->get()
            ->map(fn ($s) => [
                'id'          => $s->uuid,
                'hari'        => $s->hari->value,
                'jam_mulai'   => $s->jam_mulai,
                'jam_selesai' => $s->jam_selesai,
                'subject'     => ['nama' => $s->subject->nama, 'kode' => $s->subject->kode],
                'guru'        => $s->teacher?->user?->nama ?? '—',
                'agenda_hari_ini' => $s->agendas->first() ? [
                    'id'     => $s->agendas->first()->uuid,
                    'status' => $s->agendas->first()->status->value,
                    'resume' => $s->agendas->first()->resume_kbm,
                    'tp'     => $s->agendas->first()->learningObjectives
                        ->map(fn ($lo) => $lo->kode . ' — ' . $lo->deskripsi)
                        ->join('; '),
                ] : null,
            ]);

        return response()->json(['data' => $schedules]);
    }
}
