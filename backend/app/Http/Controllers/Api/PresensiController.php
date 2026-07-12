<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agenda;
use App\Models\Student;
use App\Models\StudentAttendance;
use App\Models\TeacherAttendance;
use App\Services\AlphaAlertService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Support\SessionTeacher;

class PresensiController extends Controller
{
    public function index(Request $request, string $agendaUuid): JsonResponse
    {
        $agenda = Agenda::where('uuid', $agendaUuid)
            ->with(['schedule.schoolClass.students.user', 'studentAttendances.student.user'])
            ->firstOrFail();

        $teacher = $request->user()->teacher;
        // Presensi mengikuti siapa yang benar-benar mengajar sesi itu — termasuk guru
        // pengganti lewat inval yang disetujui.
        abort_if(! $teacher || ! SessionTeacher::isResponsibleForAgenda($teacher->id, $agenda), 403);

        $students = $agenda->schedule->schoolClass->students;
        $existing = $agenda->studentAttendances->keyBy('student_id');

        $records = $students->map(fn ($student) => [
            'student_id'        => $student->uuid,
            'nama'              => $student->user->nama,
            'nis'               => $student->nis,
            'status'            => $existing->has($student->id)
                                    ? $existing[$student->id]->status->value
                                    : 'hadir',
            'durasi_terlambat'  => $existing[$student->id]?->durasi_terlambat ?? 0,
            'catatan'           => $existing[$student->id]?->catatan ?? null,
            'sudah_diisi'       => $existing->has($student->id),
        ]);

        return response()->json([
            'data' => [
                'agenda'        => [
                    'id'      => $agenda->uuid,
                    'tanggal' => $agenda->tanggal->format('Y-m-d'),
                    'subject' => $agenda->schedule->subject->nama,
                    'class'   => $agenda->schedule->schoolClass->tingkat->value
                                 . ' ' . $agenda->schedule->schoolClass->jurusan
                                 . ' - ' . $agenda->schedule->schoolClass->rombel,
                ],
                'records'       => $records,
                'total_siswa'   => $students->count(),
                'sudah_diisi'   => $existing->count() > 0,
            ],
        ]);
    }

    public function bulkStore(Request $request, string $agendaUuid): JsonResponse
    {
        $agenda = Agenda::where('uuid', $agendaUuid)
            ->with('schedule.schoolClass')
            ->firstOrFail();
        \App\Support\SemesterLock::assertClassWritable($agenda->schedule?->class_id);

        $teacher = $request->user()->teacher;
        // Presensi mengikuti siapa yang benar-benar mengajar sesi itu — termasuk guru
        // pengganti lewat inval yang disetujui.
        abort_if(! $teacher || ! SessionTeacher::isResponsibleForAgenda($teacher->id, $agenda), 403);

        $data = $request->validate([
            'records'                      => ['required', 'array', 'min:1'],
            'records.*.student_id'         => ['required', 'string'],
            'records.*.status'             => ['required', 'in:hadir,sakit,izin,alpha'],
            'records.*.durasi_terlambat'   => ['nullable', 'integer', 'min:0'],
            'records.*.catatan'            => ['nullable', 'string', 'max:500'],
        ]);

        $saved = 0;
        foreach ($data['records'] as $record) {
            $student = Student::where('uuid', $record['student_id'])->first();
            if (! $student) continue;

            StudentAttendance::updateOrCreate(
                ['agenda_id' => $agenda->id, 'student_id' => $student->id],
                [
                    'status'           => $record['status'],
                    'durasi_terlambat' => $record['durasi_terlambat'] ?? 0,
                    'catatan'          => $record['catatan'] ?? null,
                ],
            );
            $saved++;
        }

        // Auto-catat guru hadir
        TeacherAttendance::updateOrCreate(
            ['agenda_id' => $agenda->id, 'teacher_id' => $teacher->id],
            ['status' => 'hadir'],
        );

        $hadir = collect($data['records'])->where('status', 'hadir')->count();
        $alpha = collect($data['records'])->where('status', 'alpha')->count();
        $sakit = collect($data['records'])->where('status', 'sakit')->count();
        $izin  = collect($data['records'])->where('status', 'izin')->count();

        // Cek alert alpha berturut-turut setelah presensi disimpan
        $alerts = app(AlphaAlertService::class)->checkClass($agenda->schedule->class_id);

        return response()->json([
            'message' => "Presensi {$saved} siswa berhasil disimpan.",
            'data'    => array_merge(compact('hadir', 'alpha', 'sakit', 'izin'), ['alerts' => $alerts]),
        ]);
    }
}
