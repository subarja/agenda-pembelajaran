<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use App\Models\Student;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Edit foto DAN data profil siswa individual — dipakai DUA jalur: admin (lewat modal edit
 * siswa di Panel Admin, CRUD lengkap tetap di sana) dan wali kelas (lewat halaman "Data
 * Siswa Kelas Saya", HANYA utk siswa di kelas yang ia walikan — awalnya cuma foto, sekarang
 * ditambah edit profil dasar per Isu GK4). Siswa sendiri TIDAK bisa akses endpoint ini sama
 * sekali — lihat juga guard di ProfileController::updatePhoto() yang menolak role siswa.
 *
 * Wali kelas SENGAJA tidak boleh ubah `class_id` (pindah kelas) atau `password` lewat sini
 * — itu tetap privilese admin murni via StudentAdminController::update(), supaya perpindahan
 * kelas & reset password tetap terpusat/teraudit di Panel Admin.
 */
class StudentPhotoController extends Controller
{
    private const MAX_KB = 50;

    // GET /my-class/students — daftar siswa di kelas yang diwalikan user saat ini
    public function myClassStudents(Request $request): JsonResponse
    {
        $user = $request->user();

        $kelas = SchoolClass::where('wali_kelas_id', $user->id)
            ->whereHas('academicYear', fn ($q) => $q->where('aktif', true))
            ->first();

        abort_unless($kelas, 403, 'Anda bukan wali kelas aktif — halaman ini hanya untuk wali kelas.');

        $students = Student::where('class_id', $kelas->id)
            ->join('users', 'users.id', '=', 'students.user_id')
            ->select('students.*')
            ->with('user')
            ->orderBy('users.nama')
            ->get();

        return response()->json([
            'data' => $students->map(fn (Student $s) => $this->format($s)),
            'kelas' => [
                'id'    => $kelas->uuid,
                'label' => "{$kelas->tingkat->value} {$kelas->jurusan} - {$kelas->rombel}",
            ],
        ]);
    }

    // POST /students/{uuid}/photo — admin (semua siswa) atau wali kelas (siswa di kelasnya saja)
    public function update(Request $request, string $uuid): JsonResponse
    {
        $student = Student::where('uuid', $uuid)->with(['user', 'schoolClass'])->firstOrFail();
        $user    = $request->user();

        $isAdmin = in_array($user->role->value, ['admin', 'wakasek'], true);
        $isWali  = $student->schoolClass && $student->schoolClass->wali_kelas_id === $user->id;
        abort_unless($isAdmin || $isWali, 403, 'Anda tidak memiliki akses mengubah foto siswa ini.');

        $request->validate([
            'foto' => ['required', 'image', 'mimes:jpg,jpeg,png', 'max:'.self::MAX_KB],
        ]);

        if ($student->foto && Storage::disk('public')->exists($student->foto)) {
            Storage::disk('public')->delete($student->foto);
        }

        $path = $request->file('foto')->store('foto_siswa', 'public');
        $student->update(['foto' => $path]);

        return response()->json([
            'message'  => 'Foto siswa berhasil diperbarui.',
            'foto_url' => Storage::disk('public')->url($path),
        ]);
    }

    // PUT /students/{uuid}/profile — admin (semua siswa) atau wali kelas (siswa di kelasnya saja)
    public function updateProfile(Request $request, string $uuid): JsonResponse
    {
        $student = Student::where('uuid', $uuid)->with(['user', 'schoolClass'])->firstOrFail();
        $user    = $request->user();

        $isAdmin = in_array($user->role->value, ['admin', 'wakasek'], true);
        $isWali  = $student->schoolClass && $student->schoolClass->wali_kelas_id === $user->id;
        abort_unless($isAdmin || $isWali, 403, 'Anda tidak memiliki akses mengubah data siswa ini.');

        $data = $request->validate([
            'nama'          => ['sometimes', 'string', 'max:100'],
            'email'         => ['sometimes', 'email', 'unique:users,email,'.$student->user_id],
            'nis'           => ['sometimes', 'string', 'max:20', 'unique:students,nis,'.$student->id],
            'nisn'          => ['nullable', 'string', 'max:10', 'unique:students,nisn,'.$student->id],
            'jenis_kelamin' => ['nullable', 'in:L,P'],
            'angkatan'      => ['nullable', 'integer'],
            'wali_nama'     => ['nullable', 'string', 'max:100'],
            'wali_kontak'   => ['nullable', 'string', 'max:20'],
        ]);

        \Illuminate\Support\Facades\DB::transaction(function () use ($student, $data) {
            $userFields = array_filter([
                'nama'  => $data['nama'] ?? null,
                'email' => $data['email'] ?? null,
            ]);
            if (! empty($userFields)) {
                $student->user->update($userFields);
            }

            $sFields = [];
            if (isset($data['nis']))                     $sFields['nis'] = $data['nis'];
            if (array_key_exists('nisn', $data))          $sFields['nisn'] = $data['nisn'];
            if (array_key_exists('jenis_kelamin', $data)) $sFields['jenis_kelamin'] = $data['jenis_kelamin'];
            if (isset($data['angkatan']))                 $sFields['angkatan'] = $data['angkatan'];
            if (array_key_exists('wali_nama', $data))     $sFields['wali_nama'] = $data['wali_nama'];
            if (array_key_exists('wali_kontak', $data))   $sFields['wali_kontak'] = $data['wali_kontak'];
            if (! empty($sFields)) $student->update($sFields);
        });

        return response()->json([
            'message' => 'Data siswa diperbarui.',
            'data'    => $this->format($student->fresh(['user', 'schoolClass'])),
        ]);
    }

    private function format(Student $s): array
    {
        return [
            'id'          => $s->uuid,
            'nama'        => $s->user->nama,
            'email'       => $s->user->email,
            'nis'         => $s->nis,
            'nisn'        => $s->nisn,
            'jenis_kelamin' => $s->jenis_kelamin,
            'angkatan'    => $s->angkatan,
            'wali_nama'   => $s->wali_nama,
            'wali_kontak' => $s->wali_kontak,
            'foto_url'    => $s->foto ? Storage::disk('public')->url($s->foto) : null,
        ];
    }
}
