<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\Tingkat;
use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\SchoolClass;
use App\Models\Teacher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClassAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // Default TA aktif; `academic_year_id` (uuid) membuka kelas TA lain — dipakai
        // tab Kelas untuk melihat arsip roster tahun-tahun sebelumnya.
        $ay = $request->filled('academic_year_id')
            ? AcademicYear::where('uuid', $request->academic_year_id)->first()
            : \App\Support\TahunAjaran::current();

        $classes = SchoolClass::with(['waliKelas', 'academicYear'])
            ->when($ay, fn ($q) => $q->where('academic_year_id', $ay->id))
            ->orderBy('tingkat')->orderBy('jurusan')->orderBy('rombel')
            ->get()
            ->map(fn ($c) => $this->format($c));

        return response()->json(['data' => $classes]);
    }

    /**
     * GET /admin/classes/{uuid}/roster — anggota kelas dari riwayat enrollment
     * (bukan students.class_id), sehingga kelas TA lama tetap punya daftar siswa
     * lengkap dengan bagaimana keanggotaannya berakhir (naik/tinggal/lulus/pindah).
     */
    public function roster(string $uuid): JsonResponse
    {
        $class = SchoolClass::where('uuid', $uuid)->with('academicYear')->firstOrFail();

        $rows = \App\Models\ClassEnrollment::where('class_id', $class->id)
            ->with(['student.user:id,nama'])
            ->get()
            ->map(fn ($e) => [
                'id'     => $e->student->uuid,
                'nama'   => $e->student->user->nama,
                'nis'    => $e->student->nis,
                'status' => $e->status,
            ])
            ->sortBy('nama')
            ->values();

        return response()->json(['data' => [
            'kelas'  => $this->format($class),
            'siswa'  => $rows,
        ]]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tingkat'          => ['required', 'in:X,XI,XII'],
            'jurusan'          => ['required', 'string', 'max:100'],
            'rombel'           => ['required', 'string', 'max:10'],
            'wali_kelas_id'    => ['nullable', 'string'],
            'academic_year_id' => ['nullable', 'string'],
        ]);

        // Field opsional: `nullable` TIDAK menambahkan key ke $data bila absen dari body —
        // pakai ?? null supaya create tanpa TA/wali kelas tidak crash (dulu 500).
        $ayId = ($data['academic_year_id'] ?? null)
            ? AcademicYear::where('uuid', $data['academic_year_id'])->value('id')
            : \App\Support\TahunAjaran::id();

        abort_if(! $ayId, 422, 'Tahun ajaran aktif tidak ditemukan.');

        $waliId = ($data['wali_kelas_id'] ?? null)
            ? Teacher::where('uuid', $data['wali_kelas_id'])->value('user_id')
            : null;

        $class = SchoolClass::create([
            'tingkat'          => Tingkat::from($data['tingkat']),
            'jurusan'          => $data['jurusan'],
            'rombel'           => $data['rombel'],
            'wali_kelas_id'    => $waliId,
            'academic_year_id' => $ayId,
        ]);

        return response()->json(['message' => 'Kelas berhasil dibuat.', 'data' => $this->format($class->load(['waliKelas', 'academicYear']))], 201);
    }

    public function update(Request $request, string $uuid): JsonResponse
    {
        $class = SchoolClass::where('uuid', $uuid)->firstOrFail();
        $data  = $request->validate([
            'tingkat'       => ['sometimes', 'in:X,XI,XII'],
            'jurusan'       => ['sometimes', 'string', 'max:100'],
            'rombel'        => ['sometimes', 'string', 'max:10'],
            'wali_kelas_id' => ['nullable', 'string'],
        ]);

        $fields = array_filter([
            'tingkat' => isset($data['tingkat']) ? Tingkat::from($data['tingkat']) : null,
            'jurusan' => $data['jurusan'] ?? null,
            'rombel'  => $data['rombel'] ?? null,
        ]);
        if (array_key_exists('wali_kelas_id', $data)) {
            $fields['wali_kelas_id'] = $data['wali_kelas_id']
                ? Teacher::where('uuid', $data['wali_kelas_id'])->value('user_id')
                : null;
        }

        $class->update($fields);

        return response()->json(['message' => 'Kelas diperbarui.', 'data' => $this->format($class->fresh(['waliKelas', 'academicYear']))]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $class = SchoolClass::where('uuid', $uuid)->firstOrFail();
        abort_if($class->students()->count() > 0, 422, 'Kelas masih memiliki siswa aktif.');
        $class->delete();

        return response()->json(['message' => 'Kelas dihapus.']);
    }

    private function format(SchoolClass $c): array
    {
        return [
            'id'           => $c->uuid,
            'tingkat'      => $c->tingkat->value,
            'jurusan'      => $c->jurusan,
            'rombel'       => $c->rombel,
            'label'        => $c->label(),
            'wali_kelas'   => $c->waliKelas ? ['id' => $c->waliKelas->uuid, 'nama' => $c->waliKelas->nama] : null,
            'tahun_ajaran' => $c->academicYear ? $c->academicYear->tahun . ' ' . $c->academicYear->semester->value : null,
            'jumlah_siswa' => $c->students()->count(),
        ];
    }
}
