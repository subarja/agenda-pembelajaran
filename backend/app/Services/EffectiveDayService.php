<?php

namespace App\Services;

use App\Models\AcademicYear;
use App\Models\NonEffectiveDay;
use App\Models\Schedule;
use Carbon\Carbon;
use Carbon\CarbonPeriod;

class EffectiveDayService
{
    private const HARI_TO_DOW = [
        'senin'   => Carbon::MONDAY,
        'selasa'  => Carbon::TUESDAY,
        'rabu'    => Carbon::WEDNESDAY,
        'kamis'   => Carbon::THURSDAY,
        'jumat'   => Carbon::FRIDAY,
        'sabtu'   => Carbon::SATURDAY,
    ];

    private const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

    private const MONTHS_ID = [
        1  => 'Januari',   2  => 'Februari', 3  => 'Maret',
        4  => 'April',     5  => 'Mei',       6  => 'Juni',
        7  => 'Juli',      8  => 'Agustus',   9  => 'September',
        10 => 'Oktober',   11 => 'Nopember',  12 => 'Desember',
    ];

    /**
     * Cache per-instance untuk data yang SAMA di seluruh pemanggilan dalam satu rekap.
     *
     * rekapByClass()/rekapByTeacher() memanggil calculateMinggu() sekali per kombinasi
     * kelas×mapel — 979 kali pada ekspor seluruh sekolah. Tahun ajaran & daftar hari
     * tidak efektif tidak berubah di antara pemanggilan itu, tapi dulu diambil ulang
     * setiap kali: 3140 query dan ~5 detik (audit 2026-07-19). Sengaja instance, bukan
     * static, supaya tidak bocor antar-request/antar-test dan tidak perlu flush().
     */
    private array $ayCache = [];

    private array $nedCache = [];

    private array $scheduleCache = [];

