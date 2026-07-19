<?php

namespace App\Support;

use App\Enums\Tingkat;
use App\Models\AcademicYear;
use App\Models\AgendaFillSetting;
use App\Models\PklPlacement;
use App\Models\PklSetting;
use App\Models\Schedule;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Satu-satunya sumber kebenaran untuk perilaku Mode PKL.
 *
 * Saat OFF, seluruh method di sini menjawab "seperti biasa" sehingga pemanggil di alur
 * reguler (jadwal, agenda) tidak berubah perilakunya sama sekali. Saat ON, kelas XII
 * beralih ke alur Praktik Kerja Lapangan tanpa mengubah struktur jadwal/kelas/jam.
 *
 * Label mapel dan penyaringan kelas XII sengaja terpusat di sini, bukan disebar ke tiap
 * controller/resource, supaya "apa arti Mode PKL" tidak pernah punya dua jawaban.
 */
class PklMode
{
    public const SUBJECT_LABEL = 'Praktek Kerja Lapangan';

    /**
     * Saklar Mode PKL, di-memoize per request.
     *
     * Tanpa cache ini `PklSetting::instance()` (firstOrCreate) dijalankan sekali untuk
     * SETIAP kombinasi kelas × tanggal — EWS Guru satu semester memicu 1627 query
     * identik `select * from pkl_settings limit 1` dari total 2043 (audit 2026-07-19).
     * Pola cache-nya sama dengan self::$placementRanges di bawah, dan ikut direset
     * lewat flush().
     */
    public static function isActive(): bool
    {
        return self::$aktif ??= PklSetting::isActive();
    }

    /** Tahun ajaran yang aktif secara global — dipakai konsisten dgn ClassAccess. */
    public static function activeAcademicYearId(): ?int
    {
        return \App\Support\TahunAjaran::id();
    }

    /** Apakah kelas ini kelas XII (yang terdampak Mode PKL)? */
    public static function isPklClass(?Tingkat $tingkat): bool
    {
        return $tingkat === Tingkat::XII;
    }

    /**
     * Label mapel untuk sebuah jadwal. Kelas XII → "Praktek Kerja Lapangan" saat mode ON;
     * selain itu nama mapel asli. `schoolClass` diasumsikan sudah ter-load.
     */
    public static function subjectLabelFor(Schedule $schedule): string
    {
        $real = $schedule->subject?->nama ?? '';

        if (self::isActive() && self::isPklClass($schedule->schoolClass?->tingkat)) {
            return self::SUBJECT_LABEL;
        }

        return $real;
    }

    /** Apakah $user seorang guru pembimbing PKL pada tahun ajaran aktif? */
    public static function isPembimbing(User $user): bool
    {
        $teacher = $user->teacher;
        if (! $teacher) {
            return false;
        }

        return PklPlacement::where('pembimbing_teacher_id', $teacher->id)
            ->when(self::activeAcademicYearId(), fn ($q, $ay) => $q->where('academic_year_id', $ay))
            ->exists();
    }

    /**
     * Guru berhak masuk alur agenda PKL HANYA bila ia pembimbing (punya penugasan
     * placement). Ploting jadwal XII saja tidak cukup — keputusan 2026-07-17: guru
     * ploting tanpa penugasan sempat melihat seluruh siswa kelas (mis. 32 siswa
     * XII MEKA C), padahal tanggung jawab agenda/presensi PKL melekat ke pembimbing.
     */
    public static function canFillAgenda(User $user): bool
    {
        return self::isPembimbing($user);
    }

    /** @var array<int, array{0:string,1:string}>|null cache periode PKL per kelas (TA aktif) */
    private static ?array $placementRanges = null;

    private static ?bool $aktif = null;

    /**
     * Sesi reguler (kelas, tanggal) ini dibebaskan dari tagihan agenda?
     *
     * Berbasis PERIODE PENEMPATAN kelas (min mulai..max selesai placement), dengan
     * batas saklar yang berlaku KE DEPAN:
     *  - Saklar ON tanpa penempatan TIDAK membebaskan apa pun — dulu seluruh kelas XII
     *    langsung bebas begitu saklar dinyalakan, padahal tanpa penempatan guru juga tak
     *    bisa mengisi agenda PKL mingguan → kewajibannya lenyap dua-duanya.
     *  - Saklar ON: semua tanggal dalam periode bebas.
     *  - Saklar OFF: hanya tanggal LAMPAU (sebelum hari ini) yang tetap bebas —
     *    mematikan saklar tidak menagih retroaktif sesi semasa PKL, TAPI hari ini &
     *    ke depan kembali ditagih agenda reguler karena PKL sudah tidak berjalan.
     */
    public static function isAgendaExempt(?int $classId, string $tanggal): bool
    {
        if ($classId === null) {
            return false;
        }

        self::$placementRanges ??= PklPlacement::query()
            ->when(self::activeAcademicYearId(), fn ($q, $ay) => $q->where('academic_year_id', $ay))
            ->selectRaw('class_id, MIN(tanggal_mulai) as mulai, MAX(tanggal_selesai) as selesai')
            ->groupBy('class_id')
            ->get()
            ->mapWithKeys(fn ($r) => [(int) $r->class_id => [(string) $r->mulai, (string) $r->selesai]])
            ->all();

        $range = self::$placementRanges[$classId] ?? null;
        $inRange = $range !== null && $tanggal >= $range[0] && $tanggal <= $range[1];
        if (! $inRange) {
            return false;
        }

        if (self::isActive()) {
            return true;
        }

        // Saklar OFF → cuma bebaskan tanggal sebelum hari ini (lampau).
        $today = Carbon::now(config('app.school_timezone'))->toDateString();

        return $tanggal < $today;
    }

