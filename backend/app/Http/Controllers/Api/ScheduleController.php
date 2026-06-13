<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ScheduleResource;
use App\Models\Schedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ScheduleController extends Controller
{
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
