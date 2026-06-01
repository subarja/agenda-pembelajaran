<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agenda;
use App\Models\AgendaStudentScore;
use App\Models\CharacterInput;
use App\Models\LearningObjective;
use App\Models\Note;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\StudentAttendance;
use App\Models\TeacherAttendance;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Options;
use OpenSpout\Writer\XLSX\Writer;

class ReportController extends Controller
{
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
        ]);

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

        if ($request->format === 'pdf') {
            return Pdf::loadView('reports.kehadiran', compact('rows', 'periode', 'totalSesi') + ['kelas' => $kelasLabel])
                ->setPaper('a4', 'landscape')->download("{$filename}.pdf");
        }

        return $this->streamXlsx("{$filename}.xlsx", function (Writer $w) use ($rows, $kelasLabel, $periode, $totalSesi) {
            $w->addRow(Row::fromValues(["Rekap Kehadiran — {$kelasLabel} | Periode: {$periode} | Sesi: {$totalSesi}"]));
            $w->addRow(Row::fromValues(['No','Nama Siswa','NIS','Hadir','Sakit','Izin','Alpha','Total','% Kehadiran','Tanggal Tidak Hadir']));
            foreach ($rows->values() as $i => $r) {
                $w->addRow(Row::fromValues([$i+1,$r['nama'],$r['nis'],$r['hadir'],$r['sakit'],$r['izin'],$r['alpha'],$r['total'],$r['pct'].'%',implode(', ',$r['absences'])]));
            }
        });
    }

    public function karakter(Request $request)
    {
        $request->validate(['class_id'=>['required','string'],'format'=>['required','in:pdf,excel']]);

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

        if ($request->format === 'pdf') {
            return Pdf::loadView('reports.karakter', compact('rows','kategori','periode','totalInput') + ['kelas' => $kelasLabel])
                ->setPaper('a4','landscape')->download("{$filename}.pdf");
        }

        return $this->streamXlsx("{$filename}.xlsx", function (Writer $w) use ($rows,$kategori,$kelasLabel,$periode) {
            $w->addRow(Row::fromValues(["Rekap Karakter — {$kelasLabel} | {$periode}"]));
            $w->addRow(Row::fromValues(array_merge(['No','Nama Siswa','NIS'],$kategori,['Total Poin'])));
            foreach ($rows->values() as $i => $r) {
                $w->addRow(Row::fromValues(array_merge([$i+1,$r['nama'],$r['nis']],array_map(fn($k)=>$r['per_kategori'][$k]??0,$kategori),[$r['total']])));
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
            return Pdf::loadView('reports.ews', compact('rows','periode') + ['kelas'=>$kelasLabel])
                ->setPaper('a4','landscape')->download("{$filename}.pdf");
        }

        return $this->streamXlsx("{$filename}.xlsx", function (Writer $w) use ($rows,$kelasLabel,$periode) {
            $w->addRow(Row::fromValues(["Laporan EWS — {$kelasLabel} | {$periode}"]));
            $w->addRow(Row::fromValues(['No','Nama Siswa','NIS','Level','Kehadiran (%)','Karakter (poin)','Catatan','Nilai Rata-rata']));
            foreach ($rows as $i => $r) {
                $w->addRow(Row::fromValues([$i+1,$r['nama'],$r['nis'],strtoupper($r['level']),$r['kehadiran'],$r['karakter'],$r['catatan'],$r['nilai']??'—']));
            }
        });
    }

    public function agenda(Request $request)
    {
        $request->validate([
            'tanggal_mulai' => ['required', 'date'],
            'tanggal_akhir' => ['required', 'date', 'after_or_equal:tanggal_mulai'],
            'format'        => ['required', 'in:pdf,excel'],
        ]);

        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403, 'Hanya guru yang dapat mengakses rekap agenda.');

        $agendas = Agenda::whereHas('schedule', fn ($q) => $q->where('teacher_id', $teacher->id))
            ->whereBetween('tanggal', [$request->tanggal_mulai, $request->tanggal_akhir])
            ->with(['schedule.subject', 'schedule.schoolClass', 'learningObjectives'])
            ->orderBy('tanggal')->get();

        $periode  = date('d/m/Y', strtotime($request->tanggal_mulai)) . ' – ' . date('d/m/Y', strtotime($request->tanggal_akhir));
        $guru     = $teacher->user->nama;
        $filename = 'rekap_agenda';

        $rows = $agendas->map(fn ($a) => [
            'tanggal' => $a->tanggal->format('d/m/Y'),
            'hari'    => ucfirst($a->schedule->hari->value),
            'kelas'   => "{$a->schedule->schoolClass->tingkat->value} {$a->schedule->schoolClass->jurusan} - {$a->schedule->schoolClass->rombel}",
            'mapel'   => $a->schedule->subject->nama,
            'tp'      => $a->learningObjectives->pluck('kode')->join(', '),
            'resume'  => $a->resume_kbm,
            'status'  => $a->status->value,
        ]);

        if ($request->format === 'pdf') {
            return Pdf::loadView('reports.agenda', compact('rows','periode','guru'))
                ->setPaper('a4','landscape')->download("{$filename}.pdf");
        }

        return $this->streamXlsx("{$filename}.xlsx", function (Writer $w) use ($rows,$guru,$periode) {
            $w->addRow(Row::fromValues(["Rekap Agenda — {$guru} | Periode: {$periode}"]));
            $w->addRow(Row::fromValues(['No','Tanggal','Hari','Kelas','Mata Pelajaran','TP Dicapai','Resume KBM','Status']));
            foreach ($rows as $i => $r) {
                $w->addRow(Row::fromValues([$i+1,$r['tanggal'],$r['hari'],$r['kelas'],$r['mapel'],$r['tp'],$r['resume']??'',$r['status']]));
            }
        });
    }

    // ── Jurnal Mengajar (FR-128..131 / Bab XIII) ─────────────────────────────
    public function jurnal(Request $request)
    {
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403, 'Hanya guru yang dapat mengakses laporan ini.');

        $request->validate([
            'tanggal_mulai' => ['required', 'date'],
            'tanggal_akhir' => ['required', 'date', 'after_or_equal:tanggal_mulai'],
            'format'        => ['required', 'in:pdf,excel'],
            'class_id'      => ['nullable', 'string'],   // null = semua kelas
        ]);

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
        $mapelSet  = $agendas->map(fn ($a) => $a->schedule->subject->nama)->unique()->join(', ');
        $kelasSet  = $agendas->map(fn ($a) =>
            $a->schedule->schoolClass->tingkat->value . ' ' .
            $a->schedule->schoolClass->jurusan . ' - ' .
            $a->schedule->schoolClass->rombel
        )->unique()->sort()->join(', ');

        // ── Ringkasan ─────────────────────────────────────────────────────────
        $totalPertemuan  = $agendas->count();
        $tpDibahasIds    = $agendas->flatMap(fn ($a) => $a->learningObjectives->pluck('id'))->unique()->count();

        // Total TP direncanakan untuk guru ini (semua kelas diampu, semester aktif)
        $tpDirencanakan  = LearningObjective::where('teacher_id', $teacher->id)
            ->where('semester', $ay?->semester->value ?? 'ganjil')
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
        $filename   = 'Jurnal_Mengajar_' . str_replace(' ', '_', $teacher->user->nama) . '_' .
                      str_replace('/', '-', substr($request->tanggal_mulai, 0, 7));

        // ── PDF ───────────────────────────────────────────────────────────────
        if ($request->format === 'pdf') {
            return Pdf::loadView('reports.jurnal', [
                'rows'         => $rows,
                'guru'         => $teacher->user->nama,
                'nip'          => $teacher->nip ?? '—',
                'mapel'        => $mapelSet ?: $teacher->mapel_utama,
                'kelas_label'  => $kelasSet ?: 'Semua kelas diampu',
                'tahun_ajaran' => $ay ? $ay->tahun . ' — Semester ' . ucfirst($ay->semester->value) : '—',
                'periode'      => $periode,
                'ringkasan'    => $ringkasan,
                'report_id'    => $report_id,
            ])->setPaper('a4', 'landscape')->download("{$filename}.pdf");
        }

        // ── Excel (3 sheet mirror) ────────────────────────────────────────────
        return $this->streamXlsx("{$filename}.xlsx", function (Writer $w) use (
            $rows, $teacher, $mapelSet, $kelasSet, $ay, $periode, $ringkasan, $report_id
        ) {
            // Sheet 1: Header & Identitas
            $w->addRow(Row::fromValues(['LAPORAN JURNAL MENGAJAR']));
            $w->addRow(Row::fromValues(['SMK NEGERI 2 CIMAHI']));
            $w->addRow(Row::fromValues(['']));
            $w->addRow(Row::fromValues(['Periode', $periode]));
            $w->addRow(Row::fromValues(['Nama Guru', $teacher->user->nama]));
            $w->addRow(Row::fromValues(['NIP', $teacher->nip ?? '—']));
            $w->addRow(Row::fromValues(['Mata Pelajaran', $mapelSet ?: $teacher->mapel_utama]));
            $w->addRow(Row::fromValues(['Kelas yang Diampu', $kelasSet]));
            $w->addRow(Row::fromValues(['Tahun Ajaran', $ay ? $ay->tahun . ' — ' . ucfirst($ay->semester->value) : '—']));
            $w->addRow(Row::fromValues(['']));

            // Ringkasan
            $w->addRow(Row::fromValues(['RINGKASAN']));
            $w->addRow(Row::fromValues(['Total Pertemuan', $ringkasan['total_pertemuan']]));
            $w->addRow(Row::fromValues(['Total Jam Mengajar', $ringkasan['total_jam'] . ' JP']));
            $w->addRow(Row::fromValues(['TP Direncanakan', $ringkasan['tp_direncanakan']]));
            $w->addRow(Row::fromValues(['TP Sudah Dibahas', $ringkasan['tp_dibahas']]));
            $w->addRow(Row::fromValues(['Tidak Terlaksana', $ringkasan['tidak_terlaksana'] . ' pertemuan']));
            $w->addRow(Row::fromValues(['% Kehadiran Mengajar', $ringkasan['pct_kehadiran'] . '%']));
            $w->addRow(Row::fromValues(['']));

            // Tanda tangan (teks)
            $w->addRow(Row::fromValues(['', 'Dibuat oleh,', '', 'Mengetahui,', '', 'Disetujui,']));
            $w->addRow(Row::fromValues(['', 'Guru Mata Pelajaran', '', 'Wakasek Bid. Kurikulum', '', 'Kepala SMK Negeri 2 Cimahi']));
            $w->addRow(Row::fromValues(['']));
            $w->addRow(Row::fromValues(['']));
            $w->addRow(Row::fromValues(['']));
            $w->addRow(Row::fromValues(['', $teacher->user->nama, '', 'Kusman Subarja, S.Pd., M.T.', '', '................................']));
            $w->addRow(Row::fromValues(['', 'NIP. ' . ($teacher->nip ?? '—'), '', 'NIP. 197501012005011001', '', 'NIP. ................................']));
            $w->addRow(Row::fromValues(['']));
            $w->addRow(Row::fromValues(['ID Laporan: ' . $report_id]));

            // Sheet 2: Tabel Jurnal (new sheet via workaround — openspout adds rows to active sheet)
            // Tambahkan header tabel sebagai lanjutan sheet yang sama (single sheet Excel)
            $w->addRow(Row::fromValues(['']));
            $w->addRow(Row::fromValues(['TABEL JURNAL PERTEMUAN']));
            $w->addRow(Row::fromValues(['No', 'Tanggal', 'Hari', 'Kelas', 'Materi / Tujuan Pembelajaran', 'Catatan Kegiatan KBM', 'Status']));
            foreach ($rows->values() as $i => $r) {
                $w->addRow(Row::fromValues([
                    $i + 1,
                    $r['tanggal'],
                    $r['hari'],
                    $r['kelas'],
                    ($r['tp_kode'] ? $r['tp_kode'] . ' — ' : '') . ($r['tp'] ?: '—'),
                    $r['resume'] ?: '—',
                    $r['status'] === 'submitted' ? 'Selesai' : 'Draft',
                ]));
            }
        });
    }

    // ── Konteks jadwal guru (untuk filter di frontend jurnal) ─────────────────
    public function guruContexts(Request $request)
    {
        $teacher = $request->user()->teacher;
        if (! $teacher) return response()->json(['data' => []]);

        $ay = \App\Models\AcademicYear::where('aktif', true)->first();

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
