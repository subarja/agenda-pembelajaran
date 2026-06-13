<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class TeacherAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Teacher::query()
            ->join('users', 'users.id', '=', 'teachers.user_id')
            ->select('teachers.*')
            ->with('user')
            ->when($request->search, fn ($q, $s) =>
                $q->where(fn ($inner) =>
                    $inner->where('users.nama', 'ilike', "%$s%")
                          ->orWhere('teachers.nip', 'ilike', "%$s%")
                )
            )
            ->orderByDesc('teachers.id')
            ->paginate(20);

        return response()->json([
            'data' => $q->map(fn ($t) => $this->format($t)),
            'meta' => ['total' => $q->total(), 'current_page' => $q->currentPage(), 'last_page' => $q->lastPage(), 'per_page' => $q->perPage()],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nama'           => ['required', 'string', 'max:100'],
            'email'          => ['required', 'email', 'unique:users,email'],
            'nip'            => ['required', 'string', 'max:20', 'unique:teachers,nip'],
            'mapel_utama'    => ['required', 'string', 'max:100'],
            'role'           => ['required', 'in:guru,wali_kelas,wakasek,bk'],
            'nomor_hp'       => ['nullable', 'string', 'max:20'],
            'password'       => ['nullable', 'string', 'min:8'],
            'gelar_depan'    => ['nullable', 'string', 'max:50'],
            'gelar_belakang' => ['nullable', 'string', 'max:100'],
        ]);

        $teacher = DB::transaction(function () use ($data) {
            $user = User::create([
                'nama'     => $data['nama'],
                'email'    => $data['email'],
                'password' => $data['password'] ?? 'password',
                'role'     => UserRole::from($data['role']),
                'status'   => UserStatus::Aktif,
                'nomor_hp' => $data['nomor_hp'] ?? null,
            ]);
            return Teacher::create([
                'user_id'        => $user->id,
                'nip'            => $data['nip'],
                'mapel_utama'    => $data['mapel_utama'],
                'gelar_depan'    => $data['gelar_depan'] ?? null,
                'gelar_belakang' => $data['gelar_belakang'] ?? null,
            ]);
        });

        return response()->json(['message' => 'Guru berhasil ditambahkan.', 'data' => $this->format($teacher->load('user'))], 201);
    }

    public function update(Request $request, string $uuid): JsonResponse
    {
        $teacher = Teacher::where('uuid', $uuid)->with('user')->firstOrFail();

        $data = $request->validate([
            'nama'           => ['sometimes', 'string', 'max:100'],
            'email'          => ['sometimes', 'email', 'unique:users,email,' . $teacher->user_id],
            'nip'            => ['sometimes', 'string', 'max:20', 'unique:teachers,nip,' . $teacher->id],
            'mapel_utama'    => ['sometimes', 'string', 'max:100'],
            'role'           => ['sometimes', 'in:guru,wali_kelas,wakasek,bk'],
            'nomor_hp'       => ['nullable', 'string', 'max:20'],
            'status'         => ['sometimes', 'in:aktif,nonaktif'],
            'password'       => ['nullable', 'string', 'min:8'],
            'gelar_depan'    => ['nullable', 'string', 'max:50'],
            'gelar_belakang' => ['nullable', 'string', 'max:100'],
        ]);

        DB::transaction(function () use ($teacher, $data) {
            $userFields = array_filter([
                'nama'     => $data['nama'] ?? null,
                'email'    => $data['email'] ?? null,
                'role'     => isset($data['role']) ? UserRole::from($data['role']) : null,
                'status'   => isset($data['status']) ? UserStatus::from($data['status']) : null,
                'nomor_hp' => $data['nomor_hp'] ?? null,
                'password' => isset($data['password']) ? $data['password'] : null,
            ]);
            if (! empty($userFields)) $teacher->user->update($userFields);

            $teacherFields = array_filter([
                'nip'            => $data['nip'] ?? null,
                'mapel_utama'    => $data['mapel_utama'] ?? null,
                'gelar_depan'    => array_key_exists('gelar_depan', $data) ? ($data['gelar_depan'] ?: null) : null,
                'gelar_belakang' => array_key_exists('gelar_belakang', $data) ? ($data['gelar_belakang'] ?: null) : null,
            ], fn ($v) => $v !== null);

            // Allow explicit null for gelar fields
            if (array_key_exists('gelar_depan', $data))    $teacherFields['gelar_depan']    = $data['gelar_depan'] ?: null;
            if (array_key_exists('gelar_belakang', $data)) $teacherFields['gelar_belakang'] = $data['gelar_belakang'] ?: null;

            if (! empty($teacherFields) || array_key_exists('gelar_depan', $data) || array_key_exists('gelar_belakang', $data)) {
                $teacher->update($teacherFields);
            }
        });

        return response()->json(['message' => 'Data guru diperbarui.', 'data' => $this->format($teacher->fresh('user'))]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $teacher = Teacher::where('uuid', $uuid)->with('user')->firstOrFail();
        DB::transaction(function () use ($teacher) {
            $teacher->delete();
            $teacher->user->update(['status' => UserStatus::NonAktif]);
        });

        return response()->json(['message' => 'Guru dinonaktifkan.']);
    }

    private function format(Teacher $t): array
    {
        return [
            'id'             => $t->uuid,
            'nama'           => $t->user->nama,
            'email'          => $t->user->email,
            'role'           => $t->user->role->value,
            'status'         => $t->user->status->value,
            'nip'            => $t->nip,
            'mapel_utama'    => $t->mapel_utama,
            'nomor_hp'       => $t->user->nomor_hp,
            'gelar_depan'    => $t->gelar_depan,
            'gelar_belakang' => $t->gelar_belakang,
        ];
    }
}
