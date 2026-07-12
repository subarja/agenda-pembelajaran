<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agenda;
use App\Models\AgendaStudentScore;
use App\Models\CharacterInput;
use App\Models\CharacterManualNote;
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
use OpenSpout\Writer\XLSX\Writer;
use App\Support\ClassAccess;

class ReportController extends Controller
{
    use HandlesPdfPreview;
    use BuildsXlsxReports;

    public function classes(Request $request)
    {
        // Dropdown kelas untuk halaman Laporan. Bukan data pribadi, tapi tidak ada alasan
        // akun siswa/orang tua menerima daftar seluruh rombel sekolah.
        abort_if(ClassAccess::isStudentSide($request->user()), 403, 'Akses tidak diizinkan.');

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
            $printSettings = PrintSetting::instance($request->user()->id);
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

        // Discope ke TA milik kelas yang dilaporkan — ekspor ulang kelas semester lama
        // otomatis hanya memuat poin semester itu, dan kelas TA aktif tidak tercampur
        // poin bawaan tingkat sebelumnya.
        $rows = $students->map(function ($s) use ($kategori, &$totalInput, $class) {
            $inputs = CharacterInput::tahunAjaran($class->academic_year_id)
                ->where('student_id', $s->id)->with('subitem.category')->get();
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
            $printSettings = PrintSetting::instance($request->user()->id);
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

    // GK33: laporan "Nilai Tambah" — daftar poin manual (langsung final, tidak
    // menunggu approval admin, lihat CharacterManualNoteController::storeNilaiTambah())
    // untuk siswa di 1 kelas, mirror struktur karakter() di atas.
    public function nilaiTambah(Request $request)
    {
        $request->validate([
            'class_id'   => ['required', 'string'],
            'format'     => ['required', 'in:pdf,excel'],
            'teacher_id' => ['nullable', 'string'],
        ]);

        $teacher = $request->user()->teacher;
        if (! $teacher && $request->filled('teacher_id')) {
            $teacher = \App\Models\Teacher::where('uuid', $request->teacher_id)->with('user')->first();
        }
        if ($teacher && ! $teacher->relationLoaded('user')) {
            $teacher->load('user');
        }

        $class    = SchoolClass::where('uuid', $request->class_id)->firstOrFail();
        $students = $class->students()->with('user')->orderBy('nis')->get();

        $notes = CharacterManualNote::tahunAjaran($class->academic_year_id)
            ->whereIn('student_id', $students->pluck('id'))
            ->where('sumber', 'nilai_tambah')
            ->with(['student.user', 'teacher.user', 'atasNamaTeacher.user'])
            ->orderByDesc('created_at')
            // Pemecah seri: beberapa entri kerap lahir di detik yang sama (guru mengisi
            // beruntun), dan tanpa ini urutan barisnya diserahkan ke MySQL — laporan yang
            // sama bisa tercetak dengan urutan berbeda.
            ->orderByDesc('id')
            ->get();

        // "Diberikan Oleh" = pemberi sebenarnya (bisa guru inval); "Atas Nama" = guru
        // pengampu, yang rekapnya memuat entri ini. Untuk guru biasa keduanya sama.
        // Tanggal memuat jam supaya jelas entri inval jatuh di sesi yang mana.
        $rows = $notes->map(fn ($n) => [
            'nama'       => $n->student->user->nama,
            'nis'        => $n->student->nis,
            'nilai'      => $n->nilai_final ?? $n->nilai,
            'catatan'    => $n->catatan ?: '—',
            'tanggal'    => $n->created_at->locale('id')->isoFormat('D MMM YYYY HH:mm'),
            'guru'       => $n->teacher?->nama_lengkap ?? '—',
            'atas_nama'  => $n->atasNamaTeacher?->nama_lengkap ?? $n->teacher?->nama_lengkap ?? '—',
            'oleh_inval' => $n->diberikanOlehInval(),
        ]);

        $kelasLabel = "{$class->tingkat->value} {$class->jurusan} - {$class->rombel}";
        $filename   = "nilai_tambah_{$class->tingkat->value}_{$class->jurusan}";
        $periode    = now('Asia/Jakarta')->format('M Y');

        $guruNama = $teacher ? $teacher->nama_lengkap : null;
        $guruNip  = $teacher ? ($teacher->nip ?? '—') : null;

        if ($request->format === 'pdf') {
            $printSettings = PrintSetting::instance($request->user()->id);
            $pdf = Pdf::loadView('reports.nilai_tambah', [
                'rows' => $rows, 'kelas' => $kelasLabel, 'periode' => $periode,
                'totalInput' => $rows->count(), 'guruNama' => $guruNama, 'guruNip' => $guruNip,
                'printSettings' => $printSettings,
            ])->setPaper($printSettings->paperDimensionsPt(), 'landscape');
            return $this->pdfResponse($pdf, "{$filename}.pdf", $request);
        }

        return $this->streamXlsx("{$filename}.xlsx", function (Writer $w) use ($rows, $kelasLabel, $periode, $guruNama, $guruNip) {
            $this->xlsxSetColumnWidths($w, [1 => 5, 2 => 26, 3 => 12, 4 => 10, 5 => 40, 6 => 20, 7 => 22, 8 => 22]);

            $w->addRow(Row::fromValuesWithStyle(["Laporan Nilai Tambah — {$kelasLabel}"], $this->xlsxTitleStyle()));
            $w->addRow(Row::fromValues(["Periode: {$periode}"]));
            if ($guruNama) {
                $w->addRow(Row::fromValues(["Guru: {$guruNama}" . ($guruNip ? " | NIP: {$guruNip}" : '')]));
            }
            $w->addRow(Row::fromValues(['']));
            $w->addRow(Row::fromValuesWithStyle(
                ['No', 'Nama Siswa', 'NIS', 'Nilai', 'Deskripsi', 'Tanggal & Jam', 'Diberikan Oleh', 'Atas Nama'],
                $this->xlsxHeaderStyle()
            ));

            $cellCenter = $this->xlsxCellCenterStyle();
            $cellText   = $this->xlsxCellStyle();
            foreach ($rows->values() as $i => $r) {
                $w->addRow(new Row([
                    new NumericCell($i + 1, $cellCenter),
                    new StringCell($r['nama'], $cellText),
                    new StringCell($r['nis'], $cellCenter),
                    new NumericCell($r['nilai'], $cellCenter),
                    new StringCell($r['catatan'], $cellText),
                    new StringCell($r['tanggal'], $cellCenter),
                    new StringCell($r['guru'] . ($r['oleh_inval'] ? ' (inval)' : ''), $cellText),
                    new StringCell($r['atas_nama'], $cellText),
                ]));
            }
        });
    }

    public function ews(Request $request)
    {
        $request->validate(['class_id'=>['required','string'],'format'=>['required','in:pdf,excel']]);

        $class    = SchoolClass::where('uuid', $request->class_id)->with('students.user')->firstOrFail();
        $this->authorizeEwsExport($request->user(), $class);
        $students = $class->students()->with('user')->orderBy('nis')->get();
        $periode  = now('Asia/Jakarta')->format('M Y');

        $rows = $students->map(function ($s) use ($class) {
            // Kehadiran & poin per TA milik kelas — bukan akumulasi seumur hidup.
            $absensi   = StudentAttendance::where('student_id', $s->id)
                ->whereHas('agenda.schedule.schoolClass', fn ($q) => $q->where('academic_year_id', $class->academic_year_id));
            $total     = (clone $absensi)->count();
            $hadir     = (clone $absensi)->where('status', 'hadir')->count();
            $kehadiran = $total > 0 ? round(($hadir / $total) * 100, 1) : 100.0;
            $inputs    = CharacterInput::tahunAjaran($class->academic_year_id)
                ->where('student_id', $s->id)->with('subitem')->get();
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
            $printSettings = PrintSetting::instance($request->user()->id);
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

    // EWS BEDA dari laporan lain — guru biasa (bukan wali kelas kelas ini/BK) TIDAK
    // boleh export EWS sama sekali, walau laporan lain (agenda/jurnal/kehadiran/karakter)
    // tetap terbuka untuk guru manapun. Lihat Isu GK3 & pola sama di EwsController::index().
    private function authorizeEwsExport(\App\Models\User $user, SchoolClass $class): void
    {
        if (in_array($user->role->value, ['admin', 'wakasek'], true)) return;

        $teacher = $user->teacher;
        abort_if(! $teacher, 403, 'Anda tidak memiliki akses ke laporan EWS.');

        if ($class->wali_kelas_id === $user->id) return;

        if ($teacher->is_bk) {
            $mengajarDiKelas = \App\Models\Schedule::where('teacher_id', $teacher->id)
                ->where('class_id', $class->id)->where('aktif', true)->exists();
            if ($mengajarDiKelas) return;
        }

        abort(403, 'Anda tidak memiliki akses ke laporan EWS kelas ini.');
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
        // Discope ke TA yang memuat awal periode laporan (fallback TA aktif) supaya
        // ekspor ulang laporan semester lama tetap memakai jadwal semester itu.
        $teacherSchedules = \App\Models\Schedule::tahunAjaran($this->ayIdUntukTanggal($request->tanggal_mulai))
            ->where('teacher_id', $teacher->id)
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

        // ── GK31: ringkasan mingguan (rata-rata pertemuan & JP terlaksana per
        // minggu vs seharusnya) — ditaruh di kotak sebelah TTD, dulu ruang itu kosong. ──
        $jumlahMingguPeriode  = max(1, (int) ceil($tglMulai->diffInDays($tglAkhir) / 7) + 1);
        $pertemuanPerMinggu   = $teacherSchedules->count(); // jumlah slot jadwal aktif/minggu
        $pertemuanSeharusnya  = $pertemuanPerMinggu * $jumlahMingguPeriode;
        $pertemuanTerlaksana  = $rows->count();
        $pctPertemuan         = $pertemuanSeharusnya > 0 ? round($pertemuanTerlaksana / $pertemuanSeharusnya * 100, 1) : 0;

        $jpPerPertemuan = 2; // asumsi 2 JP per pertemuan (konvensi baku aplikasi ini)
        $ringkasanMingguan = [
            'pertemuan_per_minggu'            => round($pertemuanTerlaksana / $jumlahMingguPeriode, 1),
            'pertemuan_seharusnya_per_minggu' => $pertemuanPerMinggu,
            'pct_pertemuan'                   => $pctPertemuan,
            'jp_per_minggu'                   => round(($pertemuanTerlaksana * $jpPerPertemuan) / $jumlahMingguPeriode, 1),
            'jp_seharusnya_per_minggu'        => $pertemuanPerMinggu * $jpPerPertemuan,
            'pct_jp'                          => $pctPertemuan, // proporsional (JP = pertemuan x konstanta)
        ];

        if ($request->format === 'pdf') {
            $kopSuratPath  = 'file://' . public_path('images/kop_surat.jpg');
            $printSettings = PrintSetting::instance($request->user()->id);
            $fotoGuruPath  = \App\Support\ImageDataUri::forPublicDisk($teacher->user->foto, public_path('images/default_avatar.jpg'));
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
                'fotoGuruPath'        => $fotoGuruPath,
                'ringkasan_mingguan'  => $ringkasanMingguan,
            ])->setPaper($printSettings->paperDimensionsPt(), 'landscape');
            return $this->pdfResponse($pdf, "{$filename}.pdf", $request);
        }

        // ── Excel ─────────────────────────────────────────────────────────────
        return $this->streamXlsx("{$filename}.xlsx", function (Writer $w) use (
            $rows, $guru, $nip, $kompetensiKeahlian, $mapelSet, $kelasSet,
            $semester, $periode, $bulan, $tahunPelajaran, $tglAkhir, $ringkasanMingguan
        ) {
            $this->xlsxSetColumnWidths($w, [1 => 5, 2 => 22, 3 => 14, 4 => 16, 5 => 40, 6 => 40, 7 => 20]);
            $label = $this->xlsxLabelStyle();

            // Judul — rata kiri (default), tanpa kop teks (Excel tidak pakai kop bergambar
            // seperti PDF, dan kop teks bikin identitas di bawahnya ikut ke-truncate karena
            // berbagi lebar kolom dengan tabel data).
            $w->addRow(Row::fromValuesWithStyle(["KEGIATAN BELAJAR MENGAJAR BULAN " . strtoupper($bulan)], $this->xlsxTitleStyle()));
            $w->addRow(Row::fromValues(["TAHUN PELAJARAN {$tahunPelajaran}"]));
            $w->addRow(Row::fromValues(['']));

            // Identitas guru — label mulai kolom B, ": nilai" (titik-dua + 1 spasi + isi
            // digabung dalam SATU sel) mulai kolom C. Kolom A dikosongkan jadi indent.
            // Nilai tetap tidak ke-truncate walau kolom C sempit (mis. Kelas Diampu bisa
            // panjang) karena kolom D-G di baris yang sama kosong → Excel overflow visual
            // ke kanan otomatis.
            $w->addRow(new Row([new StringCell(''), new StringCell('Nama Guru', $label), new StringCell(": {$guru}")]));
            $w->addRow(new Row([new StringCell(''), new StringCell('NIP', $label), new StringCell(": {$nip}")]));
            $w->addRow(new Row([new StringCell(''), new StringCell('Kompetensi Keahlian', $label), new StringCell(": {$kompetensiKeahlian}")]));
            $w->addRow(new Row([new StringCell(''), new StringCell('Mata Pelajaran', $label), new StringCell(': ' . ($mapelSet ?: $kompetensiKeahlian))]));
            $w->addRow(new Row([new StringCell(''), new StringCell('Kelas Diampu', $label), new StringCell(": {$kelasSet}")]));
            $w->addRow(new Row([new StringCell(''), new StringCell('Semester', $label), new StringCell(": {$semester}")]));
            $w->addRow(new Row([new StringCell(''), new StringCell('Periode Laporan', $label), new StringCell(": {$periode}")]));
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

            // GK31: kotak ringkasan mingguan di kolom A (sejajar baris TTD di kolom F,
            // tidak tabrakan) — ruang ini dulu kosong.
            $rm = $ringkasanMingguan;
            $w->addRow(new Row([new StringCell('RINGKASAN MINGGUAN', $label)]));
            $w->addRow(Row::fromValues([sprintf(
                'Pertemuan: %s/minggu dari %s seharusnya (%s%%)',
                $rm['pertemuan_per_minggu'], $rm['pertemuan_seharusnya_per_minggu'], $rm['pct_pertemuan']
            )]));
            $w->addRow(Row::fromValues([sprintf(
                'Jam Pelajaran: %s JP/minggu dari %s JP seharusnya (%s%%)',
                $rm['jp_per_minggu'], $rm['jp_seharusnya_per_minggu'], $rm['pct_jp']
            )]));

            // TTD
            $tanggalTtd = $tglAkhir->isoFormat('D MMMM YYYY');
            $w->addRow(Row::fromValues(['', '', '', '', '', "Cimahi, {$tanggalTtd}"]));
            $w->addRow(Row::fromValues(['', '', '', '', '', 'Guru Mata Pelajaran']));
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

    // ── Konteks jadwal guru (untuk filter di frontend jurnal) ─────────────────
    public function guruContexts(Request $request)
    {
        $teacher = $request->user()->teacher;
        if (! $teacher && $request->filled('teacher_id')) {
            $teacher = \App\Models\Teacher::where('uuid', $request->teacher_id)->first();
        }
        if (! $teacher) return response()->json(['data' => []]);

        $classes = \App\Models\Schedule::tahunAjaran()
            ->where('teacher_id', $teacher->id)
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

    /**
     * ID tahun ajaran yang rentang semesternya memuat $tanggal — supaya ekspor ulang
     * laporan periode lama memakai jadwal semester itu, bukan jadwal TA aktif.
     * Fallback null (= TA aktif, lihat Schedule::scopeTahunAjaran) kalau tidak ada
     * TA yang rentang tanggalnya cocok / tanggal semesternya belum diisi.
     */
    private function ayIdUntukTanggal(?string $tanggal): ?int
    {
        if (! $tanggal) {
            return null;
        }

        return \App\Models\AcademicYear::whereNotNull('tanggal_mulai')
            ->whereNotNull('tanggal_selesai')
            ->whereDate('tanggal_mulai', '<=', $tanggal)
            ->whereDate('tanggal_selesai', '>=', $tanggal)
            ->value('id');
    }

    // streamXlsx() dipindah ke trait BuildsXlsxReports supaya controller export Excel
    // lain (mis. WeeklyReflectionController) bisa pakai tanpa duplikasi.
}
