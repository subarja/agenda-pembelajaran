<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\EwsStatus;
use App\Models\Student;
use App\Traits\BuildsXlsxReports;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenSpout\Common\Entity\Cell\NumericCell;
use OpenSpout\Common\Entity\Cell\StringCell;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer;

/**
 * Rekap Perkembangan Siswa Lintas Semester — merangkum snapshot EWS per semester
 * (tabel `ews_statuses`: level + poin karakter + kehadiran + catatan + nilai per
 * academic_year) menjadi timeline per siswa lintas tahun ajaran/semester.
 *
 * Identitas siswa lintas semester dikunci ke NIS (stabil) — bukan students.id, karena
 * satu orang bisa punya baris `students` berbeda tiap tahun ajaran (kelas per-TA).
 * Anchor daftar = roster tahun ajaran AKTIF; riwayat semester sebelumnya di-tarik via NIS.
 */
class RekapPerkembanganController extends Controller
{
    use BuildsXlsxReports;

    public function index(Request $request): JsonResponse
    {
        $this->authorizeAccess($request);

        $semesters = $this->orderedSemesters();
        $activeAy  = \App\Support\TahunAjaran::current();

        if (! $activeAy) {
            return response()->json(['semesters' => [], 'data' => [], 'meta' => ['total' => 0]]);
        }

        $perPageRaw = $request->get('per_page', 25);
        $paginator  = $this->rosterQuery($request, $activeAy->id)
            ->paginate($perPageRaw === 'all' ? 100000 : min((int) $perPageRaw, 500));

        $rows = $this->buildRows($paginator->getCollection(), $semesters);

        return response()->json([
            'semesters' => $semesters->map(fn ($ay) => [
                'id'       => $ay->id,
                'label'    => "{$ay->tahun} " . ucfirst($ay->semester->value),
                'tahun'    => $ay->tahun,
                'semester' => $ay->semester->value,
            ])->values(),
            'data' => $rows,
            'meta' => [
                'total'        => $paginator->total(),
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
            ],
        ]);
    }

