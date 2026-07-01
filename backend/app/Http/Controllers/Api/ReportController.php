<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agenda;
use App\Models\AgendaStudentScore;
use App\Models\CharacterInput;
use App\Models\LearningObjective;
use App\Models\Note;
use App\Models\PrintSetting;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\StudentAttendance;
use App\Models\TeacherAttendance;
use App\Traits\BuildsXlsxReports;
use App\Traits\HandlesPdfPreview;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use OpenSpout\Common\Entity\Cell\NumericCell;
use OpenSpout\Common\Entity\Cell\StringCell;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\CellAlignment;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Options;
use OpenSpout\Writer\XLSX\Writer;

class ReportController extends Controller
{
    use HandlesPdfPreview;
    use BuildsXlsxReports;

    public function classes(Request $request)
    {
        $ay      = \App\Models\AcademicYear::where('aktif', true)->first();
        $classes = SchoolClass::when($ay, fn ($q) => $q->where('academic_year_id', $ay->id))
            ->orderBy('tingkat')->orderBy('jurusan')->orderBy('rombel')
            ->get()
            ->map(fn ($c) => ['id' => $c->uuid, 'label' => "{$c->tingkat->value} {$c->jurusan} - {$c->rombel}"]);
        return response()->json(['data' => $classes]);
    }

    public function kehadiran(Request $request)
    {
        $request->validate([
            'class_id'     => ['required', 'string'],
            'tanggal_mulai'=> ['required', 'date'],
            'tanggal_akhir'=> ['required', 'date', 'after_or_equal:tanggal_mulai'],
            'format'       => ['required', 'in:pdf,excel'],
            'teacher_id'   => ['nullable', 'string'],
        ]);

        // Identitas guru untuk header laporan
        $teacher = $request->user()->teacher;
        if (! $teacher && $request->filled('teacher_id')) {
            $teacher = \App\Models\Teacher::where('uuid', $request->teacher_id)->with('user')->first();
        }
        if ($teacher && ! $teacher->relationLoaded('user')) {
            $teacher->load('user');
        }

        $class    = SchoolClass::where('uuid', $request->class_id)->with('students.user')->firstOrFail();
        $students = $class->students()->with('user')->orderBy('nis')->get();
        $periode  = date('d/m/Y', strtotime($request->tanggal_mulai)) . ' – ' . date('d/m/Y', strtotime($request->tanggal_akhir));
        $totalSesi = Agenda::whereHas('schedule', fn ($q) => $q->where('class_id', $class->id))
            ->whereBetween('tanggal', [$request->tanggal_mulai, $request->tanggal_akhir])->count();

        $rows = $students->map(function ($s) use ($request, $class) {
            $base = fn () => StudentAttendance::where('student_id', $s->id)
                ->whereHas('agenda', fn ($q) =>
                    $q->whereBetween('tanggal', [$request->tanggal_mulai, $request->tanggal_akhir])
                      ->whereHas('schedule', fn ($q2) => $q2->where('class_id', $class->id))
                );

            $hadir = $base()->where('status', 'hadir')->count();
            $sakit = $base()->where('status', 'sakit')->count();
            $izin  = $base()->where('status', 'izin')->count();
            $alpha = $base()->where('status', 'alpha')->count();
            $total = $hadir + $sakit + $izin + $alpha;
            $pct   = $total > 0 ? round(($hadir / $total) * 100, 1) : 100;

            $absences = $base()->where('status', '!=', 'hadir')
                ->with('agenda:id,tanggal')->orderBy('created_at')->get()
                ->map(function ($a) {
                    $tgl  = \Carbon\Carbon::parse($a->agenda->tanggal)->locale('id')->isoFormat('D MMM');
                    $stat = match ($a->status->value) { 'sakit' => 'S', 'izin' => 'I', 'alpha' => 'A', default => '?' };
                    return "{$tgl}({$stat})";
                })->toArray();

            return compact('hadir', 'sakit', 'izin', 'alpha', 'total', 'pct', 'absences')
                 + ['nama' => $s->user->nama, 'nis' => $s->nis];
        });

        $kelasLabel = "{$class->tingkat->value} {$class->jurusan} - {$class->rombel}";
        $filename   = "kehadiran_{$class->tingkat->value}_{$class->jurusan}_{$class->rombel}";

        // Cari mapel yang diajarkan guru di kelas ini
        $mapelGuru = null;
        $guruNama  = null;
        $guruNip   = null;
        if ($teacher) {
            $guruNama  = $teacher->nama_lengkap;
            $guruNip   = $teacher->nip ?? '—';
            $mapelGuru = \App\Models\Schedule::where('teacher_id', $teacher->id)
                ->where('class_id', $class->id)
                ->where('aktif', true)
                ->with('subject')
                ->get()
                ->map(fn ($s) => $s->subject->nama)
                ->unique()
                ->join(', ');
        }

        if ($request->format === 'pdf') {
            $printSettings = PrintSetting::instance();
            $pdf = Pdf::loadView('reports.kehadiran', compact('rows', 'periode', 'totalSesi', 'guruNama', 'guruNip', 'mapelGuru', 'printSettings') + ['kelas' => $kelasLabel])
                ->setPaper($printSettings->paperDimensionsPt(), 'landscape');
            return $this->pdfResponse($pdf, "{$filename}.pdf", $request);
        }

        return $this->streamXlsx("{$filename}.xlsx", function (Writer $w) use ($rows, $kelasLabel, $periode, $totalSesi, $guruNama, $guruNip, $mapelGuru) {
            $this->xlsxSetColumnWidths($w, [1 => 5, 2 => 26, 3 => 12, 4 => 8, 5 => 8, 6 => 8, 7 => 8, 8 => 8, 9 => 13, 10 => 45]);

            $w->addRow(Row::fromValuesWithStyle(["Rekap Kehadiran — {$kelasLabel}"], $this->xlsxTitleStyle()));
            $w->addRow(Row::fromValues(["Periode: {$periode} | Sesi: {$totalSesi}"]));
            if ($guruNama) {
                $w->addRow(Row::fromValues(["Guru: {$guruNama}" . ($guruNip ? " | NIP: {$guruNip}" : '') . ($mapelGuru ? " | Mapel: {$mapelGuru}" : '')]));
            }
            $w->addRow(Row::fromValues(['']));
            $w->addRow(Row::fromValuesWithStyle(
                ['No','Nama Siswa','NIS','Hadir','Sakit','Izin','Alpha','Total','% Kehadiran','Tanggal Tidak Hadir'],
                $this->xlsxHeaderStyle()
            ));

            $cellCenter = $this->xlsxCellCenterStyle();
            $cellText   = $this->xlsxCellStyle();
            foreach ($rows->values() as $i => $r) {
                $w->addRow(new Row([
                    new NumericCell($i + 1, $cellCenter),
                    new StringCell($r['nama'], $cellText),
                    new StringCell($r['nis'], $cellCenter),
                    new NumericCell($r['hadir'], $cellCenter),
                    new NumericCell($r['sakit'], $cellCenter),
                    new NumericCell($r['izin'], $cellCenter),
                    new NumericCell($r['alpha'], $cellCenter),
                    new NumericCell($r['total'], $cellCenter),
                    new StringCell($r['pct'].'%', $cellCenter),
                    new StringCell(implode(', ',$r['absences']) ?: '—', $cellText),
                ]));
            }
        });
    }

