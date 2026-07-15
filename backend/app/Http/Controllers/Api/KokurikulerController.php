<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KokurikulerAttendance;
use App\Models\KokurikulerDocument;
use App\Models\KokurikulerProject;
use App\Models\KokurikulerProjectClass;
use App\Models\KokurikulerProjectDimension;
use App\Models\KokurikulerReflection;
use App\Models\KokurikulerReport;
use App\Models\KokurikulerScore;
use App\Models\KokurikulerTeam;
use App\Models\KokurikulerTeamMember;
use App\Models\PrintSetting;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Support\ClassAccess;
use App\Support\SemesterLock;
use App\Traits\BuildsXlsxReports;
use App\Traits\HandlesPdfPreview;
use App\Traits\RejectsFutureDate;
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
 * Alur harian projek kokurikuler.
 *
 * Fasilitator (default wali kelas): absen siswa per tanggal, laporan singkat harian,
 * membaca refleksi siswa, mengelola tim, melihat/menghapus tautan dokumen tim.
 * Siswa: refleksi harian + refleksi akhir, melihat tim sendiri, menambah tautan
 * dokumen hasil untuk timnya.
 *
 * Penyiapan projek (CRUD, kelas peserta, rekap sekolah) ada di Admin\KokurikulerAdminController.
 */
class KokurikulerController extends Controller
{
    use BuildsXlsxReports;
    use HandlesPdfPreview;
    use RejectsFutureDate;

    // ── Fasilitator ────────────────────────────────────────────────────────────

    /** GET /kokurikuler/overview — projek & kelas yang saya fasilitasi. */
    public function overview(Request $request): JsonResponse
    {
        $user = $request->user();

        $rows = KokurikulerProjectClass::with(['project', 'schoolClass'])
            ->where('fasilitator_user_id', $user->id)
            ->whereHas('project', fn ($q) => $q->berjalan())
            ->get();

        $projects = $rows->groupBy('project_id')->map(function (Collection $group) {
            $project = $group->first()->project;

            return [
                'id'      => $project->uuid,
                'judul'   => $project->judul,
                'tema'    => $project->tema,
                'tingkat' => $project->tingkat,
                'tujuan'  => $project->tujuan,
                'status'  => $project->status,
                'tanggal_mulai'   => $project->tanggal_mulai->toDateString(),
                'tanggal_selesai' => $project->tanggal_selesai->toDateString(),
                'hari'    => $this->projectDates($project),
                'classes' => $group->map(fn ($pc) => [
                    'id'           => $pc->schoolClass->uuid,
                    'label'        => $this->classLabel($pc->schoolClass),
                    'jumlah_siswa' => Student::where('class_id', $pc->class_id)->count(),
                ])->values(),
            ];
        })->values();

        return response()->json(['data' => ['projects' => $projects]]);
    }

