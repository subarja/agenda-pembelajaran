<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\CharacterManualNote;
use App\Models\Student;
use App\Models\User;
use App\Notifications\ManualNoteSubmittedNotification;
use App\Support\ClassAccess;
use App\Support\SessionTeacher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CharacterManualNoteController extends Controller
{
    // POST /character-manual-notes — guru submit catatan manual
    public function store(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403, 'Hanya guru yang dapat menambahkan catatan manual.');

        $data = $request->validate([
            'student_id' => ['required', 'string'],
            'catatan'    => ['required', 'string', 'max:1000'],
            'nilai'      => ['nullable', 'integer', 'min:-20', 'max:20'],
        ]);

        $student = Student::where('uuid', $data['student_id'])->with('user')->firstOrFail();

        $note = CharacterManualNote::create([
            'student_id' => $student->id,
            'teacher_id' => $teacher->id,
            // Catatan manual biasa tidak lewat jalur inval — pemberi selalu pengampunya
            // sendiri. Diisi eksplisit supaya kolom ini tidak pernah NULL.
            'atas_nama_teacher_id' => $teacher->id,
            'catatan'    => $data['catatan'],
            'nilai'      => $data['nilai'] ?? null,
            'status'     => 'pending',
        ]);

        // Notifikasi ke semua admin & wakasek
        $admins = User::whereIn('role', ['admin', 'wakasek'])->get();
        foreach ($admins as $admin) {
            $admin->notify(new ManualNoteSubmittedNotification($note, $student, $request->user()));
        }

        return response()->json([
            'message' => 'Catatan manual berhasil dikirim dan menunggu persetujuan admin.',
            'data'    => $this->formatNote($note->load(['student.user', 'teacher.user', 'atasNamaTeacher.user'])),
        ], 201);
    }

    /**
     * POST /character-manual-notes/nilai-tambah — GK32: mirip catatan manual, tapi
     * TIDAK butuh approval admin (langsung final) & deskripsi opsional.
     *
     * Berbeda dari penilaian karakter, yang sengaja lintas kelas: nilai tambah dibatasi
     * ke kelas yang diampu. Alasannya kombinasi dua sifatnya — nilainya bebas (±20, bukan
     * bobot terstandar dari admin) DAN langsung final tanpa direview siapa pun. Poin
     * sebesar itu tanpa mata kedua hanya boleh diberikan oleh guru yang benar-benar
     * mengajar atau mewalikelasi siswa tersebut.
     *
     * Satu pengecualian: guru inval. Selama jendela sesi yang ia gantikan, ia memegang
     * kelas itu dan boleh memberi nilai tambah kepada siswanya. Tapi entrinya dicatat
     * ATAS NAMA guru pengampu (`atas_nama_teacher_id`), karena rekap kelas tetap milik
     * pengampu; `teacher_id` merekam siapa yang benar-benar memberi, dan `created_at`
     * kapan. Ketiganya muncul di laporan Nilai Tambah.
     */
    public function storeNilaiTambah(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403, 'Hanya guru yang dapat menambahkan nilai tambah.');

        $data = $request->validate([
            'student_id' => ['required', 'string'],
            'nilai'      => ['required', 'integer', 'min:-20', 'max:20'],
            'catatan'    => ['nullable', 'string', 'max:1000'],
        ]);

        $student = Student::where('uuid', $data['student_id'])->with('user')->firstOrFail();

        $atasNamaTeacherId = $this->atasNamaTeacherId($request->user(), $teacher->id, $student->class_id);

        $note = CharacterManualNote::create([
            'student_id'           => $student->id,
            'teacher_id'           => $teacher->id,
            'atas_nama_teacher_id' => $atasNamaTeacherId,
            'sumber'               => 'nilai_tambah',
            'catatan'              => $data['catatan'] ?? '',
            'nilai'                => $data['nilai'],
            'nilai_final'          => $data['nilai'],
            'status'               => 'approved',
            'reviewed_at'          => now(),
        ]);

        return response()->json([
            'message' => 'Nilai tambah berhasil disimpan.',
            'data'    => $this->formatNote($note->load(['student.user', 'teacher.user', 'atasNamaTeacher.user'])),
        ], 201);
    }

    // GET /character-manual-notes?student_id=xxx — guru & BK/wali kelas lihat per siswa
    public function index(Request $request): JsonResponse
    {
        $request->validate(['student_id' => ['required', 'string']]);
        $student = Student::where('uuid', $request->student_id)->firstOrFail();

        $notes = CharacterManualNote::where('student_id', $student->id)
            ->with(['teacher.user', 'atasNamaTeacher.user', 'reviewer'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($n) => $this->formatNote($n));

        return response()->json(['data' => $notes]);
    }

    // GET /admin/character-manual-notes?status=pending — admin list
    public function adminIndex(Request $request): JsonResponse
    {
        $status = $request->get('status');

        $query = CharacterManualNote::with(['student.user', 'student.schoolClass', 'teacher.user', 'atasNamaTeacher.user', 'reviewer'])
            ->orderByDesc('created_at');

        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        $notes = $query->paginate(25);

        return response()->json([
            'data' => $notes->map(fn ($n) => $this->formatNote($n)),
            'meta' => [
                'total'        => $notes->total(),
                'current_page' => $notes->currentPage(),
                'last_page'    => $notes->lastPage(),
                'per_page'     => $notes->perPage(),
            ],
        ]);
    }

    // PUT /admin/character-manual-notes/{uuid}/review — admin acc/tolak/sesuaikan
    public function adminReview(Request $request, string $uuid): JsonResponse
    {
        $note = CharacterManualNote::where('uuid', $uuid)->with(['student.user', 'student.schoolClass'])->firstOrFail();

        $data = $request->validate([
            'action'       => ['required', 'in:approve,reject,adjust'],
            'nilai_final'  => ['required_if:action,adjust', 'nullable', 'integer', 'min:-20', 'max:20'],
            'admin_catatan'=> ['nullable', 'string', 'max:500'],
        ]);

        $now = now();
        $newStatus = match ($data['action']) {
            'approve' => 'approved',
            'reject'  => 'rejected',
            'adjust'  => 'approved',
        };

        $nilaiFinal = match ($data['action']) {
            'approve' => $note->nilai,
            'reject'  => null,
            'adjust'  => $data['nilai_final'],
        };

        $note->update([
            'status'       => $newStatus,
            'nilai_final'  => $nilaiFinal,
            'admin_catatan'=> $data['admin_catatan'] ?? null,
            'reviewed_by'  => $request->user()->id,
            'reviewed_at'  => $now,
        ]);

        return response()->json([
            'message' => match ($data['action']) {
                'approve' => 'Catatan manual disetujui.',
                'reject'  => 'Catatan manual ditolak.',
                'adjust'  => 'Catatan manual disetujui dengan nilai yang disesuaikan.',
            },
            'data' => $this->formatNote($note->fresh(['student.user', 'teacher.user', 'atasNamaTeacher.user', 'reviewer'])),
        ]);
    }

    /**
     * Boleh $teacherId memberi nilai tambah di kelas $classId? Kalau ya, atas nama siapa?
     *
     * Menolak dengan 403 kalau tidak. Mengembalikan id guru pengampu: dirinya sendiri untuk
     * kelas yang ia ampu, atau guru terjadwal kelas itu kalau ia sedang menginval di sana.
     */
    private function atasNamaTeacherId(User $user, int $teacherId, ?int $classId): int
    {
        if (ClassAccess::allows(ClassAccess::teachingClassIds($user), $classId)) {
            return $teacherId;
        }

        $inval = SessionTeacher::activeInvalClassMap($teacherId);

        abort_unless(
            $classId !== null && isset($inval[$classId]),
            403,
            'Nilai tambah hanya dapat diberikan kepada siswa di kelas yang Anda ampu, '
            .'atau kelas yang sedang Anda inval pada sesi berjalan.',
        );

        return $inval[$classId];
    }

    private function formatNote(CharacterManualNote $n): array
    {
        $kelas = $n->student?->schoolClass
            ? $n->student->schoolClass->tingkat->value . ' '
              . $n->student->schoolClass->jurusan . ' - '
              . $n->student->schoolClass->rombel
            : null;

        return [
            'id'            => (string) $n->id,
            'uuid'          => $n->uuid,
            'catatan'       => $n->catatan,
            'nilai'         => $n->nilai,
            'nilai_final'   => $n->nilai_final,
            'status'        => $n->status,
            'admin_catatan' => $n->admin_catatan,
            'reviewed_at'   => $n->reviewed_at?->format('Y-m-d H:i'),
            'student'       => [
                'id'    => $n->student?->uuid,
                'nama'  => $n->student?->user?->nama,
                'nis'   => $n->student?->nis,
                'kelas' => $kelas,
            ],
            'teacher'       => [
                'id'   => $n->teacher?->uuid,
                'nama' => $n->teacher?->user?->nama,
            ],
            // Guru pengampu yang rekapnya memuat entri ini. Beda dari `teacher` hanya
            // bila diberikan guru inval.
            'atas_nama'     => [
                'id'   => $n->atasNamaTeacher?->uuid,
                'nama' => $n->atasNamaTeacher?->user?->nama,
            ],
            'oleh_inval'    => $n->diberikanOlehInval(),
            'created_at'    => $n->created_at?->format('Y-m-d H:i'),
        ];
    }
}
