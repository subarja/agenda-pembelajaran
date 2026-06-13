<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AgendaResource;
use App\Models\Agenda;
use App\Models\AgendaStudentScore;
use App\Models\LearningObjective;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\TeacherAttendance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgendaController extends Controller
{
    public function myClasses(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;

        if (! $teacher) {
            return response()->json(['data' => []]);
        }

        $classIds = Schedule::where('teacher_id', $teacher->id)
            ->distinct()
            ->pluck('class_id');

        $classes = SchoolClass::whereIn('id', $classIds)
            ->orderBy('tingkat')
            ->orderBy('jurusan')
            ->orderBy('rombel')
            ->get()
            ->map(fn ($c) => [
                'label' => "{$c->tingkat->value} {$c->jurusan} - {$c->rombel}",
            ]);

        return response()->json(['data' => $classes]);
    }

    public function index(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;

        if (! $teacher) {
            return response()->json(['data' => [], 'meta' => ['total' => 0, 'current_page' => 1, 'last_page' => 1]]);
        }

        $query = Agenda::whereHas('schedule', fn ($q) => $q->where('teacher_id', $teacher->id))
            ->with(['schedule.subject', 'schedule.schoolClass', 'learningObjectives', 'studentScores.student.user'])
            ->orderByDesc('tanggal')
            ->orderByDesc('created_at');

        if ($request->filled('kelas')) {
            $kelas = $request->kelas;
            $query->whereHas('schedule.schoolClass', function ($q) use ($kelas) {
                $q->whereRaw("CONCAT(tingkat, ' ', jurusan, ' - ', rombel) ILIKE ?", ["%{$kelas}%"]);
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
            'tanggal'                   => ['required', 'date'],
            'resume_kbm'               => ['nullable', 'string', 'max:2000'],
            'learning_objective_ids'   => ['nullable', 'array'],
            'learning_objective_ids.*' => ['string'],
            'status'                   => ['sometimes', 'in:draft,submitted'],
            'student_scores'           => ['nullable', 'array'],
            'student_scores.*.student_id' => ['required', 'string'],
            'student_scores.*.nilai'      => ['required', 'integer'],
            'student_scores.*.catatan'    => ['nullable', 'string', 'max:500'],
        ]);

        $schedule = Schedule::where('uuid', $data['schedule_id'])->firstOrFail();

        $teacher = $request->user()->teacher;
        abort_if(! $teacher || $schedule->teacher_id !== $teacher->id, 403, 'Bukan jadwal Anda.');

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

        abort_if(! $teacher || $agenda->schedule->teacher_id !== $teacher->id, 403);

        return response()->json(['data' => new AgendaResource($agenda)]);
    }

    public function update(Request $request, string $uuid): JsonResponse
    {
        $teacher = $request->user()->teacher;
        $agenda  = Agenda::where('uuid', $uuid)->firstOrFail();

        abort_if(! $teacher || $agenda->schedule->teacher_id !== $teacher->id, 403);

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

        $agenda->load(['schedule.subject', 'schedule.schoolClass', 'learningObjectives', 'studentScores.student.user']);

        return response()->json([
            'message' => 'Agenda berhasil diperbarui.',
            'data'    => new AgendaResource($agenda),
        ]);
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
