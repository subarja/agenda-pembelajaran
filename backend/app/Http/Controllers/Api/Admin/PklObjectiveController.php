<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PklObjective;
use App\Models\SchoolClass;
use App\Support\PklMode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * CRUD Tujuan Pembelajaran khusus PKL (admin). jurusan kosong = berlaku semua jurusan.
 */
class PklObjectiveController extends Controller
{
    public function index(): JsonResponse
    {
        $ayId = PklMode::activeAcademicYearId();

        $items = PklObjective::when($ayId, fn ($q) => $q->where('academic_year_id', $ayId))
            ->orderByRaw('jurusan IS NOT NULL')   // yang umum (NULL) dulu
            ->orderBy('jurusan')
            ->orderBy('id')
            ->get()
            ->map(fn ($o) => $this->format($o));

        return response()->json([
            'data'     => $items,
            'jurusans' => $this->jurusanList(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $ayId = PklMode::activeAcademicYearId();
        abort_if(! $ayId, 422, 'Belum ada tahun ajaran aktif.');

        $obj = PklObjective::create($data + ['academic_year_id' => $ayId, 'aktif' => true]);

        return response()->json(['message' => 'TP PKL ditambahkan.', 'data' => $this->format($obj)], 201);
    }

    public function update(Request $request, string $uuid): JsonResponse
    {
        $obj  = PklObjective::where('uuid', $uuid)->firstOrFail();
        $data = $this->validated($request);

        if ($request->has('aktif')) {
            $data['aktif'] = $request->boolean('aktif');
        }

        $obj->update($data);

        return response()->json(['message' => 'TP PKL diperbarui.', 'data' => $this->format($obj->fresh())]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        PklObjective::where('uuid', $uuid)->firstOrFail()->delete();

        return response()->json(['message' => 'TP PKL dihapus.']);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'deskripsi' => ['required', 'string', 'max:500'],
            'jurusan'   => ['nullable', 'string', 'max:100'],
        ]);

        // String kosong dari form → NULL (berlaku semua jurusan).
        $data['jurusan'] = ($data['jurusan'] ?? '') === '' ? null : $data['jurusan'];

        return $data;
    }

    /** Daftar jurusan distinct pada tahun ajaran aktif — untuk selector "Berlaku untuk". */
    private function jurusanList(): array
    {
        return SchoolClass::where('academic_year_id', \App\Support\TahunAjaran::id())
            ->distinct()
            ->orderBy('jurusan')
            ->pluck('jurusan')
            ->filter()
            ->values()
            ->all();
    }

    private function format(PklObjective $o): array
    {
        return [
            'id'        => $o->uuid,
            'deskripsi' => $o->deskripsi,
            'jurusan'   => $o->jurusan,          // null = semua jurusan
            'aktif'     => $o->aktif,
        ];
    }
}