    public function karakter(Request $request)
    {
        $request->validate([
            'class_id'   => ['required', 'string'],
            'format'     => ['required', 'in:pdf,excel'],
            'teacher_id' => ['nullable', 'string'],
        ]);

        // Identitas guru untuk header laporan
        $teacher = $request->user()->teacher;
        if (! $teacher && $request->filled('teacher_id')) {
            $teacher = \App\Models\Teacher::where('uuid', $request->teacher_id)->with('user')->first();
        }
        if ($teacher && ! $teacher->relationLoaded('user')) {
            $teacher->load('user');
        }

        $class    = SchoolClass::where('uuid', $request->class_id)->with('students.user')->firstOrFail();
        $students = $class->students()->with('user')->orderBy('nis')->get();
        $kategori = \App\Models\CharacterCategory::where('aktif', true)->pluck('nama')->toArray();
        $periode  = now('Asia/Jakarta')->format('M Y');
        $totalInput = 0;

        $rows = $students->map(function ($s) use ($kategori, &$totalInput) {
            $inputs = CharacterInput::where('student_id', $s->id)->with('subitem.category')->get();
            $totalInput += $inputs->count();
            $total = $inputs->sum(fn ($i) => $i->sign->value === 'positif' ? abs($i->subitem->bobot) : -abs($i->subitem->bobot));
            $perKat = [];
            foreach ($kategori as $kat) {
                $sub = $inputs->filter(fn ($i) => $i->subitem->category->nama === $kat);
                $perKat[$kat] = $sub->sum(fn ($i) => $i->sign->value === 'positif' ? abs($i->subitem->bobot) : -abs($i->subitem->bobot));
            }
            return ['nama' => $s->user->nama, 'nis' => $s->nis, 'total' => $total, 'per_kategori' => $perKat];
        });

        $kelasLabel = "{$class->tingkat->value} {$class->jurusan} - {$class->rombel}";
        $filename   = "karakter_{$class->tingkat->value}_{$class->jurusan}";

        $guruNama  = $teacher ? $teacher->nama_lengkap : null;
        $guruNip   = $teacher ? ($teacher->nip ?? '—') : null;
        $mapelGuru = $teacher ? \App\Models\Schedule::where('teacher_id', $teacher->id)
            ->where('class_id', $class->id)
            ->where('aktif', true)
            ->with('subject')
            ->get()
            ->map(fn ($s) => $s->subject->nama)
            ->unique()
            ->join(', ') : null;

        if ($request->format === 'pdf') {
            $printSettings = PrintSetting::instance();
            $pdf = Pdf::loadView('reports.karakter', compact('rows','kategori','periode','totalInput','guruNama','guruNip','mapelGuru','printSettings') + ['kelas' => $kelasLabel])
                ->setPaper($printSettings->paperDimensionsPt(), 'landscape');
            return $this->pdfResponse($pdf, "{$filename}.pdf", $request);
        }

        return $this->streamXlsx("{$filename}.xlsx", function (Writer $w) use ($rows,$kategori,$kelasLabel,$periode,$guruNama,$guruNip,$mapelGuru) {
            $lastCol = 3 + count($kategori) + 1;
            $this->xlsxSetColumnWidths($w, [1 => 5, 2 => 26, 3 => 12]);
            $w->getOptions()->setColumnWidthForRange(14, 4, $lastCol);

            $w->addRow(Row::fromValuesWithStyle(["Rekap Karakter — {$kelasLabel}"], $this->xlsxTitleStyle()));
            $w->addRow(Row::fromValues(["Periode: {$periode}"]));
            if ($guruNama) {
                $w->addRow(Row::fromValues(["Guru: {$guruNama}" . ($guruNip ? " | NIP: {$guruNip}" : '') . ($mapelGuru ? " | Mapel: {$mapelGuru}" : '')]));
            }
            $w->addRow(Row::fromValues(['']));
            $w->addRow(Row::fromValuesWithStyle(
                array_merge(['No','Nama Siswa','NIS'],$kategori,['Total Poin']),
                $this->xlsxHeaderStyle()
            ));

            $cellCenter = $this->xlsxCellCenterStyle();
            $cellText   = $this->xlsxCellStyle();
            $totalStyle = $this->xlsxTotalStyle();
            foreach ($rows->values() as $i => $r) {
                $cells = [
                    new NumericCell($i + 1, $cellCenter),
                    new StringCell($r['nama'], $cellText),
                    new StringCell($r['nis'], $cellCenter),
                ];
                foreach ($kategori as $k) {
                    $cells[] = new NumericCell($r['per_kategori'][$k] ?? 0, $cellCenter);
                }
                $cells[] = new NumericCell($r['total'], $totalStyle);
                $w->addRow(new Row($cells));
            }
        });
    }

