<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\StudentCaseNote;
use App\Support\ClassAccess;
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

        // Dulu di sini hanya ada pemeriksaan KAPABILITAS ("apakah orang ini wali kelas?")
        // tanpa kepemilikan ("wali kelas SISWA INI?"), sehingga wali kelas satu rombel
        // bisa membaca catatan konseling siswa rombel lain — dibuktikan pada audit
        // 2026-07-09. Kapabilitas bukan izin.
        abort_unless(
            ClassAccess::allows(ClassAccess::pastoralClassIds($user), $student->class_id),
            403, 'Akses tidak diizinkan.'
        );

        $query = StudentCaseNote::where('student_id', $student->id)
            ->with('author')
            ->orderByDesc('tanggal')
            ->orderByDesc('created_at');

        // Jenis catatan yang boleh dibaca ditentukan oleh peran pembaca TERHADAP SISWA INI,
        // bukan oleh kapabilitasnya di sekolah. Guru yang wali kelas di rombel A sekaligus
        // BK di rombel B hanya melihat catatan wali_kelas untuk siswa A, dan catatan bk
        // untuk siswa B — tidak keduanya untuk keduanya.
        if (! ClassAccess::isSchoolWide($user)) {
            $allowedJenis = [];
            if (ClassAccess::waliClassIds($user)->contains($student->class_id)) $allowedJenis[] = 'wali_kelas';
            if (ClassAccess::bkClassIds($user)->contains($student->class_id))   $allowedJenis[] = 'bk';
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

        $data = $request->validate([
            'student_id'    => ['required', 'string'],
            'jenis'         => ['required', 'in:bk,wali_kelas'],
            'catatan'       => ['required', 'string', 'max:2000'],
            'tindak_lanjut' => ['nullable', 'string', 'max:255'],
            'tanggal'       => ['required', 'date', $this->notFutureDateRule()],
            'konfidensial'  => ['boolean'],
        ], $this->notFutureDateMessages());

        $student = Student::where('uuid', $data['student_id'])->firstOrFail();

        // Jalur TULIS dulu punya cacat yang sama dengan jalur baca: wali kelas mana pun
        // boleh menulis catatan pada siswa mana pun. Sekarang jenis catatan harus cocok
        // dengan peran penulis TERHADAP KELAS SISWA INI.
        if (! ClassAccess::isSchoolWide($user)) {
            $boleh = $data['jenis'] === 'bk'
                ? ClassAccess::bkClassIds($user)->contains($student->class_id)
                : ClassAccess::waliClassIds($user)->contains($student->class_id);

            abort_unless($boleh, 403, $data['jenis'] === 'bk'
                ? 'Anda bukan Guru BK yang mengampu kelas siswa ini.'
                : 'Anda bukan wali kelas siswa ini.');
        }

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
}
