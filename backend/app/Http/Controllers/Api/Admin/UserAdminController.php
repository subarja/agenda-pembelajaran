<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserAdminController extends Controller
{
    private const MANAGED_ROLES = [UserRole::Admin, UserRole::BK, UserRole::OrangTua];

    public function index(Request $request): JsonResponse
    {
        $users = User::whereIn('role', self::MANAGED_ROLES)
            ->with(['linkedStudent.user:id,nama', 'linkedStudent.schoolClass'])
            ->when($request->search, fn ($q, $s) =>
                $q->where('nama', 'ilike', "%$s%")->orWhere('email', 'ilike', "%$s%")
            )
            ->orderByDesc('id')
            ->paginate(20);

        return response()->json([
            'data' => $users->map(fn ($u) => $this->format($u)),
            'meta' => ['total' => $users->total(), 'current_page' => $users->currentPage(), 'last_page' => $users->lastPage()],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nama'       => ['required', 'string', 'max:100'],
            'email'      => ['required', 'email', 'unique:users,email'],
            'role'       => ['required', 'in:admin,bk,orang_tua'],
            'nomor_hp'   => ['nullable', 'string', 'max:20'],
            'password'   => ['nullable', 'string', 'min:8'],
            'student_id' => ['nullable', 'string'],  // UUID siswa, hanya untuk orang_tua
        ]);

        $studentDbId = null;
        if ($data['role'] === 'orang_tua' && ! empty($data['student_id'])) {
            $student     = Student::where('uuid', $data['student_id'])->firstOrFail();
            $studentDbId = $student->id;
        }

        $user = User::create([
            'nama'               => $data['nama'],
            'email'              => $data['email'],
            'password'           => $data['password'] ?? 'password',
            'role'               => UserRole::from($data['role']),
            'status'             => UserStatus::Aktif,
            'nomor_hp'           => $data['nomor_hp'] ?? null,
            'linked_student_id'  => $studentDbId,
        ]);

        return response()->json(['message' => 'Pengguna berhasil ditambahkan.', 'data' => $this->format($user->load(['linkedStudent.user', 'linkedStudent.schoolClass']))], 201);
    }

    public function update(Request $request, string $uuid): JsonResponse
    {
        $user = User::whereIn('role', self::MANAGED_ROLES)->where('uuid', $uuid)->firstOrFail();

        $data = $request->validate([
            'nama'       => ['sometimes', 'string', 'max:100'],
            'email'      => ['sometimes', 'email', 'unique:users,email,' . $user->id],
            'role'       => ['sometimes', 'in:admin,bk,orang_tua'],
            'nomor_hp'   => ['nullable', 'string', 'max:20'],
            'status'     => ['sometimes', 'in:aktif,nonaktif'],
            'password'   => ['nullable', 'string', 'min:8'],
            'student_id' => ['nullable', 'string'],
        ]);

        $fields = [];
        if (isset($data['nama']))     $fields['nama']     = $data['nama'];
        if (isset($data['email']))    $fields['email']    = $data['email'];
        if (isset($data['role']))     $fields['role']     = UserRole::from($data['role']);
        if (isset($data['status']))   $fields['status']   = UserStatus::from($data['status']);
        if (array_key_exists('nomor_hp', $data)) $fields['nomor_hp'] = $data['nomor_hp'];
        if (isset($data['password'])) $fields['password'] = $data['password'];

        if (array_key_exists('student_id', $data)) {
            if ($data['student_id']) {
                $student = Student::where('uuid', $data['student_id'])->firstOrFail();
                $fields['linked_student_id'] = $student->id;
            } else {
                $fields['linked_student_id'] = null;
            }
        }

        if (! empty($fields)) $user->update($fields);

        return response()->json(['message' => 'Data pengguna diperbarui.', 'data' => $this->format($user->fresh()->load(['linkedStudent.user', 'linkedStudent.schoolClass']))]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $user = User::whereIn('role', self::MANAGED_ROLES)->where('uuid', $uuid)->firstOrFail();
        $user->update(['status' => UserStatus::Nonaktif]);

        return response()->json(['message' => 'Pengguna dinonaktifkan.']);
    }

    private function format(User $u): array
    {
        $fmt = [
            'id'       => $u->uuid,
            'nama'     => $u->nama,
            'email'    => $u->email,
            'role'     => $u->role->value,
            'status'   => $u->status->value,
            'nomor_hp' => $u->nomor_hp,
        ];

        if ($u->role === UserRole::OrangTua && $u->relationLoaded('linkedStudent') && $u->linkedStudent) {
            $s = $u->linkedStudent;
            $fmt['linked_student'] = [
                'id'    => $s->uuid,
                'nama'  => $s->user?->nama,
                'nis'   => $s->nis,
                'kelas' => $s->schoolClass
                    ? $s->schoolClass->tingkat->value . ' ' . $s->schoolClass->jurusan . ' - ' . $s->schoolClass->rombel
                    : null,
            ];
        }

        return $fmt;
    }
}
