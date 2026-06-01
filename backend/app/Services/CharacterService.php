<?php

namespace App\Services;

use App\Enums\EwsLevel; // @phpstan-ignore-line
use App\Models\ActionThreshold;
use App\Models\AcademicYear;
use App\Models\CharacterInput;
use App\Models\EwsStatus;
use App\Models\Recommendation;
use App\Models\Student;
use App\Models\StudentAttendance;
use App\Notifications\EwsEscalationNotification;
use App\Notifications\RecommendationCreatedNotification;

class CharacterService
{
    /**
     * Dipanggil setelah CharacterInput baru disimpan.
     * Hitung ulang poin, periksa ambang, buat rekomendasi, perbarui EWS.
     */
    public function processAfterInput(Student $student): void
    {
        $ay = AcademicYear::where('aktif', true)->first();
        if (! $ay) return;

        $netScore = $this->calculateNetScore($student);

        $this->checkThresholdsAndRecommend($student, $netScore);
        $this->updateEwsStatus($student, $ay, $netScore);
    }

    public function calculateNetScore(Student $student): int
    {
        return CharacterInput::where('student_id', $student->id)
            ->with('subitem')
            ->get()
            ->sum(fn ($inp) =>
                $inp->sign->value === 'positif'
                    ? abs($inp->subitem?->bobot ?? 0)
                    : -abs($inp->subitem?->bobot ?? 0)
            );
    }

    public function checkThresholdsAndRecommend(Student $student, int $netScore): void
    {
        $thresholds = ActionThreshold::where('aktif', true)->get();

        foreach ($thresholds as $threshold) {
            $inRange = $netScore >= $threshold->min_point
                && ($threshold->max_point === null || $netScore <= $threshold->max_point);

            if (! $inRange) continue;

            $exists = Recommendation::where('student_id', $student->id)
                ->where('threshold_id', $threshold->id)
                ->whereIn('status', ['pending', 'proses'])
                ->exists();

            if (! $exists) {
                Recommendation::create([
                    'student_id'             => $student->id,
                    'threshold_id'           => $threshold->id,
                    'akumulasi_saat_trigger' => $netScore,
                    'status'                 => 'pending',
                    'ditugaskan_ke'          => $student->schoolClass?->wali_kelas_id,
                ]);

                // Notifikasi in-app ke wali kelas
                $this->notifyWaliKelas($student, new RecommendationCreatedNotification(
                    $student, $threshold->rekomendasi, $netScore
                ));
            }
        }
    }

    public function updateEwsStatus(Student $student, AcademicYear $ay, ?int $netScore = null): void
    {
        if ($netScore === null) {
            $netScore = $this->calculateNetScore($student);
        }

        $totalAbsensi = StudentAttendance::where('student_id', $student->id)->count();
        $hadir        = StudentAttendance::where('student_id', $student->id)->where('status', 'hadir')->count();
        $kehadiranPct = $totalAbsensi > 0 ? round(($hadir / $totalAbsensi) * 100, 2) : 100.0;

        $levelBaru = $this->resolveLevel($netScore, $kehadiranPct);

        $ews = EwsStatus::where('student_id', $student->id)
            ->where('academic_year_id', $ay->id)
            ->first();

        $levelLama = $ews?->level?->value ?? 'hijau';

        EwsStatus::updateOrCreate(
            ['student_id' => $student->id, 'academic_year_id' => $ay->id],
            [
                'karakter_score'     => $netScore,
                'kehadiran_score'    => $kehadiranPct,
                'level'              => $levelBaru,
                'last_calculated_at' => now(),
            ]
        );

        // Kirim notifikasi jika level naik (bukan turun)
        $levelOrder = ['hijau' => 0, 'kuning' => 1, 'oranye' => 2, 'merah' => 3];
        $naik = ($levelOrder[$levelBaru->value] ?? 0) > ($levelOrder[$levelLama] ?? 0);

        if ($naik && in_array($levelBaru->value, ['kuning', 'oranye', 'merah'])) {
            $student->loadMissing(['schoolClass', 'user']);
            $notif = new EwsEscalationNotification($student, $levelLama, $levelBaru->value);
            $this->notifyWaliKelas($student, $notif);
        }
    }

    private function notifyWaliKelas(Student $student, $notification): void
    {
        $waliId = $student->schoolClass?->wali_kelas_id;
        if (! $waliId) return;

        $wali = \App\Models\User::find($waliId);
        $wali?->notify($notification);
    }

    private function resolveLevel(int $karakterScore, float $kehadiranPct): EwsLevel
    {
        if ($karakterScore <= -50 || $kehadiranPct < 50) return EwsLevel::Merah;
        if ($karakterScore <= -20 || $kehadiranPct < 75) return EwsLevel::Oranye;
        if ($karakterScore <= -10 || $kehadiranPct < 85) return EwsLevel::Kuning;
        return EwsLevel::Hijau;
    }
}
