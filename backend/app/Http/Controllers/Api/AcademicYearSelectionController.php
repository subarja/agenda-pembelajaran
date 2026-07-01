<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\AcademicYear;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AcademicYearSelectionController extends Controller
{
    // GET /academic-years/pilihan — daftar tahun ajaran untuk dropdown semester di
    // form login (endpoint publik — dipanggil sebelum user login)
    public function pilihan(): JsonResponse
    {
        $years = AcademicYear::orderByDesc('aktif')->orderByDesc('tahun')->orderBy('semester')->get()
            ->map(fn ($y) => [
                'id'       => $y->uuid,
                'tahun'    => $y->tahun,
                'semester' => $y->semester->value,
                'label'    => $y->tahun . ' - ' . ucfirst($y->semester->value),
                'aktif'    => $y->aktif,
            ]);

        return response()->json(['data' => $years]);
    }

    // POST /academic-years/pilih — ganti semester kerja user setelah login (mis.
    // dari halaman /pilih-tahun-ajaran, dipakai sebagai fallback kalau
    // current_academic_year_id kosong)
    public function pilih(Request $request): JsonResponse
    {
        $data = $request->validate([
            'academic_year_id' => ['required', 'string', 'exists:academic_years,uuid'],
        ]);

        $ay   = AcademicYear::where('uuid', $data['academic_year_id'])->firstOrFail();
        $user = $request->user();
        $user->update(['current_academic_year_id' => $ay->id]);
        $user->loadProfileRelation();

        return response()->json([
            'message' => 'Tahun ajaran dipilih.',
            'data'    => new UserResource($user),
        ]);
    }
}