    /**
     * Hitung minggu efektif per bulan untuk satu kombinasi kelas+mapel dalam satu tahun ajaran.
     * Basis: MINGGU KALENDER SUNGGUHAN (Senin-Minggu) yang memuat >=1 hari jadwal mapel ini,
     * BUKAN jumlah kemunculan hari jadwal itu sendiri — mapel dengan 2 hari jadwal/minggu
     * (mis. Selasa+Rabu) tetap dihitung 1 minggu per minggu kalender, bukan 2. Satu minggu
     * dianggap TIDAK efektif kalau ADA SALAH SATU hari jadwalnya di minggu itu tidak efektif.
     */
    public function calculateMinggu(int $classId, int $subjectId, int $academicYearId): array
    {
        $ay = $this->ayCache[$academicYearId] ??= AcademicYear::findOrFail($academicYearId);

        if (! $ay->tanggal_mulai || ! $ay->tanggal_selesai) {
            return $this->emptyMingguResult('Tanggal mulai/selesai semester belum diisi.');
        }

        // Satu query per KELAS, bukan per kelas x mapel: pemanggilnya (rekapMingguByClass /
        // rekapMingguAllByClass) sudah mengambil jadwal yang sama persis lalu
        // mengelompokkannya per mapel, jadi tanpa cache ini jadwal kelas yang sama diambil
        // ulang untuk setiap mapelnya. Filternya identik dengan versi lama.
        $this->scheduleCache[$classId] ??= Schedule::where('class_id', $classId)
            ->where('aktif', true)
            ->get()
            ->groupBy('subject_id');

        $schedules = $this->scheduleCache[$classId][$subjectId] ?? collect();

        if ($schedules->isEmpty()) {
            return $this->emptyMingguResult('Tidak ada jadwal aktif.');
        }

        $hariDows = $schedules->map(fn ($s) => self::HARI_TO_DOW[$s->hari->value])
            ->unique()->values()->toArray();

        // Pre-load semua hari tidak efektif dalam semester (indexed by tanggal)
        $nedMap = $this->nedCache[$academicYearId] ??= NonEffectiveDay::whereBetween('tanggal', [
            $ay->tanggal_mulai->format('Y-m-d'),
            $ay->tanggal_selesai->format('Y-m-d'),
        ])->get()->keyBy(fn ($n) => $n->tanggal->format('Y-m-d'));

        // Kelompokkan tanggal mengajar per bulan, DI DALAM bulan itu kelompokkan lagi per
        // minggu kalender (kunci = tanggal Senin minggu itu) — supaya 2 hari jadwal dalam
        // minggu yang sama tetap dihitung 1 minggu, bukan 2.
        $byMonth = [];
        $period  = CarbonPeriod::create($ay->tanggal_mulai, $ay->tanggal_selesai);
        foreach ($period as $date) {
            if (in_array($date->dayOfWeek, $hariDows)) {
                $monthKey = $date->format('Y-m');
                $weekKey  = $date->copy()->startOfWeek(Carbon::MONDAY)->format('Y-m-d');
                $byMonth[$monthKey][$weekKey][] = $date->format('Y-m-d');
            }
        }

        $bulanData         = [];
        $totalMinggu       = 0;
        $totalEfektif      = 0;
        $totalTidakEfektif = 0;
        $no                = 1;

        foreach ($byMonth as $monthKey => $weeks) {
            [, $m]         = explode('-', $monthKey);
            $jumlahMinggu  = count($weeks);
            $efektif       = 0;
            $tidakEfektif  = 0;
            $detailItems   = [];
            $keteranganLines = [];
            $weekIdx = 0;

            foreach ($weeks as $datesInWeek) {
                $roman = self::ROMAN[$weekIdx] ?? (string) ($weekIdx + 1);
                $weekIdx++;
                $weekHasNed = false;

                foreach ($datesInWeek as $ds) {
                    $ned = $nedMap->get($ds);
                    if (! $ned) continue;

                    $weekHasNed = true;
                    $dateF  = Carbon::parse($ds)->format('d/m/Y');
                    $reason = $ned->keterangan ?: 'Tidak Efektif';
                    $keteranganLines[] = "{$roman}-{$dateF}: {$reason}";
                    $detailItems[]     = [
                        'tanggal'    => $ds,
                        'minggu_ke'  => $roman,
                        'keterangan' => $reason,
                    ];
                }

                if ($weekHasNed) $tidakEfektif++; else $efektif++;
            }

            $bulanData[] = [
                'no'                => $no++,
                'bulan'             => self::MONTHS_ID[(int) $m],
                'jumlah_minggu'     => $jumlahMinggu,
                'efektif'           => $efektif,
                'tidak_efektif'     => $tidakEfektif,
                'keterangan'        => $tidakEfektif > 0 ? implode("\n", $keteranganLines) : '-',
                'detail_tidak_efektif' => $detailItems,
            ];

            $totalMinggu       += $jumlahMinggu;
            $totalEfektif      += $efektif;
            $totalTidakEfektif += $tidakEfektif;
        }

        return [
            'hari_jadwal'      => $schedules->pluck('hari')->map(fn ($h) => $h->value)->unique()->values(),
            'bulan'            => $bulanData,
            'total_minggu'     => $totalMinggu,
            'total_efektif'    => $totalEfektif,
            'total_tidak_efektif' => $totalTidakEfektif,
        ];
    }

    /**
     * Rekap minggu efektif semua mapel seorang guru dalam satu kelas.
     */
    public function rekapMingguByClass(int $classId, int $teacherId, int $academicYearId): array
    {
        $schedules = Schedule::where('class_id', $classId)
            ->where('teacher_id', $teacherId)
            ->where('aktif', true)
            ->with(['subject'])
            ->get()
            ->groupBy('subject_id');

        $result = [];
        foreach ($schedules as $subjectId => $group) {
            $first  = $group->first();
            $minggu = $this->calculateMinggu($classId, (int) $subjectId, $academicYearId);
            $result[] = [
                'subject_id'       => $first->subject->uuid,
                'subject_nama'     => $first->subject->nama,
                'subject_kode'     => $first->subject->kode,
                'hari_jadwal'      => $minggu['hari_jadwal'],
                'total_minggu'     => $minggu['total_minggu'],
                'total_efektif'    => $minggu['total_efektif'],
                'total_tidak_efektif' => $minggu['total_tidak_efektif'],
                'bulan'            => $minggu['bulan'],
            ];
        }

        return $result;
    }

