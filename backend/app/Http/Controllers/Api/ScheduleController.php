<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ScheduleResource;
use App\Models\Schedule;
use App\Support\BellSchedule;
use App\Support\PklMode;
use App\Traits\ServesStoredPdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class ScheduleController extends Controller
{
    use ServesStoredPdf;

    /**
     * GET /beban-mengajar — rekap beban mengajar guru yang login: kelas & mapel yang
     * diampu, jumlah sesi/minggu, jam pelajaran (JP), dan total JP. Ditambah penugasan
     * PKL (pembimbing) yang TIDAK lewat ploting jadwal — supaya guru tanpa ploting
     * kelas XII tetap melihat beban penugasannya.
     */
    public function bebanMengajar(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403, 'Menu Beban Mengajar khusus guru.');

        $hariOrder = ['senin' => 0, 'selasa' => 1, 'rabu' => 2, 'kamis' => 3, 'jumat' => 4, 'sabtu' => 5];

        $schedules = $teacher->schedules()
            ->tahunAjaran()
            ->where('aktif', true)
            ->with(['subject', 'schoolClass'])
            ->get();

        $rows = $schedules->groupBy(fn ($s) => $s->class_id.'|'.$s->subject_id)
            ->map(function ($group) use ($hariOrder) {
                $s = $group->first();

                return [
                    'kelas'       => $s->schoolClass
                        ? "{$s->schoolClass->tingkat->value} {$s->schoolClass->jurusan} - {$s->schoolClass->rombel}"
                        : '—',
                    // Nama mapel ASLI, bukan label PKL — beban mengajar adalah dokumen
                    // ploting; penugasan PKL dilaporkan terpisah di bawah.
                    'mapel'       => $s->subject->nama ?? '—',
                    'hari'        => $group->pluck('hari')
                        ->map(fn ($h) => $h->value)
                        ->unique()
                        ->sortBy(fn ($h) => $hariOrder[$h] ?? 9)
                        ->map(fn ($h) => ucfirst($h))
                        ->values()
                        ->join(', '),
                    'jumlah_sesi' => $group->count(),
                    'jp'          => $group->sum(fn ($x) => $this->hitungJp($x)),
                ];
            })
            ->sortBy([['kelas', 'asc'], ['mapel', 'asc']])
            ->values();

        // Penugasan mengajar yang BELUM diplot ke hari/jam (lesson aSc tanpa kartu) —
        // beban guru tetap tampil walau jadwalnya belum ditempatkan di grid.
        $plotted = $schedules->map(fn ($s) => $s->class_id.'|'.$s->subject_id)->flip();
        $belumDiplot = \App\Models\TeachingAssignment::where('teacher_id', $teacher->id)
            ->whereHas('schoolClass', fn ($q) => $q->where('academic_year_id', \App\Support\TahunAjaran::id()))
            ->with(['subject', 'schoolClass'])
            ->get()
            ->filter(fn ($a) => ! $plotted->has($a->class_id.'|'.$a->subject_id))
            ->map(fn ($a) => [
                'kelas'       => $a->schoolClass
                    ? "{$a->schoolClass->tingkat->value} {$a->schoolClass->jurusan} - {$a->schoolClass->rombel}"
                    : '—',
                'mapel'       => $a->subject->nama ?? '—',
                'hari'        => 'Belum diplot',
                'jumlah_sesi' => 0,
                'jp'          => (int) round($a->jp_per_minggu),
            ]);

        $rows = $rows->concat($belumDiplot)
            ->sortBy([['kelas', 'asc'], ['mapel', 'asc']])
            ->values();

        // Penugasan PKL: dari placement (pembimbing), terlepas dari ploting jadwal.
        $ayId = PklMode::activeAcademicYearId();
        $pkl = \App\Models\PklPlacement::where('pembimbing_teacher_id', $teacher->id)
            ->when($ayId, fn ($q) => $q->where('academic_year_id', $ayId))
            ->with('schoolClass')
            ->get()
            ->groupBy('class_id')
            ->map(fn ($group) => [
                'kelas'        => $group->first()->schoolClass
                    ? "{$group->first()->schoolClass->tingkat->value} {$group->first()->schoolClass->jurusan} - {$group->first()->schoolClass->rombel}"
                    : '—',
                'jumlah_siswa' => $group->count(),
                'periode'      => Carbon::parse($group->min('tanggal_mulai'))->locale('id')->isoFormat('D MMM YYYY')
                    .' – '.Carbon::parse($group->max('tanggal_selesai'))->locale('id')->isoFormat('D MMM YYYY'),
            ])
            ->sortBy('kelas')
            ->values();

        return response()->json(['data' => [
            'rows'     => $rows,
            'total_jp' => $rows->sum('jp'),
            'pkl'      => $pkl,
        ]]);
    }

    /**
     * Jumlah JP satu baris jadwal: dari rentang jam-ke bila ada (hasil import XML),
     * kalau tidak dari durasi menit ÷ 45 (1 JP = 45 menit, dibulatkan, minimal 1).
     */
    private function hitungJp(Schedule $s): int
    {
        if ($s->jam_ke_mulai !== null && $s->jam_ke_selesai !== null && $s->jam_ke_selesai >= $s->jam_ke_mulai) {
            return $s->jam_ke_selesai - $s->jam_ke_mulai + 1;
        }

        if ($s->jam_mulai && $s->jam_selesai) {
            $menit = Carbon::parse($s->jam_mulai)->diffInMinutes(Carbon::parse($s->jam_selesai));

            return max(1, (int) round($menit / 45));
        }

        return 0;
    }

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
            ->tahunAjaran()
            ->where('hari', $today)
            ->where('aktif', true)
            ->with([
                'subject',
                'schoolClass',
                'agendas' => fn ($q) => $q->whereDate('tanggal', $todayDate),
            ])
            ->orderBy('jam_mulai')
            ->get()
            // PKL (periode penempatan) & Kokurikuler: kelas yang hari ini tidak menjalani
            // KBM reguler disembunyikan dari "hari ini" — konsisten dengan pembebasan
            // tagihan perlu-diisi (bukan blanket saklar: XII tanpa penempatan tetap tampil).
            ->reject(fn ($s) => PklMode::isAgendaExempt($s->class_id, $todayDate)
                || \App\Support\KokurikulerMode::isAgendaExempt($s->class_id, $todayDate))
            ->values();

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
            ->tahunAjaran()
            ->where('aktif', true)
            ->with(['subject', 'schoolClass'])
            ->get()
            ->sortBy(fn ($s) => sprintf('%d-%s', $hariOrder[$s->hari->value] ?? 9, $s->jam_mulai))
            ->values()
            ->map(function ($s) use ($startOfWeek, $hariOrder) {
                $tanggal = $startOfWeek->copy()->addDays($hariOrder[$s->hari->value] ?? 0);
                $jam     = BellSchedule::resolve($s, $tanggal->toDateString());

                return [
                    'id'          => $s->uuid,
                    'hari'        => $s->hari->value,
                    'tanggal'     => $tanggal->toDateString(),
                    'jam_mulai'   => $jam['jam_mulai'],
                    'jam_selesai' => $jam['jam_selesai'],
                    'subject'     => ['id' => $s->subject->uuid, 'kode' => $s->subject->kode, 'nama' => PklMode::subjectLabelFor($s)],
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
                ...BellSchedule::resolve($s, $todayDate),
                'subject'     => ['nama' => PklMode::subjectLabelFor($s), 'kode' => $s->subject->kode],
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
