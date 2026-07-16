<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TeacherAttendance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeacherAttendanceController extends Controller
{
    // GET /teacher-attendance — riwayat kehadiran guru yang login
    public function index(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;

        if (! $teacher) {
            return response()->json(['data' => [], 'meta' => ['total' => 0]]);
        }

        $records = TeacherAttendance::where('teacher_id', $teacher->id)
            ->with(['agenda.schedule.subject', 'agenda.schedule.schoolClass'])
            ->when($request->filled('bulan'), function ($q) use ($request) {
                // format: YYYY-MM
                [$year, $month] = explode('-', $request->bulan);
                $q->whereHas('agenda', fn ($a) => $a->whereYear('tanggal', $year)->whereMonth('tanggal', $month));
            })
            ->orderByDesc('created_at')
            ->paginate(30);

        $summary = [
            'hadir'       => TeacherAttendance::where('teacher_id', $teacher->id)->where('status', 'hadir')->count(),
            'tidak_hadir' => TeacherAttendance::where('teacher_id', $teacher->id)->where('status', 'tidak_hadir')->count(),
            'izin'        => TeacherAttendance::where('teacher_id', $teacher->id)->where('status', 'izin')->count(),
            'sakit'       => TeacherAttendance::where('teacher_id', $teacher->id)->where('status', 'sakit')->count(),
        ];

        return response()->json([
            'data' => $records->map(fn ($r) => [
                'id'         => $r->id,
                'status'     => $r->status->value,
                'tanggal'    => $r->agenda?->tanggal,
                'jam_mulai'  => $r->agenda?->schedule?->jam_mulai,
                'mapel'      => $r->agenda?->schedule?->subject?->nama,
                'kelas'      => $r->agenda?->schedule?->schoolClass
                    ? $r->agenda->schedule->schoolClass->label()
                    : null,
                'catatan'    => $r->catatan,
            ]),
            'meta' => [
                'total'        => $records->total(),
                'current_page' => $records->currentPage(),
                'last_page'    => $records->lastPage(),
                'summary'      => $summary,
            ],
        ]);
    }

    // PUT /teacher-attendance/{id} — guru update status sendiri (mis. izin)
    public function update(Request $request, int $id): JsonResponse
    {
        $teacher = $request->user()->teacher;
        $record  = TeacherAttendance::where('id', $id)->where('teacher_id', $teacher?->id)->firstOrFail();

        $data = $request->validate([
            'status'  => ['required', 'in:hadir,tidak_hadir,izin,sakit'],
            'catatan' => ['nullable', 'string', 'max:500'],
        ]);

        $record->update($data);

        return response()->json(['message' => 'Kehadiran diperbarui.', 'data' => ['id' => $record->id, 'status' => $record->status->value]]);
    }
}
