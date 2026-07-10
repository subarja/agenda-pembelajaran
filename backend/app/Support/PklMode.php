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
