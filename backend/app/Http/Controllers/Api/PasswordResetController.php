<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class PasswordResetController extends Controller
{
    // POST /auth/forgot-password
    public function sendLink(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::where('email', $request->email)->first();

        // Selalu kembalikan respons sukses (hindari user enumeration)
        if (! $user) {
            return response()->json([
                'message' => 'Jika email terdaftar, link reset password telah dikirim.',
            ]);
        }

        // Hapus token lama, buat token baru
        DB::table('password_reset_tokens')
            ->where('email', $user->email)
            ->delete();

        $token = Str::random(64);

        DB::table('password_reset_tokens')->insert([
            'email'      => $user->email,
            'token'      => Hash::make($token),
            'created_at' => now(),
        ]);

        $frontendUrl = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')), '/');

        $user->notify(new ResetPasswordNotification($token, $frontendUrl));

        return response()->json([
            'message' => 'Jika email terdaftar, link reset password telah dikirim.',
            // Hanya di development — jangan tampilkan di production
            '_dev_token' => app()->environment('local') ? $token : null,
        ]);
    }

    // POST /auth/reset-password
    public function reset(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email'                 => ['required', 'email'],
            'token'                 => ['required', 'string'],
            'password'              => ['required', 'string', 'min:8', 'confirmed'],
            'password_confirmation' => ['required', 'string'],
        ]);

        $record = DB::table('password_reset_tokens')
            ->where('email', $data['email'])
            ->first();

        if (! $record || ! Hash::check($data['token'], $record->token)) {
            return response()->json([
                'message' => 'Token reset password tidak valid atau sudah kedaluwarsa.',
                'errors'  => ['token' => ['Token tidak valid atau sudah kedaluwarsa.']],
            ], 422);
        }

        // Token berlaku 60 menit
        if (now()->diffInMinutes($record->created_at) > 60) {
            DB::table('password_reset_tokens')->where('email', $data['email'])->delete();

            return response()->json([
                'message' => 'Token reset password sudah kedaluwarsa. Silakan minta ulang.',
                'errors'  => ['token' => ['Token sudah kedaluwarsa.']],
            ], 422);
        }

        $user = User::where('email', $data['email'])->firstOrFail();
        $user->update(['password' => $data['password']]);

        // Hapus semua token & sesi aktif setelah reset
        DB::table('password_reset_tokens')->where('email', $data['email'])->delete();
        $user->tokens()->delete();

        return response()->json([
            'message' => 'Password berhasil direset. Silakan login dengan password baru Anda.',
        ]);
    }
}
