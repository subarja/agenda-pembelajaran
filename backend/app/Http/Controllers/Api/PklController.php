<?php

namespace App\Http\Controllers\Api;

use App\Enums\AttendanceStatus;
use App\Http\Controllers\Controller;
use App\Models\PklAgenda;
use App\Models\PklAttendance;
use App\Models\PklObjective;
use App\Models\PklPlacement;
use App\Models\PrintSetting;
use App\Models\SchoolClass;
use App\Support\ClassAccess;
use App\Support\PklMode;
use App\Traits\BuildsXlsxReports;
use App\Traits\HandlesPdfPreview;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use OpenSpout\Common\Entity\Cell\NumericCell;
use OpenSpout\Common\Entity\Cell\StringCell;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer;

/**
 * Alur guru pembimbing PKL: lihat siswa bimbingan, isi agenda PKL mingguan (TP + catatan +
 * presensi harian), dan unduh data siswa + rekap absen. Sebagian endpoint (rekap absen)
 * juga dipakai admin & wali kelas dengan scoping ClassAccess.
 */
class PklController extends Controller
{
    use BuildsXlsxReports;
    use HandlesPdfPreview;

    // ── Ringkasan & daftar siswa bimbingan ────────────────────────────────────

    /** GET /pkl/overview — kelas yang saya bimbing ATAU ajar (ploting XII) + jumlah siswa. */
    public function overview(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403, 'Hanya guru yang memiliki menu PKL.');

        $placements = $this->myPlacements($teacher->id)->load('schoolClass');

        $classes = $placements->groupBy('class_id')->map(function (Collection $group) {
            $class = $group->first()->schoolClass;

            return [
                'id'           => $class->uuid,
                'label'        => "{$class->tingkat->value} {$class->jurusan} - {$class->rombel}",
                'jumlah_siswa' => $group->count(),
                'sebagai'      => 'pembimbing',
            ];
        });

        // Guru ber-ploting jadwal kelas XII ikut alur agenda PKL walau bukan pembimbing —
        // jadwal lepas dari ploting saat PKL, kewajibannya jadi agenda mingguan per kelas.
        // Hanya kelas yang periodenya terdefinisi (punya placement) yang bisa diisi.
        $taughtIds = collect(PklMode::taughtXiiClassIds($teacher->id))
            ->diff($placements->pluck('class_id'));
        if ($taughtIds->isNotEmpty()) {
            $ayId = PklMode::activeAcademicYearId();
            $taught = PklPlacement::whereIn('class_id', $taughtIds)
                ->when($ayId, fn ($q) => $q->where('academic_year_id', $ayId))
                ->with('schoolClass')
                ->get()
                ->groupBy('class_id')
                ->map(function (Collection $group) {
                    $class = $group->first()->schoolClass;

                    return [
                        'id'           => $class->uuid,
                        'label'        => "{$class->tingkat->value} {$class->jurusan} - {$class->rombel}",
                        'jumlah_siswa' => $group->count(),
                        'sebagai'      => 'pengajar',
                    ];
                });
            $classes = $classes->union($taught);
        }

