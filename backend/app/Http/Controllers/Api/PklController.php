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
use Illuminate\Support\Facades\DB;
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

    /**
     * GET /pkl/overview — kelas yang saya BIMBING (punya penugasan placement) + jumlah siswa.
     * Ploting jadwal XII saja TIDAK memberi akses (keputusan 2026-07-17): tanggung jawab
     * agenda & presensi PKL melekat ke pembimbing, bukan pengajar kelas.
     */
    public function overview(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403, 'Hanya guru yang memiliki menu PKL.');

        $placements = $this->myPlacements($teacher->id)->load('schoolClass');

        $classes = $placements->groupBy('class_id')->map(function (Collection $group) {
            $class = $group->first()->schoolClass;

            return [
                'id'           => $class->uuid,
                'label'        => $class->label(),
                'jumlah_siswa' => $group->count(),
                'sebagai'      => 'pembimbing',
            ];
        });

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

    // ── Agenda PKL mingguan (AGREGAT lintas kelas) ─────────────────────────────
    //
    // Pembimbingan PKL dilakukan sekaligus untuk seluruh kelas bimbingan, jadi agenda
    // diisi SEKALI per minggu dan otomatis terdistribusi ke tiap kelas (satu rekaman
    // PklAgenda per kelas, catatan/TP sama, presensi ikut kelas siswanya). Hanya bisa
    // diisi mulai HARI JUMAT minggu itu sampai batas waktu yang ditetapkan admin.

    /** GET /pkl/weeks — daftar minggu agenda PKL (agregat semua kelas bimbingan). */
    public function weeks(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403);

        $placements = $this->myPlacements($teacher->id)->load(['schoolClass']);
        if ($placements->isEmpty()) {
            return response()->json(['data' => ['weeks' => []]]);
        }

        // class_id → set minggu (string) yang sudah terisi agendanya.
        $filledByClass = PklAgenda::where('pembimbing_teacher_id', $teacher->id)
            ->get(['class_id', 'minggu_mulai'])
            ->groupBy('class_id')
            ->map(fn ($g) => $g->map(fn ($a) => substr((string) $a->minggu_mulai, 0, 10))->flip());

        [$min, $max] = $this->aggregateRange($placements);
        $ay          = \App\Support\TahunAjaran::current();
        $semMulai    = $ay?->tanggal_mulai->toDateString();
        $semSelesai  = $ay?->tanggal_selesai->toDateString();
        $now         = Carbon::now(config('app.school_timezone'));

        $weeks = [];
        foreach ($this->mondays($min, $max) as $senin) {
            $key   = $senin->toDateString();
            $jumat = $senin->copy()->addDays(4);
            if ($semMulai && ($key > $semSelesai || $jumat->toDateString() < $semMulai)) {
                continue;
            }

            $activeClasses = $this->classesActiveInWeek($placements, $senin);
            if ($activeClasses->isEmpty()) {
                continue;
            }

            // Terisi bila SEMUA kelas aktif minggu ini sudah punya rekaman agenda.
            $terisi = $activeClasses->every(fn ($c) => ($filledByClass[$c['class_db_id']] ?? collect())->has($key));

            $deadline  = PklMode::fillDeadline($senin->copy());
            $bisaMulai = $now->gte($jumat->copy()->startOfDay());  // baru boleh diisi mulai Jumat
            $weeks[] = [
                'minggu_mulai'  => $key,
                'label'         => $senin->locale('id')->isoFormat('D MMM') . ' – ' . $jumat->locale('id')->isoFormat('D MMM YYYY'),
                'classes'       => $activeClasses->map(fn ($c) => ['label' => $c['label'], 'jumlah_siswa' => $c['jumlah']])->values(),
                'total_siswa'   => $activeClasses->sum('jumlah'),
                'terisi'        => $terisi,
                'bisa_diisi'    => $bisaMulai && $now->lte($deadline),
                'sebelum_jumat' => ! $bisaMulai,
                'lewat_batas'   => $bisaMulai && $now->gt($deadline),
                'deadline'      => $deadline->format('Y-m-d H:i'),
            ];
        }

        return response()->json(['data' => ['weeks' => $weeks]]);
    }

    /** GET /pkl/agenda?minggu=YYYY-MM-DD — form agenda agregat (semua siswa bimbingan). */
    public function showAgenda(Request $request): JsonResponse
    {
        $data = $request->validate(['minggu' => ['required', 'date']]);
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403);

        $senin      = $this->normalizeMonday($data['minggu']);
        $placements = $this->myPlacements($teacher->id)->load(['student.user', 'schoolClass']);
        abort_if($placements->isEmpty(), 403, 'Anda belum menjadi pembimbing PKL.');

        $active = $this->placementsActiveInWeek($placements, $senin);
        abort_if($active->isEmpty(), 404, 'Tidak ada siswa bimbingan yang PKL pada minggu ini.');

        // Rekaman agenda per-kelas untuk minggu ini (bisa >1 kelas) — catatan & TP dibagi.
        $agendas = PklAgenda::where('pembimbing_teacher_id', $teacher->id)
            ->whereDate('minggu_mulai', $senin->toDateString())
            ->with(['objectives', 'attendances'])
            ->get();

        $catatan  = $agendas->pluck('catatan')->first(fn ($c) => filled($c)) ?? '';
        $selected = $agendas->flatMap(fn ($a) => $a->objectives->pluck('uuid'))->unique()->values()->all();
        $absensi  = $agendas->flatMap(fn ($a) => $a->attendances)
            ->mapWithKeys(fn ($a) => [$a->student_id.'|'.$a->tanggal->toDateString() => $a->status->value]);

        $hari = $this->weekdays($senin);

        return response()->json([
            'data' => [
                'minggu'     => $senin->toDateString(),
                'hari'       => $hari,
                'objectives' => $this->objectivesForJurusans($active->map(fn ($p) => $p->schoolClass?->jurusan)->filter()->unique()->values()->all()),
                'agenda'     => ['catatan' => $catatan, 'objectives' => $selected],
                // Siswa dikelompokkan agar FE bisa tampilkan per kelas, tapi tetap satu tabel.
                'students'   => $active
                    ->sortBy(fn ($p) => [$p->schoolClass?->label(), $p->student->user->nama])
                    ->map(fn ($p) => [
                        'id'       => $p->student->uuid,
                        'nis'      => $p->student->nis,
                        'nama'     => $p->student->user->nama,
                        'kelas'    => $p->schoolClass?->label(),
                        'telpon'   => $p->telpon_siswa,
                        'presensi' => collect($hari)->mapWithKeys(fn ($d) =>
                            [$d['tanggal'] => $absensi->get($p->student->id.'|'.$d['tanggal'])])->all(),
                    ])->values(),
            ],
        ]);
    }

    /** POST /pkl/agenda — simpan agenda agregat; terdistribusi ke tiap kelas bimbingan. */
    public function storeAgenda(Request $request): JsonResponse
    {
        $data = $request->validate([
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

        $senin      = $this->normalizeMonday($data['minggu']);
        $jumat      = $senin->copy()->addDays(4);
        $placements = $this->myPlacements($teacher->id)->load(['student.user', 'schoolClass']);
        abort_if($placements->isEmpty(), 403, 'Anda belum menjadi pembimbing PKL.');
        $active     = $this->placementsActiveInWeek($placements, $senin);
        abort_if($active->isEmpty(), 404, 'Tidak ada siswa bimbingan yang PKL pada minggu ini.');

        // Jendela: baru boleh diisi mulai Jumat; ditolak kalau lewat deadline.
        $now = Carbon::now(config('app.school_timezone'));
        abort_if($now->lt($jumat->copy()->startOfDay()), 422,
            'Agenda PKL minggu ini baru bisa diisi mulai hari Jumat.');
        abort_if($now->gt(PklMode::fillDeadline($senin->copy())), 422,
            'Batas waktu pengisian agenda PKL untuk minggu ini sudah lewat.');

        $ayId       = PklMode::activeAcademicYearId();
        $validDates = collect($this->weekdays($senin))->pluck('tanggal');
        $today      = $now->toDateString();

        // Presensi masuk yang di-key per uuid siswa (validasi tanggal & masa depan).
        $presensiByStudent = collect($data['presensi'] ?? [])
            ->filter(fn ($p) => $validDates->contains($p['tanggal']) && $p['tanggal'] <= $today)
            ->groupBy('student_id');

        // Distribusi: satu rekaman agenda per kelas aktif, catatan/TP sama.
        DB::transaction(function () use ($active, $teacher, $senin, $ayId, $data, $presensiByStudent) {
            foreach ($active->groupBy('class_id') as $classGroup) {
                $class = $classGroup->first()->schoolClass;

                // Upsert eksplisit lewat whereDate + withTrashed: kolom minggu_mulai
                // bertipe `date` (updateOrCreate dgn string tanggal bisa gagal cocok →
                // duplikat) DAN PklAgenda pakai SoftDeletes sehingga baris terhapus tetap
                // menahan slot unique — cari termasuk yang trashed lalu pulihkan.
                $agenda = PklAgenda::withTrashed()
                    ->where('pembimbing_teacher_id', $teacher->id)
                    ->where('class_id', $class->id)
                    ->whereDate('minggu_mulai', $senin->toDateString())
                    ->first()
                    ?? new PklAgenda([
                        'pembimbing_teacher_id' => $teacher->id,
                        'class_id'              => $class->id,
                        'minggu_mulai'          => $senin->toDateString(),
                    ]);
                if ($agenda->trashed()) {
                    $agenda->restore();
                }
                $agenda->academic_year_id = $ayId;
                $agenda->catatan          = $data['catatan'] ?? null;
                $agenda->save();

                // TP: hanya yang valid untuk jurusan kelas ini (dari daftar yang dikirim).
                $objIds = PklObjective::forJurusan($class->jurusan)
                    ->where('aktif', true)
                    ->when($ayId, fn ($q) => $q->where('academic_year_id', $ayId))
                    ->whereIn('uuid', $data['objective_ids'] ?? [])
                    ->pluck('id');
                $agenda->objectives()->sync($objIds);

                foreach ($classGroup as $p) {
                    foreach ($presensiByStudent->get($p->student->uuid, collect()) as $pr) {
                        PklAttendance::updateOrCreate(
                            ['pkl_agenda_id' => $agenda->id, 'student_id' => $p->student->id, 'tanggal' => $pr['tanggal']],
                            ['status' => $pr['status']],
                        );
                    }
                }
            }
        });

        return response()->json(['message' => 'Agenda PKL tersimpan untuk semua kelas bimbingan.']);
    }

    // ── Ekspor ─────────────────────────────────────────────────────────────────

    /**
     * GET /pkl/students/export?class_id=&format=pdf|excel — data penempatan siswa
     * bimbingan. Tanpa class_id → seluruh siswa bimbingan lintas kelas.
     */
    public function exportStudents(Request $request)
    {
        $request->validate([
            'class_id' => ['nullable', 'string'],
            'format'   => ['required', 'in:pdf,excel'],
        ]);
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403);

        if ($request->filled('class_id')) {
            [$class, $students] = $this->authorizeClass($teacher->id, $request->class_id);
            $kelasLabel = $class->label();
            $filename   = 'data_pkl_'.$class->tingkat->value.'_'.$class->jurusanKode().'_'.$class->rombel;
        } else {
            $students = $this->myPlacements($teacher->id)
                ->load(['student.user', 'schoolClass'])
                ->sortBy(fn ($p) => [$p->schoolClass?->label(), $p->student?->user?->nama])
                ->values();
            abort_if($students->isEmpty(), 404, 'Belum ada siswa bimbingan.');
            $kelasLabel = 'Semua Siswa Bimbingan';
            $filename   = 'data_pkl_bimbingan';
        }
        $rows = $students->map(fn ($p) => $this->placementRow($p))->values();

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

    // ── Edit & tambah penempatan oleh pembimbing ───────────────────────────────

    /** PUT /pkl/placements/{uuid} — pembimbing mengedit penempatan siswa bimbingannya sendiri. */
    public function updatePlacement(Request $request, string $uuid): JsonResponse
    {
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403);

        $p = PklPlacement::where('uuid', $uuid)->firstOrFail();
        abort_unless($p->pembimbing_teacher_id === $teacher->id, 403, 'Bukan siswa bimbingan Anda.');

        $data = $request->validate([
            'tempat_pkl'      => ['required', 'string', 'max:200'],
            'alamat_pkl'      => ['nullable', 'string', 'max:300'],
            'telpon'          => ['nullable', 'string', 'max:25'],
            'tanggal_mulai'   => ['required', 'date'],
            'tanggal_selesai' => ['required', 'date', 'after_or_equal:tanggal_mulai'],
        ]);

        abort_if(
            PklPlacement::overlapExists($p->student_id, $p->academic_year_id, $data['tanggal_mulai'], $data['tanggal_selesai'], $p->id),
            422,
            'Periode bertumpuk dengan tempat PKL lain milik siswa ini (waktu bersamaan = ada kesalahan data).',
        );

        $p->update([
            'tempat_pkl'      => $data['tempat_pkl'],
            'alamat_pkl'      => $data['alamat_pkl'] ?? null,
            'telpon_siswa'    => PklPlacement::normalizeTelpon($data['telpon'] ?? null),
            'tanggal_mulai'   => $data['tanggal_mulai'],
            'tanggal_selesai' => $data['tanggal_selesai'],
        ]);

        return response()->json(['message' => 'Penempatan PKL diperbarui.']);
    }

    /**
     * POST /pkl/placements — pembimbing menambah tempat PKL baru untuk siswa yang
     * SUDAH menjadi bimbingannya (satu siswa boleh beberapa tempat, waktu berbeda).
     */
    public function storePlacement(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403);

        $data = $request->validate([
            'student_id'      => ['required', 'string'],
            'tempat_pkl'      => ['required', 'string', 'max:200'],
            'alamat_pkl'      => ['nullable', 'string', 'max:300'],
            'telpon'          => ['nullable', 'string', 'max:25'],
            'tanggal_mulai'   => ['required', 'date'],
            'tanggal_selesai' => ['required', 'date', 'after_or_equal:tanggal_mulai'],
        ]);

        $student = \App\Models\Student::where('uuid', $data['student_id'])->firstOrFail();

        $ayId = PklMode::activeAcademicYearId();
        $bimbingan = PklPlacement::where('student_id', $student->id)
            ->when($ayId, fn ($q) => $q->where('academic_year_id', $ayId))
            ->where('pembimbing_teacher_id', $teacher->id)
            ->orderBy('id')
            ->first();
        abort_unless($bimbingan, 403, 'Siswa ini bukan bimbingan Anda.');

        abort_if(
            PklPlacement::overlapExists($student->id, $ayId ?? $bimbingan->academic_year_id, $data['tanggal_mulai'], $data['tanggal_selesai']),
            422,
            'Periode bertumpuk dengan tempat PKL lain milik siswa ini (waktu bersamaan = ada kesalahan data).',
        );

        $p = PklPlacement::create([
            'student_id'            => $student->id,
            'class_id'              => $bimbingan->class_id,
            'academic_year_id'      => $ayId ?? $bimbingan->academic_year_id,
            'pembimbing_teacher_id' => $teacher->id,
            'tempat_pkl'            => $data['tempat_pkl'],
            'alamat_pkl'            => $data['alamat_pkl'] ?? null,
            'telpon_siswa'          => PklPlacement::normalizeTelpon($data['telpon'] ?? null),
            'tanggal_mulai'         => $data['tanggal_mulai'],
            'tanggal_selesai'       => $data['tanggal_selesai'],
        ]);

        return response()->json(['message' => 'Tempat PKL ditambahkan.', 'id' => $p->uuid], 201);
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
     * Pastikan $teacherId benar membimbing siswa PKL di kelas ini; kembalikan
     * [kelas, placements siswa bimbingannya]. Hanya PEMBIMBING (punya penugasan
     * placement) yang berhak — ploting jadwal XII saja tidak memberi akses.
     */
    private function authorizeClass(int $teacherId, string $classUuid): array
    {
        $class = SchoolClass::where('uuid', $classUuid)->firstOrFail();

        $placements = $this->myPlacements($teacherId)
            ->load(['student.user'])
            ->filter(fn ($p) => $p->class_id === $class->id)
            ->values();

        abort_if($placements->isEmpty(), 403, 'Anda tidak membimbing siswa PKL di kelas ini.');

        return [$class, $placements];
    }

    /** TP PKL gabungan untuk beberapa jurusan (bimbingan bisa lintas jurusan). */
    private function objectivesForJurusans(array $jurusans): array
    {
        $ayId = PklMode::activeAcademicYearId();

        return PklObjective::where('aktif', true)
            ->when($ayId, fn ($q) => $q->where('academic_year_id', $ayId))
            ->where(fn ($q) => $q->whereNull('jurusan')->orWhereIn('jurusan', $jurusans))
            ->orderByRaw('jurusan IS NOT NULL')
            ->orderBy('id')
            ->get()
            ->map(fn ($o) => [
                'id'        => $o->uuid,
                'kode'      => $o->kode,
                'deskripsi' => $o->deskripsi,
                'lingkup'   => $o->jurusan === null ? 'Umum (semua jurusan)' : "Khusus {$o->jurusan}",
            ])->all();
    }

    /** Rentang tanggal PKL agregat pembimbing = min(mulai)..max(selesai) seluruh placement. */
    private function aggregateRange(Collection $placements): array
    {
        return [
            Carbon::parse($placements->min('tanggal_mulai')),
            Carbon::parse($placements->max('tanggal_selesai')),
        ];
    }

    /** Placement yang periodenya beririsan dengan minggu (Sen–Jum) yang mulai $senin. */
    private function placementsActiveInWeek(Collection $placements, Carbon $senin): Collection
    {
        $jumat = $senin->copy()->addDays(4);

        return $placements->filter(fn ($p) =>
            $p->tanggal_mulai && $p->tanggal_selesai
            && $p->tanggal_mulai->lte($jumat) && $p->tanggal_selesai->gte($senin)
        )->values();
    }

    /** Ringkasan kelas (label + jumlah siswa) yang aktif PKL pada minggu $senin. */
    private function classesActiveInWeek(Collection $placements, Carbon $senin): Collection
    {
        return $this->placementsActiveInWeek($placements, $senin)
            ->groupBy('class_id')
            ->map(fn ($g) => [
                'class_db_id' => $g->first()->class_id,
                'label'       => $g->first()->schoolClass?->label(),
                'jumlah'      => $g->count(),
            ])
            ->sortBy('label')
            ->values();
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
            'label' => $class->label(),
        ];
    }

    private function placementRow(PklPlacement $p): array
    {
        return [
            // uuid PENEMPATAN — kunci baris (satu siswa bisa >1 tempat) & target edit.
            'placement_id' => $p->uuid,
            'id'         => $p->student->uuid,
            'nama'       => $p->student->user->nama,
            'nis'        => $p->student->nis,
            'nisn'       => $p->student->nisn,
            'telpon'     => $p->telpon_siswa,
            'tempat_pkl' => $p->tempat_pkl,
            'alamat_pkl' => $p->alamat_pkl ?? '—',
            'mulai'      => $p->tanggal_mulai?->toDateString(),
            'selesai'    => $p->tanggal_selesai?->toDateString(),
            // Kelas per baris — daftar bimbingan kini lintas kelas (filter di FE).
            'class_id'   => $p->schoolClass?->uuid,
            'kelas'      => $p->schoolClass?->label(),
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
            if (ClassAccess::isSchoolWide($user)) {
                $classes = SchoolClass::where('academic_year_id', \App\Support\TahunAjaran::id())
                    ->whereHas('students.pklPlacements')
                    ->orderBy('jurusan')->orderBy('rombel')->get();
            } else {
                // Pembimbing/wali: 'semua' = seluruh kelas yang menjadi haknya —
                // kelas bimbingan (placement) + kelas perwalian.
                $classIds = collect();
                if ($teacher) {
                    $classIds = PklPlacement::where('pembimbing_teacher_id', $teacher->id)
                        ->when($ayId, fn ($q) => $q->where('academic_year_id', $ayId))
                        ->pluck('class_id');
                }
                $classIds = $classIds->merge(ClassAccess::waliClassIds($user))->unique();
                $classes  = SchoolClass::whereIn('id', $classIds)
                    ->orderBy('jurusan')->orderBy('rombel')->get();
                abort_if($classes->isEmpty(), 403, 'Anda tidak membimbing siswa PKL.');
            }
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
                'kelas' => $class->label(),
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