    public function ews(Request $request)
    {
        $request->validate(['class_id'=>['required','string'],'format'=>['required','in:pdf,excel']]);

        $class    = SchoolClass::where('uuid', $request->class_id)->with('students.user')->firstOrFail();
        $students = $class->students()->with('user')->orderBy('nis')->get();
        $periode  = now('Asia/Jakarta')->format('M Y');

        $rows = $students->map(function ($s) {
            $total     = StudentAttendance::where('student_id', $s->id)->count();
            $hadir     = StudentAttendance::where('student_id', $s->id)->where('status', 'hadir')->count();
            $kehadiran = $total > 0 ? round(($hadir / $total) * 100, 1) : 100.0;
            $inputs    = CharacterInput::where('student_id', $s->id)->with('subitem')->get();
            $karakter  = $inputs->sum(fn ($i) => $i->sign->value === 'positif' ? abs($i->subitem->bobot) : -abs($i->subitem->bobot));
            $catatan   = Note::where('target_type', Student::class)->where('target_id', $s->id)->count();
            $nilaiAvg  = AgendaStudentScore::where('student_id', $s->id)->avg('nilai');
            $nilai     = $nilaiAvg !== null ? round($nilaiAvg, 1) : null;
            $w         = ($kehadiran<80?1:0)+($karakter<0?1:0)+($catatan>=3?1:0)+($nilai!==null&&$nilai<70?1:0);
            $level     = match(true){$w>=3=>'merah',$w===2=>'oranye',$w===1=>'kuning',default=>'hijau'};
            return compact('level','kehadiran','karakter','catatan','nilai')+['nama'=>$s->user->nama,'nis'=>$s->nis];
        })->sortBy(fn($r)=>match($r['level']){'merah'=>0,'oranye'=>1,'kuning'=>2,default=>3})->values();

        $kelasLabel = "{$class->tingkat->value} {$class->jurusan} - {$class->rombel}";
        $filename   = "ews_{$class->tingkat->value}_{$class->jurusan}";

        if ($request->format === 'pdf') {
            $printSettings = PrintSetting::instance();
            $pdf = Pdf::loadView('reports.ews', compact('rows','periode','printSettings') + ['kelas'=>$kelasLabel])
                ->setPaper($printSettings->paperDimensionsPt(),'landscape');
            return $this->pdfResponse($pdf, "{$filename}.pdf", $request);
        }

        return $this->streamXlsx("{$filename}.xlsx", function (Writer $w) use ($rows,$kelasLabel,$periode) {
            $this->xlsxSetColumnWidths($w, [1 => 5, 2 => 26, 3 => 12, 4 => 10, 5 => 14, 6 => 15, 7 => 10, 8 => 15]);

            $w->addRow(Row::fromValuesWithStyle(["Laporan EWS — {$kelasLabel}"], $this->xlsxTitleStyle()));
            $w->addRow(Row::fromValues(["Periode: {$periode}"]));
            $w->addRow(Row::fromValues(['']));
            $w->addRow(Row::fromValuesWithStyle(
                ['No','Nama Siswa','NIS','Level','Kehadiran (%)','Karakter (poin)','Catatan','Nilai Rata-rata'],
                $this->xlsxHeaderStyle()
            ));

            $cellCenter = $this->xlsxCellCenterStyle();
            $cellText   = $this->xlsxCellStyle();
            foreach ($rows as $i => $r) {
                $w->addRow(new Row([
                    new NumericCell($i + 1, $cellCenter),
                    new StringCell($r['nama'], $cellText),
                    new StringCell($r['nis'], $cellCenter),
                    new StringCell(strtoupper($r['level']), $cellCenter),
                    new NumericCell($r['kehadiran'], $cellCenter),
                    new NumericCell($r['karakter'], $cellCenter),
                    new NumericCell($r['catatan'], $cellCenter),
                    new StringCell($r['nilai'] ?? '—', $cellCenter),
                ]));
            }
        });
    }