    /**
     * Rekap minggu efektif semua mapel di satu kelas, LINTAS guru (dipakai admin
     * "Per Kelas" — beda dengan rekapMingguByClass yang difilter 1 guru).
     * calculateMinggu() sendiri tidak pernah menyaring per guru, jadi tinggal group
     * jadwal per mapel seperti rekapByClass() lalu panggil calculateMinggu().
     */
    public function rekapMingguAllByClass(int $classId, int $academicYearId): array
    {
        $schedules = Schedule::where('class_id', $classId)
            ->where('aktif', true)
            ->with(['subject'])
            ->get()
            ->groupBy('subject_id');

        $result = [];
        foreach ($schedules as $subjectId => $group) {
            $first  = $group->first();
            $minggu = $this->calculateMinggu($classId, (int) $subjectId, $academicYearId);
            $result[] = [
                'subject_id'          => $first->subject->uuid,
                'subject_nama'        => $first->subject->nama,
                'subject_kode'        => $first->subject->kode,
                'hari_jadwal'         => $minggu['hari_jadwal'],
                'total_minggu'        => $minggu['total_minggu'],
                'total_efektif'       => $minggu['total_efektif'],
                'total_tidak_efektif' => $minggu['total_tidak_efektif'],
                'bulan'               => $minggu['bulan'],
            ];
        }

        return $result;
    }

    // ── Legacy: hitung hari efektif (masih dipakai KalenderPage via my-classes) ─────

    public function calculate(int $classId, int $subjectId, int $academicYearId): array
    {
        $ay = AcademicYear::findOrFail($academicYearId);

        if (! $ay->tanggal_mulai || ! $ay->tanggal_selesai) {
            return $this->emptyResult('Tanggal mulai/selesai semester belum diisi di pengaturan Tahun Ajaran.');
        }

        // Satu query per KELAS, bukan per kelas x mapel: pemanggilnya (rekapMingguByClass /
        // rekapMingguAllByClass) sudah mengambil jadwal yang sama persis lalu
        // mengelompokkannya per mapel, jadi tanpa cache ini jadwal kelas yang sama diambil
        // ulang untuk setiap mapelnya. Filternya identik dengan versi lama.
        $this->scheduleCache[$classId] ??= Schedule::where('class_id', $classId)
            ->where('aktif', true)
            ->get()
            ->groupBy('subject_id');

        $schedules = $this->scheduleCache[$classId][$subjectId] ?? collect();

        if ($schedules->isEmpty()) {
            return $this->emptyResult('Tidak ada jadwal aktif untuk kelas dan mapel ini.');
        }

        $hariDows = $schedules->map(fn ($s) => self::HARI_TO_DOW[$s->hari->value])
            ->unique()->values()->toArray();

        $period           = CarbonPeriod::create($ay->tanggal_mulai, $ay->tanggal_selesai);
        $allTeachingDates = [];

        foreach ($period as $date) {
            if (in_array($date->dayOfWeek, $hariDows)) {
                $allTeachingDates[] = $date->format('Y-m-d');
            }
        }

        $nonEffectiveSet = NonEffectiveDay::whereBetween('tanggal', [
            $ay->tanggal_mulai->format('Y-m-d'),
            $ay->tanggal_selesai->format('Y-m-d'),
        ])->pluck('tanggal')
            ->map(fn ($d) => Carbon::parse($d)->format('Y-m-d'))
            ->flip()
            ->toArray();

        $effectiveDates    = [];
        $nonEffectiveDates = [];

        foreach ($allTeachingDates as $d) {
            if (isset($nonEffectiveSet[$d])) {
                $nonEffectiveDates[] = $d;
            } else {
                $effectiveDates[] = $d;
            }
        }

        return [
            'academic_year_id'         => $ay->id,
            'tahun'                    => $ay->tahun,
            'semester'                 => $ay->semester->value,
            'tanggal_mulai'            => $ay->tanggal_mulai->format('Y-m-d'),
            'tanggal_selesai'          => $ay->tanggal_selesai->format('Y-m-d'),
            'total_hari_mengajar'      => count($allTeachingDates),
            'total_hari_tidak_efektif' => count($nonEffectiveDates),
            'total_hari_efektif'       => count($effectiveDates),
            'tanggal_efektif'          => $effectiveDates,
            'tanggal_tidak_efektif'    => $nonEffectiveDates,
            'hari_jadwal'              => $schedules->pluck('hari')->map(fn ($h) => $h->value)->unique()->values(),
        ];
    }

