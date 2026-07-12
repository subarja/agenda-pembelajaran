<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\PrintSetting;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Services\EffectiveDayService;
use App\Support\ClassAccess;
use App\Traits\HandlesPdfPreview;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenSpout\Common\Entity\Cell\NumericCell;
use OpenSpout\Common\Entity\Cell\StringCell;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Border;
use OpenSpout\Common\Entity\Style\BorderName;
use OpenSpout\Common\Entity\Style\BorderPart;
use OpenSpout\Common\Entity\Style\BorderStyle;
use OpenSpout\Common\Entity\Style\BorderWidth;
use OpenSpout\Common\Entity\Style\CellAlignment;
use OpenSpout\Common\Entity\Style\CellVerticalAlignment;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;

class EffectiveDayController extends Controller
{
    use HandlesPdfPreview;

    // DomPDF merender seluruh dokumen di RAM sebelum ditulis (bukan streaming) — kalau
    // "sheet" (kombinasi kelas×mapel atau guru×kelas×mapel) kebanyakan, satu request bisa
    // butuh >500MB dan gampang OOM/timeout, apalagi di hosting bersama (cPanel) yang
    // memory_limit-nya sering dikunci di level pool, tidak bisa dilewati ini_set(). Batasi
    // di sini, arahkan ke export Excel (streaming ke file, jauh lebih ringan) untuk data
    // banyak — lihat [[minggu_efektif_isu_selesai]] utk detail insiden OOM yang memicu ini.
    private const MAX_PDF_SHEETS = 40;

    public function __construct(private EffectiveDayService $service) {}

