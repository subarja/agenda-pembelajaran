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

    public static function isActive(): bool
    {
        return PklSetting::isActive();
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

    /**
     * Sesi reguler (kelas, tanggal) ini dibebaskan dari tagihan agenda?
     *
     * Murni berbasis PERIODE PENEMPATAN kelas (min mulai..max selesai placement),
     * BUKAN saklar:
     *  - Saklar ON tanpa penempatan TIDAK membebaskan apa pun — dulu seluruh kelas XII
     *    langsung bebas begitu saklar dinyalakan, padahal tanpa penempatan guru juga tak
     *    bisa mengisi agenda PKL mingguan → kewajibannya lenyap dua-duanya.
     *  - Tanggal dalam periode tetap bebas WALAU saklar sudah OFF — mematikan saklar
     *    tidak menagih retroaktif sesi semasa PKL (rekamannya ada di agenda PKL).
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

        return $range !== null && $tanggal >= $range[0] && $tanggal <= $range[1];
    }

    /** Reset cache statis — dipakai test & setelah import/hapus placement. */
    public static function flush(): void
    {
        self::$placementRanges = null;
    }

    /**
     * Tagihan agenda PKL mingguan seorang pembimbing untuk daftar "perlu diisi"
     * di dashboard — bentuk barisnya sama dengan sesi reguler/kokurikuler.
     *
     * Yang ditagih: minggu yang SUDAH berjalan, di DALAM rentang semester aktif
     * (minggu Sen–Jum yang beririsan), dalam rentang penempatan siswa bimbingannya
     * di kelas itu, dan belum ada agenda-nya. Minggu yang belum mulai tidak pernah
     * muncul; minggu lewat deadline tetap muncul sebagai "lewat batas" (pola sama
     * dengan sesi reguler).
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

        $now  = Carbon::now(config('app.school_timezone'));
        $rows = [];

        foreach ($placements->groupBy('class_id') as $classId => $group) {
            $class = $group->first()->schoolClass;
            if (! $class) {
                continue;
            }

            $terisi = \App\Models\PklAgenda::where('pembimbing_teacher_id', $teacher->id)
                ->where('class_id', $classId)
                ->pluck('minggu_mulai')
                ->map(fn ($t) => substr((string) $t, 0, 10))
                ->flip();

            $senin = Carbon::parse($group->min('tanggal_mulai'))->startOfWeek(Carbon::MONDAY);
            $akhir = Carbon::parse($group->max('tanggal_selesai'));

            for (; $senin->lte($akhir); $senin->addWeek()) {
                if ($now->lt($senin)) {
                    break;                                          // minggu belum berjalan
                }
                $key   = $senin->toDateString();
                $jumat = $senin->copy()->addDays(4)->toDateString();
                if ($terisi->has($key)) {
                    continue;
                }
                if ($semMulai && ($key > $semSelesai || $jumat < $semMulai)) {
                    continue;                                       // di luar periode semester
                }

                $deadline = self::fillDeadline($senin->copy());
                $rows[] = [
                    'jenis'        => 'pkl',
                    // Kunci unik utk daftar FE — bukan uuid jadwal sungguhan.
                    'schedule_id'  => "pkl|{$class->uuid}|{$key}",
                    'tanggal'      => $key,
                    'hari'         => 'Senin',
                    'jam_mulai'    => '',
                    'jam_selesai'  => '',
                    'class_id'     => $class->uuid,
                    'kelas'        => $class->label(),
                    'mapel'        => 'Agenda PKL Mingguan',
                    'minggu'       => $key,
                    'deadline'     => $deadline->format('Y-m-d H:i'),
                    'bisa_diisi'   => $now->lte($deadline),
                    'jam_tersisa'  => $now->lte($deadline) ? $now->diffInHours($deadline) : null,
                ];
            }
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