    public function agenda(Request $request)
    {
        $request->validate([
            'tanggal_mulai' => ['required', 'date'],
            'tanggal_akhir' => ['required', 'date', 'after_or_equal:tanggal_mulai'],
            'format'        => ['required', 'in:pdf,excel'],
            'teacher_id'    => ['nullable', 'string'],
        ]);

        $teacher = $request->user()->teacher;
        if (! $teacher && $request->filled('teacher_id')) {
            $teacher = \App\Models\Teacher::where('uuid', $request->teacher_id)->with('user')->first();
        }
        abort_if(! $teacher, 403, 'Pilih guru terlebih dahulu atau gunakan akun guru.');

        $agendas = Agenda::whereHas('schedule', fn ($q) => $q->where('teacher_id', $teacher->id))
            ->whereBetween('tanggal', [$request->tanggal_mulai, $request->tanggal_akhir])
            ->with(['schedule.subject', 'schedule.schoolClass', 'learningObjectives'])
            ->orderBy('tanggal')->orderBy('id')->get();

        $ay = \App\Models\AcademicYear::where('aktif', true)->first();

        $tglMulai  = \Carbon\Carbon::parse($request->tanggal_mulai)->locale('id');
        $tglAkhir  = \Carbon\Carbon::parse($request->tanggal_akhir)->locale('id');

        $bulan          = ucfirst($tglMulai->isoFormat('MMMM'));
        $tahunPelajaran = $ay ? $ay->tahun : $tglMulai->year . '/' . ($tglMulai->year + 1);
        $semester       = $ay ? ucfirst($ay->semester->value) : 'Ganjil';

        // Kelas & mapel diampu diambil dari SELURUH jadwal aktif guru (bukan cuma yang
        // sudah diisi agenda pada periode ini) — supaya identitas laporan tetap lengkap
        // walau guru belum sempat mengisi KBM di sebagian kelas/mapel yang ia ampu.
        $teacherSchedules = \App\Models\Schedule::where('teacher_id', $teacher->id)
            ->where('aktif', true)
            ->with(['subject', 'schoolClass'])
            ->get();
        $mapelSet = $this->formatMapelDiampu($teacherSchedules);
        $kelasSet = $this->formatKelasDiampu($teacherSchedules);

        $periode = $tglMulai->isoFormat('D MMMM') . ' - ' . $tglAkhir->isoFormat('D MMMM YYYY');

        $guru               = $teacher->nama_lengkap;
        $nip                = $teacher->nip ?? '—';
        $kompetensiKeahlian = $teacher->mapel_utama ?? $mapelSet;
        $filename           = 'Laporan_Agenda_' . str_replace(' ', '_', $guru) . '_' . $bulan;

        $rows = $agendas->map(function ($a) {
            $los = $a->learningObjectives;
            $tglCarbon = \Carbon\Carbon::parse($a->tanggal)->locale('id');

            $jamMulai  = substr($a->schedule->jam_mulai ?? '', 0, 5);
            $jamSelesai = substr($a->schedule->jam_selesai ?? '', 0, 5);
            $jam = $jamMulai && $jamSelesai ? "{$jamMulai} s.d {$jamSelesai}" : '—';

            return [
                'hari_tanggal'        => ucfirst($tglCarbon->isoFormat('dddd, D MMMM YYYY')),
                'jam'                 => $jam,
                'kelas'               => $a->schedule->schoolClass->tingkat->value . ' ' .
                                         $a->schedule->schoolClass->jurusan . ' - ' .
                                         $a->schedule->schoolClass->rombel,
                'mapel'               => $a->schedule->subject->nama,
                'tujuan_pembelajaran' => $los->pluck('deskripsi')->join('; '),
                'tp_kode'             => $los->pluck('kode')->join(', '),
                'kegiatan_pembelajaran' => $a->resume_kbm ?? '',
                'keterangan'          => '',
            ];
        });

        if ($request->format === 'pdf') {
            $kopSuratPath  = 'file://' . public_path('images/kop_surat.jpg');
            $printSettings = PrintSetting::instance();
            $pdf = Pdf::loadView('reports.agenda', [
                'rows'                => $rows,
                'guru'                => $guru,
                'nip'                 => $nip,
                'kompetensi_keahlian' => $kompetensiKeahlian,
                'mata_pelajaran'      => $mapelSet ?: $kompetensiKeahlian,
                'kelas_diampu'        => $kelasSet,
                'semester'            => $semester,
                'periode'             => $periode,
                'bulan'               => $bulan,
                'tahun_pelajaran'     => $tahunPelajaran,
                'tanggal_ttd'         => $tglAkhir->isoFormat('D MMMM YYYY'),
                'kopSuratPath'        => $kopSuratPath,
                'printSettings'       => $printSettings,
            ])->setPaper($printSettings->paperDimensionsPt(), 'landscape');
            return $this->pdfResponse($pdf, "{$filename}.pdf", $request);
        }

        // ── Excel ─────────────────────────────────────────────────────────────
        return $this->streamXlsx("{$filename}.xlsx", function (Writer $w) use (
            $rows, $guru, $nip, $kompetensiKeahlian, $mapelSet, $kelasSet,
            $semester, $periode, $bulan, $tahunPelajaran, $tglAkhir
        ) {
            $this->xlsxSetColumnWidths($w, [1 => 5, 2 => 22, 3 => 14, 4 => 16, 5 => 40, 6 => 40, 7 => 20]);
            $centerBold = (new Style())->withFontBold(true)->withCellAlignment(CellAlignment::CENTER);
            $label      = $this->xlsxLabelStyle();

            // Kop surat (teks)
            $w->addRow(Row::fromValuesWithStyle(['PEMERINTAH DAERAH PROVINSI JAWA BARAT'], $centerBold));
            $w->addRow(Row::fromValues(['DINAS PENDIDIKAN']));
            $w->addRow(Row::fromValues(['CABANG DINAS PENDIDIKAN WILAYAH VII']));
            $w->addRow(Row::fromValuesWithStyle(['SEKOLAH MENENGAH KEJURUAN NEGERI 2 CIMAHI'], $centerBold));
            $w->addRow(Row::fromValues(['Jalan Kamarung No.69 RT 02/RW 05 Kel. Citeureup Kec. Cimahi Utara Kota Cimahi 40512']));
            $w->addRow(Row::fromValues(['Telp/fax. (022) 87805857  Email: info@smkn2cmi.sch.id  Web: www.smkn2cimahi.sch.id']));
            $w->addRow(Row::fromValues(['']));

            // Judul
            $w->addRow(Row::fromValuesWithStyle(["KEGIATAN BELAJAR MENGAJAR BULAN " . strtoupper($bulan)], $this->xlsxTitleStyle()));
            $w->addRow(Row::fromValues(["TAHUN PELAJARAN {$tahunPelajaran}"]));
            $w->addRow(Row::fromValues(['']));

            // Identitas guru
            $w->addRow(new Row([new StringCell('Nama Guru', $label), new StringCell(':'), new StringCell($guru)]));
            $w->addRow(new Row([new StringCell('NIP', $label), new StringCell(':'), new StringCell($nip)]));
            $w->addRow(new Row([new StringCell('Kompetensi Keahlian', $label), new StringCell(':'), new StringCell($kompetensiKeahlian)]));
            $w->addRow(new Row([new StringCell('Mata Pelajaran', $label), new StringCell(':'), new StringCell($mapelSet ?: $kompetensiKeahlian)]));
            $w->addRow(new Row([new StringCell('Kelas Diampu', $label), new StringCell(':'), new StringCell($kelasSet)]));
            $w->addRow(new Row([new StringCell('Semester', $label), new StringCell(':'), new StringCell($semester)]));
            $w->addRow(new Row([new StringCell('Periode Laporan', $label), new StringCell(':'), new StringCell($periode)]));
            $w->addRow(Row::fromValues(['']));

            // Header tabel
            $w->addRow(Row::fromValuesWithStyle(
                ['No', 'Hari / Tanggal', 'Jam Ke', 'Kelas', 'Tujuan Pembelajaran', 'Kegiatan Pembelajaran', 'Keterangan'],
                $this->xlsxHeaderStyle()
            ));

            // Data baris
            $cellCenter = $this->xlsxCellCenterStyle();
            $cellText   = $this->xlsxCellStyle();
            foreach ($rows->values() as $i => $r) {
                $w->addRow(new Row([
                    new NumericCell($i + 1, $cellCenter),
                    new StringCell($r['hari_tanggal'], $cellText),
                    new StringCell($r['jam'], $cellCenter),
                    new StringCell($r['kelas'], $cellCenter),
                    new StringCell($r['tujuan_pembelajaran'] ?: '—', $cellText),
                    new StringCell($r['kegiatan_pembelajaran'] ?: '—', $cellText),
                    new StringCell($r['keterangan'] ?: '', $cellText),
                ]));
            }

            // TTD
            $w->addRow(Row::fromValues(['']));
            $tanggalTtd = $tglAkhir->isoFormat('D MMMM YYYY');
            $w->addRow(Row::fromValues(['', '', '', '', '', "Cimahi, {$tanggalTtd}"]));
            $w->addRow(Row::fromValues(['', '', '', '', '', "Guru Mapel " . ($mapelSet ?: $kompetensiKeahlian)]));
            $w->addRow(Row::fromValues(['']));
            $w->addRow(Row::fromValues(['']));
            $w->addRow(Row::fromValues(['']));
            $w->addRow(Row::fromValuesWithStyle(['', '', '', '', '', $guru], $label));
            $w->addRow(Row::fromValues(['', '', '', '', '', "NIP. {$nip}"]));
            $w->addRow(Row::fromValues(['']));

            // Waktu cetak
            $waktuCetak = now('Asia/Jakarta')->isoFormat('D MMMM YYYY, [Pkl.] HH.mm') . ' WIB';
            $w->addRow(Row::fromValues(["Waktu Cetak: {$waktuCetak}"]));
        });
    }

