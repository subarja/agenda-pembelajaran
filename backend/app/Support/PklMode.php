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
        return AcademicYear::where('aktif', true)->value('id');
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

    /** id kelas XII (TA aktif) yang diajar guru ini lewat ploting jadwal aktif. */
    public static function taughtXiiClassIds(int $teacherId): array
    {
        return Schedule::tahunAjaran()
            ->where('teacher_id', $teacherId)
            ->where('aktif', true)
            ->whereHas('schoolClass', fn ($q) => $q->where('tingkat', Tingkat::XII->value))
            ->pluck('class_id')
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Guru berhak masuk alur agenda PKL bila ia pembimbing (penugasan, walau tanpa
     * ploting) ATAU ber-ploting jadwal di kelas XII (walau tanpa penugasan bimbingan).
     * Keduanya setara: agenda PKL mingguan lepas dari jadwal harian.
     */
    public static function canFillAgenda(User $user): bool
    {
        $teacher = $user->teacher;
        if (! $teacher) {
            return false;
        }

        return self::isPembimbing($user) || self::taughtXiiClassIds($teacher->id) !== [];
    }

    /** @var array<int, array{0:string,1:string}>|null cache periode PKL per kelas (TA aktif) */
    private static ?array $placementRanges = null;

    /** @var array<int, true>|null cache id kelas XII TA aktif */
    private static ?array $xiiClassIds = null;

    /**
     * Sesi reguler (kelas, tanggal) ini dibebaskan dari tagihan agenda?
     *
     * Dua lapis, sengaja TIDAK hanya membaca saklar:
     *  1. Mode ON → seluruh kelas XII bebas (kewajiban pindah ke agenda PKL mingguan).
     *  2. Tanggal berada dalam periode PKL kelas itu (min mulai..max selesai placement)
     *     → tetap bebas WALAU mode sudah OFF. Tanpa lapis ini, mematikan saklar membuat
     *     sesi XII semasa PKL mendadak ditagih retroaktif sebagai hutang agenda di
     *     dashboard guru dan EWS Guru — padahal rekamannya ada di agenda PKL.
     */
    public static function isAgendaExempt(?int $classId, string $tanggal): bool
    {
        if ($classId === null) {
            return false;
        }

        if (self::isActive()) {
            self::$xiiClassIds ??= \App\Models\SchoolClass::whereHas('academicYear', fn ($q) => $q->where('aktif', true))
                ->where('tingkat', Tingkat::XII->value)
                ->pluck('id')
                ->flip()
                ->all();

            if (isset(self::$xiiClassIds[$classId])) {
                return true;
            }
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
        self::$xiiClassIds = null;
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