    // ── GET /effective-days?class_id=&academic_year_id=&subject_id= ──────────
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'class_id'         => ['required', 'string'],
            'academic_year_id' => ['required', 'string'],
            'subject_id'       => ['sometimes', 'string'],
        ]);

        $user  = $request->user();
        $class = SchoolClass::where('uuid', $request->class_id)->firstOrFail();
        $ay    = AcademicYear::where('uuid', $request->academic_year_id)->firstOrFail();

        // Siapa pun yang boleh melihat kelas ini sama sekali. Cabang tanpa subject_id
        // dulu TIDAK memeriksa kelas apa pun — guru bisa membaca rekap hari efektif kelas
        // mana saja di sekolah (audit 2026-07-09). Pemeriksaannya cuma dipasang di cabang
        // yang memakai subject_id.
        abort_unless(
            ClassAccess::allows(ClassAccess::teachingClassIds($user), $class->id),
            403, 'Anda tidak mengajar atau mewalikelasi kelas ini.',
        );

        if ($request->filled('subject_id')) {
            $subject = Subject::where('uuid', $request->subject_id)->firstOrFail();

            // Selain itu, rincian PER MAPEL hanya untuk pengampu mapel itu di kelas itu.
            //
            // Kondisi lama `in_array($user->role, ['admin','wakasek','bk'])` selalu bernilai
            // false: `role` sudah di-cast ke enum UserRole, dan perbandingan longgar enum
            // dengan string di PHP 8 tidak pernah cocok. Akibatnya admin & wakasek ikut
            // masuk cabang guru, lalu ditolak 403 oleh `abort_if(! $teacher)` karena mereka
            // memang tidak punya baris Teacher.
            if (! ClassAccess::isSchoolWide($user)) {
                $teacher = $user->teacher;
                abort_if(! $teacher, 403, 'Akun ini tidak terhubung ke data guru.');

                $hasSchedule = $teacher->schedules()
                    ->where('class_id', $class->id)
                    ->where('subject_id', $subject->id)
                    ->where('aktif', true)
                    ->exists();
                abort_if(! $hasSchedule, 403, 'Anda tidak mengajar mapel ini di kelas ini.');
            }

            $result = $this->service->calculate($class->id, $subject->id, $ay->id);
            return response()->json(['data' => $result]);
        }

        $rekap = $this->service->rekapByClass($class->id, $ay->id);
        return response()->json(['data' => $rekap]);
    }

    // ── GET /effective-days/my-classes ────────────────────────────────────────
    // Data ringkas: hari_jadwal per kelas (dipakai KalenderPage untuk highlight hari mengajar)
    public function myClasses(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403);

        $ay = AcademicYear::where('aktif', true)->first();
        if (! $ay) return response()->json(['data' => [], 'academic_year' => null]);

        $classIds = $teacher->schedules()
            ->tahunAjaran()
            ->where('aktif', true)
            ->pluck('class_id')
            ->unique();

        $result = [];
        foreach ($classIds as $classId) {
            $class = SchoolClass::find($classId);
            if (! $class) continue;

            $rekap = $this->service->rekapByClass($classId, $ay->id);

            $result[] = [
                'class_id'          => $class->uuid,
                'class_label'       => "{$class->tingkat->value} {$class->jurusan} - {$class->rombel}",
                'total_mapel'       => count($rekap),
                'rekap'             => $rekap,
            ];
        }

        return response()->json([
            'data'          => $result,
            'academic_year' => [
                'id'              => $ay->uuid,
                'tahun'           => $ay->tahun,
                'semester'        => $ay->semester->value,
                'tanggal_mulai'   => $ay->tanggal_mulai?->format('Y-m-d'),
                'tanggal_selesai' => $ay->tanggal_selesai?->format('Y-m-d'),
            ],
        ]);
    }

    // ── GET /effective-days/my-minggu ─────────────────────────────────────────
    // Untuk guru: data minggu efektif per kelas+mapel, per bulan (untuk MingguEfektifPage).
    // Admin/wakasek bisa lihat guru lain via teacher_id (1) atau teacher_ids[] (multi-guru) —
    // tiap item hasil dapat tambahan teacher_id/teacher_nama supaya frontend bisa
    // mengelompokkan tampilan per guru saat lebih dari satu guru dipilih.
    public function myMinggu(Request $request): JsonResponse
    {
        $teachers = $this->resolveTeachers($request);

        $ay = AcademicYear::where('aktif', true)->first();
        if (! $ay) return response()->json(['data' => [], 'academic_year' => null]);

        $result = [];
        foreach ($teachers as $teacher) {
            $classIds = $teacher->schedules()->tahunAjaran()->where('aktif', true)->pluck('class_id')->unique();

            foreach ($classIds as $classId) {
                $class = SchoolClass::find($classId);
                if (! $class) continue;

                $rekap = $this->service->rekapMingguByClass($classId, $teacher->id, $ay->id);
                if (empty($rekap)) continue;

                $totalMinggu  = collect($rekap)->sum('total_minggu');
                $totalEfektif = collect($rekap)->sum('total_efektif');

                $result[] = [
                    'teacher_id'      => $teacher->uuid,
                    'teacher_nama'    => $teacher->nama_lengkap,
                    'class_id'        => $class->uuid,
                    'class_label'     => "{$class->tingkat->value} {$class->jurusan} - {$class->rombel}",
                    'total_mapel'     => count($rekap),
                    'total_minggu'    => $totalMinggu,
                    'total_efektif'   => $totalEfektif,
                    'rekap'           => $rekap,
                ];
            }
        }

        return response()->json([
            'data'          => $result,
            'academic_year' => [
                'id'              => $ay->uuid,
                'tahun'           => $ay->tahun,
                'semester'        => $ay->semester->value,
                'tanggal_mulai'   => $ay->tanggal_mulai?->format('Y-m-d'),
                'tanggal_selesai' => $ay->tanggal_selesai?->format('Y-m-d'),
            ],
        ]);
    }

    /**
     * Ambil daftar Teacher dari request — terima `teacher_ids[]` (multi-guru, admin/wakasek
     * saja) atau `teacher_id` tunggal (back-compat), fallback ke guru yang login sendiri.
     *
     * @return \Illuminate\Support\Collection<int, \App\Models\Teacher>
     */
    private function resolveTeachers(Request $request): \Illuminate\Support\Collection
    {
        $isAdmin = in_array($request->user()->role->value, ['admin', 'wakasek']);

        if ($isAdmin && $request->filled('teacher_ids')) {
            return \App\Models\Teacher::whereIn('uuid', (array) $request->teacher_ids)->with('user')->get();
        }
        if ($isAdmin && $request->filled('teacher_id')) {
            return \App\Models\Teacher::where('uuid', $request->teacher_id)->with('user')->get();
        }

        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403, 'Akun Anda tidak terhubung ke data guru.');
        $teacher->load('user');

        return collect([$teacher]);
    }

    /**
     * Lebar kolom default OpenSpout terlalu sempit untuk tabel 6-kolom (No/Bulan/Minggu/
     * Efektif/Tidak Efektif/Keterangan) — Keterangan khususnya perlu lebar & wrap text
     * supaya "siap cetak" tidak terpotong. Setting ini berlaku 1 workbook (semua sheet).
     */
    private function setStandardColumnWidths(XlsxWriter $writer): void
    {
        $writer->getOptions()->setColumnWidth(6, 1);   // A: No
        $writer->getOptions()->setColumnWidth(16, 2);  // B: Bulan / label identitas
        $writer->getOptions()->setColumnWidth(11, 3);  // C: Minggu
        $writer->getOptions()->setColumnWidth(11, 4);  // D: Efektif
        $writer->getOptions()->setColumnWidth(13, 5);  // E: Tidak Efektif
        $writer->getOptions()->setColumnWidth(55, 6);  // F: Keterangan
    }

    /**
     * Excel membatasi nama sheet 31 karakter & harus unik dalam 1 workbook — nama panjang
     * (mis. gabung nama guru + kelas + mapel) bisa bentrok setelah dipotong, terutama saat
     * multi-guru/multi-kelas menghasilkan banyak sheet. Tambah suffix angka kalau tabrakan.
     */
    private function uniqueSheetName(string $name, array &$usedNames): string
    {
        $base = mb_substr($name, 0, 31);
        $candidate = $base;
        $i = 2;
        while (isset($usedNames[$candidate])) {
            $suffix    = " ({$i})";
            $candidate = mb_substr($base, 0, 31 - mb_strlen($suffix)) . $suffix;
            $i++;
        }
        $usedNames[$candidate] = true;

        return $candidate;
    }

    /**
     * Tulis satu sheet "Analisis Minggu Efektif" (identitas + tabel bulan + TTD) ke workbook
     * yang sedang terbuka — dipakai bareng oleh export guru (1 penanda tangan) dan export
     * admin per-kelas/umum (2 penanda tangan berjajar), format mengikuti
     * docs/format minggu efektif.xlsx.
     *
     * @param  array<string,string>  $identitas  label => nilai, urut sesuai baris (mis. ['Tahun Pelajaran' => '2026/2027', ...])
     * @param  array<int,array>  $bulanRows  baris no/bulan/jumlah_minggu/efektif/tidak_efektif/keterangan
     * @param  array<int,array{role:string,nama_line:string,nip_line:string}>  $signatures  1 atau 2 penanda tangan
     */
    private function writeMingguExcelSheet(
        XlsxWriter $writer,
        bool &$sheetAdded,
        string $sheetName,
        array $identitas,
        array $bulanRows,
        int $totalMinggu,
        int $totalEfektif,
        int $totalTidakEfektif,
        array $signatures,
        string $tanggalCetak,
    ): void {
        if (! $sheetAdded) {
            $writer->getCurrentSheet()->setName($sheetName);
            $sheetAdded = true;
        } else {
            $writer->addNewSheetAndMakeItCurrent()->setName($sheetName);
        }

        // PENTING: Row::fromValues() TIDAK menerima style sebagai argumen ke-2 (API OpenSpout
        // 5.x) — style harus lewat Row::fromValuesWithStyle($values, $style). Salah taruh
        // kurung tutup di sini sebelumnya bikin $style jadi argumen berlebih ke addRow() yang
        // diam-diam DIABAIKAN PHP (bukan error) — akibatnya SEMUA sel selalu tampil polos
        // tanpa bold/warna/border sama sekali, walau kodenya kelihatan "benar" sekilas.
        $thinBorder = new Border(
            new BorderPart(BorderName::TOP, 'D1D5DB', BorderWidth::THIN, BorderStyle::SOLID),
            new BorderPart(BorderName::BOTTOM, 'D1D5DB', BorderWidth::THIN, BorderStyle::SOLID),
            new BorderPart(BorderName::LEFT, 'D1D5DB', BorderWidth::THIN, BorderStyle::SOLID),
            new BorderPart(BorderName::RIGHT, 'D1D5DB', BorderWidth::THIN, BorderStyle::SOLID),
        );
        $titleStyle = (new Style())->withFontBold(true)->withFontSize(12);
        $labelStyle = (new Style())->withFontBold(true);
        $hStyle     = (new Style())->withFontBold(true)->withBackgroundColor('1F4E79')->withFontColor('FFFFFF')
            ->withBorder($thinBorder)->withCellAlignment(CellAlignment::CENTER);
        $cellStyle  = (new Style())->withBorder($thinBorder)->withShouldWrapText(true)
            ->withCellVerticalAlignment(CellVerticalAlignment::TOP);
        $cellCenter = (new Style())->withBorder($thinBorder)->withCellAlignment(CellAlignment::CENTER)
            ->withCellVerticalAlignment(CellVerticalAlignment::TOP);
        $tStyle     = (new Style())->withFontBold(true)->withBackgroundColor('DCE6F1')
            ->withBorder($thinBorder)->withCellAlignment(CellAlignment::CENTER);

        $writer->addRow(Row::fromValues(['']));
        $writer->addRow(Row::fromValuesWithStyle(['Analisis Minggu Efektif - SMK Negeri 2 Cimahi'], $titleStyle));
        foreach ($identitas as $label => $value) {
            $writer->addRow(new Row([
                new StringCell($label, $labelStyle),
                new StringCell(": {$value}"),
            ]));
        }
        $writer->addRow(Row::fromValues(['']));

        $writer->addRow(Row::fromValuesWithStyle(
            ['No', 'Bulan', 'Minggu', 'Efektif', 'Tidak Efektif', 'Keterangan'], $hStyle
        ));

        foreach ($bulanRows as $row) {
            $writer->addRow(new Row([
                new NumericCell($row['no'], $cellCenter),
                new StringCell($row['bulan'], $cellStyle),
                new NumericCell($row['jumlah_minggu'], $cellCenter),
                new NumericCell($row['efektif'], $cellCenter),
                new NumericCell($row['tidak_efektif'], $cellCenter),
                new StringCell($row['keterangan'], $cellStyle),
            ]));
        }

        $writer->addRow(Row::fromValuesWithStyle(
            ['Jumlah', '', $totalMinggu, $totalEfektif, $totalTidakEfektif, ''], $tStyle
        ));

        // TTD — kalau 2 penanda tangan, ditaruh berjajar (kolom A vs kolom E).
        $writer->addRow(Row::fromValues(['']));
        $sigRow = array_fill(0, 6, '');
        $sigRow[4] = "Cimahi, {$tanggalCetak}";
        $writer->addRow(Row::fromValues($sigRow));

        $roleRow = array_fill(0, 6, '');
        $roleRow[0] = $signatures[0]['role'];
        if (isset($signatures[1])) $roleRow[4] = $signatures[1]['role'];
        $writer->addRow(Row::fromValuesWithStyle($roleRow, $labelStyle));

        $writer->addRow(Row::fromValues(['']));
        $writer->addRow(Row::fromValues(['']));

        $namaRow = array_fill(0, 6, '');
        $namaRow[0] = $signatures[0]['nama_line'];
        if (isset($signatures[1])) $namaRow[4] = $signatures[1]['nama_line'];
        $writer->addRow(Row::fromValuesWithStyle($namaRow, $labelStyle));

        $nipRow = array_fill(0, 6, '');
        $nipRow[0] = $signatures[0]['nip_line'];
        if (isset($signatures[1])) $nipRow[4] = $signatures[1]['nip_line'];
        $writer->addRow(Row::fromValues($nipRow));
    }

    // ── GET /effective-days/export-teacher ────────────────────────────────────
    // Guru (atau admin lewat teacher_id/teacher_ids[]) download Excel minggu efektif:
    // 1 file, 1 sheet per (guru × kelas × mapel) kalau multi-guru dipilih.
    public function exportTeacher(Request $request): \Illuminate\Http\Response
    {
        $teachers = $this->resolveTeachers($request);
        abort_if($teachers->isEmpty(), 404, 'Guru tidak ditemukan.');

        $ay = AcademicYear::where('aktif', true)->first();
        abort_if(! $ay, 404, 'Tidak ada tahun ajaran aktif. Hubungi admin untuk mengatur tahun ajaran.');

        $tempFile = tempnam(sys_get_temp_dir(), 'minggu_efektif_') . '.xlsx';
        $writer   = new XlsxWriter();
        $writer->openToFile($tempFile);
        $this->setStandardColumnWidths($writer);

        $tanggalCetak = Carbon::now()->locale('id')->isoFormat('D MMMM YYYY');
        $sheetAdded   = false;
        $usedNames    = [];

        foreach ($teachers as $teacher) {
            $namaGuru = $teacher->nama_lengkap;
            $nipGuru  = $teacher->nip ?? '-';

            $allClassIds = $teacher->schedules()->tahunAjaran()->where('aktif', true)->pluck('class_id')->unique();
            if ($allClassIds->isEmpty()) continue;

            if ($request->filled('class_ids')) {
                $filteredIds = SchoolClass::whereIn('uuid', (array) $request->class_ids)->pluck('id');
                $classIds    = $allClassIds->intersect($filteredIds);
            } else {
                $classIds = $allClassIds;
            }

            foreach ($classIds as $classId) {
                $class = SchoolClass::find($classId);
                if (! $class) continue;

                $classLabel = "{$class->tingkat->value} {$class->jurusan} - {$class->rombel}";
                $rekap = $this->service->rekapMingguByClass($classId, $teacher->id, $ay->id);
                if (empty($rekap)) continue;

                foreach ($rekap as $mapelData) {
                    $sheetName = $this->uniqueSheetName(
                        "{$namaGuru} {$class->tingkat->value}{$class->jurusan}-{$class->rombel} {$mapelData['subject_kode']}",
                        $usedNames
                    );

                    $this->writeMingguExcelSheet(
                        $writer, $sheetAdded, $sheetName,
                        [
                            'Tahun Pelajaran' => $ay->tahun,
                            'Semester'        => ucfirst($ay->semester->value),
                            'Nama Guru'       => $namaGuru,
                            'NIP'             => $nipGuru,
                            'Kelas'           => $classLabel,
                            'Mata Pelajaran'  => $mapelData['subject_nama'],
                        ],
                        $mapelData['bulan'],
                        $mapelData['total_minggu'], $mapelData['total_efektif'], $mapelData['total_tidak_efektif'],
                        [['role' => 'Guru Mata Pelajaran', 'nama_line' => $namaGuru, 'nip_line' => "NIP. {$nipGuru}"]],
                        $tanggalCetak,
                    );
                }
            }
        }

        if (! $sheetAdded) {
            $writer->addRow(Row::fromValues(['Tidak ada data jadwal aktif.']));
        }

        $writer->close();

        $semester = $ay->semester->value;
        $filename = "minggu_efektif_{$ay->tahun}_{$semester}.xlsx";
        $content  = file_get_contents($tempFile);
        @unlink($tempFile);

        return response($content, 200, [
            'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    // ── GET /effective-days/export-teacher-pdf ───────────────────────────────
    // Guru (atau admin lewat teacher_id/teacher_ids[]) download PDF A4 minggu efektif.
    // Multi-guru: setiap sheet bawa identitas guru sendiri (nama/nip), karena bisa beda guru.
    public function exportTeacherPdf(Request $request): \Illuminate\Http\Response|\Illuminate\Http\JsonResponse
    {
        // DomPDF rakus memori (render seluruh dokumen di RAM sebelum ditulis) — default
        // 128M PHP gampang habis kalau banyak guru/kelas/mapel dipilih sekaligus (ratusan
        // halaman). Dinaikkan cuma utk request ini, bukan global php.ini.
        ini_set('memory_limit', '512M');
        set_time_limit(300);

        $teachers = $this->resolveTeachers($request);
        abort_if($teachers->isEmpty(), 404, 'Guru tidak ditemukan.');

        $ay = AcademicYear::where('aktif', true)->first();
        abort_if(! $ay, 404, 'Tidak ada tahun ajaran aktif. Hubungi admin untuk mengatur tahun ajaran.');

        $sheets = [];
        foreach ($teachers as $teacher) {
            $namaGuru = $teacher->nama_lengkap;
            $nipGuru  = $teacher->nip ?? '—';

            $allClassIds = $teacher->schedules()->tahunAjaran()->where('aktif', true)->pluck('class_id')->unique();
            if ($allClassIds->isEmpty()) continue;

            if ($request->filled('class_ids')) {
                $filteredIds = SchoolClass::whereIn('uuid', (array) $request->class_ids)->pluck('id');
                $classIds    = $allClassIds->intersect($filteredIds);
            } else {
                $classIds = $allClassIds;
            }

            foreach ($classIds as $classId) {
                $class = SchoolClass::find($classId);
                if (! $class) continue;
                $rekap = $this->service->rekapMingguByClass($classId, $teacher->id, $ay->id);
                if (empty($rekap)) continue;
                foreach ($rekap as $mapelData) {
                    $sheets[] = [
                        'nama_guru'    => $namaGuru,
                        'nip_guru'     => $nipGuru,
                        'class_label'  => "{$class->tingkat->value} {$class->jurusan} - {$class->rombel}",
                        'mapel'        => $mapelData['subject_nama'],
                        'hari_jadwal'  => $mapelData['hari_jadwal'],
                        'bulan'        => $mapelData['bulan'],
                        'total_minggu' => $mapelData['total_minggu'],
                        'total_efektif'=> $mapelData['total_efektif'],
                        'total_tidak_efektif' => $mapelData['total_tidak_efektif'],
                    ];
                }
            }
        }

        abort_if(empty($sheets), 404, 'Tidak ada jadwal aktif yang ditemukan.');
        abort_if(count($sheets) > self::MAX_PDF_SHEETS, 422, sprintf(
            'Terlalu banyak kelas/mapel untuk PDF (%d sheet, maksimal %d). Kurangi jumlah guru/kelas '
            .'yang dipilih, atau gunakan export Excel untuk data lengkap.',
            count($sheets), self::MAX_PDF_SHEETS
        ));

        $tanggalCetak = Carbon::now()->locale('id')->isoFormat('D MMMM YYYY');
        $ayLabel      = $ay->tahun . ' — Semester ' . ucfirst($ay->semester->value);
        $namaFile     = $teachers->count() === 1
            ? ($teachers->first()->user?->nama ?? $teachers->first()->nip ?? 'guru')
            : 'multi_guru';
        $filename     = 'minggu_efektif_' . str_replace(' ', '_', $namaFile) . '.pdf';
        $printSettings = PrintSetting::instance($request->user()->id);

        $pdf = Pdf::loadView('reports.minggu_efektif', compact(
            'sheets', 'tanggalCetak', 'ayLabel', 'printSettings'
        ))->setPaper($printSettings->paperDimensionsPt(), 'landscape');

        // ?preview=1 → tampil inline (dipakai modal preview FE, bukan trigger download
        // manager). Tanpa preview → attachment sungguhan, dipicu tombol "Simpan PDF".
        return $this->pdfResponse($pdf, $filename, $request);
    }

    // ── GET /admin/effective-days/summary ─────────────────────────────────────
    public function adminSummary(Request $request): JsonResponse
    {
        $request->validate([
            'academic_year_id' => ['required', 'string'],
            'class_ids'        => ['sometimes', 'array'],
            'class_ids.*'      => ['string'],
        ]);

        $ay = AcademicYear::where('uuid', $request->academic_year_id)->firstOrFail();

        $query = SchoolClass::query();
        if ($request->filled('class_ids')) {
            $query->whereIn('uuid', $request->class_ids);
        }
        $classes = $query->orderBy('tingkat')->orderBy('jurusan')->orderBy('rombel')->get();

        $result = [];
        foreach ($classes as $class) {
            $rekap = $this->service->rekapMingguAllByClass($class->id, $ay->id);
            if (empty($rekap)) continue;

            $totalMinggu  = collect($rekap)->sum('total_minggu');
            $totalEfektif = collect($rekap)->sum('total_efektif');

            $result[] = [
                'class_id'      => $class->uuid,
                'class_label'   => "{$class->tingkat->value} {$class->jurusan} - {$class->rombel}",
                'total_mapel'   => count($rekap),
                'total_minggu'  => $totalMinggu,
                'total_efektif' => $totalEfektif,
                'rekap'         => $rekap,
            ];
        }

        return response()->json([
            'data'          => $result,
            'academic_year' => [
                'id'              => $ay->uuid,
                'tahun'           => $ay->tahun,
                'semester'        => $ay->semester->value,
                'tanggal_mulai'   => $ay->tanggal_mulai?->format('Y-m-d'),
                'tanggal_selesai' => $ay->tanggal_selesai?->format('Y-m-d'),
            ],
        ]);
    }

    // Kumpulkan sheet-sheet minggu efektif per kelas (admin "Per Kelas") — dipakai bareng
    // oleh export() (Excel) dan exportPdf() supaya query & shape datanya konsisten.
    private function buildKelasSheets(AcademicYear $ay, \Illuminate\Support\Collection $classes): array
    {
        $sheets = [];
        foreach ($classes as $class) {
            $classLabel = "{$class->tingkat->value} {$class->jurusan} - {$class->rombel}";
            $rekap = $this->service->rekapMingguAllByClass($class->id, $ay->id);
            foreach ($rekap as $mapelData) {
                $sheets[] = [
                    'class_label'  => $classLabel,
                    'mapel'        => $mapelData['subject_nama'],
                    'hari_jadwal'  => $mapelData['hari_jadwal'],
                    'bulan'        => $mapelData['bulan'],
                    'total_minggu' => $mapelData['total_minggu'],
                    'total_efektif'=> $mapelData['total_efektif'],
                    'total_tidak_efektif' => $mapelData['total_tidak_efektif'],
                ];
            }
        }

        return $sheets;
    }

    // Pakai identitas Wk. Kurikulum/Kepala Sekolah yang diisi admin di tab Tahun Ajaran
    // (per semester, bisa beda orang tiap semester) — kalau belum diisi, fallback ke
    // placeholder "Nama"/"NIP" polos supaya dokumen tetap bisa ditandatangani manual.
    private function kelasSignatures(AcademicYear $ay): array
    {
        return [
            [
                'role'      => 'Wk. Kurikulum',
                'nama_line' => $ay->wk_kurikulum_nama_lengkap ?? 'Nama',
                'nip_line'  => $ay->wk_kurikulum_nip ? "NIP. {$ay->wk_kurikulum_nip}" : 'NIP',
            ],
            [
                'role'      => 'Kepala Sekolah',
                'nama_line' => $ay->kepala_sekolah_nama_lengkap ?? 'Nama',
                'nip_line'  => $ay->kepala_sekolah_nip ? "NIP. {$ay->kepala_sekolah_nip}" : 'NIP',
            ],
        ];
    }

    // ── GET /admin/effective-days/export?academic_year_id=&class_ids[]= ───────
    // Excel per kelas × mapel, format sama dengan export guru (1 sheet per kelas×mapel),
    // TTD 2 penanda tangan (Wk. Kurikulum + Kepala Sekolah) sesuai format minggu efektif.xlsx
    public function export(Request $request): \Illuminate\Http\Response
    {
        $request->validate([
            'academic_year_id' => ['required', 'string'],
            'class_ids'        => ['sometimes', 'array'],
        ]);

        $ay = AcademicYear::where('uuid', $request->academic_year_id)->firstOrFail();

        $query = SchoolClass::query();
        if ($request->filled('class_ids')) {
            $query->whereIn('uuid', $request->class_ids);
        }
        $classes = $query->orderBy('tingkat')->orderBy('jurusan')->orderBy('rombel')->get();

        $tempFile = tempnam(sys_get_temp_dir(), 'minggu_efektif_admin_') . '.xlsx';
        $writer   = new XlsxWriter();
        $writer->openToFile($tempFile);
        $this->setStandardColumnWidths($writer);

        $tanggalCetak = Carbon::now()->locale('id')->isoFormat('D MMMM YYYY');
        $sheetAdded   = false;
        $usedNames    = [];

        foreach ($classes as $class) {
            $classLabel = "{$class->tingkat->value} {$class->jurusan} - {$class->rombel}";
            $rekap = $this->service->rekapMingguAllByClass($class->id, $ay->id);

            foreach ($rekap as $mapelData) {
                $sheetName = $this->uniqueSheetName(
                    "{$class->tingkat->value} {$class->jurusan}-{$class->rombel} {$mapelData['subject_kode']}",
                    $usedNames
                );

                $this->writeMingguExcelSheet(
                    $writer, $sheetAdded, $sheetName,
                    [
                        'Tahun Pelajaran' => $ay->tahun,
                        'Semester'        => ucfirst($ay->semester->value),
                        'Kelas'           => $classLabel,
                        'Mata Pelajaran'  => $mapelData['subject_nama'],
                    ],
                    $mapelData['bulan'],
                    $mapelData['total_minggu'], $mapelData['total_efektif'], $mapelData['total_tidak_efektif'],
                    $this->kelasSignatures($ay),
                    $tanggalCetak,
                );
            }
        }

        if (! $sheetAdded) {
            $writer->addRow(Row::fromValues(['Tidak ada data jadwal aktif.']));
        }

        $writer->close();

        $filename = "minggu_efektif_{$ay->tahun}_{$ay->semester->value}.xlsx";
        $content  = file_get_contents($tempFile);
        @unlink($tempFile);

        return response($content, 200, [
            'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    // ── GET /admin/effective-days/export-pdf?academic_year_id=&class_ids[]= ───
    // PDF A4 per kelas × mapel, TTD 2 penanda tangan (Wk. Kurikulum + Kepala Sekolah).
    public function exportPdf(Request $request): \Illuminate\Http\Response|\Illuminate\Http\JsonResponse
    {
        // Lihat catatan di exportTeacherPdf() — export "semua kelas" bisa ratusan halaman.
        ini_set('memory_limit', '512M');
        set_time_limit(300);

        $request->validate([
            'academic_year_id' => ['required', 'string'],
            'class_ids'        => ['sometimes', 'array'],
        ]);

        $ay = AcademicYear::where('uuid', $request->academic_year_id)->firstOrFail();

        $query = SchoolClass::query();
        if ($request->filled('class_ids')) {
            $query->whereIn('uuid', $request->class_ids);
        }
        $classes = $query->orderBy('tingkat')->orderBy('jurusan')->orderBy('rombel')->get();

        $sheets = $this->buildKelasSheets($ay, $classes);
        abort_if(empty($sheets), 404, 'Tidak ada data jadwal aktif untuk filter ini.');
        abort_if(count($sheets) > self::MAX_PDF_SHEETS, 422, sprintf(
            'Terlalu banyak kelas/mapel untuk PDF (%d sheet, maksimal %d). Persempit filter kelas '
            .'(program keahlian/tingkat/rombel), atau gunakan export Excel untuk data lengkap.',
            count($sheets), self::MAX_PDF_SHEETS
        ));

        $tanggalCetak = Carbon::now()->locale('id')->isoFormat('D MMMM YYYY');
        $ayLabel      = $ay->tahun . ' — Semester ' . ucfirst($ay->semester->value);
        // DomPDF download() menolak "/" di nama file (RFC 6266) — "tahun" ajaran format
        // "2025/2026" harus disanitasi dulu, beda dengan response() manual di export() Excel
        // yang menerima "/" apa adanya di header Content-Disposition.
        $tahunSlug    = str_replace('/', '-', $ay->tahun);
        $filename     = "minggu_efektif_kelas_{$tahunSlug}_{$ay->semester->value}.pdf";
        $printSettings = PrintSetting::instance($request->user()->id);

        $pdf = Pdf::loadView('reports.minggu_efektif', [
            'sheets'       => $sheets,
            'tanggalCetak' => $tanggalCetak,
            'ayLabel'      => $ayLabel,
            'signatures'   => $this->kelasSignatures($ay),
            'printSettings'=> $printSettings,
        ])->setPaper($printSettings->paperDimensionsPt(), 'landscape');

        return $this->pdfResponse($pdf, $filename, $request);
    }

    // ── GET /admin/effective-days/umum?academic_year_id= ─────────────────────
    public function umum(Request $request): JsonResponse
    {
        $request->validate(['academic_year_id' => ['required', 'string']]);
        $ay   = AcademicYear::where('uuid', $request->academic_year_id)->firstOrFail();
        $data = $this->service->calculateUmum($ay->id);

        return response()->json([
            'data'          => $data,
            'academic_year' => [
                'id'              => $ay->uuid,
                'tahun'           => $ay->tahun,
                'semester'        => $ay->semester->value,
                'tanggal_mulai'   => $ay->tanggal_mulai?->format('Y-m-d'),
                'tanggal_selesai' => $ay->tanggal_selesai?->format('Y-m-d'),
            ],
        ]);
    }

    // ── GET /admin/effective-days/export-umum?academic_year_id=&format=excel|pdf ─
    // Format tabel & TTD sama persis dengan format minggu efektif.xlsx (No/Bulan/Minggu/
    // Efektif/Tidak Efektif/Keterangan + TTD Wk. Kurikulum & Kepala Sekolah berjajar).
    public function exportUmum(Request $request)
    {
        $request->validate(['academic_year_id' => ['required', 'string']]);
        $ay   = AcademicYear::where('uuid', $request->academic_year_id)->firstOrFail();
        $data = $this->service->calculateUmum($ay->id);
        $tanggalCetak = Carbon::now()->locale('id')->isoFormat('D MMMM YYYY');
        $ayLabel = "Semester {$ay->semester->value} — TP {$ay->tahun}";

        if ($request->query('format') === 'pdf') {
            $printSettings = PrintSetting::instance($request->user()->id);
            $pdf = Pdf::loadView('reports.minggu_efektif_umum', [
                'bulan'        => $data['bulan'],
                'total'        => $data,
                'ayLabel'      => $ayLabel,
                'tanggalCetak' => $tanggalCetak,
                'signatures'   => $this->kelasSignatures($ay),
                'printSettings'=> $printSettings,
            ])->setPaper($printSettings->paperDimensionsPt(), 'portrait');
            $umumFilename = 'MingguEfektifUmum_' . str_replace('/', '-', $ay->tahun) . "_{$ay->semester->value}.pdf";

            return $this->pdfResponse($pdf, $umumFilename, $request);
        }

        // Excel
        $tmpFile = tempnam(sys_get_temp_dir(), 'me_umum_') . '.xlsx';
        $writer  = new XlsxWriter();
        $writer->openToFile($tmpFile);
        $this->setStandardColumnWidths($writer);
        $sheetAdded = false;

        $this->writeMingguExcelSheet(
            $writer, $sheetAdded, 'Umum',
            [
                'Tahun Pelajaran' => $ay->tahun,
                'Semester'        => ucfirst($ay->semester->value),
            ],
            $data['bulan'],
            $data['total_minggu'], $data['total_efektif'], $data['total_tidak_efektif'],
            $this->kelasSignatures($ay),
            $tanggalCetak,
        );

        $writer->close();
        $content = file_get_contents($tmpFile);
        @unlink($tmpFile);

        return response($content, 200, [
            'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => "attachment; filename=\"MingguEfektifUmum_{$ay->tahun}_{$ay->semester->value}.xlsx\"",
        ]);
    }
}
