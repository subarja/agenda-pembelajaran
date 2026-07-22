<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agenda;
use App\Models\IzinKesiangan;
use App\Models\Student;
use App\Models\StudentAttendance;
use App\Models\TeacherAttendance;
use App\Services\AlphaAlertService;
use App\Support\SemesterLock;
use App\Support\SessionTeacher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        // Siswa yang kesiangan hari itu: default TIDAK hadir sampai guru menyatakan hadir
        // (lalu otomatis "hadir terlambat X menit"). Belum diisi = default alpha, bukan hadir.
        $kesiangan = IzinKesiangan::whereDate('tanggal', $agenda->tanggal)
            ->whereIn('student_id', $students->pluck('id'))
            ->get()->keyBy('student_id');

        $records = $students->map(function ($student) use ($existing, $kesiangan) {
            $adaKesiangan = $kesiangan->has($student->id);
            $sudah = $existing->has($student->id);

            return [
                'student_id' => $student->uuid,
                'nama' => $student->user->nama,
                'nis' => $student->nis,
                'status' => $sudah
                                        ? $existing[$student->id]->status->value
                                        : ($adaKesiangan ? 'alpha' : 'hadir'),
                'durasi_terlambat' => $existing[$student->id]?->durasi_terlambat ?? 0,
                'catatan' => $existing[$student->id]?->catatan ?? null,
                'sudah_diisi' => $sudah,
                'kesiangan_menit' => $adaKesiangan ? $kesiangan[$student->id]->terlambat_menit : null,
            ];
        });

        return response()->json([
            'data' => [
                'agenda' => [
                    'id' => $agenda->uuid,
                    'tanggal' => $agenda->tanggal->format('Y-m-d'),
                    'subject' => $agenda->schedule->subject->nama,
                    'class' => $agenda->schedule->schoolClass->label(),
                ],
                'records' => $records,
                'total_siswa' => $students->count(),
                'sudah_diisi' => $existing->count() > 0,
            ],
        ]);
    }

    public function bulkStore(Request $request, string $agendaUuid): JsonResponse
    {
        $agenda = Agenda::where('uuid', $agendaUuid)
            ->with('schedule.schoolClass')
            ->firstOrFail();
        SemesterLock::assertClassWritable($agenda->schedule?->class_id);

        $teacher = $request->user()->teacher;
        // Presensi mengikuti siapa yang benar-benar mengajar sesi itu — termasuk guru
        // pengganti lewat inval yang disetujui.
        abort_if(! $teacher || ! SessionTeacher::isResponsibleForAgenda($teacher->id, $agenda), 403);

        $data = $request->validate([
            'records' => ['required', 'array', 'min:1'],
            'records.*.student_id' => ['required', 'string'],
            'records.*.status' => ['required', 'in:hadir,sakit,izin,alpha'],
            'records.*.durasi_terlambat' => ['nullable', 'integer', 'min:0'],
            'records.*.catatan' => ['nullable', 'string', 'max:500'],
        ]);

        // Kesiangan hari itu: bila guru menandai HADIR, durasi_terlambat mengikuti hitungan
        // sistem (guru boleh menaikkan manual, tidak menurunkan) -> tampil "hadir terlambat X".
        $kesiangan = IzinKesiangan::whereDate('tanggal', $agenda->tanggal)
            ->get()->keyBy('student_id');

        $saved = 0;
        foreach ($data['records'] as $record) {
            $student = Student::where('uuid', $record['student_id'])->first();
            if (! $student) {
                continue;
            }

            $durasi = $record['durasi_terlambat'] ?? 0;
            if ($record['status'] === 'hadir' && $kesiangan->has($student->id)) {
                $durasi = max($durasi, $kesiangan[$student->id]->terlambat_menit);
            }

            StudentAttendance::updateOrCreate(
                ['agenda_id' => $agenda->id, 'student_id' => $student->id],
                [
                    'status' => $record['status'],
                    'durasi_terlambat' => $durasi,
                    'catatan' => $record['catatan'] ?? null,
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
        $izin = collect($data['records'])->where('status', 'izin')->count();

        // Cek alert alpha berturut-turut setelah presensi disimpan
        $alerts = app(AlphaAlertService::class)->checkClass($agenda->schedule->class_id);

        return response()->json([
            'message' => "Presensi {$saved} siswa berhasil disimpan.",
            'data' => array_merge(compact('hadir', 'alpha', 'sakit', 'izin'), ['alerts' => $alerts]),
        ]);
    }
}