    /** GET /kokurikuler/absen?project_id=&class_id=&tanggal= — roster + status tersimpan. */
    public function absenShow(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'string'],
            'class_id'   => ['required', 'string'],
            'tanggal'    => ['required', 'date'],
        ]);

        [$project, $class] = $this->authorizeFasilitator($request->user(), $data['project_id'], $data['class_id']);

        $existing = KokurikulerAttendance::where('project_id', $project->id)
            ->where('class_id', $class->id)
            ->whereDate('tanggal', $data['tanggal'])
            ->pluck('status', 'student_id');

        $students = $this->roster($class)->map(fn ($s) => [
            'id'     => $s->uuid,
            'nis'    => $s->nis,
            'nama'   => $s->user->nama,
            'status' => $existing->get($s->id)?->value,
        ])->values();

        return response()->json(['data' => [
            'kelas'    => $this->classLabel($class),
            'tanggal'  => $data['tanggal'],
            'students' => $students,
        ]]);
    }

    /** POST /kokurikuler/absen — simpan absensi satu kelas satu tanggal (bulk upsert). */
    public function absenStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'string'],
            'class_id'   => ['required', 'string'],
            'tanggal'    => ['required', 'date', $this->notFutureDateRule()],
            'records'    => ['required', 'array'],
            'records.*.student_id' => ['required', 'string'],
            'records.*.status'     => ['required', 'in:hadir,sakit,izin,alpha'],
        ], $this->notFutureDateMessages());

        $user = $request->user();
        [$project, $class] = $this->authorizeFasilitator($user, $data['project_id'], $data['class_id']);
        $this->assertProjectWritable($project, $class->id, $data['tanggal']);

        $idByUuid = Student::where('class_id', $class->id)->pluck('id', 'uuid');

        DB::transaction(function () use ($data, $project, $class, $user, $idByUuid) {
            foreach ($data['records'] as $r) {
                $sid = $idByUuid->get($r['student_id']);
                if (! $sid) continue; // bukan siswa kelas ini → abaikan

                KokurikulerAttendance::updateOrCreate(
                    ['project_id' => $project->id, 'student_id' => $sid, 'tanggal' => $data['tanggal']],
                    ['class_id' => $class->id, 'status' => $r['status'], 'recorded_by' => $user->id],
                );
            }
        });

        return response()->json(['message' => 'Absensi kokurikuler tersimpan.']);
    }

    /** GET /kokurikuler/laporan?project_id=&class_id= — laporan harian per tanggal projek. */
    public function laporanIndex(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'string'],
            'class_id'   => ['required', 'string'],
        ]);

        [$project, $class] = $this->authorizeFasilitator($request->user(), $data['project_id'], $data['class_id']);

        $existing = KokurikulerReport::where('project_id', $project->id)
            ->where('class_id', $class->id)
            ->get()
            ->keyBy(fn ($r) => $r->tanggal->toDateString());

        $rows = collect($this->projectDates($project))->map(fn ($h) => [
            'tanggal' => $h['tanggal'],
            'label'   => $h['label'],
            'isi'     => $existing->get($h['tanggal'])?->isi,
        ]);

        return response()->json(['data' => ['kelas' => $this->classLabel($class), 'laporan' => $rows]]);
    }

    /** POST /kokurikuler/laporan — simpan/perbarui laporan singkat satu tanggal. */
    public function laporanStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'string'],
            'class_id'   => ['required', 'string'],
            'tanggal'    => ['required', 'date', $this->notFutureDateRule()],
            'isi'        => ['required', 'string', 'max:2000'],
        ], $this->notFutureDateMessages());

        [$project, $class] = $this->authorizeFasilitator($request->user(), $data['project_id'], $data['class_id']);
        $this->assertProjectWritable($project, $class->id, $data['tanggal']);

        KokurikulerReport::updateOrCreate(
            ['project_id' => $project->id, 'class_id' => $class->id, 'tanggal' => $data['tanggal']],
            ['isi' => $data['isi']],
        );

        return response()->json(['message' => 'Laporan harian tersimpan.']);
    }

    /** GET /kokurikuler/refleksi?project_id=&class_id=&jenis=&tanggal= — refleksi siswa (dibaca fasilitator). */
    public function refleksiIndex(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'string'],
            'class_id'   => ['required', 'string'],
            'jenis'      => ['required', 'in:harian,akhir'],
            'tanggal'    => ['required_if:jenis,harian', 'nullable', 'date'],
        ]);

        [$project, $class] = $this->authorizeFasilitator($request->user(), $data['project_id'], $data['class_id']);

        $reflections = KokurikulerReflection::where('project_id', $project->id)
            ->where('jenis', $data['jenis'])
            ->when($data['jenis'] === 'harian', fn ($q) => $q->whereDate('tanggal', $data['tanggal']))
            ->get()
            ->keyBy('student_id');

        $students = $this->roster($class)->map(fn ($s) => [
            'id'   => $s->uuid,
            'nis'  => $s->nis,
            'nama' => $s->user->nama,
            'isi'  => $reflections->get($s->id)?->isi,
        ])->values();

        return response()->json(['data' => [
            'kelas'    => $this->classLabel($class),
            'terisi'   => $students->whereNotNull('isi')->count(),
            'students' => $students,
        ]]);
    }

    /** GET /kokurikuler/tim?project_id=&class_id= — tim + anggota + siswa belum bertim. */
    public function timShow(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'string'],
            'class_id'   => ['required', 'string'],
        ]);

        [$project, $class] = $this->authorizeFasilitator($request->user(), $data['project_id'], $data['class_id']);

        return response()->json(['data' => $this->teamBoard($project, $class)]);
    }

    /**
     * POST /kokurikuler/tim — susun ulang tim satu kelas.
     * Body: { project_id, class_id, jumlah_tim, teams: [{nomor, nama?}], assignments: [{student_id, nomor|null}] }
     */
    public function timStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'string'],
            'class_id'   => ['required', 'string'],
            'jumlah_tim' => ['required', 'integer', 'min:1', 'max:12'],
            'teams'      => ['array'],
            'teams.*.nomor' => ['required', 'integer', 'min:1'],
            'teams.*.nama'  => ['nullable', 'string', 'max:120'],
            'assignments'   => ['array'],
            'assignments.*.student_id' => ['required', 'string'],
            'assignments.*.nomor'      => ['nullable', 'integer', 'min:1'],
        ]);

        [$project, $class] = $this->authorizeFasilitator($request->user(), $data['project_id'], $data['class_id']);
        $this->assertProjectWritable($project, $class->id);

        $jumlah   = $data['jumlah_tim'];
        $namaTim  = collect($data['teams'] ?? [])->keyBy('nomor');
        $idByUuid = Student::where('class_id', $class->id)->pluck('id', 'uuid');

        DB::transaction(function () use ($project, $class, $jumlah, $namaTim, $idByUuid, $data) {
            // Tim berlebih hanya boleh dihapus bila tidak punya dokumen (dokumen ikut terhapus cascade).
            $extra = KokurikulerTeam::where('project_id', $project->id)
                ->where('class_id', $class->id)
                ->where('nomor', '>', $jumlah)
                ->withCount('documents')
                ->get();
            abort_if($extra->contains(fn ($t) => $t->documents_count > 0), 422,
                'Tim yang sudah punya dokumen tidak bisa dihapus — pindahkan/hapus dokumennya dulu.');
            KokurikulerTeam::whereIn('id', $extra->pluck('id'))->delete();

            $teamIdByNomor = collect(range(1, $jumlah))->mapWithKeys(function ($nomor) use ($project, $class, $namaTim) {
                $team = KokurikulerTeam::updateOrCreate(
                    ['project_id' => $project->id, 'class_id' => $class->id, 'nomor' => $nomor],
                    ['nama' => $namaTim->get($nomor)['nama'] ?? null],
                );

                return [$nomor => $team->id];
            });

            // Susun ulang keanggotaan dari nol sesuai assignment terkirim.
            KokurikulerTeamMember::whereIn('team_id', $teamIdByNomor->values())->delete();
            foreach ($data['assignments'] ?? [] as $a) {
                $sid = $idByUuid->get($a['student_id']);
                if (! $sid || empty($a['nomor']) || ! $teamIdByNomor->has($a['nomor'])) continue;

                KokurikulerTeamMember::create(['team_id' => $teamIdByNomor->get($a['nomor']), 'student_id' => $sid]);
            }
        });

        return response()->json([
            'message' => 'Susunan tim tersimpan.',
            'data'    => $this->teamBoard($project, $class),
        ]);
    }

    /** DELETE /kokurikuler/dokumen/{uuid} — pemilik, fasilitator kelasnya, atau admin. */
    public function dokumenDestroy(Request $request, string $uuid): JsonResponse
    {
        $doc  = KokurikulerDocument::where('uuid', $uuid)->with('team.project')->firstOrFail();
        $user = $request->user();

        $isFasil = KokurikulerProjectClass::where('project_id', $doc->team->project_id)
            ->where('class_id', $doc->team->class_id)
            ->where('fasilitator_user_id', $user->id)
            ->exists();

        abort_unless(
            $doc->created_by === $user->id || $isFasil || ClassAccess::isSchoolWide($user),
            403, 'Anda tidak berhak menghapus dokumen ini.'
        );
        SemesterLock::assertClassWritable($doc->team->class_id);

        $doc->delete();

        return response()->json(['message' => 'Dokumen dihapus.']);
    }

    // ── Penilaian dimensi (fasilitator) ────────────────────────────────────────

    /** GET /kokurikuler/nilai?project_id=&class_id= — grid siswa × dimensi. */
    public function nilaiShow(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'string'],
            'class_id'   => ['required', 'string'],
        ]);

        [$project, $class] = $this->authorizeFasilitator($request->user(), $data['project_id'], $data['class_id']);

        $dimensi = $this->projectDimensionRows($project);

        $scores = KokurikulerScore::where('project_id', $project->id)
            ->whereIn('student_id', Student::where('class_id', $class->id)->select('id'))
            ->get()
            ->keyBy(fn ($s) => $s->student_id . '|' . $s->project_dimension_id);

        $pdIdByUuid = $project->projectDimensions->pluck('id', 'uuid');

        $students = $this->roster($class)->map(fn ($s) => [
            'id'    => $s->uuid,
            'nis'   => $s->nis,
            'nama'  => $s->user->nama,
            'nilai' => $pdIdByUuid->mapWithKeys(function ($pdId, $pdUuid) use ($scores, $s) {
                $score = $scores->get($s->id . '|' . $pdId);

                return [$pdUuid => $score ? ['level' => $score->level, 'catatan' => $score->catatan] : null];
            }),
        ])->values();

        return response()->json(['data' => [
            'kelas'    => $this->classLabel($class),
            'dimensi'  => $dimensi,
            'students' => $students,
        ]]);
    }

    /** POST /kokurikuler/nilai — simpan nilai batch (satu kelas sekaligus). */
    public function nilaiStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'string'],
            'class_id'   => ['required', 'string'],
            'nilai'      => ['required', 'array'],
            'nilai.*.student_id'   => ['required', 'string'],
            'nilai.*.dimension_id' => ['required', 'string'], // uuid kokurikuler_project_dimensions
            'nilai.*.level'        => ['nullable', 'in:SB,B,C,K'],
            'nilai.*.catatan'      => ['nullable', 'string', 'max:255'],
        ]);

        $user = $request->user();
        [$project, $class] = $this->authorizeFasilitator($user, $data['project_id'], $data['class_id']);
        $this->assertProjectWritable($project, $class->id);

        $idByUuid   = Student::where('class_id', $class->id)->pluck('id', 'uuid');
        $pdIdByUuid = $project->projectDimensions->pluck('id', 'uuid');

        DB::transaction(function () use ($data, $project, $user, $idByUuid, $pdIdByUuid) {
            foreach ($data['nilai'] as $n) {
                $sid  = $idByUuid->get($n['student_id']);
                $pdId = $pdIdByUuid->get($n['dimension_id']);
                if (! $sid || ! $pdId) continue; // bukan siswa kelas ini / bukan dimensi projek ini

                if (empty($n['level'])) {
                    // Level dikosongkan = hapus nilai.
                    KokurikulerScore::where('project_id', $project->id)
                        ->where('student_id', $sid)
                        ->where('project_dimension_id', $pdId)
                        ->delete();
                    continue;
                }

                KokurikulerScore::updateOrCreate(
                    ['project_id' => $project->id, 'student_id' => $sid, 'project_dimension_id' => $pdId],
                    ['level' => $n['level'], 'catatan' => $n['catatan'] ?? null, 'dinilai_oleh' => $user->id],
                );
            }
        });

        return response()->json(['message' => 'Penilaian kokurikuler tersimpan.']);
    }

    /**
     * GET /kokurikuler/nilai/export?project_id=&class_id=(uuid|semua)&format=excel|pdf
     * Rekap nilai per kelas dengan blok pengesahan (TTD) fasilitator kelas ybs —
     * juga saat diunduh admin. class_id 'semua' hanya untuk admin/wakasek.
     */
    public function nilaiExport(Request $request)
    {
        $request->validate([
            'project_id' => ['required', 'string'],
            'class_id'   => ['required', 'string'],
            'format'     => ['required', 'in:pdf,excel'],
        ]);

        $user    = $request->user();
        $project = $this->resolveProject($request->project_id);
        $dimensi = $this->projectDimensionRows($project);
        abort_if(empty($dimensi), 422, 'Projek ini belum punya dimensi penilaian.');

        // Kelas target + otorisasi.
        if ($request->class_id === 'semua') {
            abort_unless(ClassAccess::isSchoolWide($user), 403, 'Hanya admin yang dapat mengunduh semua kelas.');
            $projectClasses = KokurikulerProjectClass::with(['schoolClass', 'fasilitator.teacher'])
                ->where('project_id', $project->id)->get();
        } else {
            [, $class] = $this->authorizeFasilitator($user, $request->project_id, $request->class_id);
            $projectClasses = KokurikulerProjectClass::with(['schoolClass', 'fasilitator.teacher'])
                ->where('project_id', $project->id)->where('class_id', $class->id)->get();
        }
        abort_if($projectClasses->isEmpty(), 404, 'Tidak ada kelas untuk diunduh.');

        $sections = $projectClasses->map(function ($pc) use ($project, $dimensi) {
            $scores = KokurikulerScore::where('project_id', $project->id)
                ->whereIn('student_id', Student::where('class_id', $pc->class_id)->select('id'))
                ->get()
                ->keyBy(fn ($s) => $s->student_id . '|' . $s->project_dimension_id);
            $pdIdByUuid = $project->projectDimensions->pluck('id', 'uuid');

            $rows = $this->roster($pc->schoolClass)->map(fn ($s) => [
                'nama'   => $s->user->nama,
                'nis'    => $s->nis,
                'levels' => collect($dimensi)->mapWithKeys(fn ($d) => [
                    $d['id'] => $scores->get($s->id . '|' . $pdIdByUuid->get($d['id']))?->level ?? '',
                ]),
            ])->values();

            return [
                'kelas'       => $this->classLabel($pc->schoolClass),
                'fasilitator' => [
                    'nama' => $pc->fasilitator?->nama ?? '—',
                    'nip'  => $pc->fasilitator?->teacher?->nip ?? '—',
                ],
                'rows' => $rows,
            ];
        })->values()->all();

        $filename = 'nilai_kokurikuler_' . str_replace(' ', '_', $project->judul);

        if ($request->format === 'pdf') {
            $printSettings = PrintSetting::instance($user->id);
            $pdf = Pdf::loadView('reports.kokurikuler_nilai', [
                'project'       => $project,
                'dimensi'       => $dimensi,
                'sections'      => $sections,
                'printSettings' => $printSettings,
            ])->setPaper($printSettings->paperDimensionsPt(), 'portrait');

            return $this->pdfResponse($pdf, "{$filename}.pdf", $request);
        }

        return $this->streamXlsx("{$filename}.xlsx", function (Writer $w) use ($project, $dimensi, $sections) {
            $nDim   = count($dimensi);
            $widths = [1 => 5, 2 => 28, 3 => 14];
            foreach (range(4, 3 + $nDim) as $i) $widths[$i] = 18;
            $this->xlsxSetColumnWidths($w, $widths);

            $center = $this->xlsxCellCenterStyle();
            $text   = $this->xlsxCellStyle();

            foreach ($sections as $sec) {
                $w->addRow(Row::fromValuesWithStyle(["Rekap Nilai Kokurikuler {$project->judul} — {$sec['kelas']}"], $this->xlsxTitleStyle()));
                $w->addRow(Row::fromValues(['Level: SB = Sangat Baik · B = Baik · C = Cukup · K = Perlu Bimbingan']));
                $w->addRow(Row::fromValuesWithStyle(
                    ['No', 'Nama', 'NIS', ...collect($dimensi)->pluck('nama')],
                    $this->xlsxHeaderStyle()
                ));

                foreach ($sec['rows'] as $i => $r) {
                    $w->addRow(new Row([
                        new NumericCell($i + 1, $center),
                        new StringCell($r['nama'], $text),
                        new StringCell((string) $r['nis'], $center),
                        ...collect($dimensi)->map(fn ($d) => new StringCell($r['levels'][$d['id']] ?? '', $center)),
                    ]));
                }

                // Blok pengesahan fasilitator kelas ybs (berlaku juga saat diunduh admin).
                $pad = array_fill(0, max(0, $nDim + 1), '');
                $w->addRow(Row::fromValues(['']));
                $w->addRow(Row::fromValues([...$pad, 'Cimahi, ' . now('Asia/Jakarta')->locale('id')->isoFormat('D MMMM YYYY')]));
                $w->addRow(Row::fromValues([...$pad, 'Fasilitator,']));
                $w->addRow(Row::fromValues(['']));
                $w->addRow(Row::fromValues(['']));
                $w->addRow(Row::fromValues([...$pad, $sec['fasilitator']['nama']]));
                $w->addRow(Row::fromValues([...$pad, 'NIP. ' . $sec['fasilitator']['nip']]));
                $w->addRow(Row::fromValues(['']));
            }
        });
    }

    /** Dimensi projek dalam bentuk baris API (uuid + nama + aspek + sub-dimensi). */
    private function projectDimensionRows(KokurikulerProject $project): array
    {
        return $project->projectDimensions()
            ->with(['dimension', 'subdimensions'])
            ->get()
            ->map(fn ($pd) => [
                'id'         => $pd->uuid,
                'nama'       => $pd->dimension?->nama,
                'aspek'      => $pd->aspek,
                'subdimensi' => $pd->subdimensions->pluck('nama')->values(),
            ])->all();
    }

    // ── Siswa ──────────────────────────────────────────────────────────────────

    /** GET /kokurikuler/saya — projek kelas saya + tim + refleksi + dokumen tim. */
    public function saya(Request $request): JsonResponse
    {
        $student = $request->user()->student;
        abort_if(! $student, 403, 'Halaman ini khusus siswa.');

        $pc = KokurikulerProjectClass::with('project')
            ->where('class_id', $student->class_id)
            ->whereHas('project', fn ($q) => $q->berjalan())
            ->get()
            ->sortByDesc(fn ($row) => $row->project->tanggal_mulai)
            ->first();

        if (! $pc) {
            return response()->json(['data' => ['project' => null]]);
        }

        $project = $pc->project;

        $refleksi = KokurikulerReflection::where('project_id', $project->id)
            ->where('student_id', $student->id)
            ->get();
        $harian = $refleksi->where('jenis', KokurikulerReflection::JENIS_HARIAN)
            ->mapWithKeys(fn ($r) => [$r->tanggal->toDateString() => $r->isi]);
        $akhir = $refleksi->firstWhere('jenis', KokurikulerReflection::JENIS_AKHIR)?->isi;

        $member = KokurikulerTeamMember::where('student_id', $student->id)
            ->whereHas('team', fn ($q) => $q->where('project_id', $project->id))
            ->with(['team.members.student.user', 'team.documents.creator'])
            ->first();

        return response()->json(['data' => [
            'project' => [
                'id'      => $project->uuid,
                'judul'   => $project->judul,
                'tema'    => $project->tema,
                'tujuan'  => $project->tujuan,
                'deskripsi' => $project->deskripsi,
                'status'  => $project->status,
                'tanggal_mulai'   => $project->tanggal_mulai->toDateString(),
                'tanggal_selesai' => $project->tanggal_selesai->toDateString(),
                'hari'    => $this->projectDates($project),
            ],
            'refleksi_harian' => $harian,
            'refleksi_akhir'  => $akhir,
            'tim' => $member ? [
                'nomor'   => $member->team->nomor,
                'nama'    => $member->team->nama,
                'anggota' => $member->team->members->map(fn ($m) => [
                    'id'   => $m->student->uuid,
                    'nama' => $m->student->user->nama,
                ])->values(),
                'dokumen' => $member->team->documents->map(fn ($d) => $this->documentRow($d, $request->user()))->values(),
            ] : null,
        ]]);
    }

    /** POST /kokurikuler/refleksi — refleksi harian (per tanggal) atau akhir (sekali per projek). */
    public function refleksiStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'string'],
            'jenis'      => ['required', 'in:harian,akhir'],
            'tanggal'    => ['required_if:jenis,harian', 'nullable', 'date', $this->notFutureDateRule()],
            'isi'        => ['required', 'string', 'max:2000'],
        ], $this->notFutureDateMessages());

        $student = $request->user()->student;
        abort_if(! $student, 403, 'Hanya siswa yang dapat mengisi refleksi.');

        $project = $this->resolveProject($data['project_id']);
        abort_unless(
            KokurikulerProjectClass::where('project_id', $project->id)->where('class_id', $student->class_id)->exists(),
            403, 'Kelas Anda bukan peserta projek ini.'
        );
        $this->assertProjectWritable($project, $student->class_id,
            $data['jenis'] === 'harian' ? $data['tanggal'] : null);

        if ($data['jenis'] === 'harian') {
            KokurikulerReflection::updateOrCreate(
                [
                    'project_id' => $project->id, 'student_id' => $student->id,
                    'jenis' => 'harian', 'tanggal' => $data['tanggal'],
                ],
                ['isi' => $data['isi']],
            );
        } else {
            KokurikulerReflection::updateOrCreate(
                ['project_id' => $project->id, 'student_id' => $student->id, 'jenis' => 'akhir'],
                ['tanggal' => $project->tanggal_selesai->toDateString(), 'isi' => $data['isi']],
            );
        }

        return response()->json(['message' => 'Refleksi tersimpan.']);
    }

    /** POST /kokurikuler/dokumen — siswa menambah tautan dokumen hasil untuk timnya. */
    public function dokumenStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'string'],
            'judul'      => ['required', 'string', 'max:200'],
            'url'        => ['required', 'url', 'max:500'],
        ]);

        $student = $request->user()->student;
        abort_if(! $student, 403, 'Hanya siswa yang dapat menambah dokumen tim.');

        $project = $this->resolveProject($data['project_id']);
        $this->assertProjectWritable($project, $student->class_id);

        $member = KokurikulerTeamMember::where('student_id', $student->id)
            ->whereHas('team', fn ($q) => $q->where('project_id', $project->id))
            ->with('team')
            ->first();
        abort_if(! $member, 422, 'Anda belum tergabung dalam tim — hubungi fasilitator (wali kelas).');

        $doc = KokurikulerDocument::create([
            'team_id'    => $member->team->id,
            'judul'      => $data['judul'],
            'url'        => $data['url'],
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['message' => 'Tautan dokumen ditambahkan.', 'data' => ['id' => $doc->uuid]]);
    }

    // ── Helper internal ────────────────────────────────────────────────────────

    /** Projek by uuid; draft tidak terlihat siapa pun di luar admin. */
    private function resolveProject(string $uuid): KokurikulerProject
    {
        $project = KokurikulerProject::where('uuid', $uuid)->firstOrFail();
        abort_if($project->status === 'draft', 404);

        return $project;
    }

    /** Pastikan user fasilitator kelas ini pada projek ini (admin/wakasek selalu boleh). */
    private function authorizeFasilitator($user, string $projectUuid, string $classUuid): array
    {
        $project = $this->resolveProject($projectUuid);
        $class   = SchoolClass::where('uuid', $classUuid)->firstOrFail();

        $pc = KokurikulerProjectClass::where('project_id', $project->id)
            ->where('class_id', $class->id)
            ->first();
        abort_if(! $pc, 404, 'Kelas ini bukan peserta projek.');

        abort_unless(
            ClassAccess::isSchoolWide($user) || $pc->fasilitator_user_id === $user->id,
            403, 'Anda bukan fasilitator kelas ini.'
        );

        return [$project, $class];
    }

    /**
     * Tulisan hanya boleh saat projek aktif, TA tidak terkunci, dan (bila ada
     * tanggal) tanggal berada dalam rentang projek.
     */
    private function assertProjectWritable(KokurikulerProject $project, int $classId, ?string $tanggal = null): void
    {
        abort_if($project->status !== 'aktif', 422, 'Projek kokurikuler ini tidak sedang berjalan.');
        SemesterLock::assertClassWritable($classId);

        if ($tanggal !== null) {
            $inRange = $tanggal >= $project->tanggal_mulai->toDateString()
                && $tanggal <= $project->tanggal_selesai->toDateString();
            abort_unless($inRange, 422, 'Tanggal di luar rentang pelaksanaan projek.');
        }
    }

    private function roster(SchoolClass $class): Collection
    {
        return Student::where('class_id', $class->id)
            ->with('user:id,nama')
            ->get()
            ->sortBy(fn ($s) => $s->user->nama)
            ->values();
    }

    /** Seluruh tanggal pelaksanaan projek (Minggu dilewati). */
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

    private function teamBoard(KokurikulerProject $project, SchoolClass $class): array
    {
        $teams = KokurikulerTeam::where('project_id', $project->id)
            ->where('class_id', $class->id)
            ->with(['members.student.user', 'documents.creator'])
            ->orderBy('nomor')
            ->get();

        $assignedIds = $teams->flatMap(fn ($t) => $t->members->pluck('student_id'));

        $unassigned = $this->roster($class)
            ->reject(fn ($s) => $assignedIds->contains($s->id))
            ->map(fn ($s) => ['id' => $s->uuid, 'nis' => $s->nis, 'nama' => $s->user->nama])
            ->values();

        return [
            'kelas' => $this->classLabel($class),
            'teams' => $teams->map(fn ($t) => [
                'nomor'   => $t->nomor,
                'nama'    => $t->nama,
                'anggota' => $t->members->map(fn ($m) => [
                    'id'   => $m->student->uuid,
                    'nis'  => $m->student->nis,
                    'nama' => $m->student->user->nama,
                ])->values(),
                'dokumen' => $t->documents->map(fn ($d) => $this->documentRow($d))->values(),
            ])->values(),
            'unassigned' => $unassigned,
        ];
    }

    private function documentRow(KokurikulerDocument $doc, $viewer = null): array
    {
        return [
            'id'         => $doc->uuid,
            'judul'      => $doc->judul,
            'url'        => $doc->url,
            'oleh'       => $doc->creator?->nama,
            'milik_saya' => $viewer ? $doc->created_by === $viewer->id : false,
            'created_at' => $doc->created_at?->toDateTimeString(),
        ];
    }

    private function classLabel(SchoolClass $class): string
    {
        return "{$class->tingkat->value} {$class->jurusan} - {$class->rombel}";
    }
}
