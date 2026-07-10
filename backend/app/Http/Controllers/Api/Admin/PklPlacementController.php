<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PklPlacement;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Teacher;
use App\Support\PklMode;
use App\Traits\BuildsXlsxReports;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Impor & kelola data penempatan PKL (admin).
 *
 * Pencocokan sengaja ketat (pelajaran dari duplikasi akun guru akibat fuzzy-match longgar):
 * siswa dicocokkan lewat NISN (unik), guru pembimbing lewat nama persis. Nol/ganda → error
 * baris yang jelas, bukan menebak.
 */
class PklPlacementController extends Controller
{
    use BuildsXlsxReports;

    private const HEADERS = [
        'Nama', 'NISN', 'Kelas', 'Tempat PKL', 'Alamat PKL', 'Awal PKL', 'Akhir PKL', 'Guru Pembimbing',
    ];

    public function template(): BinaryFileResponse
    {
        $example = [
            'Ahmad Fauzi', '0012345678', 'XII Rekayasa Perangkat Lunak A',
            'PT Teknologi Nusantara', 'Jl. Merdeka No. 10, Bandung', '2026-07-01', '2026-12-20', 'Budi Santoso, S.Kom.',
        ];
        $notes = [
            'nama siswa (referensi saja)', 'NISN siswa — kunci pencocokan, WAJIB',
            'contoh: XII Rekayasa Perangkat Lunak A (harus kelas XII)', 'nama tempat/DU-DI',
            'alamat tempat PKL', 'YYYY-MM-DD', 'YYYY-MM-DD', 'nama lengkap guru pembimbing (harus persis)',
        ];

        $tempFile = tempnam(sys_get_temp_dir(), 'pkl_tpl_');
        $writer   = new XlsxWriter();
        $writer->openToFile($tempFile);
        $writer->getOptions()->setColumnWidthForRange(24, 1, count(self::HEADERS));

        $writer->addRow(Row::fromValuesWithStyle(self::HEADERS, $this->xlsxHeaderStyle()));
        $writer->addRow(Row::fromValuesWithStyle($example, $this->xlsxCellStyle()));
        $writer->addRow(Row::fromValuesWithStyle($notes, (new Style())->withFontItalic(true)->withFontColor('6B7280')));
        $writer->close();

        return response()->download($tempFile, 'template_pkl.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    public function import(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls', 'max:5120']]);

        $ayId = PklMode::activeAcademicYearId();
        abort_if(! $ayId, 422, 'Belum ada tahun ajaran aktif.');

        $rows    = $this->readXlsx($request->file('file')->getRealPath());
        $success = 0;
        $errors  = [];

        foreach ($rows as $i => $row) {
            $rowNum  = $i + 2;
            $nisn    = trim((string) ($row[1] ?? ''));
            $kelas   = trim((string) ($row[2] ?? ''));
            $tempat  = trim((string) ($row[3] ?? ''));
            $alamat  = trim((string) ($row[4] ?? '')) ?: null;
            $mulai   = $this->parseDate($row[5] ?? null);
            $selesai = $this->parseDate($row[6] ?? null);
            $guru    = trim((string) ($row[7] ?? ''));

            if ($nisn === '' && $tempat === '') continue;

            if ($nisn === '')  { $errors[] = "Baris $rowNum: NISN wajib diisi."; continue; }
            if ($tempat === '') { $errors[] = "Baris $rowNum: Tempat PKL wajib diisi."; continue; }
            if (! $mulai || ! $selesai) { $errors[] = "Baris $rowNum: Tanggal awal/akhir PKL tidak valid (YYYY-MM-DD)."; continue; }
            if ($selesai->lt($mulai)) { $errors[] = "Baris $rowNum: Akhir PKL mendahului Awal PKL."; continue; }

            $student = Student::where('nisn', $nisn)->first();
            if (! $student) { $errors[] = "Baris $rowNum: Siswa dengan NISN '$nisn' tidak ditemukan."; continue; }

            [$class, $classErr] = $this->resolvePklClass($kelas);
            if (! $class) { $errors[] = "Baris $rowNum: $classErr"; continue; }

            [$teacher, $teacherErr] = $this->resolveTeacher($guru);
            if (! $teacher) { $errors[] = "Baris $rowNum: $teacherErr"; continue; }

            PklPlacement::updateOrCreate(
                ['student_id' => $student->id, 'academic_year_id' => $ayId],
                [
                    'class_id'              => $class->id,
                    'pembimbing_teacher_id' => $teacher->id,
                    'tempat_pkl'            => $tempat,
                    'alamat_pkl'            => $alamat,
                    'tanggal_mulai'         => $mulai->toDateString(),
                    'tanggal_selesai'       => $selesai->toDateString(),
                ],
            );
            $success++;
        }

        return response()->json([
            'success_count' => $success,
            'error_count'   => count($errors),
            'errors'        => $errors,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $ayId = PklMode::activeAcademicYearId();

        $items = PklPlacement::when($ayId, fn ($q) => $q->where('academic_year_id', $ayId))
            ->with(['student.user', 'schoolClass', 'pembimbing.user'])
            ->when($request->filled('class_id'), fn ($q) =>
                $q->whereHas('schoolClass', fn ($c) => $c->where('uuid', $request->class_id)))
            ->get()
            ->sortBy(fn ($p) => [$p->schoolClass?->rombel, $p->student?->user?->nama])
            ->values()
            ->map(fn ($p) => [
                'id'         => $p->uuid,
                'nama'       => $p->student?->user?->nama,
                'nisn'       => $p->student?->nisn,
                'class_id'   => $p->schoolClass?->uuid,
                'kelas'      => $p->schoolClass
                    ? "{$p->schoolClass->tingkat->value} {$p->schoolClass->jurusan} - {$p->schoolClass->rombel}" : null,
                'tempat_pkl' => $p->tempat_pkl,
                'alamat_pkl' => $p->alamat_pkl,
                'mulai'      => $p->tanggal_mulai?->toDateString(),
                'selesai'    => $p->tanggal_selesai?->toDateString(),
                'pembimbing' => $p->pembimbing?->user?->nama,
            ]);

        return response()->json(['data' => $items]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        PklPlacement::where('uuid', $uuid)->firstOrFail()->delete();

        return response()->json(['message' => 'Data PKL siswa dihapus.']);
    }

    /** Kelas harus ada, di tahun ajaran aktif, dan tingkat XII. */
    private function resolvePklClass(string $label): array
    {
        if ($label === '') {
            return [null, 'Kelas wajib diisi.'];
        }

        $parts = explode(' ', trim($label));
        if (count($parts) < 3) {
            return [null, "Format kelas '$label' tidak valid. Contoh: XII Rekayasa Perangkat Lunak A"];
        }
        $tingkat = strtoupper(array_shift($parts));
        $rombel  = array_pop($parts);
        $jurusan = implode(' ', $parts);

        if ($tingkat !== 'XII') {
            return [null, "Kelas '$label' bukan kelas XII — PKL hanya untuk kelas XII."];
        }

        $class = SchoolClass::whereHas('academicYear', fn ($q) => $q->where('aktif', true))
            ->where('tingkat', $tingkat)->where('jurusan', $jurusan)->where('rombel', $rombel)
            ->first();

        return $class ? [$class, null] : [null, "Kelas '$label' tidak ditemukan di tahun ajaran aktif."];
    }

    /** Guru pembimbing dicocokkan dgn nama persis (case-insensitive). Nol/ganda = error jelas. */
    private function resolveTeacher(string $nama): array
    {
        if ($nama === '') {
            return [null, 'Guru pembimbing wajib diisi.'];
        }

        $matches = Teacher::whereHas('user', fn ($q) => $q->whereRaw('LOWER(nama) = ?', [mb_strtolower($nama)]))->get();

        if ($matches->isEmpty()) {
            return [null, "Guru pembimbing '$nama' tidak ditemukan. Tulis nama persis seperti di data guru."];
        }
        if ($matches->count() > 1) {
            return [null, "Guru pembimbing '$nama' ganda di data — bedakan dengan nama lengkap/gelar."];
        }

        return [$matches->first(), null];
    }

    private function parseDate($value): ?Carbon
    {
        if ($value instanceof \DateTimeInterface) {
            return Carbon::instance($value);
        }
        $str = trim((string) $value);
        if ($str === '') {
            return null;
        }
        try {
            return Carbon::parse($str);
        } catch (\Throwable) {
            return null;
        }
    }

    private function readXlsx(string $path): array
    {
        $reader = new XlsxReader();
        $reader->open($path);
        $rows = [];

        foreach ($reader->getSheetIterator() as $sheet) {
            $firstRow = true;
            foreach ($sheet->getRowIterator() as $row) {
                if ($firstRow) { $firstRow = false; continue; }
                $values = $row->toArray();
                if (empty(array_filter($values, fn ($v) => $v !== '' && $v !== null))) continue;
                $rows[] = $values;
            }
            break; // sheet pertama saja
        }

        $reader->close();
        return $rows;
    }
}
