<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\KokurikulerAttendance;
use App\Models\KokurikulerDimension;
use App\Models\KokurikulerDocument;
use App\Models\KokurikulerProject;
use App\Models\KokurikulerProjectClass;
use App\Models\KokurikulerProjectDimension;
use App\Models\KokurikulerReflection;
use App\Models\KokurikulerReport;
use App\Models\KokurikulerScore;
use App\Models\KokurikulerSubdimension;
use App\Models\KokurikulerTeam;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\User;
use App\Support\KokurikulerMode;
use App\Traits\BuildsXlsxReports;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use OpenSpout\Common\Entity\Cell\NumericCell;
use OpenSpout\Common\Entity\Cell\StringCell;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use OpenSpout\Writer\XLSX\Writer;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Penyiapan & rekap projek kokurikuler (admin/wakasek): CRUD projek per periode/tingkat
 * (tema, judul, tujuan, dimensi & sub-dimensi), kelas peserta dengan fasilitator yang
 * bisa diganti (default wali kelas, override manual per kelas, atau impor Excel),
 * master dimensi, rekap keterisian + nilai, dan ekspor absen.
 */
class KokurikulerAdminController extends Controller
{
    use BuildsXlsxReports;

    // ── Master Dimensi Profil Lulusan ─────────────────────────────────────────

    /** GET /admin/kokurikuler/dimensions */
    public function dimensions(): JsonResponse
    {
        $items = KokurikulerDimension::with('subdimensions')
            ->orderBy('urutan')
            ->get()
            ->map(fn ($d) => [
                'id'        => $d->id,
                'kode'      => $d->kode,
                'nama'      => $d->nama,
                'deskripsi' => $d->deskripsi,
                'aktif'     => $d->aktif,
                'subdimensions' => $d->subdimensions->map(fn ($s) => ['id' => $s->id, 'nama' => $s->nama])->values(),
            ]);

        return response()->json(['data' => $items]);
    }

