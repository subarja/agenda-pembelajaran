<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use App\Models\Student;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'class_id' => ['nullable', 'string'],
            'search'   => ['nullable', 'string', 'min:2', 'max:50'],
        ]);

        // Per kelas (untuk form presensi / nilai)
        if ($request->filled('class_id')) {
            $class    = SchoolClass::where('uuid', $request->class_id)->firstOrFail();
            $students = $class->students()
                ->with('user:id,nama')
                ->orderBy('nis')
                ->get()
                ->map(fn ($s) => [
                    'id'    => $s->uuid,
                    'nis'   => $s->nis,
                    'nama'  => $s->user->nama,
                    'kelas' => null,
                ]);

            return response()->json(['data' => $students]);
        }

        // Pencarian global (untuk input karakter)
        abort_if(! $request->filled('search'), 422, 'Parameter class_id atau search wajib diisi.');

        $keyword = '%' . $request->search . '%';

        $students = Student::whereHas('user', fn ($q) => $q->where('nama', 'ilike', $keyword))
            ->orWhere('nis', 'ilike', $keyword)
            ->with(['user:id,nama', 'schoolClass'])
            ->limit(15)
            ->get()
            ->map(fn ($s) => [
                'id'    => $s->uuid,
                'nis'   => $s->nis,
                'nama'  => $s->user->nama,
                'kelas' => $s->schoolClass
                    ? "{$s->schoolClass->tingkat->value} {$s->schoolClass->jurusan} - {$s->schoolClass->rombel}"
                    : null,
            ]);

        return response()->json(['data' => $students]);
    }
}
