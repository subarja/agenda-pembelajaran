<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PiketShift;
use App\Models\Teacher;
use App\Support\TahunAjaran;
use App\Traits\BuildsXlsxReports;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Panel Admin -> Piket: pola mingguan petugas piket per HARI × SHIFT (scope TA aktif).
 * Setup sekali, berulang tiap minggu. Guru piket = KAPABILITAS (App\Support\PiketAccess),
 * muncul otomatis pada hari ia bertugas — tanpa input per tanggal.
 *
 * Hari didukung: Senin–Jumat. Shift dalam satu hari TIDAK boleh tumpang tindih jam.
 */
class PiketShiftController extends Controller
{
    use BuildsXlsxReports;

    /** Hari yang didukung untuk piket (Senin–Jumat). */
    private const HARI = ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];

    private const HARI_LABEL = [
        'senin' => 'Senin', 'selasa' => 'Selasa', 'rabu' => 'Rabu',
        'kamis' => 'Kamis', 'jumat' => 'Jumat',
    ];

    // ── GET /admin/piket/shifts ──────────────────────────────────────────────
    public function index(): JsonResponse
    {
        $shifts = PiketShift::tahunAjaran()
            ->with('teachers.user')
            ->orderBy('hari')
            ->orderBy('urutan')
            ->orderBy('jam_mulai')
            ->get()
            ->map(fn ($s) => $this->present($s));

        return response()->json([
            'data' => $shifts,
            'hari' => array_map(fn ($h) => ['value' => $h, 'label' => self::HARI_LABEL[$h]], self::HARI),
        ]);
    }

    // ── POST /admin/piket/shifts ─────────────────────────────────────────────
    public function store(Request $request): JsonResponse
    {
        $data = $this->validateShift($request);
        $this->assertNoOverlap($data['hari'], $data['jam_mulai'], $data['jam_selesai']);
        $this->assertNamaUnik($data['hari'], $data['nama_shift']);

        $shift = PiketShift::create([
            'academic_year_id' => TahunAjaran::id(),
            'hari' => $data['hari'],
            'nama_shift' => $data['nama_shift'],
            'jam_mulai' => $data['jam_mulai'],
            'jam_selesai' => $data['jam_selesai'],
            'urutan' => $data['urutan'] ?? 0,
        ]);

        return response()->json(['message' => 'Shift piket dibuat.', 'data' => $this->present($shift->load('teachers.user'))], 201);
    }

    // ── PUT /admin/piket/shifts/{shift} ──────────────────────────────────────
    public function update(Request $request, PiketShift $shift): JsonResponse
    {
        $this->assertScope($shift);
        $data = $this->validateShift($request);
        $this->assertNoOverlap($data['hari'], $data['jam_mulai'], $data['jam_selesai'], $shift->id);
        $this->assertNamaUnik($data['hari'], $data['nama_shift'], $shift->id);

        $shift->update([
            'hari' => $data['hari'],
            'nama_shift' => $data['nama_shift'],
            'jam_mulai' => $data['jam_mulai'],
            'jam_selesai' => $data['jam_selesai'],
            'urutan' => $data['urutan'] ?? $shift->urutan,
        ]);

        return response()->json(['message' => 'Shift piket diperbarui.', 'data' => $this->present($shift->load('teachers.user'))]);
    }

    // ── PUT /admin/piket/shifts/{shift}/petugas ──────────────────────────────
    public function setPetugas(Request $request, PiketShift $shift): JsonResponse
    {
        $this->assertScope($shift);
        $data = $request->validate([
            'teacher_uuid' => ['present', 'array'],
            'teacher_uuid.*' => ['string'],
        ]);

        $ids = Teacher::whereIn('uuid', $data['teacher_uuid'])->pluck('id')->all();
        $shift->teachers()->sync($ids);

        return response()->json(['message' => 'Petugas shift diperbarui.', 'data' => $this->present($shift->load('teachers.user'))]);
    }

    // ── DELETE /admin/piket/shifts/{shift} ───────────────────────────────────
    public function destroy(PiketShift $shift): JsonResponse
    {
        $this->assertScope($shift);
        $shift->delete();

        return response()->json(['message' => 'Shift piket dihapus.']);
    }

    // ── GET /admin/piket/template ────────────────────────────────────────────
    public function template(): BinaryFileResponse
    {
        $headers = ['hari', 'nama_shift', 'jam_mulai', 'jam_selesai', 'nama_guru'];
        $example = [
            ['senin', 'Pagi', '06:00', '11:00', 'Budi Santoso'],
            ['senin', 'Pagi', '06:00', '11:00', 'Siti Aminah'],
            ['senin', 'Siang', '11:00', '15:00', 'Ahmad Fauzi'],
        ];

        $tempFile = tempnam(sys_get_temp_dir(), 'piket_tpl_');
        $writer = new XlsxWriter;
        $writer->openToFile($tempFile);
        $writer->getOptions()->setColumnWidthForRange(20, 1, count($headers));
        $writer->addRow(Row::fromValuesWithStyle($headers, $this->xlsxHeaderStyle()));
        foreach ($example as $ex) {
            $writer->addRow(Row::fromValuesWithStyle($ex, $this->xlsxCellStyle()));
        }
        $writer->close();

        return response()->download($tempFile, 'template_piket.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    // ── POST /admin/piket/import ─────────────────────────────────────────────
    // Format: hari | nama_shift | jam_mulai | jam_selesai | nama_guru
    // Satu baris = satu guru pada satu shift-hari. Shift dibuat/dilengkapi otomatis.
    public function import(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls', 'max:2048']]);

        $rows = $this->readXlsx($request->file('file')->getRealPath());
        $errors = [];
        $imported = 0;

        foreach ($rows as $i => $row) {
            $rowNum = $i + 2;
            $hari = mb_strtolower(trim((string) ($row[0] ?? '')));
            $namaShift = trim((string) ($row[1] ?? ''));
            $jamMulai = $this->normalizeTime($row[2] ?? '');
            $jamSelesai = $this->normalizeTime($row[3] ?? '');
            $namaGuru = trim((string) ($row[4] ?? ''));

            if (! in_array($hari, self::HARI, true)) {
                $errors[] = "Baris $rowNum: hari \"$hari\" tidak valid (senin–jumat).";

                continue;
            }
            if ($namaShift === '') {
                $errors[] = "Baris $rowNum: nama_shift kosong.";

                continue;
            }
            if (! $jamMulai || ! $jamSelesai) {
                $errors[] = "Baris $rowNum: jam_mulai/jam_selesai tidak valid (format HH:MM).";

                continue;
            }
            if ($jamMulai >= $jamSelesai) {
                $errors[] = "Baris $rowNum: jam_mulai harus lebih awal dari jam_selesai.";

                continue;
            }
            if ($namaGuru === '') {
                $errors[] = "Baris $rowNum: nama_guru kosong.";

                continue;
            }

            $matches = Teacher::whereHas('user', fn ($q) => $q->whereRaw('LOWER(nama) = ?', [mb_strtolower($namaGuru)]))->get();
            if ($matches->isEmpty()) {
                $errors[] = "Baris $rowNum: guru \"$namaGuru\" tidak ditemukan.";

                continue;
            }
            if ($matches->count() > 1) {
                $errors[] = "Baris $rowNum: nama guru \"$namaGuru\" ganda, tidak bisa dipastikan.";

                continue;
            }

            $shift = PiketShift::updateOrCreate(
                ['academic_year_id' => TahunAjaran::id(), 'hari' => $hari, 'nama_shift' => $namaShift],
                ['jam_mulai' => $jamMulai, 'jam_selesai' => $jamSelesai],
            );
            $shift->teachers()->syncWithoutDetaching([$matches->first()->id]);
            $imported++;
        }

        return response()->json([
            'message' => "Berhasil mengimpor $imported baris penugasan piket.",
            'imported' => $imported,
            'error_count' => count($errors),
            'errors' => $errors,
        ], $imported > 0 ? 200 : 422);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function present(PiketShift $s): array
    {
        return [
            'id' => $s->id,
            'hari' => $s->hari->value,
            'nama_shift' => $s->nama_shift,
            'jam_mulai' => $this->hhmm($s->jam_mulai),
            'jam_selesai' => $this->hhmm($s->jam_selesai),
            'urutan' => $s->urutan,
            'petugas' => $s->teachers->map(fn ($t) => [
                'id' => $t->uuid,
                'nama' => $t->user?->nama,
            ])->values(),
        ];
    }

    /** @return array{hari:string,nama_shift:string,jam_mulai:string,jam_selesai:string,urutan:?int} */
    private function validateShift(Request $request): array
    {
        $data = $request->validate([
            'hari' => ['required', Rule::in(self::HARI)],
            'nama_shift' => ['required', 'string', 'max:50'],
            'jam_mulai' => ['required', 'date_format:H:i'],
            'jam_selesai' => ['required', 'date_format:H:i'],
            'urutan' => ['nullable', 'integer', 'min:0', 'max:255'],
        ]);

        if ($data['jam_mulai'] >= $data['jam_selesai']) {
            abort(422, 'Jam mulai harus lebih awal dari jam selesai.');
        }

        return $data;
    }

    private function assertScope(PiketShift $shift): void
    {
        abort_unless($shift->academic_year_id === TahunAjaran::id(), 404, 'Shift tidak ditemukan.');
    }

    /** Larang shift tumpang tindih jam pada hari yang sama (batas [mulai, selesai)). */
    private function assertNoOverlap(string $hari, string $mulai, string $selesai, ?int $exceptId = null): void
    {
        $mulaiN = $this->norm($mulai);
        $selesaiN = $this->norm($selesai);

        $bentrok = PiketShift::tahunAjaran()
            ->where('hari', $hari)
            ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))
            ->get()
            ->first(fn ($s) => $mulaiN < $this->norm($s->jam_selesai) && $this->norm($s->jam_mulai) < $selesaiN);

        if ($bentrok) {
            abort(422, "Jam shift bentrok dengan \"{$bentrok->nama_shift}\" ({$this->hhmm($bentrok->jam_mulai)}–{$this->hhmm($bentrok->jam_selesai)}).");
        }
    }

    private function assertNamaUnik(string $hari, string $nama, ?int $exceptId = null): void
    {
        $ada = PiketShift::tahunAjaran()
            ->where('hari', $hari)
            ->whereRaw('LOWER(nama_shift) = ?', [mb_strtolower($nama)])
            ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))
            ->exists();

        if ($ada) {
            abort(422, "Nama shift \"$nama\" sudah ada pada hari itu.");
        }
    }

    private function norm(string $jam): string
    {
        try {
            return Carbon::parse($jam)->format('H:i:s');
        } catch (\Throwable) {
            return '00:00:00';
        }
    }

    private function hhmm(?string $jam): string
    {
        try {
            return Carbon::parse($jam)->format('H:i');
        } catch (\Throwable) {
            return (string) $jam;
        }
    }

    private function normalizeTime(mixed $val): ?string
    {
        if ($val instanceof \DateTimeInterface) {
            return $val->format('H:i');
        }
        $s = trim((string) $val);
        if ($s === '') {
            return null;
        }
        try {
            return Carbon::parse($s)->format('H:i');
        } catch (\Throwable) {
            return null;
        }
    }

    private function readXlsx(string $path): array
    {
        $reader = new XlsxReader;
        $reader->open($path);
        $rows = [];
        $sheetCount = 0;
        foreach ($reader->getSheetIterator() as $sheet) {
            if ($sheetCount++ > 0) {
                break;
            }
            $firstRow = true;
            foreach ($sheet->getRowIterator() as $row) {
                if ($firstRow) {
                    $firstRow = false;

                    continue;
                }
                $values = $row->toArray();
                if (empty(array_filter($values, fn ($v) => $v !== '' && $v !== null))) {
                    continue;
                }
                $rows[] = $values;
            }
        }
        $reader->close();

        return $rows;
    }
}
