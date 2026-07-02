<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\Password;

class ProfileController extends Controller
{
    // GET /profile
    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => new UserResource($request->user()->loadProfileRelation())]);
    }

    // PUT /profile — nama, nomor_hp, gelar (guru)
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nama'           => ['sometimes', 'string', 'max:150'],
            'nomor_hp'       => ['nullable', 'string', 'max:20'],
            'gelar_depan'    => ['nullable', 'string', 'max:50'],
            'gelar_belakang' => ['nullable', 'string', 'max:100'],
        ]);

        $user = $request->user();
        if (isset($data['nama'])) $user->update(['nama' => $data['nama']]);

        if ($user->teacher) {
            $teacherFields = [];
            if (array_key_exists('nomor_hp', $data))       $teacherFields['nomor_hp']       = $data['nomor_hp'];
            if (array_key_exists('gelar_depan', $data))    $teacherFields['gelar_depan']    = $data['gelar_depan'] ?: null;
            if (array_key_exists('gelar_belakang', $data)) $teacherFields['gelar_belakang'] = $data['gelar_belakang'] ?: null;
            if (! empty($teacherFields)) $user->teacher->update($teacherFields);
        }

        return response()->json([
            'message' => 'Profil berhasil diperbarui.',
            'data'    => new UserResource($user->fresh()->loadProfileRelation()),
        ]);
    }

    // POST /profile/photo — upload foto
    public function updatePhoto(Request $request): JsonResponse
    {
        $user = $request->user();

        // Foto siswa dikelola khusus (kolom students.foto) oleh admin/wali kelas saja —
        // lihat StudentPhotoController — siswa TIDAK boleh ganti foto sendiri lewat sini.
        abort_if($user->role === UserRole::Siswa, 403, 'Siswa tidak dapat mengubah foto sendiri. Hubungi admin atau wali kelas.');

        $request->validate([
            'foto' => ['required', 'image', 'max:50', 'mimes:jpg,jpeg,png'],
        ]);

        // Hapus foto lama
        if ($user->foto && Storage::disk('public')->exists($user->foto)) {
            Storage::disk('public')->delete($user->foto);
        }

        $path = $request->file('foto')->store('photos', 'public');
        $user->update(['foto' => $path]);

        return response()->json([
            'message'   => 'Foto profil berhasil diperbarui.',
            'foto_url'  => Storage::disk('public')->url($path),
        ]);
    }

    // PUT /profile/password — ganti password
    public function updatePassword(Request $request): JsonResponse
    {
        $request->validate([
            'password_lama' => ['required', 'string'],
            'password_baru' => ['required', 'confirmed', Password::min(6)],
        ]);

        $user = $request->user();

        if (! Hash::check($request->password_lama, $user->password)) {
            return response()->json(['message' => 'Password lama tidak sesuai.'], 422);
        }

        $user->update(['password' => Hash::make($request->password_baru)]);

        return response()->json(['message' => 'Password berhasil diperbarui.']);
    }

    // PUT /profile/email — ganti email
    public function updateEmail(Request $request): JsonResponse
    {
        $request->validate([
            'email'    => ['required', 'email', 'unique:users,email,' . $request->user()->id],
            'password' => ['required', 'string'],
        ]);

        $user = $request->user();

        if (! Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Password tidak sesuai.'], 422);
        }

        $user->update(['email' => $request->email, 'email_verified_at' => null]);

        return response()->json(['message' => 'Email berhasil diperbarui.']);
    }
}