    // ── Jurnal Mengajar (FR-128..131 / Bab XIII) ─────────────────────────────
    public function jurnal(Request $request)
    {
        $request->validate([
            'tanggal_mulai' => ['required', 'date'],
            'tanggal_akhir' => ['required', 'date', 'after_or_equal:tanggal_mulai'],
            'format'        => ['required', 'in:pdf,excel'],
            'class_id'      => ['nullable', 'string'],
            'teacher_id'    => ['nullable', 'string'],
        ]);

        $teacher = $request->user()->teacher;
        if (! $teacher && $request->filled('teacher_id')) {
            $teacher = \App\Models\Teacher::where('uuid', $request->teacher_id)->with('user')->first();
        }
        abort_if(! $teacher, 403, 'Pilih guru terlebih dahulu atau gunakan akun guru.');

        $teacher->load('user');
        $ay = \App\Models\AcademicYear::where('aktif', true)->first();

        // ── Ambil agendas ─────────────────────────────────────────────────────
        $query = Agenda::whereHas('schedule', fn ($q) => $q->where('teacher_id', $teacher->id))
            ->whereBetween('tanggal', [$request->tanggal_mulai, $request->tanggal_akhir])
            ->with(['schedule.subject', 'schedule.schoolClass', 'learningObjectives'])
            ->orderBy('tanggal');

        if ($request->filled('class_id')) {
            $query->whereHas('schedule.schoolClass', fn ($q) => $q->where('uuid', $request->class_id));
        }

        $agendas = $query->get();

        // ── Baris tabel jurnal ────────────────────────────────────────────────
        $rows = $agendas->map(function ($a) {
            $los = $a->learningObjectives;
            return [
                'tanggal'  => $a->tanggal->locale('id')->isoFormat('DD/MM/YYYY'),
                'hari'     => ucfirst($a->schedule->hari->value),
                'kelas'    => $a->schedule->schoolClass->tingkat->value . ' ' .
                              $a->schedule->schoolClass->jurusan . ' - ' .
                              $a->schedule->schoolClass->rombel,
                'tp_kode'  => $los->pluck('kode')->join(', '),
                'tp'       => $los->pluck('deskripsi')->join(' | '),
                'resume'   => $a->resume_kbm,
                'status'   => $a->status->value,
            ];
        });

        // ── Mapel & kelas label ───────────────────────────────────────────────
        // Diambil dari SELURUH jadwal aktif guru (bukan cuma yang sudah diisi agenda pada
        // periode ini) — supaya identitas laporan tetap lengkap walau guru belum sempat
        // mengisi KBM di sebagian kelas/mapel yang ia ampu.
        $teacherSchedules = \App\Models\Schedule::where('teacher_id', $teacher->id)
            ->where('aktif', true)
            ->with(['subject', 'schoolClass'])
            ->get();
        $mapelSet  = $this->formatMapelDiampu($teacherSchedules);
        $kelasSet  = $this->formatKelasDiampu($teacherSchedules);

        // ── Ringkasan ─────────────────────────────────────────────────────────
        $totalPertemuan  = $agendas->count();
        $tpDibahasIds    = $agendas->flatMap(fn ($a) => $a->learningObjectives->pluck('id'))->unique()->count();

        // Total TP direncanakan — cari via mapel + fase yang diajarkan guru
        $subjectIds = $teacherSchedules->pluck('subject_id')->unique();
        $fases = $teacherSchedules
            ->map(fn ($s) => $s->schoolClass?->tingkat->value === 'X' ? 'E' : 'F')
            ->filter()
            ->unique()
            ->values();
        $tpDirencanakan = LearningObjective::whereIn('subject_id', $subjectIds)
            ->whereIn('fase', $fases)
            ->where('semester', $ay?->semester->value ?? 'ganjil')
            ->when($ay, fn ($q) => $q->where('academic_year_id', $ay->id))
            ->count();

        // Kehadiran mengajar — cek TeacherAttendance
        $hadirCount = TeacherAttendance::whereIn(
            'agenda_id', $agendas->pluck('id')
        )->where('status', 'hadir')->count();
        $pctKehadiran = $totalPertemuan > 0
            ? round(($hadirCount / $totalPertemuan) * 100, 1)
            : 100;
        $tidakTerlaksana = $totalPertemuan - $hadirCount;

        $ringkasan = [
            'total_pertemuan'  => $totalPertemuan,
            'total_jam'        => $totalPertemuan * 2, // asumsi 2 JP per pertemuan
            'tp_direncanakan'  => $tpDirencanakan,
            'tp_dibahas'       => $tpDibahasIds,
            'tidak_terlaksana' => $tidakTerlaksana,
            'pct_kehadiran'    => $pctKehadiran,
        ];

        $periode    = \Carbon\Carbon::parse($request->tanggal_mulai)->locale('id')->isoFormat('D MMMM YYYY') .
                      ' s.d. ' .
                      \Carbon\Carbon::parse($request->tanggal_akhir)->locale('id')->isoFormat('D MMMM YYYY');
        $report_id  = strtoupper(Str::random(8));
        $guruNama   = $teacher->nama_lengkap;
        $filename   = 'Jurnal_Mengajar_' . str_replace(' ', '_', $teacher->user->nama) . '_' .
                      str_replace('/', '-', substr($request->tanggal_mulai, 0, 7));

        // ── PDF ───────────────────────────────────────────────────────────────
        if ($request->format === 'pdf') {
            $printSettings = PrintSetting::instance();
            $pdf = Pdf::loadView('reports.jurnal', [
                'rows'         => $rows,
                'guru'         => $guruNama,
                'nip'          => $teacher->nip ?? '—',
                'mapel'        => $mapelSet ?: $teacher->mapel_utama,
                'kelas_label'  => $kelasSet ?: 'Semua kelas diampu',
                'tahun_ajaran' => $ay ? $ay->tahun . ' — Semester ' . ucfirst($ay->semester->value) : '—',
                'periode'      => $periode,
                'ringkasan'    => $ringkasan,
                'report_id'    => $report_id,
                'printSettings'=> $printSettings,
            ])->setPaper($printSettings->paperDimensionsPt(), 'landscape');
            return $this->pdfResponse($pdf, "{$filename}.pdf", $request);
        }

        // ── Excel (2 sheet: Identitas+Ringkasan, Tabel Jurnal) ────────────────
        return $this->streamXlsx("{$filename}.xlsx", function (Writer $w) use (
            $rows, $teacher, $guruNama, $mapelSet, $kelasSet, $ay, $periode, $ringkasan, $report_id
        ) {
            $label = $this->xlsxLabelStyle();

            // Sheet 1: Header & Identitas
            $w->getCurrentSheet()->setName('Identitas & Ringkasan');
            $w->getOptions()->setColumnWidth(24, 1);
            $w->getOptions()->setColumnWidth(35, 2);
            $w->addRow(Row::fromValuesWithStyle(['LAPORAN JURNAL MENGAJAR'], $this->xlsxTitleStyle()));
            $w->addRow(Row::fromValues(['SMK NEGERI 2 CIMAHI']));
            $w->addRow(Row::fromValues(['']));
            $w->addRow(new Row([new StringCell('Periode', $label), new StringCell($periode)]));
            $w->addRow(new Row([new StringCell('Nama Guru', $label), new StringCell($guruNama)]));
            $w->addRow(new Row([new StringCell('NIP', $label), new StringCell($teacher->nip ?? '—')]));
            $w->addRow(new Row([new StringCell('Mata Pelajaran', $label), new StringCell($mapelSet ?: $teacher->mapel_utama)]));
            $w->addRow(new Row([new StringCell('Kelas yang Diampu', $label), new StringCell($kelasSet)]));
            $w->addRow(new Row([new StringCell('Tahun Ajaran', $label), new StringCell($ay ? $ay->tahun . ' — ' . ucfirst($ay->semester->value) : '—')]));
            $w->addRow(Row::fromValues(['']));

            // Ringkasan
            $w->addRow(Row::fromValuesWithStyle(['RINGKASAN'], $label));
            $w->addRow(new Row([new StringCell('Total Pertemuan', $label), new NumericCell($ringkasan['total_pertemuan'])]));
            $w->addRow(new Row([new StringCell('Total Jam Mengajar', $label), new StringCell($ringkasan['total_jam'] . ' JP')]));
            $w->addRow(new Row([new StringCell('TP Direncanakan', $label), new NumericCell($ringkasan['tp_direncanakan'])]));
            $w->addRow(new Row([new StringCell('TP Sudah Dibahas', $label), new NumericCell($ringkasan['tp_dibahas'])]));
            $w->addRow(new Row([new StringCell('Tidak Terlaksana', $label), new StringCell($ringkasan['tidak_terlaksana'] . ' pertemuan')]));
            $w->addRow(new Row([new StringCell('% Kehadiran Mengajar', $label), new StringCell($ringkasan['pct_kehadiran'] . '%')]));
            $w->addRow(Row::fromValues(['']));

            // Tanda tangan (teks)
            $w->addRow(Row::fromValuesWithStyle(['', 'Dibuat oleh,', '', 'Mengetahui,', '', 'Disetujui,'], $label));
            $w->addRow(Row::fromValues(['', 'Guru Mata Pelajaran', '', 'Wakasek Bid. Kurikulum', '', 'Kepala SMK Negeri 2 Cimahi']));
            $w->addRow(Row::fromValues(['']));
            $w->addRow(Row::fromValues(['']));
            $w->addRow(Row::fromValues(['']));
            $w->addRow(Row::fromValuesWithStyle(['', $guruNama, '', 'Kusman Subarja, S.Pd., M.T.', '', '................................'], $label));
            $w->addRow(Row::fromValues(['', 'NIP. ' . ($teacher->nip ?? '—'), '', 'NIP. 197501012005011001', '', 'NIP. ................................']));
            $w->addRow(Row::fromValues(['']));
            $w->addRow(Row::fromValues(['ID Laporan: ' . $report_id]));

            // Sheet 2: Tabel Jurnal
            $w->addNewSheetAndMakeItCurrent()->setName('Tabel Jurnal');
            $this->xlsxSetColumnWidths($w, [1 => 5, 2 => 13, 3 => 10, 4 => 16, 5 => 45, 6 => 45, 7 => 12]);
            $w->addRow(Row::fromValuesWithStyle(
                ['No', 'Tanggal', 'Hari', 'Kelas', 'Materi / Tujuan Pembelajaran', 'Catatan Kegiatan KBM', 'Status'],
                $this->xlsxHeaderStyle()
            ));

            $cellCenter = $this->xlsxCellCenterStyle();
            $cellText   = $this->xlsxCellStyle();
            foreach ($rows->values() as $i => $r) {
                $w->addRow(new Row([
                    new NumericCell($i + 1, $cellCenter),
                    new StringCell($r['tanggal'], $cellCenter),
                    new StringCell($r['hari'], $cellCenter),
                    new StringCell($r['kelas'], $cellCenter),
                    new StringCell(($r['tp_kode'] ? $r['tp_kode'] . ' — ' : '') . ($r['tp'] ?: '—'), $cellText),
                    new StringCell($r['resume'] ?: '—', $cellText),
                    new StringCell($r['status'] === 'submitted' ? 'Selesai' : 'Draft', $cellCenter),
                ]));
            }
        });
    }

