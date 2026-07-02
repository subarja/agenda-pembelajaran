<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\Teacher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * Upload masal foto siswa & guru — admin browse banyak file sekaligus (atau satu folder
 * lewat <input webkitdirectory>), nama file (tanpa ekstensi) dicocokkan ke NISN (siswa)
 * atau NIP/email (guru). File yang tidak match / rusak / salah format / kelebihan ukuran
 * dilaporkan di rekap "gagal", BUKAN membatalkan seluruh proses — file lain tetap diproses.
 */
class PhotoBulkUploadController extends Controller
{
    private const ALLOWED_EXT = ['jpg', 'jpeg', 'png'];
    private const MAX_KB      = 50;

    // POST /admin/students/photos/bulk — nama file = NISN
    public function students(Request $request): JsonResponse
    {
        $request->validate(['photos' => ['required', 'array', 'min:1']]);

        $berhasil = [];
        $gagal    = [];

        foreach ($request->file('photos', []) as $file) {
            $filename = $file->getClientOriginalName();
            $key      = mb_strtolower(pathinfo($filename, PATHINFO_FILENAME));

            if ($err = $this->validateFile($file)) {
                $gagal[] = ['file' => $filename, 'alasan' => $err];
                continue;
            }

            $student = Student::whereRaw('LOWER(nisn) = ?', [$key])->with('user')->first();
            if (! $student) {
                $gagal[] = ['file' => $filename, 'alasan' => "Tidak ada siswa dengan NISN \"{$key}\"."];
                continue;
            }

            if ($student->foto && Storage::disk('public')->exists($student->foto)) {
                Storage::disk('public')->delete($student->foto);
            }
            $path = $file->store('foto_siswa', 'public');
            $student->update(['foto' => $path]);

            $berhasil[] = ['file' => $filename, 'nama' => $student->user->nama, 'nisn' => $key];
        }

        return response()->json($this->buildResponse('siswa', $berhasil, $gagal));
    }

    // POST /admin/teachers/photos/bulk — nama file = NIP, atau email kalau tidak punya NIP
    public function teachers(Request $request): JsonResponse
    {
        $request->validate(['photos' => ['required', 'array', 'min:1']]);

        $berhasil = [];
        $gagal    = [];

        foreach ($request->file('photos', []) as $file) {
            $filename = $file->getClientOriginalName();
            $key      = mb_strtolower(pathinfo($filename, PATHINFO_FILENAME));

            if ($err = $this->validateFile($file)) {
                $gagal[] = ['file' => $filename, 'alasan' => $err];
                continue;
            }

            // Cocokkan NIP dulu, baru email (penuh), baru bagian sebelum "@" (jaga-jaga
            // admin cuma pakai nama lokal email sebagai nama file, tanpa domain).
            $teacher = Teacher::whereRaw('LOWER(nip) = ?', [$key])->with('user')->first()
                ?? Teacher::whereHas('user', fn ($q) => $q->whereRaw('LOWER(email) = ?', [$key]))->with('user')->first()
                ?? Teacher::whereHas('user', fn ($q) => $q->whereRaw("LOWER(SPLIT_PART(email, '@', 1)) = ?", [$key]))->with('user')->first();

            if (! $teacher) {
                $gagal[] = ['file' => $filename, 'alasan' => "Tidak ada guru dengan NIP/email \"{$key}\"."];
                continue;
            }

            $user = $teacher->user;
            if ($user->foto && Storage::disk('public')->exists($user->foto)) {
                Storage::disk('public')->delete($user->foto);
            }
            $path = $file->store('photos', 'public');
            $user->update(['foto' => $path]);

            $berhasil[] = ['file' => $filename, 'nama' => $user->nama, 'cocok_dengan' => $key];
        }

        return response()->json($this->buildResponse('guru', $berhasil, $gagal));
    }

    private function validateFile(UploadedFile $file): ?string
    {
        if (! $file->isValid()) {
            return 'File rusak / gagal diunggah.';
        }

        $ext = mb_strtolower($file->getClientOriginalExtension());
        if (! in_array($ext, self::ALLOWED_EXT, true)) {
            return 'Format tidak didukung (harus JPG/JPEG/PNG).';
        }

        if ($file->getSize() > self::MAX_KB * 1024) {
            return 'Ukuran melebihi '.self::MAX_KB.'KB.';
        }

        return null;
    }

    private function buildResponse(string $label, array $berhasil, array $gagal): array
    {
        return [
            'message' => "Proses upload foto {$label} selesai.",
            'summary' => [
                'total'    => count($berhasil) + count($gagal),
                'berhasil' => count($berhasil),
                'gagal'    => count($gagal),
            ],
            'berhasil' => $berhasil,
            'gagal'    => $gagal,
        ];
    }
}
