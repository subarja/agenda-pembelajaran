<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\EwsStatus;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StudentAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Student::with(['user', 'schoolClass'])
            ->when($request->search, fn ($q, $s) =>
                $q->whereHas('user', fn ($u) => $u->where('nama', 'ilike', "%$s%"))
                  ->orWhere('nis', 'ilike', "%$s%")
                  ->orWhere('nisn', 'ilike', "%$s%")
            )
            ->when($request->class_id, fn ($q, $c) =>
                $q->whereHas('schoolClass', fn ($sc) => $sc->where('uuid', $c))
            )
            ->orderByDesc('id')
            ->paginate(30);

        return response()->json([
            'data' => $q->map(fn ($s) => $this->format($s)),
            'meta' => ['total' => $q->total(), 'current_page' => $q->currentPage(), 'last_page' => $q->lastPage()],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nama'        => ['required', 'string', 'max:100'],
            'email'       => ['nullable', 'email', 'unique:users,email'],
            'nis'         => ['required', 'string', 'max:20', 'unique:students,nis'],
            'nisn'        => ['nullable', 'string', 'max:10', 'unique:students,nisn'],
            'class_id'    => ['required', 'string'],
            'angkatan'    => ['nullable', 'integer', 'min:2000'],
            'wali_nama'   => ['nullable', 'string', 'max:100'],
            'wali_kontak' => ['nullable', 'string', 'max:20'],
            'password'    => ['nullable', 'string', 'min:8'],
        ]);

        $class = SchoolClass::where('uuid', $data['class_id'])->firstOrFail();

        $student = DB::transaction(function () use ($data, $class) {
            $email = $data['email'] ?? ($data['nis'] . '@smkn2cimahi.sch.id');
            $user  = User::create([
                'nama'     => $data['nama'],
                'email'    => $email,
                'password' => $data['password'] ?? 'password',
                'role'     => UserRole::Siswa,
                'status'   => UserStatus::Aktif,
            ]);
            $student = Student::create([
                'user_id'     => $user->id,
                'nis'         => $data['nis'],
                'nisn'        => $data['nisn'] ?? null,
                'class_id'    => $class->id,
                'angkatan'    => $data['angkatan'] ?? null,
                'wali_nama'   => $data['wali_nama'] ?? null,
                'wali_kontak' => $data['wali_kontak'] ?? null,
            ]);

            // Buat EwsStatus untuk tahun ajaran aktif
            $ay = AcademicYear::where('aktif', true)->first();
            if ($ay) {
                EwsStatus::firstOrCreate(
                    ['student_id' => $student->id, 'academic_year_id' => $ay->id],
                    ['level' => 'hijau', 'kehadiran_score' => 100, 'karakter_score' => 0]
                );
            }

            return $student;
        });

        return response()->json(['message' => 'Siswa berhasil ditambahkan.', 'data' => $this->format($student->load(['user', 'schoolClass']))], 201);
    }

    public function update(Request $request, string $uuid): JsonResponse
    {
        $student = Student::where('uuid', $uuid)->with(['user', 'schoolClass'])->firstOrFail();

        $data = $request->validate([
            'nama'        => ['sometimes', 'string', 'max:100'],
            'email'       => ['sometimes', 'email', 'unique:users,email,' . $student->user_id],
            'nis'         => ['sometimes', 'string', 'max:20', 'unique:students,nis,' . $student->id],
            'nisn'        => ['nullable', 'string', 'max:10', 'unique:students,nisn,' . $student->id],
            'class_id'    => ['sometimes', 'string'],
            'angkatan'    => ['nullable', 'integer'],
            'wali_nama'   => ['nullable', 'string', 'max:100'],
            'wali_kontak' => ['nullable', 'string', 'max:20'],
            'status'      => ['sometimes', 'in:aktif,nonaktif'],
            'password'    => ['nullable', 'string', 'min:8'],
        ]);

        DB::transaction(function () use ($student, $data) {
            $userFields = array_filter([
                'nama'     => $data['nama'] ?? null,
                'email'    => $data['email'] ?? null,
                'status'   => isset($data['status']) ? UserStatus::from($data['status']) : null,
                'password' => $data['password'] ?? null,
            ]);
            if (! empty($userFields)) $student->user->update($userFields);

            $sFields = [];
            if (isset($data['nis']))         $sFields['nis']         = $data['nis'];
            if (array_key_exists('nisn', $data)) $sFields['nisn']    = $data['nisn'];
            if (isset($data['class_id']))    $sFields['class_id']    = SchoolClass::where('uuid', $data['class_id'])->value('id');
            if (isset($data['angkatan']))    $sFields['angkatan']    = $data['angkatan'];
            if (array_key_exists('wali_nama', $data))   $sFields['wali_nama']   = $data['wali_nama'];
            if (array_key_exists('wali_kontak', $data)) $sFields['wali_kontak'] = $data['wali_kontak'];
            if (! empty($sFields)) $student->update($sFields);
        });

        return response()->json(['message' => 'Data siswa diperbarui.', 'data' => $this->format($student->fresh(['user', 'schoolClass']))]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $student = Student::where('uuid', $uuid)->with('user')->firstOrFail();
        DB::transaction(function () use ($student) {
            $student->delete();
            $student->user->update(['status' => UserStatus::NonAktif]);
        });

        return response()->json(['message' => 'Siswa dinonaktifkan.']);
    }

    private function format(Student $s): array
    {
        return [
            'id'          => $s->uuid,
            'nama'        => $s->user->nama,
            'email'       => $s->user->email,
            'status'      => $s->user->status->value,
            'nis'         => $s->nis,
            'nisn'        => $s->nisn,
            'angkatan'    => $s->angkatan,
            'wali_nama'   => $s->wali_nama,
            'wali_kontak' => $s->wali_kontak,
            'kelas'       => $s->schoolClass ? [
                'id'    => $s->schoolClass->uuid,
                'label' => $s->schoolClass->tingkat->value . ' ' . $s->schoolClass->jurusan . ' - ' . $s->schoolClass->rombel,
            ] : null,
        ];
    }
}