        return response()->json([
            'data' => [
                'mode_aktif' => PklMode::isActive(),
                'classes'    => $classes->values()->sortBy('label')->values(),
            ],
        ]);
    }

    /** GET /pkl/my-students?class_id= — siswa bimbingan (opsional per kelas). */
    public function myStudents(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403, 'Hanya guru yang memiliki menu PKL.');

        $placements = $this->myPlacements($teacher->id)
            ->load(['student.user', 'schoolClass'])
            ->when($request->filled('class_id'), fn ($c) =>
                $c->filter(fn ($p) => $p->schoolClass?->uuid === $request->class_id)->values());

        return response()->json(['data' => $placements->map(fn ($p) => $this->placementRow($p))->values()]);
    }

    // ── Agenda PKL mingguan ────────────────────────────────────────────────────

    /** GET /pkl/weeks?class_id= — daftar minggu dalam rentang PKL kelas + status pengisian. */
    public function weeks(Request $request): JsonResponse
    {
        $request->validate(['class_id' => ['required', 'string']]);
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403);

        [$class, $students] = $this->authorizeClass($teacher->id, $request->class_id);

        $range = $this->pklRange($students->pluck('student_id'), $class->id);
        if (! $range) {
            return response()->json(['data' => ['class' => $this->classInfo($class), 'weeks' => []]]);
        }

        $agendas = PklAgenda::where('pembimbing_teacher_id', $teacher->id)
            ->where('class_id', $class->id)
            ->get()->keyBy(fn ($a) => $a->minggu_mulai->toDateString());

        $now   = Carbon::now(config('app.school_timezone'));
        $weeks = [];
        foreach ($this->mondays($range[0], $range[1]) as $senin) {
            $key      = $senin->toDateString();
            $agenda   = $agendas->get($key);
            $deadline = PklMode::fillDeadline($senin->copy());
            $weeks[] = [
                'minggu_mulai' => $key,
                'label'        => $senin->locale('id')->isoFormat('D MMM') . ' – ' . $senin->copy()->addDays(4)->locale('id')->isoFormat('D MMM YYYY'),
                'terisi'       => (bool) $agenda,
                'agenda_id'    => $agenda?->uuid,
                'sudah_mulai'  => $now->gte($senin),
                'deadline'     => $deadline->format('Y-m-d H:i'),
                'lewat_batas'  => $now->gt($deadline),
            ];
        }

        return response()->json(['data' => ['class' => $this->classInfo($class), 'weeks' => $weeks]]);
    }

    /** GET /pkl/agenda?class_id=&minggu=YYYY-MM-DD — form agenda (data existing atau kosong). */
    public function showAgenda(Request $request): JsonResponse
    {
        $data = $request->validate([
            'class_id' => ['required', 'string'],
            'minggu'   => ['required', 'date'],
        ]);
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403);

        [$class, $students] = $this->authorizeClass($teacher->id, $data['class_id']);
        $senin = $this->normalizeMonday($data['minggu']);

        $agenda = PklAgenda::where('pembimbing_teacher_id', $teacher->id)
            ->where('class_id', $class->id)
            ->whereDate('minggu_mulai', $senin->toDateString())
            ->with(['objectives', 'attendances'])
            ->first();

        $selectedObjectives = $agenda ? $agenda->objectives->pluck('uuid')->all() : [];
        $absensi = $agenda
            ? $agenda->attendances->mapWithKeys(fn ($a) => [$a->student_id.'|'.$a->tanggal->toDateString() => $a->status->value])
            : collect();

        return response()->json([
            'data' => [
                'class'       => $this->classInfo($class),
                'minggu'      => $senin->toDateString(),
                'hari'        => $this->weekdays($senin),
                'objectives'  => $this->objectivesForClass($class),
                'agenda'      => [
                    'id'         => $agenda?->uuid,
                    'catatan'    => $agenda?->catatan ?? '',
                    'objectives' => $selectedObjectives,
                ],
                'students' => $students->map(fn ($p) => [
                    'id'   => $p->student->uuid,
                    'nis'  => $p->student->nis,
                    'nama' => $p->student->user->nama,
                    'presensi' => collect($this->weekdays($senin))->mapWithKeys(fn ($d) =>
                        [$d['tanggal'] => $absensi->get($p->student->id.'|'.$d['tanggal'])])->all(),
                ])->values(),
            ],
        ]);
    }

    /** POST /pkl/agenda — buat/perbarui agenda mingguan + presensi harian. */
    public function storeAgenda(Request $request): JsonResponse
    {
        $data = $request->validate([
            'class_id'          => ['required', 'string'],
            'minggu'            => ['required', 'date'],
            'catatan'           => ['nullable', 'string', 'max:2000'],
            'objective_ids'     => ['array'],
            'objective_ids.*'   => ['string'],
            'presensi'          => ['array'],
            'presensi.*.student_id' => ['required', 'string'],
            'presensi.*.tanggal'    => ['required', 'date'],
            'presensi.*.status'     => ['required', 'in:hadir,sakit,izin,alpha'],
        ]);

        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403);

        [$class, $students] = $this->authorizeClass($teacher->id, $data['class_id']);
        $senin = $this->normalizeMonday($data['minggu']);

        // Jendela: minggu belum boleh diisi kalau belum mulai; ditolak kalau lewat deadline.
        $now = Carbon::now(config('app.school_timezone'));
        abort_if($now->lt($senin), 422, 'Minggu ini belum berjalan — agenda PKL belum bisa diisi.');
        abort_if($now->gt(PklMode::fillDeadline($senin->copy())), 422,
            'Batas waktu pengisian agenda PKL untuk minggu ini sudah lewat.');

        $ayId = PklMode::activeAcademicYearId();

        $agenda = PklAgenda::updateOrCreate(
            ['pembimbing_teacher_id' => $teacher->id, 'class_id' => $class->id, 'minggu_mulai' => $senin->toDateString()],
            ['academic_year_id' => $ayId, 'catatan' => $data['catatan'] ?? null],
        );

        // TP: hanya yang valid untuk jurusan kelas ini.
        $allowedObjectiveIds = PklObjective::forJurusan($class->jurusan)
            ->where('aktif', true)
            ->when($ayId, fn ($q) => $q->where('academic_year_id', $ayId))
            ->whereIn('uuid', $data['objective_ids'] ?? [])
            ->pluck('id');
        $agenda->objectives()->sync($allowedObjectiveIds);

        // Presensi: hanya siswa bimbingan di kelas ini, tanggal Sen–Jum minggu ini, tidak masa depan.
        $studentIdByUuid = $students->mapWithKeys(fn ($p) => [$p->student->uuid => $p->student->id]);
        $validDates      = collect($this->weekdays($senin))->pluck('tanggal');
        $today           = $now->toDateString();

        foreach ($data['presensi'] ?? [] as $p) {
            $sid = $studentIdByUuid->get($p['student_id']);
            if (! $sid) continue;                                   // bukan siswa bimbingan → abaikan
            if (! $validDates->contains($p['tanggal'])) continue;   // di luar Sen–Jum minggu ini
            if ($p['tanggal'] > $today) continue;                   // tolak tanggal masa depan

            PklAttendance::updateOrCreate(
                ['pkl_agenda_id' => $agenda->id, 'student_id' => $sid, 'tanggal' => $p['tanggal']],
                ['status' => $p['status']],
            );
        }

        return response()->json(['message' => 'Agenda PKL tersimpan.', 'data' => ['id' => $agenda->uuid]]);
    }

    // ── Ekspor ─────────────────────────────────────────────────────────────────

    /** GET /pkl/students/export?class_id=&format=pdf|excel — data penempatan siswa bimbingan. */
    public function exportStudents(Request $request)
    {
        $request->validate([
            'class_id' => ['required', 'string'],
            'format'   => ['required', 'in:pdf,excel'],
        ]);
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403);

        [$class, $students] = $this->authorizeClass($teacher->id, $request->class_id);
        $rows = $students->map(fn ($p) => $this->placementRow($p))->values();
        $kelasLabel = "{$class->tingkat->value} {$class->jurusan} - {$class->rombel}";
        $filename   = 'data_pkl_'.$class->tingkat->value.'_'.$class->jurusan.'_'.$class->rombel;

        if ($request->format === 'pdf') {
            $printSettings = PrintSetting::instance($request->user()->id);
            $pdf = Pdf::loadView('reports.pkl_students', [
                'rows' => $rows, 'kelas' => $kelasLabel,
                'pembimbing' => $teacher->nama_lengkap ?? $teacher->user->nama,
                'printSettings' => $printSettings,
            ])->setPaper($printSettings->paperDimensionsPt(), 'landscape');

            return $this->pdfResponse($pdf, "{$filename}.pdf", $request);
        }

        return $this->streamXlsx("{$filename}.xlsx", function (Writer $w) use ($rows, $kelasLabel) {
            $this->xlsxSetColumnWidths($w, [1 => 5, 2 => 28, 3 => 14, 4 => 30, 5 => 36, 6 => 14, 7 => 14]);
            $w->addRow(Row::fromValuesWithStyle(["Data PKL Siswa — {$kelasLabel}"], $this->xlsxTitleStyle()));
            $w->addRow(Row::fromValues(['']));
            $w->addRow(Row::fromValuesWithStyle(
                ['No', 'Nama', 'NISN', 'Tempat PKL', 'Alamat PKL', 'Awal PKL', 'Akhir PKL'],
                $this->xlsxHeaderStyle()
            ));
            $center = $this->xlsxCellCenterStyle();
            $text   = $this->xlsxCellStyle();
            foreach ($rows as $i => $r) {
                $w->addRow(new Row([
                    new NumericCell($i + 1, $center),
                    new StringCell($r['nama'], $text),
                    new StringCell((string) $r['nisn'], $center),
                    new StringCell($r['tempat_pkl'], $text),
                    new StringCell((string) $r['alamat_pkl'], $text),
                    new StringCell((string) $r['mulai'], $center),
                    new StringCell((string) $r['selesai'], $center),
                ]));
            }
        });
    }

    /**
     * GET /pkl/rekap-absen/export?class_id=&format= — rekap absen PKL per kelas.
     * Dipakai pembimbing (siswa bimbingannya), wali kelas (kelas perwaliannya), admin/wakasek
     * (semua kelas). class_id boleh 'semua' hanya untuk admin/wakasek.
     */
    public function exportRekapAbsen(Request $request)
    {
        $request->validate([
            'class_id' => ['required', 'string'],
            'format'   => ['required', 'in:pdf,excel'],
        ]);

        $user     = $request->user();
        $sections = $this->rekapSections($user, $request->class_id);
        $periode  = now(config('app.school_timezone'))->locale('id')->isoFormat('MMMM YYYY');

        if ($request->format === 'pdf') {
            $printSettings = PrintSetting::instance($user->id);
            $pdf = Pdf::loadView('reports.pkl_rekap_absen', [
                'sections' => $sections, 'periode' => $periode, 'printSettings' => $printSettings,
            ])->setPaper($printSettings->paperDimensionsPt(), 'landscape');

            return $this->pdfResponse($pdf, 'rekap_absen_pkl.pdf', $request);
        }

        return $this->streamXlsx('rekap_absen_pkl.xlsx', function (Writer $w) use ($sections) {
            $this->xlsxSetColumnWidths($w, [1 => 5, 2 => 28, 3 => 14, 4 => 8, 5 => 8, 6 => 8, 7 => 8, 8 => 8, 9 => 13]);
            $center = $this->xlsxCellCenterStyle();
            $text   = $this->xlsxCellStyle();

            foreach ($sections as $sec) {
                $w->addRow(Row::fromValuesWithStyle(["Rekap Absen PKL — {$sec['kelas']}"], $this->xlsxTitleStyle()));
                $w->addRow(Row::fromValuesWithStyle(
                    ['No', 'Nama', 'NISN', 'Hadir', 'Sakit', 'Izin', 'Alpha', 'Total', '% Hadir'],
                    $this->xlsxHeaderStyle()
                ));
                foreach ($sec['rows'] as $i => $r) {
                    $w->addRow(new Row([
                        new NumericCell($i + 1, $center),
                        new StringCell($r['nama'], $text),
                        new StringCell((string) $r['nisn'], $center),
                        new NumericCell($r['hadir'], $center),
                        new NumericCell($r['sakit'], $center),
                        new NumericCell($r['izin'], $center),
                        new NumericCell($r['alpha'], $center),
                        new NumericCell($r['total'], $center),
                        new StringCell($r['pct'].'%', $center),
                    ]));
                }
                $w->addRow(Row::fromValues(['']));
            }
        });
    }

    // ── Helper internal ────────────────────────────────────────────────────────

    private function myPlacements(int $teacherId): Collection
    {
        $ayId = PklMode::activeAcademicYearId();

        return PklPlacement::where('pembimbing_teacher_id', $teacherId)
            ->when($ayId, fn ($q) => $q->where('academic_year_id', $ayId))
            ->get();
    }

    /**
     * Pastikan kelas ini benar dibimbing ATAU diajar $teacherId; kembalikan
     * [kelas, placements yang menjadi tanggung jawabnya].
     *
     * Pembimbing (penugasan) → hanya siswa bimbingannya. Guru ber-ploting jadwal XII
     * tanpa penugasan → seluruh siswa PKL kelas itu (ia mengajar satu kelas penuh,
     * jadi presensi & agendanya mencakup semua siswa yang ditempatkan).
     */
    private function authorizeClass(int $teacherId, string $classUuid): array
    {
        $class = SchoolClass::where('uuid', $classUuid)->firstOrFail();

        $placements = $this->myPlacements($teacherId)
            ->load(['student.user'])
            ->filter(fn ($p) => $p->class_id === $class->id)
            ->values();

        if ($placements->isEmpty() && in_array($class->id, PklMode::taughtXiiClassIds($teacherId), true)) {
            $ayId = PklMode::activeAcademicYearId();
            $placements = PklPlacement::where('class_id', $class->id)
                ->when($ayId, fn ($q) => $q->where('academic_year_id', $ayId))
                ->with('student.user')
                ->get();
        }

        abort_if($placements->isEmpty(), 403, 'Anda tidak membimbing atau mengajar kelas ini.');

        return [$class, $placements];
    }

    private function objectivesForClass(SchoolClass $class): array
    {
        $ayId = PklMode::activeAcademicYearId();

        return PklObjective::forJurusan($class->jurusan)
            ->where('aktif', true)
            ->when($ayId, fn ($q) => $q->where('academic_year_id', $ayId))
            ->orderByRaw('jurusan IS NOT NULL')
            ->orderBy('id')
            ->get()
            ->map(fn ($o) => [
                'id'        => $o->uuid,
                'deskripsi' => $o->deskripsi,
                'lingkup'   => $o->jurusan === null ? 'Umum (semua jurusan)' : "Khusus {$o->jurusan}",
            ])->all();
    }

    /** Rentang tanggal PKL sebuah kelas = min(mulai)..max(selesai) placement di kelas itu. */
    private function pklRange(Collection $studentIds, int $classId): ?array
    {
        $ayId = PklMode::activeAcademicYearId();
        $q = PklPlacement::where('class_id', $classId)
            ->when($ayId, fn ($qq) => $qq->where('academic_year_id', $ayId))
            ->whereIn('student_id', $studentIds);

        $mulai   = $q->clone()->min('tanggal_mulai');
        $selesai = $q->clone()->max('tanggal_selesai');

        if (! $mulai || ! $selesai) {
            return null;
        }

        return [Carbon::parse($mulai), Carbon::parse($selesai)];
    }

    /** Semua Senin dari minggu yang memuat $start s/d $end. */
    private function mondays(Carbon $start, Carbon $end): array
    {
        $senin = $start->copy()->startOfWeek(Carbon::MONDAY);
        $out   = [];
        while ($senin->lte($end)) {
            $out[] = $senin->copy();
            $senin->addWeek();
        }

        return $out;
    }

    private function weekdays(Carbon $senin): array
    {
        $names = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
        $out = [];
        foreach ($names as $idx => $nama) {
            $d = $senin->copy()->addDays($idx);
            $out[] = ['nama' => $nama, 'tanggal' => $d->toDateString()];
        }

        return $out;
    }

    private function normalizeMonday(string $tanggal): Carbon
    {
        return Carbon::parse($tanggal)->startOfWeek(Carbon::MONDAY);
    }

    private function classInfo(SchoolClass $class): array
    {
        return [
            'id'    => $class->uuid,
            'label' => "{$class->tingkat->value} {$class->jurusan} - {$class->rombel}",
        ];
    }

    private function placementRow(PklPlacement $p): array
    {
        return [
            'id'         => $p->student->uuid,
            'nama'       => $p->student->user->nama,
            'nisn'       => $p->student->nisn,
            'tempat_pkl' => $p->tempat_pkl,
            'alamat_pkl' => $p->alamat_pkl ?? '—',
            'mulai'      => $p->tanggal_mulai?->toDateString(),
            'selesai'    => $p->tanggal_selesai?->toDateString(),
        ];
    }

    /**
     * Bangun bagian-bagian rekap (satu per kelas) dengan scoping:
     *  - admin/wakasek: kelas mana pun, atau 'semua' = seluruh kelas XII yang punya PKL.
     *  - wali kelas   : hanya kelas perwaliannya.
     *  - pembimbing   : hanya siswa bimbingannya di kelas itu.
     */
    private function rekapSections($user, string $classUuid): array
    {
        $ayId    = PklMode::activeAcademicYearId();
        $teacher = $user->teacher;

        // Kelas target
        if ($classUuid === 'semua') {
            abort_unless(ClassAccess::isSchoolWide($user), 403, 'Hanya admin yang dapat mengunduh semua kelas.');
            $classes = SchoolClass::whereHas('academicYear', fn ($q) => $q->where('aktif', true))
                ->whereHas('students.pklPlacements')
                ->orderBy('jurusan')->orderBy('rombel')->get();
        } else {
            $classes = collect([SchoolClass::where('uuid', $classUuid)->firstOrFail()]);
        }

        $sections = [];
        foreach ($classes as $class) {
            // Tentukan himpunan siswa sesuai peran.
            $studentIds = $this->rekapStudentIds($user, $teacher, $class, $ayId);
            if ($studentIds === null) {
                // tidak berhak atas kelas ini
                if ($classUuid !== 'semua') {
                    abort(403, 'Anda tidak berhak atas rekap kelas ini.');
                }
                continue;
            }

            $rows = \App\Models\Student::whereIn('id', $studentIds)
                ->with('user:id,nama')
                ->get()
                ->sortBy(fn ($s) => $s->user->nama)
                ->values()
                ->map(function ($s) {
                    $counts = PklAttendance::where('student_id', $s->id)
                        ->selectRaw('status, COUNT(*) c')->groupBy('status')->pluck('c', 'status');
                    $hadir = (int) ($counts['hadir'] ?? 0);
                    $sakit = (int) ($counts['sakit'] ?? 0);
                    $izin  = (int) ($counts['izin'] ?? 0);
                    $alpha = (int) ($counts['alpha'] ?? 0);
                    $total = $hadir + $sakit + $izin + $alpha;

                    return [
                        'nama'  => $s->user->nama,
                        'nisn'  => $s->nisn,
                        'hadir' => $hadir, 'sakit' => $sakit, 'izin' => $izin, 'alpha' => $alpha,
                        'total' => $total,
                        'pct'   => $total > 0 ? round($hadir / $total * 100, 1) : 0,
                    ];
                });

            $sections[] = [
                'kelas' => "{$class->tingkat->value} {$class->jurusan} - {$class->rombel}",
                'rows'  => $rows->all(),
            ];
        }

        abort_if(empty($sections), 404, 'Tidak ada data PKL untuk diunduh.');

        return $sections;
    }

    /** Himpunan student_id untuk rekap sebuah kelas sesuai peran; null = tidak berhak. */
    private function rekapStudentIds($user, $teacher, SchoolClass $class, ?int $ayId): ?Collection
    {
        $placements = PklPlacement::where('class_id', $class->id)
            ->when($ayId, fn ($q) => $q->where('academic_year_id', $ayId));

        if (ClassAccess::isSchoolWide($user)) {
            return $placements->pluck('student_id');
        }

        // Wali kelas dari kelas ini → semua siswa PKL kelas itu.
        if (ClassAccess::waliClassIds($user)->contains($class->id)) {
            return $placements->pluck('student_id');
        }

        // Pembimbing → hanya siswa bimbingannya di kelas ini.
        if ($teacher) {
            $mine = $placements->clone()->where('pembimbing_teacher_id', $teacher->id)->pluck('student_id');
            if ($mine->isNotEmpty()) {
                return $mine;
            }
        }

        return null;
    }
}