    /** POST /admin/kokurikuler/dimensions */
    public function storeDimension(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nama'      => ['required', 'string', 'max:160'],
            'deskripsi' => ['nullable', 'string', 'max:2000'],
            'subdimensions'   => ['array'],
            'subdimensions.*' => ['string', 'max:200'],
        ]);

        $dim = KokurikulerDimension::create([
            'kode'      => Str::slug($data['nama'], '_'),
            'nama'      => $data['nama'],
            'deskripsi' => $data['deskripsi'] ?? null,
            'urutan'    => (int) KokurikulerDimension::max('urutan') + 1,
        ]);
        foreach ($data['subdimensions'] ?? [] as $i => $nama) {
            $dim->subdimensions()->create(['nama' => $nama, 'urutan' => $i + 1]);
        }

        return response()->json(['message' => 'Dimensi ditambahkan.', 'data' => ['id' => $dim->id]], 201);
    }

    /** PUT /admin/kokurikuler/dimensions/{id} */
    public function updateDimension(Request $request, int $id): JsonResponse
    {
        $dim  = KokurikulerDimension::findOrFail($id);
        $data = $request->validate([
            'nama'      => ['required', 'string', 'max:160'],
            'deskripsi' => ['nullable', 'string', 'max:2000'],
            'aktif'     => ['boolean'],
            'subdimensions'   => ['array'],
            'subdimensions.*' => ['string', 'max:200'],
        ]);

        DB::transaction(function () use ($dim, $data) {
            $dim->update([
                'nama'      => $data['nama'],
                'deskripsi' => $data['deskripsi'] ?? null,
                'aktif'     => $data['aktif'] ?? $dim->aktif,
            ]);

            // Sub-dimensi disinkronkan by-nama; yang hilang dihapus bila tidak dipakai projek.
            $keep = collect($data['subdimensions'] ?? []);
            $dim->subdimensions()
                ->whereNotIn('nama', $keep)
                ->get()
                ->each(function (KokurikulerSubdimension $s) {
                    $dipakai = DB::table('kokurikuler_project_subdimensions')->where('subdimension_id', $s->id)->exists();
                    abort_if($dipakai, 422, "Sub-dimensi \"{$s->nama}\" sedang dipakai projek — tidak bisa dihapus.");
                    $s->delete();
                });
            $keep->values()->each(fn ($nama, $i) => $dim->subdimensions()->updateOrCreate(['nama' => $nama], ['urutan' => $i + 1]));
        });

        return response()->json(['message' => 'Dimensi diperbarui.']);
    }

    /** DELETE /admin/kokurikuler/dimensions/{id} */
    public function destroyDimension(int $id): JsonResponse
    {
        $dim = KokurikulerDimension::findOrFail($id);
        abort_if(
            KokurikulerProjectDimension::where('dimension_id', $dim->id)->exists(),
            422, 'Dimensi ini dipakai projek — nonaktifkan saja, jangan dihapus.'
        );
        $dim->delete();

        return response()->json(['message' => 'Dimensi dihapus.']);
    }

    /** GET /admin/kokurikuler/dimensions/template — berisi master saat ini, siap diedit lalu diimpor ulang. */
    public function dimensionsTemplate(): BinaryFileResponse
    {
        $tempFile = tempnam(sys_get_temp_dir(), 'kk_dim_');
        $writer   = new Writer();
        $writer->openToFile($tempFile);
        $writer->getOptions()->setColumnWidthForRange(36, 1, 3);

        $writer->addRow(Row::fromValuesWithStyle(
            ['Nama Dimensi', 'Deskripsi', 'Sub-Dimensi (pisahkan dengan ;)'],
            $this->xlsxHeaderStyle()
        ));
        foreach (KokurikulerDimension::with('subdimensions')->orderBy('urutan')->get() as $d) {
            $writer->addRow(Row::fromValuesWithStyle([
                $d->nama,
                (string) ($d->deskripsi ?? ''),
                $d->subdimensions->pluck('nama')->implode('; '),
            ], $this->xlsxCellStyle()));
        }
        $writer->addRow(Row::fromValuesWithStyle(
            ['jangan diubah -> hapus baris ini sebelum impor bila perlu; nama = kunci pencocokan', 'opsional', 'contoh: Berperilaku produktif; Menciptakan inovasi'],
            (new Style())->withFontItalic(true)->withFontColor('6B7280')
        ));
        $writer->close();

        return response()->download($tempFile, 'template_dimensi_kokurikuler.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    /**
     * POST /admin/kokurikuler/dimensions/import — upsert master dimensi by nama.
     * Sub-dimensi yang tercantum di-upsert; sub-dimensi lama yang TIDAK tercantum
     * dibiarkan (tidak dihapus) agar projek yang sudah memakainya tidak rusak.
     */
    public function dimensionsImport(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls', 'max:5120']]);

        $success = 0;
        $errors  = [];
        foreach ($this->readXlsx($request->file('file')->getRealPath()) as $i => $row) {
            $rowNum    = $i + 2;
            $nama      = trim((string) ($row[0] ?? ''));
            $deskripsi = trim((string) ($row[1] ?? '')) ?: null;
            $subRaw    = trim((string) ($row[2] ?? ''));

            if ($nama === '') continue;
            if (str_starts_with($nama, 'jangan diubah')) continue; // baris catatan template
            if (mb_strlen($nama) > 160) { $errors[] = "Baris $rowNum: nama dimensi terlalu panjang (maks. 160)."; continue; }

            $dim = KokurikulerDimension::whereRaw('LOWER(nama) = ?', [mb_strtolower($nama)])->first();
            if (! $dim) {
                $kode = Str::slug($nama, '_');
                if (KokurikulerDimension::where('kode', $kode)->exists()) {
                    $kode .= '_' . Str::lower(Str::random(4));
                }
                $dim = KokurikulerDimension::create([
                    'kode'   => $kode,
                    'nama'   => $nama,
                    'urutan' => (int) KokurikulerDimension::max('urutan') + 1,
                ]);
            }
            $dim->update(['deskripsi' => $deskripsi ?? $dim->deskripsi]);

            $subs = collect(preg_split('/[;\n]/', $subRaw))->map(fn ($s) => trim($s))->filter()->values();
            $subs->each(fn ($namaSub, $j) => $dim->subdimensions()->updateOrCreate(['nama' => $namaSub], ['urutan' => $j + 1]));

            $success++;
        }

        return response()->json([
            'success_count' => $success,
            'error_count'   => count($errors),
            'errors'        => $errors,
        ]);
    }

    // ── Projek ─────────────────────────────────────────────────────────────────

    /** GET /admin/kokurikuler/projects */
    public function index(): JsonResponse
    {
        $projects = KokurikulerProject::with($this->projectRelations())
            ->orderByDesc('tanggal_mulai')
            ->get()
            ->map(fn ($p) => $this->projectRow($p));

        return response()->json(['data' => $projects]);
    }

    /** GET /admin/kokurikuler/teacher-options — kandidat fasilitator (semua guru). */
    public function teacherOptions(): JsonResponse
    {
        $options = User::whereHas('teacher')
            ->with('teacher:id,user_id,nip')
            ->orderBy('nama')
            ->get()
            ->map(fn ($u) => ['id' => $u->uuid, 'nama' => $u->nama, 'nip' => $u->teacher?->nip]);

        return response()->json(['data' => $options]);
    }

    /** POST /admin/kokurikuler/projects */
    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $ayId = KokurikulerMode::activeAcademicYearId();
        abort_if(! $ayId, 422, 'Belum ada tahun ajaran aktif.');
        $this->assertPeriodeDalamTahunAjaran($ayId, $data['tanggal_mulai'], $data['tanggal_selesai']);

        $project = DB::transaction(function () use ($data, $ayId) {
            $project = KokurikulerProject::create([
                ...collect($data)->except(['classes', 'dimensi'])->all(),
                'academic_year_id' => $ayId,
            ]);
            $this->syncClasses($project, $data['classes'] ?? []);
            $this->syncDimensions($project, $data['dimensi'] ?? []);

            return $project;
        });

        return response()->json([
            'message' => 'Projek kokurikuler dibuat.',
            'data'    => $this->projectRow($project->fresh($this->projectRelations())),
        ], 201);
    }

    /** PUT /admin/kokurikuler/projects/{uuid} */
    public function update(Request $request, string $uuid): JsonResponse
    {
        $project = KokurikulerProject::where('uuid', $uuid)->firstOrFail();
        $data    = $this->validated($request);
        $this->assertPeriodeDalamTahunAjaran($project->academic_year_id, $data['tanggal_mulai'], $data['tanggal_selesai']);

        DB::transaction(function () use ($request, $project, $data) {
            $project->update(collect($data)->except(['classes', 'dimensi'])->all());

            // Sinkronkan HANYA bila key-nya benar-benar dikirim. Dulu `?? []`
            // membuat PUT tanpa key classes/dimensi (mis. klien lama yang cuma
            // mengubah status) MENGHAPUS seluruh kelas peserta secara diam-diam —
            // fasilitator lenyap tanpa jejak (kasus nyata projek "Sakola Waluya").
            if ($request->has('classes')) {
                $this->syncClasses($project, $data['classes'] ?? []);
            }
            if ($request->has('dimensi')) {
                $this->syncDimensions($project, $data['dimensi'] ?? []);
            }
        });

        return response()->json([
            'message' => 'Projek diperbarui.',
            'data'    => $this->projectRow($project->fresh($this->projectRelations())),
        ]);
    }

    /** DELETE /admin/kokurikuler/projects/{uuid} */
    public function destroy(string $uuid): JsonResponse
    {
        KokurikulerProject::where('uuid', $uuid)->firstOrFail()->delete();

        return response()->json(['message' => 'Projek dihapus.']);
    }

    // ── Fasilitator: reset default wali + impor Excel ──────────────────────────

    /** POST /admin/kokurikuler/projects/{uuid}/fasilitator-reset — semua kelas kembali ke wali. */
    public function fasilitatorReset(string $uuid): JsonResponse
    {
        $project = KokurikulerProject::with('projectClasses.schoolClass')->where('uuid', $uuid)->firstOrFail();

        foreach ($project->projectClasses as $pc) {
            $pc->update(['fasilitator_user_id' => $pc->schoolClass->wali_kelas_id]);
        }

        return response()->json([
            'message' => 'Fasilitator semua kelas dikembalikan ke wali kelas.',
            'data'    => $this->projectRow($project->fresh($this->projectRelations())),
        ]);
    }

    /** GET /admin/kokurikuler/projects/{uuid}/fasilitator-template */
    public function fasilitatorTemplate(string $uuid): BinaryFileResponse
    {
        $project = KokurikulerProject::with(['projectClasses.schoolClass', 'projectClasses.fasilitator.teacher'])
            ->where('uuid', $uuid)->firstOrFail();

        $tempFile = tempnam(sys_get_temp_dir(), 'kk_fasil_');
        $writer   = new Writer();
        $writer->openToFile($tempFile);
        $writer->getOptions()->setColumnWidthForRange(28, 1, 3);

        $writer->addRow(Row::fromValuesWithStyle(['Kelas', 'NIP Guru Fasilitator', 'Nama Guru Fasilitator'], $this->xlsxHeaderStyle()));
        foreach ($project->projectClasses as $pc) {
            $c = $pc->schoolClass;
            $writer->addRow(Row::fromValuesWithStyle([
                $c->label(),
                (string) ($pc->fasilitator?->teacher?->nip ?? ''),
                (string) ($pc->fasilitator?->nama ?? ''),
            ], $this->xlsxCellStyle()));
        }
        $writer->addRow(Row::fromValuesWithStyle(
            ['jangan diubah', 'kunci pencocokan utama', 'dipakai bila NIP kosong — harus persis & unik'],
            (new Style())->withFontItalic(true)->withFontColor('6B7280')
        ));
        $writer->close();

        return response()->download($tempFile, 'template_fasilitator_kokurikuler.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    /** POST /admin/kokurikuler/projects/{uuid}/fasilitator-import */
    public function fasilitatorImport(Request $request, string $uuid): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls', 'max:5120']]);

        $project = KokurikulerProject::with('projectClasses.schoolClass')->where('uuid', $uuid)->firstOrFail();

        $byLabel = $project->projectClasses->keyBy(function ($pc) {
            $c = $pc->schoolClass;

            return mb_strtolower(trim($c->label()));
        });

        $success = 0;
        $errors  = [];
        foreach ($this->readXlsx($request->file('file')->getRealPath()) as $i => $row) {
            $rowNum = $i + 2;
            $kelas  = mb_strtolower(trim((string) ($row[0] ?? '')));
            $nip    = trim((string) ($row[1] ?? ''));
            $nama   = trim((string) ($row[2] ?? ''));

            if ($kelas === '' || ($nip === '' && $nama === '')) continue;
            if (str_starts_with($kelas, 'jangan diubah')) continue; // baris catatan template

            $pc = $byLabel->get($kelas);
            if (! $pc) { $errors[] = "Baris $rowNum: kelas '{$row[0]}' bukan peserta projek ini."; continue; }

            [$user, $err] = $this->resolveFasilitator($nip, $nama);
            if (! $user) { $errors[] = "Baris $rowNum: $err"; continue; }

            $pc->update(['fasilitator_user_id' => $user->id]);
            $success++;
        }

        return response()->json([
            'success_count' => $success,
            'error_count'   => count($errors),
            'errors'        => $errors,
            'data'          => $this->projectRow($project->fresh($this->projectRelations())),
        ]);
    }

    // ── Rekap ──────────────────────────────────────────────────────────────────

    /** GET /admin/kokurikuler/projects/{uuid}/rekap — keterisian per kelas per tanggal. */
    public function rekap(string $uuid): JsonResponse
    {
        $project = KokurikulerProject::with($this->projectRelations())->where('uuid', $uuid)->firstOrFail();

        $absen = KokurikulerAttendance::where('project_id', $project->id)
            ->selectRaw('class_id, tanggal, COUNT(*) c')
            ->groupBy('class_id', 'tanggal')->get()
            ->groupBy('class_id');

        $laporan = KokurikulerReport::where('project_id', $project->id)
            ->get(['class_id', 'tanggal'])
            ->groupBy('class_id');

        $refleksi = KokurikulerReflection::where('project_id', $project->id)
            ->join('students', 'students.id', '=', 'kokurikuler_reflections.student_id')
            ->selectRaw('students.class_id, kokurikuler_reflections.jenis, kokurikuler_reflections.tanggal, COUNT(*) c')
            ->groupBy('students.class_id', 'kokurikuler_reflections.jenis', 'kokurikuler_reflections.tanggal')
            ->get()
            ->groupBy('class_id');

        $nilai = KokurikulerScore::where('project_id', $project->id)
            ->join('students', 'students.id', '=', 'kokurikuler_scores.student_id')
            ->selectRaw('students.class_id, COUNT(*) c')
            ->groupBy('students.class_id')
            ->pluck('c', 'class_id');

        $dokumen = KokurikulerDocument::join('kokurikuler_teams', 'kokurikuler_teams.id', '=', 'kokurikuler_documents.team_id')
            ->where('kokurikuler_teams.project_id', $project->id)
            ->selectRaw('kokurikuler_teams.class_id, COUNT(*) c')
            ->groupBy('kokurikuler_teams.class_id')
            ->pluck('c', 'class_id');

        $tim = KokurikulerTeam::where('project_id', $project->id)
            ->selectRaw('class_id, COUNT(*) c')->groupBy('class_id')->pluck('c', 'class_id');

        $jumlahDimensi = $project->projectDimensions->count();

        $classes = $project->projectClasses->map(function ($pc) use ($absen, $laporan, $refleksi, $nilai, $dokumen, $tim, $jumlahDimensi) {
            $key = fn ($t) => Carbon::parse($t)->toDateString();

            $refleksiKelas = $refleksi->get($pc->class_id, collect());
            $jumlahSiswa   = Student::where('class_id', $pc->class_id)->count();

            return [
                'id'           => $pc->schoolClass->uuid,
                'label'        => $pc->schoolClass->label(),
                'fasilitator'  => $pc->fasilitator?->nama ?? '— (belum ada fasilitator)',
                'jumlah_siswa' => $jumlahSiswa,
                'jumlah_tim'   => (int) $tim->get($pc->class_id, 0),
                'dokumen'      => (int) $dokumen->get($pc->class_id, 0),
                'absen'   => $absen->get($pc->class_id, collect())->mapWithKeys(fn ($r) => [$key($r->tanggal) => (int) $r->c]),
                'laporan' => $laporan->get($pc->class_id, collect())->mapWithKeys(fn ($r) => [$key($r->tanggal) => true]),
                'refleksi' => $refleksiKelas->where('jenis', 'harian')
                    ->mapWithKeys(fn ($r) => [$key($r->tanggal) => (int) $r->c]),
                'refleksi_akhir' => (int) $refleksiKelas->where('jenis', 'akhir')->sum('c'),
                'nilai_terisi'   => (int) $nilai->get($pc->class_id, 0),
                'nilai_total'    => $jumlahSiswa * $jumlahDimensi,
            ];
        })->values();

        return response()->json(['data' => [
            'project' => $this->projectRow($project),
            'hari'    => $this->projectDates($project),
            'classes' => $classes,
        ]]);
    }

    /** GET /admin/kokurikuler/projects/{uuid}/export-absen — Excel absen seluruh kelas. */
    public function exportAbsen(string $uuid)
    {
        $project = KokurikulerProject::with('projectClasses.schoolClass')->where('uuid', $uuid)->firstOrFail();
        $dates   = collect($this->projectDates($project))->pluck('tanggal');

        $statuses = KokurikulerAttendance::where('project_id', $project->id)->get()
            ->groupBy('student_id')
            ->map(fn ($rows) => $rows->mapWithKeys(fn ($r) => [$r->tanggal->toDateString() => strtoupper(substr($r->status->value, 0, 1))]));

        return $this->streamXlsx('absen_kokurikuler.xlsx', function (Writer $w) use ($project, $dates, $statuses) {
            $widths = [1 => 5, 2 => 28, 3 => 14];
            foreach (range(4, 3 + $dates->count()) as $i) $widths[$i] = 7;
            foreach (range(4 + $dates->count(), 8 + $dates->count()) as $i) $widths[$i] = 8;
            $this->xlsxSetColumnWidths($w, $widths);

            $center = $this->xlsxCellCenterStyle();
            $text   = $this->xlsxCellStyle();

            foreach ($project->projectClasses as $pc) {
                $class = $pc->schoolClass;
                $label = $class->label();
                $w->addRow(Row::fromValuesWithStyle(["Absen Kokurikuler {$project->judul} — {$label}"], $this->xlsxTitleStyle()));
                $w->addRow(Row::fromValuesWithStyle(
                    ['No', 'Nama', 'NIS', ...$dates->map(fn ($t) => Carbon::parse($t)->format('d/m')), 'H', 'S', 'I', 'A', '% Hadir'],
                    $this->xlsxHeaderStyle()
                ));

                $students = Student::where('class_id', $pc->class_id)->with('user:id,nama')
                    ->get()->sortBy(fn ($s) => $s->user->nama)->values();

                foreach ($students as $i => $s) {
                    $marks  = $statuses->get($s->id, collect());
                    $counts = $marks->countBy();
                    $total  = $marks->count();
                    $hadir  = (int) $counts->get('H', 0);

                    $w->addRow(new Row([
                        new NumericCell($i + 1, $center),
                        new StringCell($s->user->nama, $text),
                        new StringCell((string) $s->nis, $center),
                        ...$dates->map(fn ($t) => new StringCell($marks->get($t, ''), $center)),
                        new NumericCell($hadir, $center),
                        new NumericCell((int) $counts->get('S', 0), $center),
                        new NumericCell((int) $counts->get('I', 0), $center),
                        new NumericCell((int) $counts->get('A', 0), $center),
                        new StringCell($total > 0 ? round($hadir / $total * 100, 1) . '%' : '—', $center),
                    ]));
                }
                $w->addRow(Row::fromValues(['']));
            }
        });
    }

    // ── Helper internal ────────────────────────────────────────────────────────

    /**
     * Tolak periode projek yang SELURUHNYA di luar rentang tahun ajaran — projek akan
     * terikat ke TA yang salah dan tak pernah dianggap "berjalan" setelah TA berganti.
     * Kasus nyata: "Sakola Waluya" (15–21 Jul) dibuat saat TA 2025/2026 genap masih
     * aktif (berakhir 19 Jun) — fasilitator & tagihannya mati senyap.
     */
    private function assertPeriodeDalamTahunAjaran(int $ayId, string $mulai, string $selesai): void
    {
        $ay = \App\Models\AcademicYear::find($ayId);
        if (! $ay) {
            return;
        }

        $luar = $selesai < $ay->tanggal_mulai->toDateString()
            || $mulai > $ay->tanggal_selesai->toDateString();

        abort_if($luar, 422,
            "Periode projek ($mulai s.d. $selesai) berada di luar rentang tahun ajaran "
            ."{$ay->tahun} ".ucfirst($ay->semester->value)
            ." ({$ay->tanggal_mulai->toDateString()} s.d. {$ay->tanggal_selesai->toDateString()}). "
            .'Aktifkan tahun ajaran yang sesuai dulu, atau sesuaikan tanggal projek.');
    }

    private function projectRelations(): array
    {
        return [
            'academicYear',
            'projectClasses.schoolClass',
            'projectClasses.fasilitator',
            'projectDimensions.dimension',
            'projectDimensions.subdimensions',
        ];
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'judul'           => ['required', 'string', 'max:200'],
            'tema'            => ['nullable', 'string', 'max:200'],
            'tingkat'         => ['nullable', 'string', 'max:10'],
            'tujuan'          => ['nullable', 'string', 'max:2000'],
            'deskripsi'       => ['nullable', 'string', 'max:2000'],
            'tanggal_mulai'   => ['required', 'date'],
            'tanggal_selesai' => ['required', 'date', 'after_or_equal:tanggal_mulai'],
            'status'          => ['required', 'in:draft,aktif,selesai'],
            'classes'         => ['array'],
            'classes.*.id'    => ['required', 'string'],
            'classes.*.fasilitator_user_id' => ['nullable', 'string'],
            'dimensi'         => ['array', 'max:4'],
            'dimensi.*.dimension_id'        => ['required', 'integer'],
            'dimensi.*.aspek'               => ['nullable', 'string', 'max:255'],
            'dimensi.*.subdimension_ids'    => ['array'],
            'dimensi.*.subdimension_ids.*'  => ['integer'],
        ]);

        // Tingkat boleh lebih dari satu ('XI,XII'). Dinormalkan: urut X→XI→XII,
        // duplikat/nilai asing dibuang; ketiganya terpilih ≡ semua tingkat (null).
        if (! empty($data['tingkat'])) {
            $urutan  = ['X', 'XI', 'XII'];
            $tingkat = collect(explode(',', $data['tingkat']))
                ->map(fn ($t) => strtoupper(trim($t)))
                ->filter(fn ($t) => in_array($t, $urutan, true))
                ->unique()
                ->sortBy(fn ($t) => array_search($t, $urutan, true))
                ->values();
            $data['tingkat'] = ($tingkat->isEmpty() || $tingkat->count() === 3)
                ? null
                : $tingkat->implode(',');
        }

        return $data;
    }

    /**
     * Selaraskan kelas peserta + fasilitator per kelas. fasilitator_user_id null =
     * pakai wali kelas saat ini. Kelas yang dilepas ditolak bila sudah punya data.
     */
    private function syncClasses(KokurikulerProject $project, array $rows): void
    {
        $classUuids = collect($rows)->pluck('id');
        $classes    = SchoolClass::whereIn('uuid', $classUuids)->get()->keyBy('uuid');
        $keepIds    = $classes->pluck('id');

        $removed = KokurikulerProjectClass::where('project_id', $project->id)
            ->whereNotIn('class_id', $keepIds)
            ->pluck('class_id');
        foreach ($removed as $classId) {
            $punyaData = KokurikulerAttendance::where('project_id', $project->id)->where('class_id', $classId)->exists()
                || KokurikulerReport::where('project_id', $project->id)->where('class_id', $classId)->exists()
                || KokurikulerTeam::where('project_id', $project->id)->where('class_id', $classId)->exists();
            abort_if($punyaData, 422,
                'Kelas yang sudah punya data absen/laporan/tim tidak bisa dilepas dari projek.');
        }
        KokurikulerProjectClass::where('project_id', $project->id)->whereIn('class_id', $removed)->delete();

        $fasilByUuid = User::whereIn('uuid', collect($rows)->pluck('fasilitator_user_id')->filter())
            ->whereHas('teacher')
            ->pluck('id', 'uuid');

        foreach ($rows as $row) {
            $class = $classes->get($row['id']);
            // Dulu id tak dikenal di-skip diam-diam — kelas yang admin kira tersimpan
            // bisa hilang tanpa error. Sekarang ditolak terang-terangan.
            abort_if(! $class, 422, 'Ada kelas pada daftar peserta yang tidak dikenal — muat ulang halaman lalu coba lagi.');

            $override = $row['fasilitator_user_id'] ?? null;
            KokurikulerProjectClass::updateOrCreate(
                ['project_id' => $project->id, 'class_id' => $class->id],
                ['fasilitator_user_id' => $override ? $fasilByUuid->get($override) : $class->wali_kelas_id],
            );
        }
    }

    /** Selaraskan dimensi yang dinilai + sub-dimensi yang diamati. */
    private function syncDimensions(KokurikulerProject $project, array $rows): void
    {
        $keepDimIds = collect($rows)->pluck('dimension_id');

        $project->projectDimensions()
            ->whereNotIn('dimension_id', $keepDimIds)
            ->get()
            ->each(function (KokurikulerProjectDimension $pd) {
                abort_if(
                    KokurikulerScore::where('project_dimension_id', $pd->id)->exists(),
                    422, 'Dimensi yang sudah punya nilai tidak bisa dilepas dari projek.'
                );
                $pd->delete();
            });

        foreach (array_values($rows) as $i => $row) {
            $pd = KokurikulerProjectDimension::updateOrCreate(
                ['project_id' => $project->id, 'dimension_id' => $row['dimension_id']],
                ['aspek' => $row['aspek'] ?? null, 'urutan' => $i + 1],
            );

            // Sub-dimensi hanya boleh milik dimensi bersangkutan.
            $validSubIds = KokurikulerSubdimension::where('dimension_id', $row['dimension_id'])
                ->whereIn('id', $row['subdimension_ids'] ?? [])
                ->pluck('id');
            $pd->subdimensions()->sync($validSubIds);
        }
    }

    /** Cari guru fasilitator: NIP dulu (kunci utama), lalu nama persis & unik. */
    private function resolveFasilitator(string $nip, string $nama): array
    {
        if ($nip !== '') {
            $user = User::whereHas('teacher', fn ($q) => $q->where('nip', $nip))->first();

            return $user ? [$user, null] : [null, "guru dengan NIP '$nip' tidak ditemukan."];
        }

        $matches = User::whereHas('teacher')
            ->whereRaw('LOWER(nama) = ?', [mb_strtolower($nama)])
            ->get();
        if ($matches->isEmpty()) return [null, "guru '$nama' tidak ditemukan. Tulis nama persis seperti di data guru."];
        if ($matches->count() > 1) return [null, "guru '$nama' ganda di data — isi kolom NIP untuk memastikan."];

        return [$matches->first(), null];
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

    private function projectRow(KokurikulerProject $project): array
    {
        return [
            'id'              => $project->uuid,
            'judul'           => $project->judul,
            'tema'            => $project->tema,
            'tingkat'         => $project->tingkat,
            'tujuan'          => $project->tujuan,
            'deskripsi'       => $project->deskripsi,
            'status'          => $project->status,
            'tanggal_mulai'   => $project->tanggal_mulai->toDateString(),
            'tanggal_selesai' => $project->tanggal_selesai->toDateString(),
            'tahun_ajaran'    => $project->relationLoaded('academicYear') && $project->academicYear
                ? $project->academicYear->tahun . ' - ' . ucfirst($project->academicYear->semester->value)
                : null,
            'classes' => $project->relationLoaded('projectClasses')
                ? $project->projectClasses->map(fn ($pc) => [
                    'id'          => $pc->schoolClass->uuid,
                    'label'       => $pc->schoolClass->label(),
                    'fasilitator' => $pc->relationLoaded('fasilitator') ? $pc->fasilitator?->nama : null,
                    'fasilitator_user_id' => $pc->fasilitator?->uuid,
                    'wali_adalah_fasilitator' => $pc->fasilitator_user_id !== null
                        && $pc->fasilitator_user_id === $pc->schoolClass->wali_kelas_id,
                ])->values()
                : [],
            'dimensi' => $project->relationLoaded('projectDimensions')
                ? $project->projectDimensions->map(fn ($pd) => [
                    'dimension_id'     => $pd->dimension_id,
                    'nama'             => $pd->dimension?->nama,
                    'aspek'            => $pd->aspek,
                    'subdimension_ids' => $pd->subdimensions->pluck('id')->values(),
                ])->values()
                : [],
        ];
    }

    /** Seluruh tanggal pelaksanaan projek (Minggu dilewati) — sama dengan KokurikulerController. */
    private function projectDates(KokurikulerProject $project): array
    {
        $out = [];
        $d   = $project->tanggal_mulai->copy();
        while ($d->lte($project->tanggal_selesai)) {
            if (! $d->isSunday()) {
                $out[] = [
                    'tanggal' => $d->toDateString(),
                    'label'   => $d->locale('id')->isoFormat('dddd, D MMM'),
                ];
            }
            $d = $d->copy()->addDay();
        }

        return $out;
    }
}
