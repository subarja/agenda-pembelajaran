<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class UserAdminController extends Controller
{
    private const MANAGED_ROLES = [UserRole::Admin, UserRole::BK, UserRole::OrangTua];

    public function index(Request $request): JsonResponse
    {
        $users = User::whereIn('role', self::MANAGED_ROLES)
            ->with(['linkedStudent.user:id,nama', 'linkedStudent.schoolClass'])
            ->when($request->search, fn ($q, $s) => $q->where(fn ($inner) => $inner->whereLikeCi('nama', $s)
                ->orWhereLikeCi('email', $s)
                ->orWhereLikeCi('role', $s)
            ))
            ->orderBy('nama')
            ->paginate(20);

        return response()->json([
            'data' => $users->map(fn ($u) => $this->format($u)),
            'meta' => ['total' => $users->total(), 'current_page' => $users->currentPage(), 'last_page' => $users->lastPage()],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nama' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'unique:users,email'],
            'role' => ['required', 'in:admin,bk,orang_tua'],
            'nomor_hp' => ['nullable', 'string', 'max:20'],
            'password' => ['nullable', 'string', 'min:8'],
            'student_id' => ['nullable', 'string'],  // UUID siswa, hanya untuk orang_tua
        ]);

        $studentDbId = null;
        if ($data['role'] === 'orang_tua' && ! empty($data['student_id'])) {
            $student = Student::where('uuid', $data['student_id'])->firstOrFail();
            $studentDbId = $student->id;
        }

        $user = User::create([
            'nama' => $data['nama'],
            'email' => $data['email'],
            'password' => $data['password'] ?? 'password',
            'role' => UserRole::from($data['role']),
            'status' => UserStatus::Aktif,
            'nomor_hp' => $data['nomor_hp'] ?? null,
            'linked_student_id' => $studentDbId,
        ]);

        return response()->json(['message' => 'Pengguna berhasil ditambahkan.', 'data' => $this->format($user->load(['linkedStudent.user', 'linkedStudent.schoolClass']))], 201);
    }

    public function update(Request $request, string $uuid): JsonResponse
    {
        $user = User::whereIn('role', self::MANAGED_ROLES)->where('uuid', $uuid)->firstOrFail();

        $data = $request->validate([
            'nama' => ['sometimes', 'string', 'max:100'],
            'email' => ['sometimes', 'email', 'unique:users,email,'.$user->id],
            'role' => ['sometimes', 'in:admin,bk,orang_tua'],
            'nomor_hp' => ['nullable', 'string', 'max:20'],
            'status' => ['sometimes', 'in:aktif,nonaktif'],
            'password' => ['nullable', 'string', 'min:8'],
            'student_id' => ['nullable', 'string'],
        ]);

        $fields = [];
        if (isset($data['nama'])) {
            $fields['nama'] = $data['nama'];
        }
        if (isset($data['email'])) {
            $fields['email'] = $data['email'];
        }
        if (isset($data['role'])) {
            $fields['role'] = UserRole::from($data['role']);
        }
        if (isset($data['status'])) {
            $fields['status'] = UserStatus::from($data['status']);
        }
        if (array_key_exists('nomor_hp', $data)) {
            $fields['nomor_hp'] = $data['nomor_hp'];
        }
        if (isset($data['password'])) {
            $fields['password'] = $data['password'];
        }

        if (array_key_exists('student_id', $data)) {
            if ($data['student_id']) {
                $student = Student::where('uuid', $data['student_id'])->firstOrFail();
                $fields['linked_student_id'] = $student->id;
            } else {
                $fields['linked_student_id'] = null;
            }
        }

        if (! empty($fields)) {
            $user->update($fields);
        }

        return response()->json(['message' => 'Data pengguna diperbarui.', 'data' => $this->format($user->fresh()->load(['linkedStudent.user', 'linkedStudent.schoolClass']))]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $user = User::whereIn('role', self::MANAGED_ROLES)->where('uuid', $uuid)->firstOrFail();
        $user->update(['status' => UserStatus::Nonaktif]);

        return response()->json(['message' => 'Pengguna dinonaktifkan.']);
    }

    // GET /admin/users-detail?role=admin|guru|siswa
    public function detail(Request $request): JsonResponse
    {
        $role = $request->query('role', 'admin');

        // Build last login map and online status from sessions
        $lastLogins = AuditLog::where('action', 'login')
            ->selectRaw('user_id, max(timestamp) as last_login')
            ->groupBy('user_id')
            ->pluck('last_login', 'user_id');

        $onlineThreshold = now()->subMinutes(5)->timestamp;
        $onlineUserIds = DB::table('sessions')
            ->where('last_activity', '>=', $onlineThreshold)
            ->whereNotNull('user_id')
            ->pluck('user_id')
            ->unique();

        $lastIps = DB::table('sessions')
            ->whereNotNull('user_id')
            ->select('user_id', DB::raw('max(last_activity) as la'), 'ip_address')
            ->groupBy('user_id', 'ip_address')
            ->get()
            ->sortByDesc('la')
            ->unique('user_id')
            ->pluck('ip_address', 'user_id');

        if ($role === 'guru') {
            $users = User::whereIn('role', [UserRole::Guru, UserRole::WaliKelas, UserRole::BK, UserRole::Wakasek])
                ->with('teacher')
                ->when($request->search, fn ($q, $s) => $q->where(fn ($inner) => $inner->whereLikeCi('nama', $s)
                    ->orWhereLikeCi('email', $s)
                    ->orWhereLikeCi('role', $s)
                    ->orWhereHas('teacher', fn ($t) => $t->whereLikeCi('nip', $s)->orWhereLikeCi('nuptk', $s)->orWhereLikeCi('mapel_utama', $s))
                ))
                ->orderBy('nama')
                ->paginate(50);
        } elseif ($role === 'siswa') {
            $users = User::where('role', UserRole::Siswa)
                ->with(['student.schoolClass'])
                ->when($request->search, fn ($q, $s) => $q->where(fn ($inner) => $inner->whereLikeCi('nama', $s)
                    ->orWhereLikeCi('email', $s)
                    ->orWhereHas('student', fn ($st) => $st->whereLikeCi('nis', $s)->orWhereLikeCi('nisn', $s))
                    ->orWhereHas('student.schoolClass', fn ($sc) => $sc->whereLabelLike($s))
                ))
                ->orderBy('nama')
                ->paginate(100);
        } else {
            $users = User::whereIn('role', [UserRole::Admin, UserRole::OrangTua])
                ->when($request->search, fn ($q, $s) => $q->where(fn ($inner) => $inner->whereLikeCi('nama', $s)
                    ->orWhereLikeCi('email', $s)
                    ->orWhereLikeCi('role', $s)
                ))
                ->orderBy('nama')
                ->paginate(50);
        }

        $data = $users->map(function (User $u) use ($lastLogins, $onlineUserIds, $lastIps) {
            $lastLogin = $lastLogins[$u->id] ?? null;
            $row = [
                'id' => $u->uuid,
                'nama' => $u->nama,
                'email' => $u->email,
                'role' => $u->role->value,
                'status' => $u->status->value,
                'last_login' => $lastLogin ? Carbon::parse($lastLogin)->timezone('Asia/Jakarta')->format('d/m/Y H:i') : null,
                'last_login_raw' => $lastLogin,
                'online' => $onlineUserIds->contains($u->id),
                'ip_address' => $lastIps[$u->id] ?? null,
            ];

            if ($u->role === UserRole::Guru || $u->role === UserRole::WaliKelas || $u->role === UserRole::BK || $u->role === UserRole::Wakasek) {
                $t = $u->teacher;
                $row['nip'] = $t?->nip;
                $row['mapel_utama'] = $t?->mapel_utama;
                $row['has_password'] = true; // can't reliably detect; show for info only
            }
            if ($u->role === UserRole::Siswa) {
                $s = $u->student;
                $row['nis'] = $s?->nis;
                $row['nisn'] = $s?->nisn;
                $row['kelas'] = $s?->schoolClass
                    ? $s->schoolClass->label()
                    : null;
            }

            // Nama pengguna untuk login = kredensial yang dipakai (bukan selalu NIP/NISN;
            // guru tanpa NIP tetap perlu tahu username-nya). Urutannya sama dengan
            // AuthController::resolveUser: NIP → NISN → email → nama.
            $row['username'] = self::usernameFor($u);

            return $row;
        });

        return response()->json([
            'data' => $data,
            'meta' => ['total' => $users->total(), 'current_page' => $users->currentPage(), 'last_page' => $users->lastPage()],
        ]);
    }

    // PUT /admin/users/{uuid}/reset-password
    public function resetPassword(Request $request, string $uuid): JsonResponse
    {
        $user = User::where('uuid', $uuid)->firstOrFail();
        // Password boleh KOSONG → pakai password default sesuai peran. Admin sering
        // hanya ingin mengembalikan akun ke default tanpa mengetik apa pun.
        $data = $request->validate(['password' => ['nullable', 'string', 'min:8']]);

        $isDefault = empty($data['password']);
        if ($isDefault) {
            $plain = self::defaultPasswordFor($user);
            if (! $plain) {
                return response()->json([
                    'message' => 'Password default belum dikonfigurasi di .env server (DEFAULT_TEACHER_PASSWORD / DEFAULT_STUDENT_PASSWORD). Isi dulu, atau ketik password baru secara manual.',
                ], 422);
            }
        } else {
            $plain = $data['password'];
        }

        // Password yang di-set admin selalu bersifat sementara — pemilik akun
        // wajib menggantinya sendiri saat login berikutnya.
        $user->update(['password' => Hash::make($plain), 'must_change_password' => true]);

        return response()->json([
            'message'    => 'Password berhasil direset. Pengguna wajib mengganti password saat login berikutnya.',
            'is_default' => $isDefault,
            'target'     => $user->nama,
            'username'   => self::usernameFor($user),
            'password'   => $plain,
        ]);
    }

    /** Nama pengguna (kredensial login) sebuah user: NIP → NISN → email → nama. */
    private static function usernameFor(User $u): string
    {
        return $u->teacher?->nip
            ?: $u->student?->nisn
            ?: ($u->email ?: $u->nama);
    }

    /** Password default (plain) menurut peran; null bila belum dikonfigurasi. */
    private static function defaultPasswordFor(User $u): ?string
    {
        $isSiswa = $u->role === UserRole::Siswa;
        return config($isSiswa ? 'accounts.default_student_password' : 'accounts.default_teacher_password');
    }

    // PUT /admin/users/{uuid}/toggle-status
    public function toggleStatus(string $uuid): JsonResponse
    {
        $user = User::where('uuid', $uuid)->firstOrFail();
        $new = $user->status === UserStatus::Aktif ? UserStatus::Nonaktif : UserStatus::Aktif;
        $user->update(['status' => $new]);

        return response()->json(['message' => "Status diubah ke {$new->value}.", 'status' => $new->value]);
    }

    // POST /admin/generate-accounts?type=guru|siswa
    public function generateAccounts(Request $request): JsonResponse
    {
        $type = $request->query('type', 'guru');

        if (! in_array($type, ['guru', 'siswa'], true)) {
            return response()->json(['message' => 'Tipe tidak dikenal.'], 422);
        }

        // Password default tidak lagi di-hardcode — nilai lama sudah tercatat di
        // riwayat git sehingga wajib dirotasi dan hanya hidup di .env server.
        $envKey = $type === 'guru' ? 'DEFAULT_TEACHER_PASSWORD' : 'DEFAULT_STUDENT_PASSWORD';
        $plain  = config($type === 'guru' ? 'accounts.default_teacher_password' : 'accounts.default_student_password');

        if (! $plain) {
            return response()->json([
                'message' => "Password default belum dikonfigurasi. Isi {$envKey} di file .env server, lalu coba lagi.",
            ], 422);
        }

        $defaultPw = Hash::make($plain);
        $count = 0;

        if ($type === 'guru') {
            foreach (Teacher::with('user')->get() as $t) {
                if ($t->user && $t->nip) {
                    $t->user->update(['password' => $defaultPw, 'must_change_password' => true]);
                    $count++;
                }
            }
        } else {
            foreach (Student::with('user')->get() as $s) {
                if ($s->user && $s->nisn) {
                    $s->user->update(['password' => $defaultPw, 'must_change_password' => true]);
                    $count++;
                }
            }
        }

        $username = $type === 'guru' ? 'NIP' : 'NISN';

        return response()->json([
            'message'  => "Password default berhasil di-set untuk {$count} akun {$type}.",
            'count'    => $count,
            'target'   => "Semua {$type} ({$count} akun)",
            'username' => "{$username} masing-masing",
            'password' => $plain,
        ]);
    }

    private function format(User $u): array
    {
        $fmt = [
            'id' => $u->uuid,
            'nama' => $u->nama,
            'email' => $u->email,
            'role' => $u->role->value,
            'status' => $u->status->value,
            'nomor_hp' => $u->nomor_hp,
        ];

        if ($u->role === UserRole::OrangTua && $u->relationLoaded('linkedStudent') && $u->linkedStudent) {
            $s = $u->linkedStudent;
            $fmt['linked_student'] = [
                'id' => $s->uuid,
                'nama' => $s->user?->nama,
                'nis' => $s->nis,
                'kelas' => $s->schoolClass
                    ? $s->schoolClass->label()
                    : null,
            ];
        }

        return $fmt;
    }
}
