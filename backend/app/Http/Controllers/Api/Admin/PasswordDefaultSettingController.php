<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PasswordDefaultSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PasswordDefaultSettingController extends Controller
{
    // ── GET /admin/password-defaults ─────────────────────────────────────────
    // Nilai asli TIDAK pernah dikirim mentah ke frontend — hanya bentuk tersamar
    // (mask) + info dari mana asalnya (panel admin vs .env server).
    public function show(): JsonResponse
    {
        return response()->json(['data' => [
            'guru' => $this->describe('teacher_password', 'accounts.default_teacher_password', 'DEFAULT_TEACHER_PASSWORD'),
            'siswa' => $this->describe('student_password', 'accounts.default_student_password', 'DEFAULT_STUDENT_PASSWORD'),
        ]]);
    }

    // ── PUT /admin/password-defaults ─────────────────────────────────────────
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            // min:8 mengikuti aturan reset password manual di UserAdminController.
            'teacher_password' => ['sometimes', 'nullable', 'string', 'min:8', 'max:100'],
            'student_password' => ['sometimes', 'nullable', 'string', 'min:8', 'max:100'],
            // Penghapusan harus eksplisit: input kosong = "tidak diubah" (frontend
            // tidak pernah menerima nilai lama), jadi tidak bisa dipakai untuk kosongkan.
            'clear_teacher' => ['sometimes', 'boolean'],
            'clear_student' => ['sometimes', 'boolean'],
        ]);

        $s = PasswordDefaultSetting::instance();

        if (! empty($data['teacher_password'])) {
            $s->teacher_password = $data['teacher_password'];
        } elseif (! empty($data['clear_teacher'])) {
            $s->teacher_password = null;
        }

        if (! empty($data['student_password'])) {
            $s->student_password = $data['student_password'];
        } elseif (! empty($data['clear_student'])) {
            $s->student_password = null;
        }

        $s->save();

        return response()->json(['message' => 'Password default disimpan. Password akun yang sudah ada tidak ikut berubah — jalankan "Generate Akun" atau reset per-akun bila ingin menerapkannya.']);
    }

    private function describe(string $column, string $configKey, string $envKey): array
    {
        $stored = PasswordDefaultSetting::stored($column);
        $env = config($configKey);

        return [
            'masked' => $this->mask($stored ?: $env),
            'is_set' => (bool) ($stored ?: $env),
            'sumber' => $stored ? 'panel' : ($env ? 'env' : null),
            'env_key' => $envKey,
            'env_is_set' => (bool) $env,
        ];
    }

    // Ditutup PENUH dengan panjang tetap — beda dari R2SettingController::mask()
    // yang menyisakan 4 karakter terakhir. Ini password login yang dipakai ratusan
    // akun sekaligus, jadi bocornya potongan karakter maupun panjangnya pun tidak
    // sepadan dengan manfaat "biar admin ingat isinya".
    private function mask(?string $value): ?string
    {
        return $value ? str_repeat('•', 8) : null;
    }
}
