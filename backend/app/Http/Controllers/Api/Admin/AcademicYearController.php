<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AcademicYearController extends Controller
{
    // Identitas Wk. Kurikulum & Kepala Sekolah dipakai sebagai penanda tangan laporan
    // Minggu Efektif (per kelas/umum) — disimpan per baris AcademicYear karena bisa beda
    // orang tiap semester.
    private const PEJABAT_RULES = [
        'wk_kurikulum_gelar_depan'      => ['sometimes', 'nullable', 'string', 'max:50'],
        'wk_kurikulum_nama'             => ['sometimes', 'nullable', 'string', 'max:100'],
        'wk_kurikulum_gelar_belakang'   => ['sometimes', 'nullable', 'string', 'max:100'],
        'wk_kurikulum_nip'              => ['sometimes', 'nullable', 'string', 'max:30'],
        'kepala_sekolah_gelar_depan'    => ['sometimes', 'nullable', 'string', 'max:50'],
        'kepala_sekolah_nama'           => ['sometimes', 'nullable', 'string', 'max:100'],
        'kepala_sekolah_gelar_belakang' => ['sometimes', 'nullable', 'string', 'max:100'],
        'kepala_sekolah_nip'            => ['sometimes', 'nullable', 'string', 'max:30'],
    ];

    public function index(): JsonResponse
    {
        $years = AcademicYear::orderByDesc('tahun')->orderBy('semester')->get()
            ->map(fn ($y) => $this->format($y));

        return response()->json(['data' => $years]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === UserRole::Admin, 403, 'Hanya admin yang dapat membuat tahun pelajaran.');

        $data = $request->validate([
            'tahun'           => ['required', 'string', 'max:10'],
            'semester'        => ['required', 'in:ganjil,genap'],
            'aktif'           => ['boolean'],
            'tanggal_mulai'   => ['nullable', 'date'],
            'tanggal_selesai' => ['nullable', 'date', 'after_or_equal:tanggal_mulai'],
            ...self::PEJABAT_RULES,
        ]);

        if (! empty($data['aktif'])) {
            AcademicYear::where('aktif', true)->update(['aktif' => false]);
        }

        $ay = AcademicYear::create($data);

        return response()->json(['message' => 'Tahun ajaran berhasil dibuat.', 'data' => $this->format($ay)], 201);
    }

    public function update(Request $request, string $uuid): JsonResponse
    {
        abort_unless($request->user()->role === UserRole::Admin, 403, 'Hanya admin yang dapat mengubah tahun pelajaran.');

        $ay   = AcademicYear::where('uuid', $uuid)->firstOrFail();
        $data = $request->validate([
            'tahun'           => ['sometimes', 'string', 'max:10'],
            'semester'        => ['sometimes', 'in:ganjil,genap'],
            'aktif'           => ['sometimes', 'boolean'],
            'locked'          => ['sometimes', 'boolean'],
            'tanggal_mulai'   => ['sometimes', 'nullable', 'date'],
            'tanggal_selesai' => ['sometimes', 'nullable', 'date', 'after_or_equal:tanggal_mulai'],
            ...self::PEJABAT_RULES,
        ]);

        // Kunci semester: TA aktif tidak boleh dikunci (semua orang sedang menulis ke
        // sana), dan TA terkunci tidak boleh diaktifkan tanpa dibuka dulu — dua aturan
        // ini yang menjadikan "terkunci" benar-benar berarti arsip beku.
        if (! empty($data['locked'])) {
            abort_if($ay->aktif, 422,
                'Tahun ajaran aktif tidak bisa dikunci. Aktifkan tahun ajaran lain dulu.');
        }
        if (! empty($data['aktif'])) {
            $akanTerkunci = $data['locked'] ?? $ay->locked;
            abort_if($akanTerkunci, 422,
                'Tahun ajaran ini terkunci (arsip). Buka kuncinya dulu sebelum diaktifkan.');
            AcademicYear::where('aktif', true)->where('id', '!=', $ay->id)->update(['aktif' => false]);
        }

        $ay->update($data);

        return response()->json(['message' => 'Tahun ajaran diperbarui.', 'data' => $this->format($ay)]);
    }

    private function format(AcademicYear $y): array
    {
        return [
            'id'              => $y->uuid,
            'tahun'           => $y->tahun,
            'semester'        => $y->semester->value,
            'aktif'           => $y->aktif,
            'locked'          => $y->locked,
            'tanggal_mulai'   => $y->tanggal_mulai?->format('Y-m-d'),
            'tanggal_selesai' => $y->tanggal_selesai?->format('Y-m-d'),
            'wk_kurikulum_gelar_depan'      => $y->wk_kurikulum_gelar_depan,
            'wk_kurikulum_nama'             => $y->wk_kurikulum_nama,
            'wk_kurikulum_gelar_belakang'   => $y->wk_kurikulum_gelar_belakang,
            'wk_kurikulum_nip'              => $y->wk_kurikulum_nip,
            'kepala_sekolah_gelar_depan'    => $y->kepala_sekolah_gelar_depan,
            'kepala_sekolah_nama'           => $y->kepala_sekolah_nama,
            'kepala_sekolah_gelar_belakang' => $y->kepala_sekolah_gelar_belakang,
            'kepala_sekolah_nip'            => $y->kepala_sekolah_nip,
        ];
    }

    public function destroy(Request $request, string $uuid): JsonResponse
    {
        abort_unless($request->user()->role === UserRole::Admin, 403, 'Hanya admin yang dapat menghapus tahun pelajaran.');

        $ay = AcademicYear::where('uuid', $uuid)->firstOrFail();
        abort_if($ay->aktif, 422, 'Tahun ajaran aktif tidak dapat dihapus.');
        $ay->delete();

        return response()->json(['message' => 'Tahun ajaran dihapus.']);
    }
}
