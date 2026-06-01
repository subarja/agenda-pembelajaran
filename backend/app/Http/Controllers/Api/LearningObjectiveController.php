<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\LearningObjectiveResource;
use App\Models\LearningObjective;
use App\Models\Schedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class LearningObjectiveController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->filled('schedule_id')) {
            $schedule  = Schedule::where('uuid', $request->schedule_id)->firstOrFail();
            $semester  = Carbon::now('Asia/Jakarta')->month <= 6 ? 'genap' : 'ganjil';
            $objectives = LearningObjective::where('class_id', $schedule->class_id)
                ->where('subject_id', $schedule->subject_id)
                ->where('semester', $semester)
                ->where('aktif', true)
                ->orderBy('urutan')
                ->get();
            return response()->json(['data' => LearningObjectiveResource::collection($objectives)]);
        }

        $request->validate([
            'class_id'   => ['required', 'string'],
            'subject_id' => ['required', 'string'],
            'semester'   => ['sometimes', 'in:ganjil,genap'],
        ]);

        $class   = \App\Models\SchoolClass::where('uuid', $request->class_id)->firstOrFail();
        $subject = \App\Models\Subject::where('uuid', $request->subject_id)->firstOrFail();

        $objectives = LearningObjective::where('class_id', $class->id)
            ->where('subject_id', $subject->id)
            ->when($request->filled('semester'), fn ($q) => $q->where('semester', $request->semester))
            ->orderBy('semester')->orderBy('urutan')
            ->get();

        return response()->json(['data' => LearningObjectiveResource::collection($objectives)]);
    }

    public function myContexts(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403);

        $contexts = $teacher->schedules()
            ->where('aktif', true)
            ->with(['schoolClass', 'subject'])
            ->get()
            ->map(fn ($s) => [
                'class_id'     => $s->schoolClass->uuid,
                'class_label'  => "{$s->schoolClass->tingkat->value} {$s->schoolClass->jurusan} - {$s->schoolClass->rombel}",
                'subject_id'   => $s->subject->uuid,
                'subject_nama' => $s->subject->nama,
                'subject_kode' => $s->subject->kode,
            ])
            ->unique(fn ($item) => $item['class_id'] . '-' . $item['subject_id'])
            ->values();

        return response()->json(['data' => $contexts]);
    }

    public function store(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403);

        $data = $request->validate([
            'class_id'   => ['required', 'string'],
            'subject_id' => ['required', 'string'],
            'kode'       => ['required', 'string', 'max:20'],
            'deskripsi'  => ['required', 'string', 'max:500'],
            'urutan'     => ['required', 'integer', 'min:1'],
            'semester'   => ['required', 'in:ganjil,genap'],
        ]);

        $class   = \App\Models\SchoolClass::where('uuid', $data['class_id'])->firstOrFail();
        $subject = \App\Models\Subject::where('uuid', $data['subject_id'])->firstOrFail();

        abort_if(
            LearningObjective::where('class_id', $class->id)
                ->where('subject_id', $subject->id)
                ->where('kode', $data['kode'])
                ->where('semester', $data['semester'])
                ->exists(),
            422,
            'Kode TP sudah ada untuk kelas, mapel, dan semester yang sama.'
        );

        $lo = LearningObjective::create([
            'teacher_id' => $teacher->id,
            'class_id'   => $class->id,
            'subject_id' => $subject->id,
            'kode'       => $data['kode'],
            'deskripsi'  => $data['deskripsi'],
            'urutan'     => $data['urutan'],
            'semester'   => $data['semester'],
            'aktif'      => true,
        ]);

        return response()->json([
            'message' => 'Tujuan Pembelajaran berhasil ditambahkan.',
            'data'    => new LearningObjectiveResource($lo),
        ], 201);
    }

    public function update(Request $request, string $uuid): JsonResponse
    {
        $teacher = $request->user()->teacher;
        $lo      = LearningObjective::where('uuid', $uuid)->firstOrFail();
        abort_if(! $teacher || $lo->teacher_id !== $teacher->id, 403);

        $data = $request->validate([
            'kode'      => ['sometimes', 'string', 'max:20'],
            'deskripsi' => ['sometimes', 'string', 'max:500'],
            'urutan'    => ['sometimes', 'integer', 'min:1'],
            'semester'  => ['sometimes', 'in:ganjil,genap'],
            'aktif'     => ['sometimes', 'boolean'],
        ]);

        $lo->update($data);

        return response()->json([
            'message' => 'Tujuan Pembelajaran berhasil diperbarui.',
            'data'    => new LearningObjectiveResource($lo->fresh()),
        ]);
    }

    public function destroy(Request $request, string $uuid): JsonResponse
    {
        $teacher = $request->user()->teacher;
        $lo      = LearningObjective::where('uuid', $uuid)->firstOrFail();
        abort_if(! $teacher || $lo->teacher_id !== $teacher->id, 403);

        $lo->delete();

        return response()->json(['message' => 'Tujuan Pembelajaran berhasil dihapus.']);
    }
}