    // ── Konteks jadwal guru (untuk filter di frontend jurnal) ─────────────────
    public function guruContexts(Request $request)
    {
        $teacher = $request->user()->teacher;
        if (! $teacher && $request->filled('teacher_id')) {
            $teacher = \App\Models\Teacher::where('uuid', $request->teacher_id)->first();
        }
        if (! $teacher) return response()->json(['data' => []]);

        $classes = \App\Models\Schedule::where('teacher_id', $teacher->id)
            ->where('aktif', true)
            ->with('schoolClass')
            ->get()
            ->map(fn ($s) => $s->schoolClass)
            ->filter()
            ->unique('id')
            ->map(fn ($c) => ['id' => $c->uuid, 'label' => $c->tingkat->value . ' ' . $c->jurusan . ' - ' . $c->rombel])
            ->values();

        return response()->json(['data' => $classes]);
    }

    // ── Daftar semua guru aktif (untuk laporan admin) ─────────────────────────
    public function reportTeachers()
    {
        $teachers = \App\Models\Teacher::with('user')
            ->whereHas('user', fn ($q) => $q->where('status', 'aktif'))
            ->get()
            ->map(fn ($t) => ['id' => $t->uuid, 'nama' => $t->user->nama, 'nip' => $t->nip ?? ''])
            ->sortBy('nama')
            ->values();

        return response()->json(['data' => $teachers]);
    }

