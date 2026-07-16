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
        'Nama', 'NIS', 'NISN', 'Kelas', 'No. HP Siswa', 'Tempat PKL', 'Alamat PKL', 'Awal PKL', 'Akhir PKL', 'Guru Pembimbing',
    ];

    public function template(): BinaryFileResponse
    {
        $example = [
            'Ahmad Fauzi', '2324001', '0012345678', 'XII Rekayasa Perangkat Lunak A', '081234567890',
            'PT Teknologi Nusantara', 'Jl. Merdeka No. 10, Bandung', '2026-07-01', '2026-12-20', 'Budi Santoso, S.Kom.',
        ];
        $notes = [
            'nama siswa (referensi saja)', 'NIS siswa — kunci pencocokan cadangan bila NISN kosong',
            'NISN siswa — kunci pencocokan utama', 'contoh: XII Rekayasa Perangkat Lunak A (harus kelas XII)',
            'nomor HP siswa (opsional) — tampil ke pembimbing dgn tombol WhatsApp', 'nama tempat/DU-DI',
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
        $request->validate([
            'file'      => ['required', 'file', 'mimes:xlsx,xls', 'max:5120'],
            'decisions' => ['nullable', 'string'],
        ]);

        $ayId = PklMode::activeAcademicYearId();
        abort_if(! $ayId, 422, 'Belum ada tahun ajaran aktif.');

        // decisions: { "pkl:<uuid siswa>:<kunci perusahaan>": "timpa"|"baru" } — jawaban
        // admin atas perusahaan MIRIP yang ditahan pada unggahan sebelumnya.
        $decisions = json_decode($request->input('decisions', '{}'), true) ?: [];

        $rows           = $this->readXlsx($request->file('file')->getRealPath());
        $success        = 0;
        $errors         = [];
        $pendingMatches = [];

        foreach ($rows as $i => $row) {
            $rowNum  = $i + 2;
            $nis     = trim((string) ($row[1] ?? ''));
            $nisn    = trim((string) ($row[2] ?? ''));
            $kelas   = trim((string) ($row[3] ?? ''));
            $telpon  = PklPlacement::normalizeTelpon($row[4] ?? null);
            $tempat  = trim((string) ($row[5] ?? ''));
            $alamat  = trim((string) ($row[6] ?? '')) ?: null;
            $mulai   = $this->parseDate($row[7] ?? null);
            $selesai = $this->parseDate($row[8] ?? null);
            $guru    = trim((string) ($row[9] ?? ''));

            if ($nisn === '' && $nis === '' && $tempat === '') continue;

            if ($nisn === '' && $nis === '') { $errors[] = "Baris $rowNum: NISN atau NIS wajib diisi."; continue; }
            if ($tempat === '') { $errors[] = "Baris $rowNum: Tempat PKL wajib diisi."; continue; }
            if (! $mulai || ! $selesai) { $errors[] = "Baris $rowNum: Tanggal awal/akhir PKL tidak valid (YYYY-MM-DD)."; continue; }
            if ($selesai->lt($mulai)) { $errors[] = "Baris $rowNum: Akhir PKL mendahului Awal PKL."; continue; }

            // NISN kunci utama; NIS kunci cadangan bila NISN kosong/tidak ketemu.
            $student = $nisn !== '' ? Student::where('nisn', $nisn)->first() : null;
            $student ??= $nis !== '' ? Student::where('nis', $nis)->first() : null;
            if (! $student) {
                $errors[] = "Baris $rowNum: Siswa dengan NISN '$nisn'".($nis !== '' ? " / NIS '$nis'" : '').' tidak ditemukan.';
                continue;
            }

            [$class, $classErr] = $this->resolvePklClass($kelas);
            if (! $class) { $errors[] = "Baris $rowNum: $classErr"; continue; }

            [$teacher, $teacherErr] = $this->resolveTeacher($guru);
            if (! $teacher) { $errors[] = "Baris $rowNum: $teacherErr"; continue; }

            // Satu siswa boleh beberapa tempat PKL. Baris menimpa penempatan lama bila
            // perusahaannya SAMA; perusahaan MIRIP ditahan dulu (tanya admin: timpa
            // atau memang perusahaan baru); selain itu jadi penempatan baru.
            $existing = PklPlacement::where('student_id', $student->id)
                ->where('academic_year_id', $ayId)
                ->get();

            $target = $existing->first(fn ($p) => $this->companyKey($p->tempat_pkl) === $this->companyKey($tempat));

            if (! $target) {
                $mirip = $existing->first(fn ($p) => $this->companySimilar($p->tempat_pkl, $tempat));
                if ($mirip) {
                    $key      = "pkl:{$student->uuid}:".$this->companyKey($tempat);
                    $decision = $decisions[$key] ?? null;
                    if ($decision === 'timpa') {
                        $target = $mirip;
                    } elseif ($decision !== 'baru') {
                        $pendingMatches[] = [
                            'key'          => $key,
                            'siswa'        => $student->user?->nama,
                            'kelas'        => $kelas,
                            'tempat_baru'  => $tempat,
                            'tempat_lama'  => $mirip->tempat_pkl,
                        ];
                        continue; // ditahan sampai admin memutuskan, baris lain jalan terus
                    }
                }
            }

            if (PklPlacement::overlapExists($student->id, $ayId, $mulai->toDateString(), $selesai->toDateString(), $target?->id)) {
                $errors[] = "Baris $rowNum: periode {$mulai->toDateString()} – {$selesai->toDateString()} bertumpuk dengan tempat PKL lain milik siswa ini (waktu bersamaan = ada kesalahan data).";
                continue;
            }

            $attrs = [
                'class_id'              => $class->id,
                'pembimbing_teacher_id' => $teacher->id,
                'tempat_pkl'            => $tempat,
                // Melengkapi: kolom kosong di file tidak menghapus data yang sudah ada.
                'alamat_pkl'            => $alamat ?? $target?->alamat_pkl,
                'telpon_siswa'          => $telpon ?? $target?->telpon_siswa,
                'tanggal_mulai'         => $mulai->toDateString(),
                'tanggal_selesai'       => $selesai->toDateString(),
            ];

            if ($target) {
                $target->update($attrs);
            } else {
                PklPlacement::create($attrs + ['student_id' => $student->id, 'academic_year_id' => $ayId]);
            }
            $success++;
        }

        return response()->json([
            'success_count'   => $success,
            'error_count'     => count($errors),
            'errors'          => $errors,
            'pending_matches' => $pendingMatches,
        ]);
    }

    /** POST /admin/pkl/placements — tambah penempatan manual per anak (admin). */
    public function store(Request $request): JsonResponse
    {
        $ayId = PklMode::activeAcademicYearId();
        abort_if(! $ayId, 422, 'Belum ada tahun ajaran aktif.');

        $data = $request->validate([
            'nisn'            => ['nullable', 'string', 'max:20'],
            'nis'             => ['nullable', 'string', 'max:20'],
            'tempat_pkl'      => ['required', 'string', 'max:200'],
            'alamat_pkl'      => ['nullable', 'string', 'max:300'],
            'telpon'          => ['nullable', 'string', 'max:25'],
            'tanggal_mulai'   => ['required', 'date'],
            'tanggal_selesai' => ['required', 'date', 'after_or_equal:tanggal_mulai'],
            'pembimbing'      => ['required', 'string', 'max:150'],
        ]);

        $student = ($data['nisn'] ?? '') !== '' ? Student::where('nisn', $data['nisn'])->first() : null;
        $student ??= ($data['nis'] ?? '') !== '' ? Student::where('nis', $data['nis'])->first() : null;
        abort_unless($student, 422, 'Siswa tidak ditemukan — isi NISN atau NIS yang terdaftar.');
        abort_unless($student->class_id, 422, 'Siswa ini belum punya kelas.');

        [$teacher, $teacherErr] = $this->resolveTeacher($data['pembimbing']);
        abort_unless($teacher, 422, $teacherErr ?? 'Guru pembimbing tidak ditemukan.');

        abort_if(
            PklPlacement::overlapExists($student->id, $ayId, $data['tanggal_mulai'], $data['tanggal_selesai']),
            422,
            'Periode bertumpuk dengan tempat PKL lain milik siswa ini (waktu bersamaan = ada kesalahan data).',
        );

        $p = PklPlacement::create([
            'student_id'            => $student->id,
            'class_id'              => $student->class_id,
            'academic_year_id'      => $ayId,
            'pembimbing_teacher_id' => $teacher->id,
            'tempat_pkl'            => $data['tempat_pkl'],
            'alamat_pkl'            => $data['alamat_pkl'] ?? null,
            'telpon_siswa'          => PklPlacement::normalizeTelpon($data['telpon'] ?? null),
            'tanggal_mulai'         => $data['tanggal_mulai'],
            'tanggal_selesai'       => $data['tanggal_selesai'],
        ]);

        return response()->json(['message' => 'Penempatan PKL ditambahkan.', 'id' => $p->uuid], 201);
    }

    /** PUT /admin/pkl/placements/{uuid} — edit manual (perusahaan, periode, telpon, alamat, pembimbing). */
    public function update(Request $request, string $uuid): JsonResponse
    {
        $p = PklPlacement::where('uuid', $uuid)->firstOrFail();

        $data = $request->validate([
            'tempat_pkl'      => ['required', 'string', 'max:200'],
            'alamat_pkl'      => ['nullable', 'string', 'max:300'],
            'telpon'          => ['nullable', 'string', 'max:25'],
            'tanggal_mulai'   => ['required', 'date'],
            'tanggal_selesai' => ['required', 'date', 'after_or_equal:tanggal_mulai'],
            'pembimbing'      => ['nullable', 'string', 'max:150'],
        ]);

        abort_if(
            PklPlacement::overlapExists($p->student_id, $p->academic_year_id, $data['tanggal_mulai'], $data['tanggal_selesai'], $p->id),
            422,
            'Periode bertumpuk dengan tempat PKL lain milik siswa ini (waktu bersamaan = ada kesalahan data).',
        );

        $attrs = [
            'tempat_pkl'      => $data['tempat_pkl'],
            'alamat_pkl'      => $data['alamat_pkl'] ?? null,
            'telpon_siswa'    => PklPlacement::normalizeTelpon($data['telpon'] ?? null),
            'tanggal_mulai'   => $data['tanggal_mulai'],
            'tanggal_selesai' => $data['tanggal_selesai'],
        ];

        if (($data['pembimbing'] ?? '') !== '') {
            [$teacher, $teacherErr] = $this->resolveTeacher($data['pembimbing']);
            abort_unless($teacher, 422, $teacherErr ?? 'Guru pembimbing tidak ditemukan.');
            $attrs['pembimbing_teacher_id'] = $teacher->id;
        }

        $p->update($attrs);

        return response()->json(['message' => 'Penempatan PKL diperbarui.']);
    }

    /**
     * GET /admin/pkl/placements/export — Excel seluruh peserta PKL, kolom SAMA dengan
     * template import supaya hasil edit bisa diunduh, dirapikan, lalu diimpor ulang.
     */
    public function export(): BinaryFileResponse
    {
        $ayId = PklMode::activeAcademicYearId();

        $items = PklPlacement::when($ayId, fn ($q) => $q->where('academic_year_id', $ayId))
            ->with(['student.user', 'schoolClass', 'pembimbing.user'])
            ->get()
            ->sortBy(fn ($p) => [$p->schoolClass?->jurusan, $p->schoolClass?->rombel, $p->student?->user?->nama])
            ->values();

        $tempFile = tempnam(sys_get_temp_dir(), 'pkl_export_');
        $writer   = new XlsxWriter();
        $writer->openToFile($tempFile);
        $writer->getOptions()->setColumnWidthForRange(24, 1, count(self::HEADERS));

        $writer->addRow(Row::fromValuesWithStyle(self::HEADERS, $this->xlsxHeaderStyle()));
        $cell = $this->xlsxCellStyle();
        foreach ($items as $p) {
            $writer->addRow(Row::fromValuesWithStyle([
                (string) ($p->student?->user?->nama ?? ''),
                (string) ($p->student?->nis ?? ''),
                (string) ($p->student?->nisn ?? ''),
                $p->schoolClass ? "{$p->schoolClass->tingkat->value} {$p->schoolClass->jurusan} {$p->schoolClass->rombel}" : '',
                (string) ($p->telpon_siswa ?? ''),
                $p->tempat_pkl,
                (string) ($p->alamat_pkl ?? ''),
                (string) ($p->tanggal_mulai?->toDateString() ?? ''),
                (string) ($p->tanggal_selesai?->toDateString() ?? ''),
                (string) ($p->pembimbing?->user?->nama ?? ''),
            ], $cell));
        }
        $writer->close();

        return response()->download($tempFile, 'peserta_pkl.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
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
                'nis'        => $p->student?->nis,
                'nisn'       => $p->student?->nisn,
                'telpon'     => $p->telpon_siswa,
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

        $class = SchoolClass::where('academic_year_id', \App\Support\TahunAjaran::id())
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

    /**
     * Kunci perbandingan nama perusahaan: kapital, tanpa tanda baca, badan usaha
     * di depan (PT/CV/UD) diabaikan — "PT. Teknologi Nusantara" ≙ "Teknologi Nusantara".
     */
    private function companyKey(string $nama): string
    {
        $s = strtoupper(preg_replace('/[^A-Za-z0-9 ]+/', '', $nama));
        $s = preg_replace('/^(PT|CV|UD)\s+/', '', trim($s));

        return preg_replace('/\s+/', ' ', trim($s));
    }

    /** Mirip tapi tidak identik (≥80%) — kandidat "tanyakan dulu: timpa atau perusahaan baru?". */
    private function companySimilar(string $a, string $b): bool
    {
        $ka = $this->companyKey($a);
        $kb = $this->companyKey($b);
        if ($ka === $kb) {
            return false;
        }
        similar_text($ka, $kb, $pct);

        return $pct >= 80;
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