    public function rekapByClass(int $classId, int $academicYearId): array
    {
        $schedules = Schedule::where('class_id', $classId)
            ->where('aktif', true)
            ->with(['subject'])
            ->get()
            ->groupBy('subject_id');

        $result = [];
        foreach ($schedules as $subjectId => $group) {
            $calc     = $this->calculate($classId, (int) $subjectId, $academicYearId);
            $result[] = [
                'subject_id'               => $group->first()->subject->uuid,
                'subject_nama'             => $group->first()->subject->nama,
                'subject_kode'             => $group->first()->subject->kode,
                'hari_jadwal'              => $calc['hari_jadwal'] ?? [],
                'total_hari_mengajar'      => $calc['total_hari_mengajar'] ?? 0,
                'total_hari_tidak_efektif' => $calc['total_hari_tidak_efektif'] ?? 0,
                'total_hari_efektif'       => $calc['total_hari_efektif'] ?? 0,
            ];
        }

        return $result;
    }

    private function emptyMingguResult(string $pesan = ''): array
    {
        return [
            'hari_jadwal'         => [],
            'bulan'               => [],
            'total_minggu'        => 0,
            'total_efektif'       => 0,
            'total_tidak_efektif' => 0,
            'pesan'               => $pesan,
        ];
    }

    private function emptyResult(string $pesan): array
    {
        return [
            'total_hari_mengajar'      => 0,
            'total_hari_tidak_efektif' => 0,
            'total_hari_efektif'       => 0,
            'tanggal_efektif'          => [],
            'tanggal_tidak_efektif'    => [],
            'hari_jadwal'              => [],
            'pesan'                    => $pesan,
        ];
    }

