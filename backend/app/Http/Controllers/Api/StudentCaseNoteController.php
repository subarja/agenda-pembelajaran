<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\StudentCaseNote;
use App\Traits\RejectsFutureDate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentCaseNoteController extends Controller
{
    use RejectsFutureDate;

    // GET /student-case-notes?student_id=xxx
    public function index(Request $request): JsonResponse
    {
        $request->validate(['student_id' => ['required', 'string']]);
        $student = Student::where('uuid', $request->student_id)->firstOrFail();

        $user = $request->user();
        $kap  = $this->getKapabilitas($user);

        // Hanya BK, wali kelas, admin, dan wakasek yang bisa lihat
        abort_unless(
            $kap['is_bk'] || $kap['is_wali_kelas'] || in_array($user->role->value, ['admin', 'wakasek']),
            403, 'Akses tidak diizinkan.'
        );

        $query = StudentCaseNote::where('student_id', $student->id)
            ->with('author')
            ->orderByDesc('tanggal')
            ->orderByDesc('created_at');

        // Filter jenis berdasarkan kapabilitas (guru non-admin)
        if (! in_array($user->role->value, ['admin', 'wakasek'])) {
            $allowedJenis = [];
            if ($kap['is_bk'])         $allowedJenis[] = 'bk';
            if ($kap['is_wali_kelas']) $allowedJenis[] = 'wali_kelas';
            $query->whereIn('jenis', $allowedJenis);

            // Konfidensial hanya bisa dilihat oleh author-nya sendiri
            $query->where(fn ($q) =>
                $q->where('konfidensial', false)
                  ->orWhere('author_id', $user->id)
            );
        }

        $notes = $query->get()->map(fn ($n) => $this->format($n));

        return response()->json(['data' => $notes]);
    }

    // POST /student-case-notes
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $kap  = $this->getKapabilitas($user);

        $data = $request->validate([
            'student_id'    => ['required', 'string'],
            'jenis'         => ['required', 'in:bk,wali_kelas'],
            'catatan'       => ['required', 'string', 'max:2000'],
            'tindak_lanjut' => ['nullable', 'string', 'max:255'],
            'tanggal'       => ['required', 'date', $this->notFutureDateRule()],
            'konfidensial'  => ['boolean'],
        ], $this->notFutureDateMessages());

        // Validasi kapabilitas berdasarkan jenis
        if ($data['jenis'] === 'bk') {
            abort_unless($kap['is_bk'] || in_array($user->role->value, ['admin', 'wakasek']), 403, 'Anda tidak memiliki akses sebagai Guru BK.');
        }
        if ($data['jenis'] === 'wali_kelas') {
            abort_unless($kap['is_wali_kelas'] || in_array($user->role->value, ['admin', 'wakasek']), 403, 'Anda tidak memiliki akses sebagai Wali Kelas.');
        }

        $student = Student::where('uuid', $data['student_id'])->firstOrFail();

        $note = StudentCaseNote::create([
            'student_id'    => $student->id,
            'author_id'     => $user->id,
            'jenis'         => $data['jenis'],
            'catatan'       => $data['catatan'],
            'tindak_lanjut' => $data['tindak_lanjut'] ?? null,
            'tanggal'       => $data['tanggal'],
            'konfidensial'  => $data['konfidensial'] ?? false,
        ]);

        return response()->json([
            'message' => 'Catatan berhasil disimpan.',
            'data'    => $this->format($note->load('author')),
        ], 201);
    }

    // PUT /student-case-notes/{uuid}
    public function update(Request $request, string $uuid): JsonResponse
    {
        $note = StudentCaseNote::where('uuid', $uuid)->firstOrFail();
        abort_unless($note->author_id === $request->user()->id, 403, 'Hanya penulis yang dapat mengedit catatan ini.');

        $data = $request->validate([
            'catatan'       => ['sometimes', 'string', 'max:2000'],
            'tindak_lanjut' => ['nullable', 'string', 'max:255'],
            'tanggal'       => ['sometimes', 'date', $this->notFutureDateRule()],
            'konfidensial'  => ['boolean'],
        ], $this->notFutureDateMessages());

        $note->update($data);

        return response()->json([
            'message' => 'Catatan berhasil diperbarui.',
            'data'    => $this->format($note->fresh('author')),
        ]);
    }

    // DELETE /student-case-notes/{uuid}
    public function destroy(Request $request, string $uuid): JsonResponse
    {
        $note = StudentCaseNote::where('uuid', $uuid)->firstOrFail();
        abort_unless($note->author_id === $request->user()->id, 403, 'Hanya penulis yang dapat menghapus catatan ini.');

        $note->delete();

        return response()->json(['message' => 'Catatan berhasil dihapus.']);
    }

    private function format(StudentCaseNote $n): array
    {
        return [
            'id'            => $n->uuid,
            'jenis'         => $n->jenis,
            'catatan'       => $n->catatan,
            'tindak_lanjut' => $n->tindak_lanjut,
            'tanggal'       => $n->tanggal->format('Y-m-d'),
            'konfidensial'  => $n->konfidensial,
            'author'        => $n->author?->nama,
            'author_id'     => $n->author_id,
            'created_at'    => $n->created_at->format('Y-m-d H:i'),
        ];
    }

    private function getKapabilitas(\App\Models\User $user): array
    {
        $teacher = $user->teacher ?? $user->load('teacher')->teacher;

        $isBk = (bool) ($teacher?->is_bk ?? false);

        $kelasWali   = SchoolClass::where('wali_kelas_id', $user->id)
            ->whereHas('academicYear', fn ($q) => $q->where('aktif', true))
            ->exists();

        return ['is_bk' => $isBk, 'is_wali_kelas' => $kelasWali];
    }
}