    /** Reset cache statis — dipakai test & setelah import/hapus placement. */
    public static function flush(): void
    {
        self::$placementRanges = null;
        self::$aktif = null;
    }

    /**
     * Tagihan agenda PKL mingguan pembimbing untuk daftar "perlu diisi" di dashboard —
     * AGREGAT: satu baris per minggu untuk SEMUA kelas bimbingan (pembimbingan lintas
     * kelas dilakukan sekaligus). Bentuk barisnya sama dengan sesi reguler/kokurikuler.
     *
     * Yang ditagih: minggu yang sudah masuk HARI JUMAT-nya (agenda PKL cuma bisa diisi
     * mulai Jumat), beririsan periode semester aktif, dalam rentang penempatan, dan
     * belum semua kelasnya terisi. Sebelum Jumat tidak muncul; lewat deadline tetap
     * muncul sebagai "lewat batas".
     */
    public static function tagihanPembimbing(User $user, \App\Models\AgendaFillSetting $setting): array
    {
        $teacher = $user->teacher;
        if (! $teacher) {
            return [];
        }

        $ayId = self::activeAcademicYearId();
        $placements = PklPlacement::where('pembimbing_teacher_id', $teacher->id)
            ->when($ayId, fn ($q) => $q->where('academic_year_id', $ayId))
            ->with('schoolClass')
            ->get();
        if ($placements->isEmpty()) {
            return [];
        }

        $ay         = \App\Support\TahunAjaran::current();
        $semMulai   = $ay?->tanggal_mulai->toDateString();
        $semSelesai = $ay?->tanggal_selesai->toDateString();

        // class_id → set minggu (string) yang sudah terisi agendanya.
        $filledByClass = \App\Models\PklAgenda::where('pembimbing_teacher_id', $teacher->id)
            ->get(['class_id', 'minggu_mulai'])
            ->groupBy('class_id')
            ->map(fn ($g) => $g->map(fn ($a) => substr((string) $a->minggu_mulai, 0, 10))->flip());

        // Saklar OFF: hanya tagih PKL minggu LAMPAU (Jumat-nya sudah lewat sebelum hari
        // ini) sebagai backlog — minggu berjalan & mendatang tidak lagi ditagih karena
        // PKL sudah dihentikan. Saklar ON: minggu berjalan (Jumat tercapai) ikut ditagih.
        $modeAktif = self::isActive();
        $today     = Carbon::now(config('app.school_timezone'))->toDateString();

        $now   = Carbon::now(config('app.school_timezone'));
        $senin = Carbon::parse($placements->min('tanggal_mulai'))->startOfWeek(Carbon::MONDAY);
        $akhir = Carbon::parse($placements->max('tanggal_selesai'));
        $rows  = [];

        for (; $senin->lte($akhir); $senin->addWeek()) {
            $jumat = $senin->copy()->addDays(4);
            if ($now->lt($jumat->copy()->startOfDay())) {
                break;                                          // belum masuk Jumat minggu ini
            }
            if (! $modeAktif && $jumat->toDateString() >= $today) {
                continue;                                       // OFF: lewati minggu berjalan/mendatang
            }
            $key = $senin->toDateString();
            if ($semMulai && ($key > $semSelesai || $jumat->toDateString() < $semMulai)) {
                continue;                                       // di luar periode semester
            }

            // Kelas aktif minggu ini (placement beririsan Sen–Jum).
            $active = $placements->filter(fn ($p) =>
                $p->tanggal_mulai && $p->tanggal_selesai
                && $p->tanggal_mulai->lte($jumat) && $p->tanggal_selesai->gte($senin)
            );
            if ($active->isEmpty()) {
                continue;
            }

            $byClass = $active->groupBy('class_id');
            $terisi  = $byClass->keys()->every(fn ($cid) => ($filledByClass[$cid] ?? collect())->has($key));
            if ($terisi) {
                continue;                                       // semua kelas sudah terisi
            }

            $labels   = $byClass->map(fn ($g) => $g->first()->schoolClass?->label())->filter()->sort()->values();
            $deadline = self::fillDeadline($senin->copy());
            $rows[] = [
                'jenis'        => 'pkl',
                'schedule_id'  => "pkl|{$key}",                 // kunci unik FE (bukan uuid jadwal)
                'tanggal'      => $key,
                'hari'         => 'Jumat',
                'jam_mulai'    => '',
                'jam_selesai'  => '',
                'class_id'     => null,
                'kelas'        => $labels->implode(', ')." ({$active->count()} siswa)",
                'mapel'        => 'Agenda PKL Mingguan',
                'minggu'       => $key,
                'deadline'     => $deadline->format('Y-m-d H:i'),
                'bisa_diisi'   => $now->lte($deadline),
                'jam_tersisa'  => $now->lte($deadline) ? $now->diffInHours($deadline) : null,
            ];
        }

        return $rows;
    }

    /**
     * Batas akhir pengisian agenda PKL untuk minggu yang mulai $mingguMulai (Senin).
     *
     * Sesuai keputusan: "rentang 1 minggu berjalan + waktu tambahan yang ditetapkan admin
     * pada agenda reguler". Jadi deadline = akhir minggu (Minggu 23:59) lalu ditambah
     * batas_hari/batas_jam dari AgendaFillSetting — sumber aturan yang sama dengan agenda
     * reguler, supaya keduanya tidak pernah menjawab berbeda.
     */
    public static function fillDeadline(Carbon $mingguMulai): Carbon
    {
        $akhirMinggu = $mingguMulai->copy()->addDays(6)->endOfDay();

        return AgendaFillSetting::instance()->batasWaktu($akhirMinggu);
    }
}
