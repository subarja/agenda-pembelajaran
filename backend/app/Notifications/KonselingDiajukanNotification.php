<?php

namespace App\Notifications;

use App\Models\Student;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

// GK8: wali kelas ajukan konseling ke BK — lonceng in-app + push, bukan email (beda
// dari EwsEscalationNotification yang memang butuh urgensi email untuk level oranye/merah).
class KonselingDiajukanNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly Student $student,
        private readonly string $waliKelasNama,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'fcm'];
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'type'         => 'konseling_diajukan',
            'title'        => "Pengajuan Konseling: {$this->student->user->nama}",
            'body'         => "{$this->waliKelasNama} mengajukan konseling untuk {$this->student->user->nama}.",
            'student_id'   => $this->student->uuid,
            'student_nama' => $this->student->user->nama,
            'url'          => "/siswa/{$this->student->uuid}/rekap",
        ];
    }
}
