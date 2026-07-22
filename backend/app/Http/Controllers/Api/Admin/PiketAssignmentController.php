<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PiketAssignment;
use App\Models\Teacher;
use App\Support\TahunAjaran;
use App\Traits\BuildsXlsxReports;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Panel Admin -> Piket: penugasan guru piket per tanggal (scope TA aktif). Satu hari
 * boleh >1 petugas. Guru piket = KAPABILITAS (App\Support\PiketAccess), muncul hanya saat bertugas.
 */
class PiketAssignmentController extends Controller
{
    use BuildsXlsxReports;

    // ── GET /admin/piket/assignments?dari=&sampai= ───────────────────────────
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'dari' => ['nullable', 'date_format:Y-m-d'],
            'sampai' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $dari = $data['dari'] ?? Carbon::now('Asia/Jakarta')->startOfMonth()->toDateString();
        $sampai = $data['sampai'] ?? Carbon::now('Asia/Jakarta')->endOfMonth()->toDateString();

        $rows = PiketAssignment::tahunAjaran()
            ->with('teacher.user')
            ->whereBetween('tanggal', [$dari, $sampai])
            ->orderBy('tanggal')
            ->get()
            ->map(fn ($a) => [
                'id' => $a->id,
                'tanggal' => $a->tanggal->toDateString(),
                'teacher_id' => $a->teacher?->uuid,
                'nama_guru' => $a->teacher?->user?->nama,
            ]);

        return response()->json(['data' => $rows, 'range' => ['dari' => $dari, 'sampai' => $sampai]]);
    }

    // ── POST /admin/piket/assignments ────────────────────────────────────────
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tanggal' => ['required', 'date_format:Y-m-d'],
            'teacher_uuid' => ['required', 'array', 'min:1'],
            'teacher_uuid.*' => ['string'],
        ]);

        $ditambah = 0;
        foreach ($data['teacher_uuid'] as $uuid) {
            $teacher = Teacher::where('uuid', $uuid)->first();
            if (! $teacher) {
                continue;
            }
            PiketAssignment::updateOrCreate(
                ['academic_year_id' => TahunAjaran::id(), 'tanggal' => $data['tanggal'], 'teacher_id' => $teacher->id],
                ['dibuat_oleh' => $request->user()->id],
            );
            $ditambah++;
        }

        return response()->json(['message' => "$ditambah penugasan piket disimpan."], 201);
    }

    // ── DELETE /admin/piket/assignments/{assignment} ─────────────────────────
    public function destroy(PiketAssignment $assignment): JsonResponse
    {
        $assignment->delete();

        return response()->json(['message' => 'Penugasan piket dihapus.']);
    }

    // ── GET /admin/piket/template ────────────────────────────────────────────
    public function template(): BinaryFileResponse
    {
        $headers = ['tanggal', 'nama_guru'];
        $example = [
            ['2026-08-03', 'Budi Santoso'],
            ['2026-08-03', 'Siti Aminah'],
            ['2026-08-04', 'Budi Santoso'],
        ];

        $tempFile = tempnam(sys_get_temp_dir(), 'piket_tpl_');
        $writer = new XlsxWriter;
        $writer->openToFile($tempFile);
        $writer->getOptions()->setColumnWidthForRange(24, 1, count($headers));
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
    // Format: tanggal | nama_guru (satu baris = satu guru pada satu tanggal).
    public function import(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls', 'max:2048']]);

        $rows = $this->readXlsx($request->file('file')->getRealPath());
        $errors = [];
        $imported = 0;

        foreach ($rows as $i => $row) {
            $rowNum = $i + 2;
            $tanggal = $this->normalizeDate($row[0] ?? '');
            $nama = trim((string) ($row[1] ?? ''));

            if (! $tanggal) {
                $errors[] = "Baris $rowNum: tanggal tidak valid (format YYYY-MM-DD).";

                continue;
            }
            if ($nama === '') {
                $errors[] = "Baris $rowNum: nama guru kosong.";

                continue;
            }

            $matches = Teacher::whereHas('user', fn ($q) => $q->whereRaw('LOWER(nama) = ?', [mb_strtolower($nama)]))->get();
            if ($matches->isEmpty()) {
                $errors[] = "Baris $rowNum: guru \"$nama\" tidak ditemukan.";

                continue;
            }
            if ($matches->count() > 1) {
                $errors[] = "Baris $rowNum: nama guru \"$nama\" ganda, tidak bisa dipastikan.";

                continue;
            }

            PiketAssignment::updateOrCreate(
                ['academic_year_id' => TahunAjaran::id(), 'tanggal' => $tanggal, 'teacher_id' => $matches->first()->id],
                ['dibuat_oleh' => $request->user()->id],
            );
            $imported++;
        }

        return response()->json([
            'message' => "Berhasil mengimpor $imported penugasan piket.",
            'imported' => $imported,
            'error_count' => count($errors),
            'errors' => $errors,
        ], $imported > 0 ? 200 : 422);
    }

    private function normalizeDate(mixed $val): ?string
    {
        if ($val instanceof \DateTimeInterface) {
            return $val->format('Y-m-d');
        }
        $s = trim((string) $val);
        if ($s === '') {
            return null;
        }
        try {
            return Carbon::parse($s)->format('Y-m-d');
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