    /**
     * Ringkas daftar kelas yang diampu guru: dikelompokkan per tingkat+jurusan lalu
     * rombel digabung jadi satu baris — mis. "X Mekatronika A, B, C, D; X Desain
     * Komunikasi Visual A, B" — bukan dipisah baris per kelas satu-satu.
     *
     * @param  \Illuminate\Support\Collection<int,\App\Models\Schedule>  $schedules
     */
    private function formatKelasDiampu(\Illuminate\Support\Collection $schedules): string
    {
        $groups = [];
        foreach ($schedules as $s) {
            $c = $s->schoolClass;
            if (! $c) continue;
            $key = "{$c->tingkat->value} {$c->jurusan}";
            $groups[$key][$c->rombel] = true;
        }
        ksort($groups);

        $parts = [];
        foreach ($groups as $key => $rombels) {
            $r = array_keys($rombels);
            sort($r);
            $parts[] = "{$key} " . implode(', ', $r);
        }

        return implode('; ', $parts);
    }

    /**
     * @param  \Illuminate\Support\Collection<int,\App\Models\Schedule>  $schedules
     */
    private function formatMapelDiampu(\Illuminate\Support\Collection $schedules): string
    {
        return $schedules->pluck('subject.nama')->filter()->unique()->sort()->values()->join(', ');
    }

    private function streamXlsx(string $filename, callable $callback): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        return response()->streamDownload(function () use ($callback) {
            $tmp     = tempnam(sys_get_temp_dir(), 'xlsx_');
            $writer  = new Writer(new Options());
            $writer->openToFile($tmp);
            $callback($writer);
            $writer->close();
            readfile($tmp);
            unlink($tmp);
        }, $filename, [
            'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }
}
