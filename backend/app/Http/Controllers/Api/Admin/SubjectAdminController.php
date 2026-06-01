<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\SubjectKelompok;
use App\Http\Controllers\Controller;
use App\Models\Subject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubjectAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $subjects = Subject::when($request->search, fn ($q, $s) =>
                $q->where('nama', 'ilike', "%$s%")->orWhere('kode', 'ilike', "%$s%")
            )
            ->orderBy('kelompok')->orderBy('nama')
            ->get()
            ->map(fn ($s) => [
                'id'       => $s->uuid,
                'kode'     => $s->kode,
                'nama'     => $s->nama,
                'kelompok' => $s->kelompok->value,
                'aktif'    => $s->aktif,
            ]);

        return response()->json(['data' => $subjects]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kode'     => ['required', 'string', 'max:20', 'unique:subjects,kode'],
            'nama'     => ['required', 'string', 'max:100'],
            'kelompok' => ['required', 'in:normatif,adaptif,produktif,muatan_lokal'],
            'aktif'    => ['boolean'],
        ]);

        $subject = Subject::create([
            'kode'     => $data['kode'],
            'nama'     => $data['nama'],
            'kelompok' => SubjectKelompok::from($data['kelompok']),
            'aktif'    => $data['aktif'] ?? true,
        ]);

        return response()->json(['message' => 'Mata pelajaran berhasil dibuat.', 'data' => ['id' => $subject->uuid, 'kode' => $subject->kode, 'nama' => $subject->nama, 'kelompok' => $subject->kelompok->value, 'aktif' => $subject->aktif]], 201);
    }

    public function update(Request $request, string $uuid): JsonResponse
    {
        $subject = Subject::where('uuid', $uuid)->firstOrFail();
        $data    = $request->validate([
            'kode'     => ['sometimes', 'string', 'max:20', 'unique:subjects,kode,' . $subject->id],
            'nama'     => ['sometimes', 'string', 'max:100'],
            'kelompok' => ['sometimes', 'in:normatif,adaptif,produktif,muatan_lokal'],
            'aktif'    => ['sometimes', 'boolean'],
        ]);

        if (isset($data['kelompok'])) $data['kelompok'] = SubjectKelompok::from($data['kelompok']);
        $subject->update($data);

        return response()->json(['message' => 'Mata pelajaran diperbarui.', 'data' => ['id' => $subject->uuid, 'kode' => $subject->kode, 'nama' => $subject->nama, 'kelompok' => $subject->kelompok->value, 'aktif' => $subject->aktif]]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $subject = Subject::where('uuid', $uuid)->firstOrFail();
        abort_if($subject->schedules()->count() > 0, 422, 'Mata pelajaran masih terhubung dengan jadwal.');
        $subject->delete();

        return response()->json(['message' => 'Mata pelajaran dihapus.']);
    }
}
