<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AgendaResource;
use App\Traits\RejectsFutureDate;
use App\Models\Agenda;
use App\Models\AgendaFillSetting;
use App\Models\AgendaStudentScore;
use App\Models\AuditLog;
use App\Models\LearningObjective;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\TeacherAttendance;
use App\Enums\Tingkat;
use App\Support\BellSchedule;
use App\Support\PklMode;
use App\Support\SessionTeacher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AgendaController extends Controller
{
    use RejectsFutureDate;

    public function myClasses(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;

        if (! $teacher) {
            return response()->json(['data' => []]);
        }

        $classIds = Schedule::tahunAjaran()
            ->where('teacher_id', $teacher->id)
            ->distinct()
            ->pluck('class_id');

        $classes = SchoolClass::whereIn('id', $classIds)
            ->orderBy('tingkat')
            ->orderBy('jurusan')
            ->orderBy('rombel')
            ->get()
            ->map(fn ($c) => [
                'id'    => $c->uuid,
                'label' => "{$c->tingkat->value} {$c->jurusan} - {$c->rombel}",
            ]);

        return response()->json(['data' => $classes]);
    }

    /**
     * GET /agendas/perlu-diisi — semua sesi terjadwal guru yang BELUM diisi, mundur
     * sampai H- (batas_hari admin), bukan cuma hari ini. Sebelumnya dashboard & form
     * "Isi Agenda" cuma pakai /schedules/today — jadwal yang telat diisi kemarin/H-2
     * jadi TIDAK PERNAH muncul di mana pun walau backend (store()) sebenarnya masih
     * mengizinkan pengisian selama dalam jendela deadline. Endpoint ini menutup celah
     * itu: tampilkan SEMUA yang masih relevan, lengkap dengan kapan batas isinya, supaya
     * guru sadar ada yang harus segera diisi sebelum kelewat.
     */
    public function perluDiisi(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;
        if (! $teacher) {
            return response()->json(['data' => []]);
        }

        $setting = AgendaFillSetting::instance();
        $today   = Carbon::now('Asia/Jakarta')->startOfDay();
        // +1 hari buffer di atas batas_hari admin — supaya sesi yang BARU SAJA lewat
        // deadline tetap kelihatan sekali (transparansi "ini yang kelewat"), bukan
        // langsung hilang begitu deadline lewat sepersekian detik.
        $mulai = $today->copy()->subDays($setting->batas_hari + 1);

        $hariMap = [
            'senin' => Carbon::MONDAY, 'selasa' => Carbon::TUESDAY,
            'rabu'  => Carbon::WEDNESDAY, 'kamis' => Carbon::THURSDAY,
            'jumat' => Carbon::FRIDAY, 'sabtu' => Carbon::SATURDAY, 'minggu' => Carbon::SUNDAY,
        ];

        $schedules = Schedule::tahunAjaran()
            ->where('teacher_id', $teacher->id)->where('aktif', true)
            ->with(['subject', 'schoolClass'])->get();

        $sesi = [];
        foreach ($schedules as $schedule) {
            $hariNum = $hariMap[$schedule->hari->value] ?? null;
            if ($hariNum === null) continue;

            $cursor = $mulai->copy();
            while ($cursor->lte($today)) {
                if ($hariNum === $cursor->dayOfWeek) {
                    $sesi[] = ['tanggal' => $cursor->toDateString(), 'schedule' => $schedule];
                }
                $cursor->addDay();
            }
        }

        // ── Guru inval ────────────────────────────────────────────────────────
        // Sesi yang sudah dialihkan ke guru lain (inval DISETUJUI) hilang dari daftar ini,
        // dan sesi guru lain yang dialihkan KEPADA saya ikut masuk. Hanya di sinilah
        // "kewajiban mengisi agenda" berpindah — lihat App\Support\SessionTeacher.
        $dialihkan = SessionTeacher::delegatedAwayKeys($teacher->id)->flip();

        $sesi = array_values(array_filter(
            $sesi,
            fn ($s) => ! $dialihkan->has($s['schedule']->id.'|'.$s['tanggal']),
        ));

        foreach (SessionTeacher::delegatedToSessions($teacher->id) as $ds) {
            $tanggal = $ds->tanggal->toDateString();

            // Batasi ke jendela yang sama dengan jadwal sendiri, supaya sesi inval jauh di
            // masa lalu tidak tiba-tiba muncul kembali di daftar "perlu diisi".
            if ($ds->schedule && $tanggal >= $mulai->toDateString() && $tanggal <= $today->toDateString()) {
                $sesi[] = [
                    'tanggal'   => $tanggal,
                    'schedule'  => $ds->schedule,
                    'inval_dari' => $ds->request->requester->user?->nama,
                ];
            }
        }

        // Mode PKL: sesi kelas XII tidak lagi menuntut agenda harian — kewajibannya pindah
        // ke agenda PKL mingguan. Buang dari daftar "perlu diisi" (termasuk sesi inval XII).
        if (PklMode::isActive()) {
            $sesi = array_values(array_filter(
                $sesi,
                fn ($s) => $s['schedule']->schoolClass?->tingkat !== Tingkat::XII,
            ));
        }

        // Kokurikuler: kelas peserta projek pada tanggal dalam periode projek dibebaskan
        // dari kewajiban agenda reguler — tidak muncul sebagai tagihan dan tidak pernah
        // menjadi hutang (projek selesai tetap membebaskan tanggal lamanya).
        $sesi = array_values(array_filter(
            $sesi,
            fn ($s) => ! \App\Support\KokurikulerMode::isAgendaExempt($s['schedule']->class_id, $s['tanggal']),
        ));

        if (empty($sesi)) {
            return response()->json(['data' => []]);
        }

        $scheduleIds = collect($sesi)->pluck('schedule.id')->unique()->values();
        $tanggalList = collect($sesi)->pluck('tanggal')->unique()->values();

        $agendaExists = Agenda::whereIn('schedule_id', $scheduleIds)
            ->whereIn('tanggal', $tanggalList)
            ->get(['schedule_id', 'tanggal'])
            ->map(fn ($a) => $a->schedule_id . '|' . $a->tanggal->toDateString())
            ->flip();

        $rows = collect($sesi)
            ->filter(fn ($s) => ! $agendaExists->has($s['schedule']->id . '|' . $s['tanggal']))
            ->map(function ($s) use ($setting) {
                $schedule      = $s['schedule'];
                $jam           = BellSchedule::resolve($schedule, $s['tanggal']);
                $jadwalSelesai = Carbon::parse("{$s['tanggal']} {$jam['jam_selesai']}", 'Asia/Jakarta');
                $deadline      = $setting->batasWaktu($jadwalSelesai);
                $now           = Carbon::now('Asia/Jakarta');

                return [
                    'schedule_id'  => $schedule->uuid,
                    'tanggal'      => $s['tanggal'],
                    'hari'         => ucfirst($schedule->hari->value),
                    'jam_mulai'    => substr($jam['jam_mulai'] ?? '', 0, 5),
                    'jam_selesai'  => substr($jam['jam_selesai'] ?? '', 0, 5),
                    'class_id'     => $schedule->schoolClass?->uuid,
                    'kelas'        => $schedule->schoolClass
                        ? "{$schedule->schoolClass->tingkat->value} {$schedule->schoolClass->jurusan} - {$schedule->schoolClass->rombel}"
                        : '—',
                    'mapel'        => $schedule->subject->nama ?? '—',
                    'deadline'     => $deadline->format('Y-m-d H:i'),
                    'bisa_diisi'   => $now->lte($deadline),
                    'jam_tersisa'  => $now->lte($deadline) ? $now->diffInHours($deadline) : null,
                    // Terisi hanya untuk sesi yang masuk lewat inval — supaya guru pengganti
                    // tahu ini bukan jadwalnya sendiri, dan tidak mengira aplikasinya keliru.
                    'inval_dari'   => $s['inval_dari'] ?? null,
                ];
            })
            ->sortBy('deadline')
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function index(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;

        if (! $teacher) {
            return response()->json(['data' => [], 'meta' => ['total' => 0, 'current_page' => 1, 'last_page' => 1]]);
        }

        $query = Agenda::untukGuru($teacher->id)
            ->with(['schedule.subject', 'schedule.schoolClass', 'learningObjectives', 'studentScores.student.user'])
            ->orderByDesc('tanggal')
            ->orderByDesc('created_at');

        if ($request->filled('kelas')) {
            $kelas = $request->kelas;
            $query->whereHas('schedule.schoolClass', function ($q) use ($kelas) {
                $q->whereLikeCi("CONCAT(tingkat, ' ', jurusan, ' - ', rombel)", $kelas);
            });
        }

        if ($request->filled('tanggal_dari')) {
            $query->whereDate('tanggal', '>=', $request->tanggal_dari);
        }

        if ($request->filled('tanggal_sampai')) {
            $query->whereDate('tanggal', '<=', $request->tanggal_sampai);
        }

        $agendas = $query->paginate(15);

        return response()->json([
            'data' => AgendaResource::collection($agendas->items()),
            'meta' => [
                'total'        => $agendas->total(),
                'current_page' => $agendas->currentPage(),
                'last_page'    => $agendas->lastPage(),
                'per_page'     => $agendas->perPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'schedule_id'               => ['required', 'string'],
            'tanggal'                   => ['required', 'date', $this->notFutureDateRule()],
            'resume_kbm'               => ['nullable', 'string', 'max:2000'],
            'learning_objective_ids'   => ['nullable', 'array'],
            'learning_objective_ids.*' => ['string'],
            'status'                   => ['sometimes', 'in:draft,submitted'],
            'student_scores'           => ['nullable', 'array'],
            'student_scores.*.student_id' => ['required', 'string'],
            'student_scores.*.nilai'      => ['required', 'integer'],
            'student_scores.*.catatan'    => ['nullable', 'string', 'max:500'],
        ], $this->notFutureDateMessages());

        $schedule = Schedule::where('uuid', $data['schedule_id'])->firstOrFail();
        \App\Support\SemesterLock::assertClassWritable($schedule->class_id);

        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403, 'Bukan jadwal Anda.');

        // BUKAN lagi `$schedule->teacher_id !== $teacher->id`. Kalau sesi ini sudah dialihkan
        // lewat guru inval yang disetujui, yang berhak (dan wajib) mengisi adalah guru
        // penggantinya — dan guru terjadwal justru tidak lagi berhak.
        abort_unless(
            SessionTeacher::isResponsible($teacher->id, $schedule->id, $data['tanggal'], $schedule->teacher_id),
            403,
            $schedule->teacher_id === $teacher->id
                ? 'Sesi ini sudah dialihkan ke guru pengganti.'
                : 'Bukan jadwal Anda.',
        );

        $this->abortIfPastFillDeadline($schedule, $data['tanggal']);

        abort_if(
            Agenda::where('schedule_id', $schedule->id)
                ->whereDate('tanggal', $data['tanggal'])
                ->exists(),
            422,
            'Agenda untuk jadwal dan tanggal ini sudah ada.'
        );

        $agenda = Agenda::create([
            'schedule_id' => $schedule->id,
            'tanggal'     => $data['tanggal'],
            'resume_kbm'  => $data['resume_kbm'] ?? null,
            'status'      => $data['status'] ?? 'submitted',
        ]);

        if (! empty($data['learning_objective_ids'])) {
            $loIds = LearningObjective::whereIn('uuid', $data['learning_objective_ids'])->pluck('id');
            $agenda->learningObjectives()->attach($loIds);
        }

        if (! empty($data['student_scores'])) {
            $this->syncStudentScores($agenda, $teacher->id, $data['student_scores']);
        }

        // Auto check-in guru saat agenda dibuat
        TeacherAttendance::firstOrCreate(
            ['teacher_id' => $teacher->id, 'agenda_id' => $agenda->id],
            ['status' => 'hadir']
        );

        // Jejak kapan & dari IP mana agenda ini diisi — dipakai laporan kepatuhan EWS Guru
        // (sebelumnya tidak ada, cuma created_at/updated_by tanpa IP).
        AuditLog::record('created', $agenda, ['status' => $agenda->status->value], $request->user()->id);

        $agenda->load(['schedule.subject', 'schedule.schoolClass', 'learningObjectives', 'studentScores.student.user']);

        return response()->json([
            'message' => 'Agenda berhasil disimpan.',
            'data'    => new AgendaResource($agenda),
        ], 201);
    }

    public function show(Request $request, string $uuid): JsonResponse
    {
        $teacher = $request->user()->teacher;

        $agenda = Agenda::where('uuid', $uuid)
            ->with(['schedule.subject', 'schedule.schoolClass', 'learningObjectives', 'studentScores.student.user'])
            ->firstOrFail();

        // Guru pengganti yang menerima inval berhak atas agenda sesi ini; guru terjadwal
        // yang sudah mengalihkannya tidak lagi berhak. Lihat App\Support\SessionTeacher.
        abort_if(! $teacher || ! SessionTeacher::isResponsibleForAgenda($teacher->id, $agenda), 403);

        return response()->json(['data' => new AgendaResource($agenda)]);
    }

    public function update(Request $request, string $uuid): JsonResponse
    {
        $teacher = $request->user()->teacher;
        $agenda  = Agenda::where('uuid', $uuid)->firstOrFail();
        \App\Support\SemesterLock::assertClassWritable($agenda->schedule?->class_id);

        // Guru pengganti yang menerima inval berhak atas agenda sesi ini; guru terjadwal
        // yang sudah mengalihkannya tidak lagi berhak. Lihat App\Support\SessionTeacher.
        abort_if(! $teacher || ! SessionTeacher::isResponsibleForAgenda($teacher->id, $agenda), 403);

        $data = $request->validate([
            'resume_kbm'               => ['nullable', 'string', 'max:2000'],
            'learning_objective_ids'   => ['nullable', 'array'],
            'learning_objective_ids.*' => ['string'],
            'status'                   => ['sometimes', 'in:draft,submitted'],
            'student_scores'           => ['nullable', 'array'],
            'student_scores.*.student_id' => ['required', 'string'],
            'student_scores.*.nilai'      => ['required', 'integer'],
            'student_scores.*.catatan'    => ['nullable', 'string', 'max:500'],
        ]);

        $agenda->update([
            'resume_kbm' => array_key_exists('resume_kbm', $data) ? $data['resume_kbm'] : $agenda->resume_kbm,
            'status'     => $data['status'] ?? $agenda->status->value,
        ]);

        if (array_key_exists('learning_objective_ids', $data)) {
            $loIds = LearningObjective::whereIn('uuid', $data['learning_objective_ids'] ?? [])->pluck('id');
            $agenda->learningObjectives()->sync($loIds);
        }

        if (array_key_exists('student_scores', $data)) {
            $agenda->studentScores()->delete();
            if (! empty($data['student_scores'])) {
                $this->syncStudentScores($agenda, $teacher->id, $data['student_scores']);
            }
        }

        AuditLog::record('updated', $agenda, ['status' => $agenda->status->value], $request->user()->id);

        $agenda->load(['schedule.subject', 'schedule.schoolClass', 'learningObjectives', 'studentScores.student.user']);

        return response()->json([
            'message' => 'Agenda berhasil diperbarui.',
            'data'    => new AgendaResource($agenda),
        ]);
    }

    /**
     * Tolak pembuatan agenda BARU kalau sudah lewat batas waktu yang diatur admin
     * (Panel Admin → Pengaturan Agenda) — dihitung dari tanggal+jam SELESAI jadwal,
     * bukan dari sekarang. Cuma berlaku utk store() (mengisi baru); update() atas
     * agenda yang sudah ada (mis. draft yang mau disubmit) tidak dibatasi ulang,
     * karena agenda itu sudah terbukti dibuat di dalam jendela waktu yang benar.
     */
    private function abortIfPastFillDeadline(Schedule $schedule, string $tanggal): void
    {
        $setting = AgendaFillSetting::instance();

        $jam           = BellSchedule::resolve($schedule, $tanggal);
        $jadwalSelesai = Carbon::parse("{$tanggal} {$jam['jam_selesai']}");
        $deadline      = $setting->batasWaktu($jadwalSelesai);

        abort_if(
            now()->gt($deadline),
            422,
            "Batas waktu pengisian agenda untuk jadwal ini sudah lewat (maksimal {$setting->batas_hari} hari {$setting->batas_jam} jam setelah jadwal selesai, batas: {$deadline->format('d/m/Y H:i')})."
        );
    }

    private function syncStudentScores(Agenda $agenda, int $teacherId, array $scores): void
    {
        foreach ($scores as $score) {
            $student = Student::where('uuid', $score['student_id'])->first();
            if (! $student) continue;

            AgendaStudentScore::updateOrCreate(
                ['agenda_id' => $agenda->id, 'student_id' => $student->id],
                ['teacher_id' => $teacherId, 'nilai' => $score['nilai'], 'catatan' => $score['catatan'] ?? null],
            );
        }
    }
}
