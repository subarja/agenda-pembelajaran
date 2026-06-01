<?php

namespace App\Services;

use App\Enums\EwsLevel;
use App\Enums\NoteKategori;
use App\Models\AcademicYear;
use App\Models\EwsStatus;
use App\Models\Note;
use App\Models\Student;
use App\Models\StudentAttendance;
use App\Notifications\AlphaAlertNotification;
use App\Notifications\EwsEscalationNotification;

class AlphaAlertService
{
    public const ALPHA_THRESHOLD = 3;

    /**
     * Cek siswa dalam satu kelas setelah presensi disimpan.
     * Return daftar siswa yang memicu alert (alpha berturut-turut ≥ threshold).
     */
    public function checkClass(int $classId): array
    {
        $students = Student::where('class_id', $classId)->get();
        $alerts   = [];

        foreach ($students as $student) {
            $streak = $this->currentAlphaStreak($student->id);
            if ($streak >= self::ALPHA_THRESHOLD) {
                $this->recordAlert($student, $streak);
                $alerts[] = [
                    'student_id' => $student->uuid,
                    'nama'       => $student->user?->nama ?? '—',
                    'streak'     => $streak,
                    'pesan'      => "Alpha {$streak} sesi berturut-turut",
                ];
            }
        }

        return $alerts;
    }

    /**
     * Hitung berapa sesi alpha berturut-turut paling akhir untuk satu siswa.
     * "Berturut-turut" = sesi berurutan berdasarkan tanggal agenda, bukan hari kalender.
     */
    public function currentAlphaStreak(int $studentId): int
    {
        // Ambil 10 tanggal terakhir yang ada data presensi siswa ini
        $dates = \App\Models\Agenda::join('student_attendances', 'agendas.id', '=', 'student_attendances.agenda_id')
            ->where('student_attendances.student_id', $studentId)
            ->whereNull('agendas.deleted_at')
            ->orderByDesc('agendas.tanggal')
            ->limit(50)
            ->pluck('agendas.tanggal')
            ->map(fn ($d) => \Carbon\Carbon::parse($d)->toDateString())
            ->unique()
            ->take(10)
            ->values();

        // Per tanggal: jika SEMUA sesi pada tanggal itu alpha → hari alpha
        // Jika ADA satu sesi hadir/izin/sakit → bukan hari alpha
        $streak = 0;
        foreach ($dates as $date) {
            $dayAttendances = StudentAttendance::where('student_id', $studentId)
                ->join('agendas', 'agendas.id', '=', 'student_attendances.agenda_id')
                ->whereDate('agendas.tanggal', $date)
                ->whereNull('agendas.deleted_at')
                ->pluck('student_attendances.status');

            // Hari dianggap "alpha" jika ada minimal 1 sesi dengan status alpha
            $hasAlpha = $dayAttendances->contains(
                fn ($s) => (is_string($s) ? $s : $s->value) === 'alpha'
            );

            if ($hasAlpha) {
                $streak++;
            } else {
                break;
            }
        }

        return $streak;
    }

    private function recordAlert(Student $student, int $streak): void
    {
        $ay = AcademicYear::where('aktif', true)->first();

        // Buat catatan presensi — cek apakah sudah ada catatan alpha hari ini
        $todayNote = Note::where('target_type', Student::class)
            ->where('target_id', $student->id)
            ->where('kategori', NoteKategori::Presensi)
            ->whereDate('created_at', today())
            ->exists();

        if (! $todayNote) {
            Note::create([
                'target_type'   => Student::class,
                'target_id'     => $student->id,
                'kategori'      => NoteKategori::Presensi,
                'isi'           => "Peringatan: siswa tercatat alpha {$streak} sesi berturut-turut. " .
                                   "Perlu tindak lanjut segera dari wali kelas.",
                'tindak_lanjut' => null,
            ]);
        }

        // Update EwsStatus — tambah catatan_count, recalculate level
        if ($ay) {
            $ews = EwsStatus::firstOrCreate(
                ['student_id' => $student->id, 'academic_year_id' => $ay->id],
                ['level' => EwsLevel::Hijau, 'kehadiran_score' => 100, 'karakter_score' => 0]
            );

            $catatanCount = Note::where('target_type', Student::class)
                ->where('target_id', $student->id)
                ->where('kategori', NoteKategori::Presensi)
                ->count();

            $total = StudentAttendance::where('student_id', $student->id)->count();
            $hadir = StudentAttendance::where('student_id', $student->id)->where('status', 'hadir')->count();
            $kehadiranScore = $total > 0 ? round(($hadir / $total) * 100, 2) : 100.0;

            $levelLama = $ews->level?->value ?? 'hijau';
            $levelBaru = $this->resolveLevel($ews->karakter_score, $kehadiranScore, $catatanCount);

            $ews->update([
                'catatan_count'      => $catatanCount,
                'kehadiran_score'    => $kehadiranScore,
                'level'              => $levelBaru,
                'last_calculated_at' => now(),
            ]);

            // Notifikasi wali kelas: alpha alert + eskalasi EWS jika level naik
            $student->loadMissing(['schoolClass', 'user']);
            $waliId = $student->schoolClass?->wali_kelas_id;
            if ($waliId) {
                $wali = \App\Models\User::find($waliId);
                if ($wali) {
                    $wali->notify(new AlphaAlertNotification($student, $streak));

                    $levelOrder = ['hijau' => 0, 'kuning' => 1, 'oranye' => 2, 'merah' => 3];
                    $naik = ($levelOrder[$levelBaru->value] ?? 0) > ($levelOrder[$levelLama] ?? 0);
                    if ($naik && in_array($levelBaru->value, ['kuning', 'oranye', 'merah'])) {
                        $wali->notify(new EwsEscalationNotification($student, $levelLama, $levelBaru->value));
                    }
                }
            }
        }
    }

    private function resolveLevel(int $karakter, float $kehadiran, int $catatan): EwsLevel
    {
        $w = ($kehadiran < 80 ? 1 : 0)
           + ($karakter  < 0  ? 1 : 0)
           + ($catatan   >= 3 ? 1 : 0);

        return match (true) {
            $w >= 3  => EwsLevel::Merah,
            $w === 2 => EwsLevel::Oranye,
            $w === 1 => EwsLevel::Kuning,
            default  => EwsLevel::Hijau,
        };
    }
}