    // GET /rekap-perkembangan/export?format=excel
    public function export(Request $request)
    {
        $this->authorizeAccess($request);

        $semesters = $this->orderedSemesters();
        $activeAy  = \App\Support\TahunAjaran::current();
        abort_if(! $activeAy, 404, 'Belum ada tahun ajaran aktif.');

        $students = $this->rosterQuery($request, $activeAy->id)->get();
        $rows     = $this->buildRows($students, $semesters);

        return $this->streamXlsx('Rekap_Perkembangan_Siswa.xlsx', function (Writer $w) use ($rows, $semesters) {
            // Lebar kolom: No, Nama, NIS, Kelas, lalu 2 kolom (Level+Poin) per semester, Tren.
            $widths = [1 => 5, 2 => 26, 3 => 14, 4 => 20];
            $col = 5;
            foreach ($semesters as $_) { $widths[$col] = 10; $widths[$col + 1] = 8; $col += 2; }
            $widths[$col] = 12;
            $this->xlsxSetColumnWidths($w, $widths);

            $w->addRow(Row::fromValuesWithStyle(['Rekap Perkembangan Siswa Lintas Semester'], $this->xlsxTitleStyle()));
            $w->addRow(Row::fromValues(['']));

            $header = ['No', 'Nama Siswa', 'NIS', 'Kelas'];
            foreach ($semesters as $s) {
                $header[] = "{$s->tahun} " . ucfirst($s->semester->value) . ' — Level';
                $header[] = 'Poin';
            }
            $header[] = 'Tren Karakter';
            $w->addRow(Row::fromValuesWithStyle($header, $this->xlsxHeaderStyle()));

            $center = $this->xlsxCellCenterStyle();
            $text   = $this->xlsxCellStyle();
            foreach ($rows as $i => $r) {
                $cells = [
                    new NumericCell($i + 1, $center),
                    new StringCell($r['nama'], $text),
                    new StringCell($r['nis'] ?? '-', $center),
                    new StringCell($r['kelas'] ?? '-', $center),
                ];
                foreach ($semesters as $s) {
                    $cell = $r['semesters'][$s->id] ?? null;
                    $cells[] = new StringCell($cell ? strtoupper($cell['level']) : '–', $center);
                    $cells[] = $cell ? new NumericCell($cell['karakter'], $center) : new StringCell('–', $center);
                }
                $cells[] = new StringCell($this->trendLabel($r['trend_karakter'], $r['delta_karakter']), $center);
                $w->addRow(new Row($cells));
            }
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function authorizeAccess(Request $request): void
    {
        abort_unless(
            in_array($request->user()->role->value, ['admin', 'wakasek'], true),
            403,
            'Hanya admin & wakasek yang dapat mengakses rekap perkembangan lintas semester.'
        );
    }

    /** Tahun ajaran urut kronologis (tahun, lalu ganjil sebelum genap). */
    private function orderedSemesters()
    {
        return AcademicYear::get()
            ->sortBy(fn ($ay) => $ay->tahun . '-' . ($ay->semester->value === 'ganjil' ? '0' : '1'))
            ->values();
    }

    private function rosterQuery(Request $request, int $activeAyId)
    {
        return Student::query()
            ->join('users', 'users.id', '=', 'students.user_id')
            ->select('students.*')
            ->with(['user:id,nama', 'schoolClass'])
            ->whereHas('schoolClass', fn ($q) => $q->where('academic_year_id', $activeAyId))
            ->when($request->filled('class_id'), fn ($q) => $q->whereHas('schoolClass', fn ($sc) => $sc->where('uuid', $request->class_id)))
            ->when($request->filled('tingkat'), fn ($q) => $q->whereHas('schoolClass', fn ($sc) => $sc->where('tingkat', $request->tingkat)))
            ->when($request->filled('jurusan'), fn ($q) => $q->whereHas('schoolClass', fn ($sc) => $sc->where('jurusan', $request->jurusan)))
            ->when($request->filled('search'), fn ($q, $s) => $q->where(fn ($inner) => $inner
                ->whereLikeCi('users.nama', $request->search)
                ->orWhereLikeCi('students.nis', $request->search)
                ->orWhereLikeCi('students.nisn', $request->search)))
            ->orderBy('users.nama');
    }

    // GET /rekap-perkembangan/chart — data grafik utk scope terfilter (tingkat/jurusan/
    // kelas): distribusi level EWS + 5 siswa poin karakter terendah (perlu perhatian) &
    // tertinggi (terbaik) pada semester AKTIF. Pencarian tidak dipakai di sini (grafik =
    // gambaran kelompok, bukan pencarian individu).
    public function chart(Request $request): JsonResponse
    {
        $this->authorizeAccess($request);

        $activeAy = \App\Support\TahunAjaran::current();
        if (! $activeAy) {
            return response()->json(['semester' => null, 'distribusi' => [], 'perhatian' => [], 'terbaik' => [], 'total' => 0]);
        }

        $statuses = EwsStatus::where('academic_year_id', $activeAy->id)
            ->whereHas('student.schoolClass', function ($q) use ($request, $activeAy) {
                $q->where('academic_year_id', $activeAy->id);
                if ($request->filled('class_id')) $q->where('uuid', $request->class_id);
                if ($request->filled('tingkat'))  $q->where('tingkat', $request->tingkat);
                if ($request->filled('jurusan'))  $q->where('jurusan', $request->jurusan);
            })
            ->with(['student.user:id,nama', 'student.schoolClass'])
            ->get();

        $mapped = $statuses->map(function ($st) {
            $c = $st->student?->schoolClass;
            return [
                'nama'     => $st->student?->user?->nama ?? '-',
                'nis'      => $st->student?->nis,
                'kelas'    => $c ? $c->label() : null,
                'karakter' => (int) $st->karakter_score,
                'level'    => $st->level instanceof \App\Enums\EwsLevel ? $st->level->value : (string) $st->level,
            ];
        });

        $distribusi = collect(['hijau', 'kuning', 'oranye', 'merah'])
            ->mapWithKeys(fn ($lvl) => [$lvl => $mapped->where('level', $lvl)->count()]);

        return response()->json([
            'semester'   => "{$activeAy->tahun} " . ucfirst($activeAy->semester->value),
            'total'      => $mapped->count(),
            'distribusi' => $distribusi,
            'perhatian'  => $mapped->sortBy('karakter')->take(5)->values(),      // poin terendah
            'terbaik'    => $mapped->sortByDesc('karakter')->take(5)->values(),  // poin tertinggi
        ]);
    }

    /**
     * Bangun baris rekap utk sekumpulan Student (satu halaman): tarik semua EwsStatus
     * lintas semester via NIS, susun timeline + hitung tren poin karakter.
     */
    private function buildRows($students, $semesters): array
    {
        $nisList = $students->pluck('nis')->filter()->unique()->values();

        // Semua snapshot EWS utk NIS-NIS ini, di SEMUA tahun ajaran, dikelompokkan per NIS.
        $statusesByNis = EwsStatus::query()
            ->join('students', 'students.id', '=', 'ews_statuses.student_id')
            ->whereIn('students.nis', $nisList->all())
            ->get([
                'students.nis as nis',
                'ews_statuses.academic_year_id as ay_id',
                'ews_statuses.level as level',
                'ews_statuses.karakter_score as karakter',
                'ews_statuses.kehadiran_score as kehadiran',
                'ews_statuses.catatan_count as catatan',
                'ews_statuses.nilai_score as nilai',
            ])
            ->groupBy('nis');

        $semesterOrder = $semesters->pluck('id')->values();

        return $students->map(function (Student $s) use ($statusesByNis, $semesterOrder) {
            $perSem = [];
            foreach (($statusesByNis[$s->nis] ?? collect()) as $st) {
                $perSem[(int) $st->ay_id] = [
                    'level'     => $st->level instanceof \App\Enums\EwsLevel ? $st->level->value : (string) $st->level,
                    'karakter'  => (int) $st->karakter,
                    'kehadiran' => round((float) $st->kehadiran, 1),
                    'catatan'   => (int) $st->catatan,
                    'nilai'     => $st->nilai !== null ? round((float) $st->nilai, 1) : null,
                ];
            }

            // Timeline kronologis (hanya semester yang ada datanya) utk tren karakter.
            $timeline = $semesterOrder->filter(fn ($id) => isset($perSem[$id]))->values();
            $trend = null; $delta = null; $levelTerkini = null;
            if ($timeline->isNotEmpty()) {
                $first = $perSem[$timeline->first()];
                $last  = $perSem[$timeline->last()];
                $levelTerkini = $last['level'];
                if ($timeline->count() >= 2) {
                    $delta = $last['karakter'] - $first['karakter'];
                    $trend = $delta > 0 ? 'naik' : ($delta < 0 ? 'turun' : 'stabil');
                }
            }

            $kelas = $s->schoolClass
                ? $s->schoolClass->label()
                : null;

            return [
                'nis'            => $s->nis,
                'nama'           => $s->user->nama ?? '-',
                'kelas'          => $kelas,
                'angkatan'       => $s->angkatan,
                'semesters'      => $perSem,
                'level_terkini'  => $levelTerkini,
                'trend_karakter' => $trend,
                'delta_karakter' => $delta,
            ];
        })->values()->all();
    }

    private function trendLabel(?string $trend, ?int $delta): string
    {
        return match ($trend) {
            'naik'   => 'Naik (+' . $delta . ')',
            'turun'  => 'Turun (' . $delta . ')',
            'stabil' => 'Stabil (0)',
            default  => 'Butuh ≥2 semester',
        };
    }
}
