<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\LearningObjectiveResource;
use App\Models\AcademicYear;
use App\Models\LearningObjective;
use App\Models\LearningObjectiveLog;
use App\Models\Schedule;
use App\Models\Subject;
use App\Models\User;
use App\Support\ClassAccess;
use App\Traits\BuildsXlsxReports;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class LearningObjectiveController extends Controller
{
    use BuildsXlsxReports;

    // ── GET /learning-objectives ──────────────────────────────────────────────
    public function index(Request $request): JsonResponse
    {
        // Path A: via schedule_id (dari agenda form)
        if ($request->filled('schedule_id')) {
            $schedule = Schedule::where('uuid', $request->schedule_id)
                ->with('schoolClass')
                ->firstOrFail();

            $fase     = $schedule->schoolClass->tingkat->value === 'X' ? 'E' : 'F';
            $semester = Carbon::now('Asia/Jakarta')->month <= 6 ? 'genap' : 'ganjil';
            $year     = $this->activeYear();

            $objectives = LearningObjective::where('subject_id', $schedule->subject_id)
                ->where('fase', $fase)
                ->where('semester', $semester)
                ->where('academic_year_id', $year?->id)
                ->where('aktif', true)
                ->orderBy('urutan')
                ->get();

            return response()->json(['data' => LearningObjectiveResource::collection($objectives)]);
        }

        // Path B: via subject_id + fase + semester (dari halaman manajemen TP)
        $request->validate([
            'subject_id' => ['required', 'string'],
            'fase'       => ['required', 'in:E,F'],
            'semester'   => ['sometimes', 'in:ganjil,genap'],
        ]);

        $subject = Subject::where('uuid', $request->subject_id)->firstOrFail();
        $year    = $this->activeYear();

        $objectives = LearningObjective::where('subject_id', $subject->id)
            ->where('fase', $request->fase)
            ->where('academic_year_id', $year?->id)
            ->when($request->filled('semester'), fn ($q) => $q->where('semester', $request->semester))
            ->with('updatedByUser')
            ->orderBy('semester')
            ->orderBy('urutan')
            ->get();

        return response()->json(['data' => LearningObjectiveResource::collection($objectives)]);
    }

    // ── GET /learning-objectives/my-contexts ──────────────────────────────────
    public function myContexts(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403);

        $contexts = $teacher->schedules()
            ->tahunAjaran()
            ->where('aktif', true)
            ->with(['schoolClass', 'subject'])
            ->get()
            ->map(fn ($s) => [
                'subject_id'   => $s->subject->uuid,
                'subject_nama' => $s->subject->nama,
                'subject_kode' => $s->subject->kode,
                'fase'         => $s->schoolClass->tingkat->value === 'X' ? 'E' : 'F',
                'fase_label'   => $s->schoolClass->tingkat->value === 'X'
                    ? 'Fase E (Kelas X)'
                    : 'Fase F (Kelas XI & XII)',
            ])
            ->unique(fn ($item) => $item['subject_id'] . '|' . $item['fase'])
            ->values();

        return response()->json(['data' => $contexts]);
    }

    // ── POST /learning-objectives ─────────────────────────────────────────────
    public function store(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403);

        $data = $request->validate([
            'subject_id' => ['required', 'string'],
            'fase'       => ['required', 'in:E,F'],
            'kode'       => ['required', 'string', 'max:20'],
            'deskripsi'  => ['required', 'string', 'max:500'],
            'urutan'     => ['required', 'integer', 'min:1'],
            'semester'   => ['required', 'in:ganjil,genap'],
        ]);

        $subject = Subject::where('uuid', $data['subject_id'])->firstOrFail();
        $year    = $this->activeYear();
        abort_if(! $year, 422, 'Tidak ada tahun ajaran aktif.');

        $this->authorizeTeacherForSubjectFase($teacher, $subject->id, $data['fase']);

        abort_if(
            LearningObjective::where('subject_id', $subject->id)
                ->where('fase', $data['fase'])
                ->where('kode', $data['kode'])
                ->where('semester', $data['semester'])
                ->where('academic_year_id', $year->id)
                ->exists(),
            422,
            'Kode TP sudah ada untuk mata pelajaran, fase, dan semester yang sama.'
        );

        $lo = LearningObjective::create([
            'subject_id'       => $subject->id,
            'fase'             => $data['fase'],
            'academic_year_id' => $year->id,
            'kode'             => $data['kode'],
            'deskripsi'        => $data['deskripsi'],
            'urutan'           => $data['urutan'],
            'semester'         => $data['semester'],
            'aktif'            => true,
        ]);

        $this->writeLog($lo, 'create', null, $request->user());

        return response()->json([
            'message' => 'Tujuan Pembelajaran berhasil ditambahkan.',
            'data'    => new LearningObjectiveResource($lo),
        ], 201);
    }

    // ── PUT /learning-objectives/{uuid} ──────────────────────────────────────
    public function update(Request $request, string $uuid): JsonResponse
    {
        $teacher = $request->user()->teacher;
        $lo      = LearningObjective::where('uuid', $uuid)->firstOrFail();

        $this->authorizeTeacherForSubjectFase($teacher, $lo->subject_id, $lo->fase);

        $data = $request->validate([
            'kode'      => ['sometimes', 'string', 'max:20'],
            'deskripsi' => ['sometimes', 'string', 'max:500'],
            'urutan'    => ['sometimes', 'integer', 'min:1'],
            'semester'  => ['sometimes', 'in:ganjil,genap'],
            'aktif'     => ['sometimes', 'boolean'],
        ]);

        $snapshot = [
            'kode'      => $lo->kode,
            'deskripsi' => $lo->deskripsi,
            'urutan'    => $lo->urutan,
            'semester'  => $lo->semester->value,
            'aktif'     => $lo->aktif,
        ];

        $lo->update($data);
        $this->writeLog($lo, 'update', $snapshot, $request->user());

        return response()->json([
            'message' => 'Tujuan Pembelajaran berhasil diperbarui.',
            'data'    => new LearningObjectiveResource($lo->fresh(['updatedByUser'])),
        ]);
    }

    // ── DELETE /learning-objectives/{uuid} ───────────────────────────────────
    public function destroy(Request $request, string $uuid): JsonResponse
    {
        $teacher = $request->user()->teacher;
        $lo      = LearningObjective::where('uuid', $uuid)->firstOrFail();

        $this->authorizeTeacherForSubjectFase($teacher, $lo->subject_id, $lo->fase);

        $snapshot = [
            'kode'      => $lo->kode,
            'deskripsi' => $lo->deskripsi,
            'urutan'    => $lo->urutan,
            'semester'  => $lo->semester->value,
            'aktif'     => $lo->aktif,
        ];

        $lo->delete();
        $this->writeLog($lo, 'delete', $snapshot, $request->user());

        return response()->json(['message' => 'Tujuan Pembelajaran berhasil dihapus.']);
    }

    // ── GET /learning-objectives/logs ────────────────────────────────────────
    public function logs(Request $request): JsonResponse
    {
        $request->validate([
            'subject_id' => ['required', 'string'],
            'fase'       => ['required', 'in:E,F'],
        ]);

        $subject = Subject::where('uuid', $request->subject_id)->firstOrFail();
        $year    = $this->activeYear();

        // Akses: guru yang mengajar mapel ini di fase ini, atau admin/wakasek.
        //
        // Kondisi lama `in_array($user->role, ['admin','wakasek'])` selalu false — `role`
        // sudah di-cast ke enum UserRole, dan perbandingan longgar enum↔string di PHP 8
        // tidak pernah cocok. Admin & wakasek karenanya ikut masuk cabang guru lalu
        // ditolak 403 oleh `abort_if(! $teacher)`: riwayat TP tidak pernah bisa mereka buka.
        $user = $request->user();
        if (! ClassAccess::isSchoolWide($user)) {
            $teacher = $user->teacher;
            abort_if(! $teacher, 403, 'Akun ini tidak terhubung ke data guru.');
            $this->authorizeTeacherForSubjectFase($teacher, $subject->id, $request->fase);
        }

        $loIds = LearningObjective::withTrashed()
            ->where('subject_id', $subject->id)
            ->where('fase', $request->fase)
            ->where('academic_year_id', $year?->id)
            ->pluck('id');

        $logs = LearningObjectiveLog::whereIn('learning_objective_id', $loIds)
            ->with(['changedBy', 'learningObjective'])
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(fn ($l) => [
                'uuid'       => $l->uuid,
                'action'     => $l->action,
                'changed_by' => $l->changedBy?->nama ?? '—',
                'tp_kode'    => $l->learningObjective?->kode ?? ($l->snapshot['kode'] ?? '—'),
                'snapshot'   => $l->snapshot,
                'created_at' => $l->created_at?->format('Y-m-d H:i'),
            ]);

        return response()->json(['data' => $logs]);
    }

    // ── POST /admin/learning-objectives/revert/{uuid} ────────────────────────
    public function adminRevert(Request $request, string $logUuid): JsonResponse
    {
        $log = LearningObjectiveLog::where('uuid', $logUuid)
            ->with('learningObjective')
            ->firstOrFail();

        $lo       = $log->learningObjective;
        $snapshot = $log->snapshot;

        if ($log->action === 'create') {
            // Kembalikan dari create = hapus TP tersebut
            abort_if(! $lo, 404, 'TP sudah tidak ada.');
            $beforeRevert = [
                'kode' => $lo->kode, 'deskripsi' => $lo->deskripsi,
                'urutan' => $lo->urutan, 'semester' => $lo->semester->value,
            ];
            $lo->delete();
            $this->writeLog($lo, 'restore', $beforeRevert, $request->user());
        } elseif ($log->action === 'delete' && $lo?->trashed()) {
            // Kembalikan dari delete = restore + isi dari snapshot
            $beforeRevert = null;
            $lo->restore();
            if ($snapshot) {
                $lo->update([
                    'kode'      => $snapshot['kode'],
                    'deskripsi' => $snapshot['deskripsi'],
                    'urutan'    => $snapshot['urutan'],
                    'aktif'     => $snapshot['aktif'] ?? true,
                ]);
            }
            $this->writeLog($lo, 'restore', $beforeRevert, $request->user());
        } elseif ($snapshot && $lo) {
            // Kembalikan update ke state sebelumnya
            $beforeRevert = [
                'kode'      => $lo->kode,
                'deskripsi' => $lo->deskripsi,
                'urutan'    => $lo->urutan,
                'semester'  => $lo->semester->value,
                'aktif'     => $lo->aktif,
            ];
            $lo->update([
                'kode'      => $snapshot['kode'],
                'deskripsi' => $snapshot['deskripsi'],
                'urutan'    => $snapshot['urutan'],
                'aktif'     => $snapshot['aktif'] ?? $lo->aktif,
            ]);
            $this->writeLog($lo, 'restore', $beforeRevert, $request->user());
        } else {
            abort(422, 'Log ini tidak dapat dikembalikan.');
        }

        return response()->json(['message' => 'TP berhasil dikembalikan ke versi sebelumnya.']);
    }

    // ── Template Excel ────────────────────────────────────────────────────────
    // GK21: identitas mapel/fase/semester disematkan di nama file DAN baris info di
    // sheet (styling abu-abu "read-only" secara konvensi — OpenSpout tidak mendukung
    // proteksi sel/sheet, jadi ini bukan penguncian teknis, hanya penanda visual).
    public function template(Request $request): BinaryFileResponse
    {
        $subjectNama  = 'Umum';
        $faseLabel    = '';
        $semesterLabel = '';
        $filenameParts = ['Template_TP'];

        if ($request->filled('subject_id')) {
            $subject = Subject::where('uuid', $request->subject_id)->first();
            if ($subject) {
                $subjectNama = $subject->nama;
                $filenameParts[] = preg_replace('/[^A-Za-z0-9]+/', '_', $subject->nama);
            }
        }
        if ($request->filled('fase')) {
            $faseLabel = $request->fase === 'E' ? 'Fase E (Kelas X)' : 'Fase F (Kelas XI & XII)';
            $filenameParts[] = 'Fase' . $request->fase;
        }
        if ($request->filled('semester')) {
            $semesterLabel = ucfirst($request->semester);
            $filenameParts[] = ucfirst($request->semester);
        }

        $filename = implode('_', $filenameParts) . '.xlsx';

        $tempFile = tempnam(sys_get_temp_dir(), 'tp_tpl_');
        $writer   = new XlsxWriter();
        $writer->openToFile($tempFile);
        $this->xlsxSetColumnWidths($writer, [1 => 10, 2 => 55, 3 => 10]);

        $infoStyle = (new \OpenSpout\Common\Entity\Style\Style())
            ->withBackgroundColor('F1F5F9')->withFontColor('64748B')->withFontItalic(true);
        $writer->addRow(Row::fromValuesWithStyle(['Mata Pelajaran:', $subjectNama, ''], $infoStyle));
        $writer->addRow(Row::fromValuesWithStyle(['Fase:', $faseLabel ?: '-', ''], $infoStyle));
        $writer->addRow(Row::fromValuesWithStyle(['Semester:', $semesterLabel ?: '-', ''], $infoStyle));
        $writer->addRow(Row::fromValuesWithStyle(['', '', ''], $infoStyle));

        $writer->addRow(Row::fromValuesWithStyle(['kode', 'deskripsi', 'urutan'], $this->xlsxHeaderStyle()));
        $cellStyle = $this->xlsxCellStyle();
        $writer->addRow(Row::fromValuesWithStyle(['3.1', 'Peserta didik mampu memahami konsep dasar pemrograman', '1'], $cellStyle));
        $writer->addRow(Row::fromValuesWithStyle(['3.2', 'Peserta didik mampu menerapkan konsep berorientasi objek', '2'], $cellStyle));
        $writer->addRow(Row::fromValuesWithStyle(['4.1', 'Peserta didik mampu membuat program sederhana', '3'], $cellStyle));
        $writer->close();

        return response()->download($tempFile, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    // ── Import Excel ──────────────────────────────────────────────────────────
    public function import(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403);

        $request->validate([
            'file'       => ['required', 'file', 'mimes:xlsx,xls', 'max:5120'],
            'subject_id' => ['required', 'string'],
            'fase'       => ['required', 'in:E,F'],
            'semester'   => ['required', 'in:ganjil,genap'],
        ]);

        $subject = Subject::where('uuid', $request->subject_id)->firstOrFail();
        $year    = $this->activeYear();
        abort_if(! $year, 422, 'Tidak ada tahun ajaran aktif.');

        $this->authorizeTeacherForSubjectFase($teacher, $subject->id, $request->fase);

        $reader  = new XlsxReader();
        $reader->open($request->file('file')->getRealPath());

        $inserted = 0;
        $updated  = 0;
        $errors   = [];
        $rowNum   = 0;
        $headerFound = false;

        foreach ($reader->getSheetIterator() as $sheet) {
            foreach ($sheet->getRowIterator() as $row) {
                $rowNum++;
                $values = $row->toArray();

                // GK21: template sekarang punya baris info identitas (Mata Pelajaran/
                // Fase/Semester) sebelum header — lewati semua baris sampai ketemu
                // baris header literal "kode" di kolom pertama, baru mulai baca data.
                if (! $headerFound) {
                    if (trim((string) ($values[0] ?? '')) === 'kode') {
                        $headerFound = true;
                    }
                    continue;
                }

                $kode      = trim((string) ($values[0] ?? ''));
                $deskripsi = trim((string) ($values[1] ?? ''));
                $urutan    = (isset($values[2]) && $values[2] !== '') ? (int) $values[2] : null;

                if ($kode === '' && $deskripsi === '') continue;

                if ($kode === '') { $errors[] = "Baris {$rowNum}: kolom kode wajib diisi."; continue; }
                if ($deskripsi === '') { $errors[] = "Baris {$rowNum}: kolom deskripsi wajib diisi."; continue; }
                if (strlen($kode) > 20) { $errors[] = "Baris {$rowNum}: kode '{$kode}' melebihi 20 karakter."; continue; }
                if (strlen($deskripsi) > 500) { $errors[] = "Baris {$rowNum}: deskripsi terlalu panjang (maks 500 karakter)."; continue; }

                $existing = LearningObjective::where('subject_id', $subject->id)
                    ->where('fase', $request->fase)
                    ->where('kode', $kode)
                    ->where('semester', $request->semester)
                    ->where('academic_year_id', $year->id)
                    ->first();

                if ($existing) {
                    $snapshot = [
                        'kode' => $existing->kode, 'deskripsi' => $existing->deskripsi,
                        'urutan' => $existing->urutan, 'semester' => $existing->semester->value,
                        'aktif' => $existing->aktif,
                    ];
                    $existing->update([
                        'deskripsi' => $deskripsi,
                        'urutan'    => $urutan ?? $existing->urutan,
                    ]);
                    $this->writeLog($existing, 'update', $snapshot, $request->user());
                    $updated++;
                } else {
                    $lo = LearningObjective::create([
                        'subject_id'       => $subject->id,
                        'fase'             => $request->fase,
                        'academic_year_id' => $year->id,
                        'kode'             => $kode,
                        'deskripsi'        => $deskripsi,
                        'urutan'           => $urutan ?? ($inserted + $updated + 1),
                        'semester'         => $request->semester,
                        'aktif'            => true,
                    ]);
                    $this->writeLog($lo, 'create', null, $request->user());
                    $inserted++;
                }
            }
            break;
        }

        $reader->close();

        return response()->json([
            'message'  => "Import selesai: {$inserted} ditambahkan, {$updated} diperbarui.",
            'inserted' => $inserted,
            'updated'  => $updated,
            'errors'   => $errors,
        ]);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private function activeYear(): ?AcademicYear
    {
        return \App\Support\TahunAjaran::current();
    }

    private function writeLog(LearningObjective $lo, string $action, ?array $snapshot, User $user): void
    {
        LearningObjectiveLog::create([
            'learning_objective_id' => $lo->id,
            'changed_by'            => $user->id,
            'action'                => $action,
            'snapshot'              => $snapshot,
        ]);
    }

    private function authorizeTeacherForSubjectFase($teacher, int $subjectId, string $fase): void
    {
        if (! $teacher) {
            abort(403, 'Hanya guru yang dapat mengelola Tujuan Pembelajaran.');
        }

        $tingkat = $fase === 'E' ? ['X'] : ['XI', 'XII'];

        $hasSchedule = Schedule::tahunAjaran()
            ->where('teacher_id', $teacher->id)
            ->where('subject_id', $subjectId)
            ->where('aktif', true)
            ->whereHas('schoolClass', fn ($q) => $q->whereIn('tingkat', $tingkat))
            ->exists();

        abort_if(
            ! $hasSchedule,
            403,
            'Anda tidak memiliki jadwal mengajar untuk mata pelajaran dan fase ini.'
        );
    }
}
