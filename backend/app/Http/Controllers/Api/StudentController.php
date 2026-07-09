<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Support\ClassAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class StudentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'class_id' => ['nullable', 'string'],
            'search'   => ['nullable', 'string', 'min:2', 'max:50'],
        ]);

        $user = $request->user();

        // Endpoint ini DULU tanpa otorisasi sama sekali: akun siswa pun bisa menelusuri
        // seluruh siswa sekolah lengkap NIS dan URL fotonya (audit 2026-07-09). Siswa &
        // orang tua tidak pernah punya alasan sah membaca daftar siswa lain.
        abort_if(ClassAccess::isStudentSide($user), 403, 'Akses tidak diizinkan.');

        // Per kelas (untuk form presensi / nilai / grid karakter GK25) — urut nama
        // A-Z, nomor absen = urutan alfabetis (tidak ada kolom nomor absen tersendiri
        // di skema, jadi index urut nama dipakai sebagai representasinya).
        if ($request->filled('class_id')) {
            $class = SchoolClass::where('uuid', $request->class_id)->firstOrFail();

            // Daftar absen sebuah kelas hanya untuk yang mengajar atau mewalikelasinya.
            abort_unless(
                ClassAccess::allows(ClassAccess::teachingClassIds($user), $class->id),
                403, 'Anda tidak mengajar atau mewalikelasi kelas ini.',
            );

            $students = $class->students()
                ->with('user:id,nama')
                ->get()
                ->sortBy(fn ($s) => $s->user->nama)
                ->values()
                ->map(fn ($s, $i) => [
                    'id'         => $s->uuid,
                    'nis'        => $s->nis,
                    'nama'       => $s->user->nama,
                    'kelas'      => null,
                    'nomor_absen'=> $i + 1,
                    'foto_url'   => $s->foto ? Storage::disk('public')->url($s->foto) : null,
                ]);

            return response()->json(['data' => $students]);
        }

        // Pencarian global (untuk input karakter). SENGAJA lintas kelas untuk SELURUH
        // guru — prinsip produk "karakter sebagai aset kolektif": guru piket yang
        // memergoki pelanggaran siswa di luar kelasnya harus tetap bisa mencatatnya.
        // Yang dijaga di sini adalah PERAN pemanggil (abort_if di atas), bukan kelasnya.
        abort_if(! $request->filled('search'), 422, 'Parameter class_id atau search wajib diisi.');

        $keyword = $request->search;

        $students = Student::whereHas('user', fn ($q) => $q->whereLikeCi('nama', $keyword))
            ->orWhereLikeCi('nis', $keyword)
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
                'foto_url' => $s->foto ? Storage::disk('public')->url($s->foto) : null,
            ]);

        return response()->json(['data' => $students]);
    }
}
