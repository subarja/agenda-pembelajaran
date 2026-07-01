<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Agenda;
use App\Models\AuditLog;
use App\Models\PrintSetting;
use App\Models\Schedule;
use App\Models\Teacher;
use App\Traits\BuildsXlsxReports;
use App\Traits\HandlesPdfPreview;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use OpenSpout\Common\Entity\Cell\NumericCell;
use OpenSpout\Common\Entity\Cell\StringCell;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Writer;

class TeacherEwsController extends Controller
{
    use HandlesPdfPreview;
    use BuildsXlsxReports;

    /**
     * GET /admin/teacher-ews
     *
     * Evaluasi kepatuhan pengisian agenda per guru dalam periode tertentu.
     * Urutkan dari yang paling banyak tidak mengisi (prioritas tertinggi).
     *
     * Level EWS guru:
     *   merah   — < 50% sesi diisi
     *   oranye  — 50–74% sesi diisi
     *   kuning  — 75–89% sesi diisi
     *   hijau   — ≥ 90% sesi diisi (atau tidak punya jadwal)
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'tanggal_mulai' => ['nullable', 'date'],
            'tanggal_akhir' => ['nullable', 'date', 'after_or_equal:tanggal_mulai'],
        ]);

        // Default: 30 hari terakhir
        $mulai  = $request->filled('tanggal_mulai')
            ? Carbon::parse($request->tanggal_mulai)->startOfDay()
            : Carbon::now()->subDays(30)->startOfDay();
        $akhir  = $request->filled('tanggal_akhir')
            ? Carbon::parse($request->tanggal_akhir)->endOfDay()
            : Carbon::now()->endOfDay();

        $teachers = Teacher::with('user')->get();

        // Ambil last login semua guru sekaligus dari audit_logs
        $lastLogins = AuditLog::where('action', 'login')
            ->selectRaw('user_id, max(timestamp) as last_login')
            ->groupBy('user_id')
            ->pluck('last_login', 'user_id');

        $results = $teachers->map(function (Teacher $teacher) use ($mulai, $akhir, $lastLogins) {
            // Hitung sesi yang harusnya diajar dalam periode ini
            // Berdasarkan jadwal aktif (hari + jam) × jumlah minggu yang relevan
            $schedules    = Schedule::where('teacher_id', $teacher->id)->where('aktif', true)->get();
            $totalJadwal  = $this->hitungSesiTerjadwal($schedules, $mulai, $akhir);

            // Hitung agenda yang sudah terisi
            $terisi = Agenda::whereHas('schedule', fn ($q) => $q->where('teacher_id', $teacher->id))
                ->whereBetween('tanggal', [$mulai->toDateString(), $akhir->toDateString()])
                ->where('status', 'submitted')
                ->count();

            // Hitung yang draft (diisi tapi belum submit)
            $draft = Agenda::whereHas('schedule', fn ($q) => $q->where('teacher_id', $teacher->id))
                ->whereBetween('tanggal', [$mulai->toDateString(), $akhir->toDateString()])
                ->where('status', 'draft')
                ->count();

            $totalIsi = $terisi + $draft;
            $kosong   = max(0, $totalJadwal - $totalIsi);
            $pct      = $totalJadwal > 0 ? round(($totalIsi / $totalJadwal) * 100, 1) : null;

            $level = $this->resolveLevel($pct);

            $lastLoginRaw  = $lastLogins[$teacher->user_id] ?? null;
            $lastLoginDiff = $lastLoginRaw
                ? Carbon::parse($lastLoginRaw)->diffForHumans()
                : 'Belum pernah login';
            $lastLoginDate = $lastLoginRaw
                ? Carbon::parse($lastLoginRaw)->format('d/m/Y H:i')
                : null;

            return [
                'teacher_id'     => $teacher->uuid,
                'nama'           => $teacher->user->nama,
                'nip'            => $teacher->nip,
                'mapel_utama'    => $teacher->mapel_utama,
                'role'           => $teacher->user->role->value,
                'total_jadwal'   => $totalJadwal,
                'total_diisi'    => $totalIsi,
                'total_tersubmit'=> $terisi,
                'total_draft'    => $draft,
                'total_kosong'   => $kosong,
                'pct_terisi'     => $pct,
                'level'          => $level,
                'last_login'     => $lastLoginDiff,
                'last_login_date'=> $lastLoginDate,
                'last_login_raw' => $lastLoginRaw,
            ];
        });

        // Urutkan: merah → oranye → kuning → hijau, lalu pct_terisi ASC (paling sedikit isi di atas)
        $levelOrder = ['merah' => 0, 'oranye' => 1, 'kuning' => 2, 'hijau' => 3, 'n/a' => 4];
        $results = $results->sortBy([
            fn ($a, $b) => ($levelOrder[$a['level']] ?? 9) <=> ($levelOrder[$b['level']] ?? 9),
            fn ($a, $b) => ($a['pct_terisi'] ?? 101) <=> ($b['pct_terisi'] ?? 101),
        ])->values();

        $summary = [
            'merah'  => $results->where('level', 'merah')->count(),
            'oranye' => $results->where('level', 'oranye')->count(),
            'kuning' => $results->where('level', 'kuning')->count(),
            'hijau'  => $results->where('level', 'hijau')->count(),
        ];

        return response()->json([
            'data'   => $results,
            'meta'   => [
                'total'         => $results->count(),
                'summary'       => $summary,
                'tanggal_mulai' => $mulai->toDateString(),
                'tanggal_akhir' => $akhir->toDateString(),
            ],
        ]);
    }

    // GET /admin/teacher-ews/export?format=excel|pdf&tanggal_mulai=&tanggal_akhir=&level=
    public function export(Request $request)
    {
        $jsonResp = $this->index($request);
        $payload  = $jsonResp->getData(true);
        $rows     = $payload['data'] ?? [];
        $meta     = $payload['meta'] ?? [];

        if ($request->filled('level')) {
            $lvl  = $request->level;
            $rows = array_values(array_filter($rows, fn ($r) => $r['level'] === $lvl));
        }

        $periodeLabel = ($meta['tanggal_mulai'] ?? '—') . ' s.d. ' . ($meta['tanggal_akhir'] ?? '—');

        if ($request->query('format') === 'pdf') {
            $printSettings = PrintSetting::instance();
            $pdf = Pdf::loadView('reports.ews_guru', compact('rows', 'periodeLabel', 'printSettings'))
                ->setPaper($printSettings->paperDimensionsPt(), 'landscape');
            return $this->pdfResponse($pdf, 'EWS_Guru.pdf', $request);
        }

        // Excel
        $tmpFile = tempnam(sys_get_temp_dir(), 'ews_guru_') . '.xlsx';
        $writer  = new Writer();
        $writer->openToFile($tmpFile);

        $this->xlsxSetColumnWidths($writer, [1 => 5, 2 => 26, 3 => 20, 4 => 20, 5 => 12, 6 => 12, 7 => 10, 8 => 10, 9 => 10, 10 => 10, 11 => 16]);

        $writer->addRow(Row::fromValuesWithStyle(["Laporan EWS Guru — Periode: {$periodeLabel}"], $this->xlsxTitleStyle()));
        $writer->addRow(Row::fromValues(['']));
        $writer->addRow(Row::fromValuesWithStyle(
            ['No', 'Nama Guru', 'NIP', 'Mapel Utama', 'Level EWS', 'Total Jadwal', 'Terisi', 'Draft', 'Kosong', '% Terisi', 'Terakhir Login'],
            $this->xlsxHeaderStyle()
        ));

        $cellCenter = $this->xlsxCellCenterStyle();
        $cellText   = $this->xlsxCellStyle();
        foreach ($rows as $i => $r) {
            $writer->addRow(new Row([
                new NumericCell($i + 1, $cellCenter),
                new StringCell($r['nama'] ?? '—', $cellText),
                new StringCell($r['nip'] ?? '—', $cellCenter),
                new StringCell($r['mapel_utama'] ?? '—', $cellText),
                new StringCell(strtoupper($r['level']), $cellCenter),
                new NumericCell($r['total_jadwal'], $cellCenter),
                new NumericCell($r['total_tersubmit'], $cellCenter),
                new NumericCell($r['total_draft'], $cellCenter),
                new NumericCell($r['total_kosong'], $cellCenter),
                new StringCell($r['pct_terisi'] !== null ? $r['pct_terisi'] . '%' : '—', $cellCenter),
                new StringCell($r['last_login_date'] ?? 'Belum pernah', $cellCenter),
            ]));
        }

        $writer->close();
        $content = file_get_contents($tmpFile);
        @unlink($tmpFile);

        return response($content, 200, [
            'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="EWS_Guru.xlsx"',
        ]);
    }

    /**
     * Hitung berapa sesi yang seharusnya terjadwal dalam rentang tanggal
     * berdasarkan jadwal mingguan (hari-hari yang aktif).
     */
    private function hitungSesiTerjadwal($schedules, Carbon $mulai, Carbon $akhir): int
    {
        $hariMap = [
            'senin' => Carbon::MONDAY, 'selasa' => Carbon::TUESDAY,
            'rabu'  => Carbon::WEDNESDAY, 'kamis' => Carbon::THURSDAY,
            'jumat' => Carbon::FRIDAY, 'sabtu' => Carbon::SATURDAY,
        ];

        $total = 0;
        foreach ($schedules as $schedule) {
            $hariNum = $hariMap[$schedule->hari->value] ?? null;
            if ($hariNum === null) continue;

            // Hitung berapa kali hari ini muncul dalam rentang
            $current = $mulai->copy()->startOfWeek(Carbon::MONDAY);
            while ($current->lte($akhir)) {
                $tglHari = $current->copy()->addDays($hariNum - Carbon::MONDAY);
                if ($tglHari->between($mulai, $akhir)) {
                    $total++;
                }
                $current->addWeek();
            }
        }

        return $total;
    }

    private function resolveLevel(?float $pct): string
    {
        if ($pct === null) return 'n/a';    // tidak punya jadwal
        if ($pct < 50)    return 'merah';
        if ($pct < 75)    return 'oranye';
        if ($pct < 90)    return 'kuning';
        return 'hijau';
    }
}