    /**
     * Hitung minggu efektif umum (sekolah) per bulan dalam satu semester.
     * Aturan: sebuah minggu dihitung tidak efektif jika > 3 hari sekolah dalam minggu itu
     * adalah hari tidak efektif (NonEffectiveDay).
     * "Minggu sekolah" = Senin–Jumat (5 hari). Jumlah minggu terganggu > 3 hari = tidak efektif.
     */
    public function calculateUmum(int $academicYearId): array
    {
        $ay = AcademicYear::findOrFail($academicYearId);

        if (! $ay->tanggal_mulai || ! $ay->tanggal_selesai) {
            return ['bulan' => [], 'total_minggu' => 0, 'total_efektif' => 0, 'total_tidak_efektif' => 0];
        }

        $nedSet = NonEffectiveDay::whereBetween('tanggal', [
            $ay->tanggal_mulai->format('Y-m-d'),
            $ay->tanggal_selesai->format('Y-m-d'),
        ])->pluck('keterangan', 'tanggal')
          ->mapWithKeys(fn ($ket, $tgl) => [$tgl instanceof \Carbon\Carbon ? $tgl->format('Y-m-d') : (string)$tgl => $ket]);

        // Group all calendar weeks within the semester
        $start = $ay->tanggal_mulai->copy()->startOfWeek(Carbon::MONDAY);
        $end   = $ay->tanggal_selesai->copy();

        $byMonth = [];
        $current = $start->copy();

        while ($current->lte($end)) {
            $weekStart = $current->copy();
            $weekEnd   = $current->copy()->endOfWeek(Carbon::FRIDAY);

            // Clip to semester range
            $wStart = $weekStart->lt($ay->tanggal_mulai) ? $ay->tanggal_mulai->copy() : $weekStart;
            $wEnd   = $weekEnd->gt($end) ? $end->copy() : $weekEnd;

            // Count school days (Mon-Fri) in this clipped week
            $schoolDays = [];
            for ($d = $wStart->copy(); $d->lte($wEnd); $d->addDay()) {
                if ($d->dayOfWeek >= Carbon::MONDAY && $d->dayOfWeek <= Carbon::FRIDAY) {
                    $schoolDays[] = $d->format('Y-m-d');
                }
            }

            if (count($schoolDays) === 0) {
                $current->addWeek();
                continue;
            }

            $nedDays = array_filter($schoolDays, fn ($ds) => isset($nedSet[$ds]));
            $nedCount = count($nedDays);
            $efektif  = $nedCount <= 3;

            $reasons = array_unique(array_filter(
                array_map(fn ($ds) => $nedSet[$ds] ?? null, $nedDays)
            ));

            $monthKey = $wStart->format('Y-m');
            $byMonth[$monthKey][] = [
                'minggu_mulai'   => $wStart->format('d/m'),
                'minggu_akhir'   => $wEnd->format('d/m'),
                'hari_terganggu' => $nedCount,
                'efektif'        => $efektif,
                'keterangan'     => implode('; ', $reasons),
                // Tanggal + alasan tiap hari tidak efektif di minggu ini, dipakai untuk
                // menyusun kolom "Keterangan" per bulan format "W-DD/MM/YYYY: <keg>".
                'ned_dates'      => array_map(fn ($ds) => ['tanggal' => $ds, 'keterangan' => $nedSet[$ds]], $nedDays),
            ];

            $current->addWeek();
        }

        $bulanData = [];
        $no = 1;
        $totalMinggu = 0;
        $totalEfektif = 0;
        $totalTidakEfektif = 0;

        foreach ($byMonth as $monthKey => $weeks) {
            [, $m] = explode('-', $monthKey);
            $efektifCount    = count(array_filter($weeks, fn ($w) => $w['efektif']));
            $tidakEfektifCount = count($weeks) - $efektifCount;

            // Kolom Keterangan: satu baris per tanggal tidak efektif di bulan ini, format
            // "W-DD/MM/YYYY: <keg>" — W = minggu ke berapa DI BULAN ITU (angka romawi),
            // sama seperti format referensi docs/format minggu efektif.xlsx.
            $keteranganLines = [];
            foreach ($weeks as $wIdx => $w) {
                $roman = self::ROMAN[$wIdx] ?? (string) ($wIdx + 1);
                foreach ($w['ned_dates'] as $nd) {
                    $dateF = Carbon::parse($nd['tanggal'])->format('d/m/Y');
                    $reason = $nd['keterangan'] ?: 'Tidak Efektif';
                    $keteranganLines[] = "{$roman}-{$dateF}: {$reason}";
                }
            }

            $bulanData[] = [
                'no'            => $no++,
                'bulan'         => self::MONTHS_ID[(int) $m],
                'jumlah_minggu' => count($weeks),
                'efektif'       => $efektifCount,
                'tidak_efektif' => $tidakEfektifCount,
                'keterangan'    => $keteranganLines ? implode("\n", $keteranganLines) : '-',
                'weeks'         => $weeks,
            ];

            $totalMinggu       += count($weeks);
            $totalEfektif      += $efektifCount;
            $totalTidakEfektif += $tidakEfektifCount;
        }

        return [
            'bulan'              => $bulanData,
            'total_minggu'       => $totalMinggu,
            'total_efektif'      => $totalEfektif,
            'total_tidak_efektif' => $totalTidakEfektif,
        ];
    }
}
