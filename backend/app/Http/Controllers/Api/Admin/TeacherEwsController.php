<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
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
use App\Support\SessionTeacher;

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
        [$mulai, $akhir] = $this->resolvePeriode($request);

        $teachers = Teacher::with('user')->get();

        // Ambil last login semua guru sekaligus dari audit_logs
        $lastLogins = AuditLog::where('action', 'login')
            ->selectRaw('user_id, max(timestamp) as last_login')
            ->groupBy('user_id')
            ->pluck('last_login', 'user_id');

        // Peta pengalihan inval untuk SEMUA guru sekaligus. Diambil sekali di luar map():
        // memanggil versi per-guru di dalam perulangan 97 guru berarti 194 query tambahan.
        $delegasi = SessionTeacher::delegationMapFor($teachers->pluck('id')->all());

        $results = $teachers->map(function (Teacher $teacher) use ($mulai, $akhir, $lastLogins, $delegasi) {
            // Hitung sesi yang harusnya diajar dalam periode ini
            // Berdasarkan jadwal aktif (hari + jam) × jumlah minggu yang relevan
            $schedules    = Schedule::where('teacher_id', $teacher->id)->where('aktif', true)->get();
            $totalJadwal  = $this->hitungSesiTerjadwal($schedules, $mulai, $akhir);

            // Kewajiban ikut berpindah bersama inval yang disetujui: sesi yang dialihkan
            // ke guru lain tidak lagi dihitung sebagai jadwalnya, dan sesi yang diterimanya
            // dari guru lain ditambahkan. Tanpa ini, guru yang sakit tetap tercatat menunggak
            // agenda yang secara resmi bukan lagi tanggung jawabnya.
            $totalJadwal -= $this->hitungKunciDalamPeriode($delegasi['away'][$teacher->id] ?? [], $mulai, $akhir);
            $totalJadwal += $this->hitungKunciDalamPeriode($delegasi['to'][$teacher->id] ?? [], $mulai, $akhir);
            $totalJadwal  = max(0, $totalJadwal);

            // Agenda::untukGuru() memakai aturan pengalihan yang sama persis, jadi
            // pembilang dan penyebut tidak pernah menghitung sesi yang berbeda.
            $terisi = Agenda::untukGuru($teacher->id)
                ->whereBetween('tanggal', [$mulai->toDateString(), $akhir->toDateString()])
                ->where('status', 'submitted')
                ->count();

            // Hitung yang draft (diisi tapi belum submit)
            $draft = Agenda::untukGuru($teacher->id)
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
                'foto_url'       => $teacher->user->foto ? \Illuminate\Support\Facades\Storage::disk('public')->url($teacher->user->foto) : null,
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

        // Laporan (PDF/Excel) diurutkan per level dulu (merah→hijau), baru nama abjad —
        // beda dengan index() yang diurutkan level lalu % terisi (dipakai dashboard live).
        $levelOrder = ['merah' => 0, 'oranye' => 1, 'kuning' => 2, 'hijau' => 3, 'n/a' => 4];
        usort($rows, fn ($a, $b) => [$levelOrder[$a['level']] ?? 9, mb_strtolower($a['nama'] ?? '')]
            <=> [$levelOrder[$b['level']] ?? 9, mb_strtolower($b['nama'] ?? '')]);

        $periodeLabel = ($meta['tanggal_mulai'] ?? '—') . ' s.d. ' . ($meta['tanggal_akhir'] ?? '—');
        $signatures   = $this->laporanSignatures();
        $tanggalCetak = now('Asia/Jakarta')->locale('id')->isoFormat('D MMMM YYYY');

        if ($request->query('format') === 'pdf') {
            $printSettings = PrintSetting::instance($request->user()->id);
            $legend = $this->ewsGuruLegend();
            $pdf = Pdf::loadView('reports.ews_guru', compact('rows', 'periodeLabel', 'printSettings', 'legend', 'signatures', 'tanggalCetak'))
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

        // Keterangan kolom
        $label     = $this->xlsxLabelStyle();
        $noteStyle = (new Style())->withFontItalic(true)->withFontColor('6B7280');
        $writer->addRow(Row::fromValues(['']));
        $writer->addRow(Row::fromValuesWithStyle(['Keterangan Kolom:'], $label));
        foreach ($this->ewsGuruLegend() as $line) {
            $writer->addRow(Row::fromValuesWithStyle([$line], $noteStyle));
        }

        // Validasi (TTD) — proporsional kiri/kanan: Mengetahui + Kepala Sekolah di kiri
        // (kolom A), Cimahi+tanggal + Wk. Kurikulum di kanan (kolom H) — sesuai posisi
        // yang diminta khusus untuk laporan ini (beda dari pola Minggu Efektif).
        $this->addSignatureRows($writer, $signatures, $tanggalCetak, 11, 0, 7, $label);

        $writer->close();
        $content = file_get_contents($tmpFile);
        @unlink($tmpFile);

        return response($content, 200, [
            'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="EWS_Guru.xlsx"',
        ]);
    }

    /**
     * GET /admin/teacher-ews/{teacherUuid}/sessions?tanggal_mulai=&tanggal_akhir=
     *
     * Detail per-sesi seorang guru: kelas & tanggal mana saja yang harus diisi dalam
     * periode, status keterisiannya, dan jejak log kapan (tanggal jam) + dari IP mana
     * pengisian terakhir dilakukan (lihat AuditLog::record() di AgendaController).
     */
    public function sessions(Request $request, string $teacherUuid): JsonResponse
    {
        $teacher = Teacher::where('uuid', $teacherUuid)->with('user')->firstOrFail();
        [$mulai, $akhir] = $this->resolvePeriode($request);

        $rows = $this->buildSessionRows($teacher, $mulai, $akhir);

        return response()->json([
            'data' => [
                'teacher'  => [
                    'nama'        => $teacher->user->nama,
                    'nip'         => $teacher->nip,
                    'mapel_utama' => $teacher->mapel_utama,
                    'foto_url'    => $teacher->user->foto ? \Illuminate\Support\Facades\Storage::disk('public')->url($teacher->user->foto) : null,
                ],
                'periode'  => ['mulai' => $mulai->toDateString(), 'akhir' => $akhir->toDateString()],
                'summary'  => [
                    'total_jadwal' => count($rows),
                    'terisi'       => count(array_filter($rows, fn ($r) => $r['status'] === 'submitted')),
                    'draft'        => count(array_filter($rows, fn ($r) => $r['status'] === 'draft')),
                    'kosong'       => count(array_filter($rows, fn ($r) => $r['status'] === 'kosong')),
                ],
                'sesi'     => $rows,
            ],
        ]);
    }

    // GET /admin/teacher-ews/{teacherUuid}/sessions/export?format=excel|pdf&tanggal_mulai=&tanggal_akhir=
    public function sessionsExport(Request $request, string $teacherUuid)
    {
        $teacher = Teacher::where('uuid', $teacherUuid)->with('user')->firstOrFail();
        [$mulai, $akhir] = $this->resolvePeriode($request);
        $rows = $this->buildSessionRows($teacher, $mulai, $akhir);

        $periodeLabel = $mulai->toDateString() . ' s.d. ' . $akhir->toDateString();
        $namaFile = 'Detail_Agenda_' . str_replace(' ', '_', $teacher->user->nama) . '_' .
            $mulai->format('Ymd') . '-' . $akhir->format('Ymd');
        $signatures   = $this->laporanSignatures();
        $tanggalCetak = now('Asia/Jakarta')->locale('id')->isoFormat('D MMMM YYYY');

        if ($request->query('format') === 'pdf') {
            $printSettings = PrintSetting::instance($request->user()->id);
            $pdf = Pdf::loadView('reports.teacher_sessions', [
                'teacher'       => $teacher,
                'rows'          => $rows,
                'periodeLabel'  => $periodeLabel,
                'printSettings' => $printSettings,
                'signatures'    => $signatures,
                'tanggalCetak'  => $tanggalCetak,
            ])->setPaper($printSettings->paperDimensionsPt(), 'landscape');
            return $this->pdfResponse($pdf, "{$namaFile}.pdf", $request);
        }

        // Excel
        $tmpFile = tempnam(sys_get_temp_dir(), 'teacher_sesi_') . '.xlsx';
        $writer  = new Writer();
        $writer->openToFile($tmpFile);

        $this->xlsxSetColumnWidths($writer, [1 => 5, 2 => 12, 3 => 10, 4 => 12, 5 => 22, 6 => 20, 7 => 12, 8 => 40]);

        $writer->addRow(Row::fromValuesWithStyle(["Detail Pengisian Agenda — {$teacher->user->nama}"], $this->xlsxTitleStyle()));
        $writer->addRow(Row::fromValues(["Periode: {$periodeLabel}"]));
        $writer->addRow(Row::fromValues(['']));
        $writer->addRow(Row::fromValuesWithStyle(
            ['No', 'Tanggal', 'Hari', 'Jam', 'Kelas', 'Mata Pelajaran', 'Status', 'Diisi Pada'],
            $this->xlsxHeaderStyle()
        ));

        $cellCenter = $this->xlsxCellCenterStyle();
        $cellText   = $this->xlsxCellStyle();
        foreach ($rows as $i => $r) {
            $writer->addRow(new Row([
                new NumericCell($i + 1, $cellCenter),
                new StringCell($r['tanggal'], $cellCenter),
                new StringCell($r['hari'], $cellCenter),
                new StringCell($r['jam'], $cellCenter),
                new StringCell($r['kelas'], $cellText),
                new StringCell($r['mapel'], $cellText),
                new StringCell(strtoupper($r['status']), $cellCenter),
                new StringCell($this->formatLogText($r), $cellText),
            ]));
        }

        // Keterangan kolom
        $label     = $this->xlsxLabelStyle();
        $noteStyle = (new Style())->withFontItalic(true)->withFontColor('6B7280');
        $writer->addRow(Row::fromValues(['']));
        $writer->addRow(Row::fromValuesWithStyle(['Keterangan Kolom:'], $label));
        foreach ($this->teacherSessionsLegend() as $line) {
            $writer->addRow(Row::fromValuesWithStyle([$line], $noteStyle));
        }

        // Validasi (TTD) — Mengetahui + Kepala Sekolah kiri, Cimahi+tanggal + Wk. Kurikulum
        // kanan, sama seperti laporan EWS Guru (daftar).
        $this->addSignatureRows($writer, $signatures, $tanggalCetak, 8, 0, 5, $label);

        $writer->close();
        $content = file_get_contents($tmpFile);
        @unlink($tmpFile);

        return response($content, 200, [
            'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => "attachment; filename=\"{$namaFile}.xlsx\"",
        ]);
    }

    /**
     * Bangun daftar sesi (tanggal × jadwal) seorang guru dalam periode, digabung dengan
     * status agenda (submitted/draft/kosong) dan jejak AuditLog terakhir (kapan + IP).
     *
     * @return array<int,array>
     */
    private function buildSessionRows(Teacher $teacher, Carbon $mulai, Carbon $akhir): array
    {
        $schedules = Schedule::where('teacher_id', $teacher->id)
            ->where('aktif', true)
            ->with(['subject', 'schoolClass'])
            ->get();

        $sesiTerjadwal = $this->daftarSesiTerjadwal($schedules, $mulai, $akhir);
        if (empty($sesiTerjadwal)) {
            return [];
        }

        $scheduleIds = collect($sesiTerjadwal)->pluck('schedule.id')->unique()->values();

        $agendas = Agenda::whereIn('schedule_id', $scheduleIds)
            ->whereBetween('tanggal', [$mulai->toDateString(), $akhir->toDateString()])
            ->get()
            ->keyBy(fn ($a) => $a->schedule_id . '|' . $a->tanggal->toDateString());

        // Log terakhir per agenda (created/updated) — target_type+target_id sudah ter-index.
        $logs = AuditLog::where('target_type', Agenda::class)
            ->whereIn('target_id', $agendas->pluck('id'))
            ->orderByDesc('timestamp')
            ->get()
            ->groupBy('target_id');

        $rows = [];
        foreach ($sesiTerjadwal as $s) {
            $schedule = $s['schedule'];
            $agenda   = $agendas->get($schedule->id . '|' . $s['tanggal']);

            $status = 'kosong';
            $log    = null;
            if ($agenda) {
                $status    = $agenda->status->value;
                $latestLog = $logs->get($agenda->id)?->first();
                if ($latestLog) {
                    $log = [
                        'aksi'  => $latestLog->action === 'created' ? 'Dibuat' : 'Diubah',
                        'waktu' => $latestLog->timestamp->format('d/m/Y H:i:s'),
                        'ip'    => $latestLog->ip,
                    ];
                }
            }

            $rows[] = [
                'tanggal' => $s['tanggal'],
                'hari'    => ucfirst($schedule->hari->value),
                'jam'     => substr($schedule->jam_mulai ?? '', 0, 5) . ' - ' . substr($schedule->jam_selesai ?? '', 0, 5),
                'kelas'   => $schedule->schoolClass
                    ? "{$schedule->schoolClass->tingkat->value} {$schedule->schoolClass->jurusan} - {$schedule->schoolClass->rombel}"
                    : '—',
                'mapel'   => $schedule->subject->nama ?? '—',
                'status'  => $status,
                'log'     => $log,
            ];
        }

        usort($rows, fn ($a, $b) => $a['tanggal'] <=> $b['tanggal']);

        return $rows;
    }

    /**
     * Teks "Diisi Pada" satu baris — dipakai Excel & bisa dipakai FE. Bedakan 3 kondisi:
     * belum ada agenda sama sekali (kosong), ada tapi log-nya belum tercatat (dibuat
     * sebelum AuditLog::record() dipasang di AgendaController), atau ada log lengkap.
     */
    private function formatLogText(array $row): string
    {
        if ($row['status'] === 'kosong') {
            return '—';
        }
        if (! $row['log']) {
            return 'Belum tercatat (sebelum fitur log aktif)';
        }

        return "{$row['log']['aksi']} {$row['log']['waktu']} · IP {$row['log']['ip']}";
    }

    /**
     * @return array<int,string>
     */
    private function teacherSessionsLegend(): array
    {
        return [
            'Status Terisi/Draft/Kosong mengikuti status agenda yang guru simpan di halaman Agenda Pembelajaran.',
            'Kolom "Diisi Pada" diambil dari log audit (audit_logs) yang mencatat waktu & alamat IP setiap kali agenda dibuat/diubah — hanya tersedia untuk pengisian sejak fitur ini aktif (2026-07-02). Agenda lama sebelum tanggal itu tetap tampil statusnya tapi log-nya "Belum tercatat".',
        ];
    }

    /**
     * Identitas Wk. Kurikulum & Kepala Sekolah untuk validasi (TTD) laporan — sumbernya
     * sama dengan Minggu Efektif (diisi admin di tab Tahun Ajaran, per semester), supaya
     * satu sumber data dipakai konsisten di semua laporan resmi. Fallback placeholder
     * "Nama"/"NIP" polos kalau belum diisi, supaya dokumen tetap bisa ditandatangani manual.
     */
    private function laporanSignatures(): array
    {
        $ay = AcademicYear::where('aktif', true)->first();

        return [
            'wk_kurikulum' => [
                'role'      => 'Wakasek Bid. Kurikulum',
                'nama_line' => $ay?->wk_kurikulum_nama_lengkap ?? 'Nama',
                'nip_line'  => $ay?->wk_kurikulum_nip ? "NIP. {$ay->wk_kurikulum_nip}" : 'NIP',
            ],
            'kepala_sekolah' => [
                'role'      => 'Kepala SMK Negeri 2 Cimahi',
                'nama_line' => $ay?->kepala_sekolah_nama_lengkap ?? 'Nama',
                'nip_line'  => $ay?->kepala_sekolah_nip ? "NIP. {$ay->kepala_sekolah_nip}" : 'NIP',
            ],
        ];
    }

    /**
     * Tulis blok validasi (TTD) 2 penanda tangan ke Excel — kiri "Mengetahui," + Kepala
     * Sekolah, kanan "Cimahi, tanggal" + Wk. Kurikulum, proporsional (kolom kiri/kanan
     * beda index, bukan cuma spacer kosong).
     */
    private function addSignatureRows(Writer $writer, array $signatures, string $tanggalCetak, int $colCount, int $leftCol, int $rightCol, Style $label): void
    {
        $writer->addRow(Row::fromValues(['']));

        $dateRow = array_fill(0, $colCount, '');
        $dateRow[$rightCol] = "Cimahi, {$tanggalCetak}";
        $writer->addRow(Row::fromValues($dateRow));

        $roleRow = array_fill(0, $colCount, '');
        $roleRow[$leftCol]  = 'Mengetahui,';
        $roleRow[$rightCol] = "{$signatures['wk_kurikulum']['role']},";
        $writer->addRow(Row::fromValuesWithStyle($roleRow, $label));

        $roleRow2 = array_fill(0, $colCount, '');
        $roleRow2[$leftCol] = $signatures['kepala_sekolah']['role'];
        $writer->addRow(Row::fromValuesWithStyle($roleRow2, $label));

        $writer->addRow(Row::fromValues(['']));
        $writer->addRow(Row::fromValues(['']));
        $writer->addRow(Row::fromValues(['']));

        $namaRow = array_fill(0, $colCount, '');
        $namaRow[$leftCol]  = $signatures['kepala_sekolah']['nama_line'];
        $namaRow[$rightCol] = $signatures['wk_kurikulum']['nama_line'];
        $writer->addRow(Row::fromValuesWithStyle($namaRow, $label));

        $nipRow = array_fill(0, $colCount, '');
        $nipRow[$leftCol]  = $signatures['kepala_sekolah']['nip_line'];
        $nipRow[$rightCol] = $signatures['wk_kurikulum']['nip_line'];
        $writer->addRow(Row::fromValues($nipRow));
    }

    /**
     * Penjelasan arti kolom EWS Guru, ditampilkan di bagian bawah laporan (PDF & Excel) —
     * sinkron dengan threshold di resolveLevel() dan perhitungan di index() di atas.
     *
     * @return array<int,string>
     */
    private function ewsGuruLegend(): array
    {
        return [
            'Level EWS: tingkat kepatuhan pengisian agenda guru berdasarkan % Terisi. Hijau ≥ 90%, Kuning 75–89%, Oranye 50–74%, Merah < 50% (perlu tindak lanjut segera).',
            'Total Jadwal: jumlah sesi mengajar yang seharusnya berlangsung pada periode laporan, dihitung dari jadwal mingguan aktif guru.',
            'Terisi: jumlah sesi yang agendanya sudah disubmit (final) oleh guru.',
            'Draft: jumlah sesi yang agendanya sudah mulai diisi tapi belum disubmit.',
            'Kosong: jumlah sesi yang sama sekali belum diisi (Total Jadwal dikurangi Terisi dan Draft).',
            '% Terisi: persentase (Terisi + Draft) dibanding Total Jadwal — dasar penentuan Level EWS.',
        ];
    }

    /**
     * Hitung berapa sesi yang seharusnya terjadwal dalam rentang tanggal
     * berdasarkan jadwal mingguan (hari-hari yang aktif).
     */
    /**
     * Berapa kunci sesi "scheduleId|Y-m-d" yang jatuh di dalam periode laporan.
     * Perbandingan string aman karena formatnya Y-m-d (leksikografis = kronologis).
     *
     * @param  string[]  $kunci
     */
    private function hitungKunciDalamPeriode(array $kunci, Carbon $mulai, Carbon $akhir): int
    {
        $dari  = $mulai->toDateString();
        $sampai = $akhir->toDateString();

        return count(array_filter($kunci, function (string $k) use ($dari, $sampai) {
            $tanggal = substr($k, strpos($k, '|') + 1);

            return $tanggal >= $dari && $tanggal <= $sampai;
        }));
    }

    private function hitungSesiTerjadwal($schedules, Carbon $mulai, Carbon $akhir): int
    {
        return count($this->daftarSesiTerjadwal($schedules, $mulai, $akhir));
    }

    /**
     * Sama seperti hitungSesiTerjadwal() tapi kembalikan daftar (tanggal × jadwal),
     * bukan cuma jumlahnya — dipakai halaman detail per-guru (sessions()).
     *
     * @return array<int,array{tanggal:string,schedule:Schedule}>
     */
    private function daftarSesiTerjadwal($schedules, Carbon $mulai, Carbon $akhir): array
    {
        $hariMap = [
            'senin' => Carbon::MONDAY, 'selasa' => Carbon::TUESDAY,
            'rabu'  => Carbon::WEDNESDAY, 'kamis' => Carbon::THURSDAY,
            'jumat' => Carbon::FRIDAY, 'sabtu' => Carbon::SATURDAY,
        ];

        $sesi = [];
        foreach ($schedules as $schedule) {
            $hariNum = $hariMap[$schedule->hari->value] ?? null;
            if ($hariNum === null) continue;

            $current = $mulai->copy()->startOfWeek(Carbon::MONDAY);
            while ($current->lte($akhir)) {
                $tglHari = $current->copy()->addDays($hariNum - Carbon::MONDAY);
                if ($tglHari->between($mulai, $akhir)) {
                    $sesi[] = ['tanggal' => $tglHari->toDateString(), 'schedule' => $schedule];
                }
                $current->addWeek();
            }
        }

        return $sesi;
    }

    /**
     * Rentang tanggal laporan EWS Guru — default 30 hari terakhir kalau tidak diisi.
     * Dipakai bareng oleh index(), sessions(), dan sessionsExport() supaya konsisten.
     *
     * @return array{0:Carbon,1:Carbon}
     */
    private function resolvePeriode(Request $request): array
    {
        $request->validate([
            'tanggal_mulai' => ['nullable', 'date'],
            'tanggal_akhir' => ['nullable', 'date', 'after_or_equal:tanggal_mulai'],
        ]);

        $mulai = $request->filled('tanggal_mulai')
            ? Carbon::parse($request->tanggal_mulai)->startOfDay()
            : Carbon::now()->subDays(30)->startOfDay();
        $akhir = $request->filled('tanggal_akhir')
            ? Carbon::parse($request->tanggal_akhir)->endOfDay()
            : Carbon::now()->endOfDay();

        return [$mulai, $akhir];
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
