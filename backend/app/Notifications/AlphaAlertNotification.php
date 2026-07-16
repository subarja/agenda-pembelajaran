<?php

namespace App\Notifications;

use App\Models\Student;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class AlphaAlertNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly Student $student,
        private readonly int $streak,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'fcm'];
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'type'       => 'alpha_alert',
            'title'      => 'Peringatan Alpha Berturut-turut',
            'body'       => "{$this->student->user->nama} tercatat alpha {$this->streak} sesi berturut-turut.",
            'student_id' => $this->student->uuid,
            'student_nama' => $this->student->user->nama,
            'streak'     => $this->streak,
            'kelas'      => $this->student->schoolClass
                ? $this->student->schoolClass->label()
                : null,
            'url'        => "/siswa/{$this->student->uuid}/rekap",
        ];
    }
}
