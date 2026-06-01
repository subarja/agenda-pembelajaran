<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AcademicYearController extends Controller
{
    public function index(): JsonResponse
    {
        $years = AcademicYear::orderByDesc('tahun')->orderBy('semester')->get()
            ->map(fn ($y) => [
                'id'       => $y->uuid,
                'tahun'    => $y->tahun,
                'semester' => $y->semester->value,
                'aktif'    => $y->aktif,
            ]);

        return response()->json(['data' => $years]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tahun'    => ['required', 'string', 'max:10'],
            'semester' => ['required', 'in:ganjil,genap'],
            'aktif'    => ['boolean'],
        ]);

        if (! empty($data['aktif'])) {
            AcademicYear::where('aktif', true)->update(['aktif' => false]);
        }

        $ay = AcademicYear::create($data);

        return response()->json(['message' => 'Tahun ajaran berhasil dibuat.', 'data' => ['id' => $ay->uuid, 'tahun' => $ay->tahun, 'semester' => $ay->semester->value, 'aktif' => $ay->aktif]], 201);
    }

    public function update(Request $request, string $uuid): JsonResponse
    {
        $ay   = AcademicYear::where('uuid', $uuid)->firstOrFail();
        $data = $request->validate([
            'tahun'    => ['sometimes', 'string', 'max:10'],
            'semester' => ['sometimes', 'in:ganjil,genap'],
            'aktif'    => ['sometimes', 'boolean'],
        ]);

        if (! empty($data['aktif'])) {
            AcademicYear::where('aktif', true)->where('id', '!=', $ay->id)->update(['aktif' => false]);
        }

        $ay->update($data);

        return response()->json(['message' => 'Tahun ajaran diperbarui.', 'data' => ['id' => $ay->uuid, 'tahun' => $ay->tahun, 'semester' => $ay->semester->value, 'aktif' => $ay->aktif]]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $ay = AcademicYear::where('uuid', $uuid)->firstOrFail();
        abort_if($ay->aktif, 422, 'Tahun ajaran aktif tidak dapat dihapus.');
        $ay->delete();

        return response()->json(['message' => 'Tahun ajaran dihapus.']);
    }
}
