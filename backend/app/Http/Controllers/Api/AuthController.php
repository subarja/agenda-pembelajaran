<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\AcademicYear;
use App\Models\AuditLog;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        $user = $this->resolveUser($request->identifier);

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'Identifier atau password salah.',
            ], 401);
        }

        if ($user->status->value === 'nonaktif') {
            return response()->json([
                'message' => 'Akun Anda dinonaktifkan. Hubungi administrator.',
            ], 403);
        }

        if ($request->academic_year_id) {
            $ay = AcademicYear::where('uuid', $request->academic_year_id)->firstOrFail();
            $user->update(['current_academic_year_id' => $ay->id]);
        } elseif (AcademicYear::exists()) {
            // Semester sudah ada di sistem tapi tidak dipilih — wajib pilih salah satu.
            return response()->json(['message' => 'Semester wajib dipilih.'], 422);
        } elseif ($user->role !== UserRole::Admin) {
            // Belum ada semester sama sekali (instalasi baru) — hanya admin yang boleh
            // masuk tanpa memilih semester, supaya bisa membuat tahun ajaran pertama.
            return response()->json([
                'message' => 'Sistem belum memiliki tahun ajaran. Hubungi admin untuk membuat tahun ajaran pertama.',
            ], 422);
        }
        // Admin diizinkan login tanpa memilih semester saat instalasi baru (belum ada
        // tahun ajaran sama sekali), supaya bisa membuat tahun ajaran pertama.

        $deviceName = $request->device_name ?? ($request->userAgent() ?? 'unknown');
        $token      = $user->createToken($deviceName)->plainTextToken;

        $user->loadProfileRelation();

        AuditLog::record('login', $user, [], $user->id);

        return response()->json([
            'message' => 'Login berhasil.',
            'data'    => [
                'user'       => new UserResource($user),
                'token'      => $token,
                'token_type' => 'Bearer',
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->loadProfileRelation();

        return response()->json(['data' => new UserResource($user)]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        AuditLog::record('logout', $request->user());

        return response()->json(['message' => 'Logout berhasil.']);
    }

    public function logoutAll(Request $request): JsonResponse
    {
        $request->user()->tokens()->delete();

        return response()->json(['message' => 'Semua sesi berhasil dihapus.']);
    }

    // ── Resolve identifier: email → NIP → NISN ────────────────────────────────

    private function resolveUser(string $identifier): ?User
    {
        // Email → admin / wakasek / siapapun
        if (str_contains($identifier, '@')) {
            return User::where('email', $identifier)->first();
        }

        // NIP → guru
        $teacher = Teacher::where('nip', $identifier)->with('user')->first();
        if ($teacher) return $teacher->user;

        // NISN → siswa
        $student = Student::where('nisn', $identifier)->with('user')->first();
        if ($student) return $student->user;

        // Fallback: nama user (untuk admin)
        return User::where('nama', $identifier)->first();
    }
}
