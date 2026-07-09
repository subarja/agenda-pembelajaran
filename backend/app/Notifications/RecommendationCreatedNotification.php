<?php

namespace App\Notifications;

use App\Models\Student;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class RecommendationCreatedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly Student $student,
        private readonly string $rekomendasi,
        private readonly int $akumulasi,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'fcm'];
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'type'         => 'rekomendasi',
            'title'        => "Rekomendasi Baru: {$this->student->user->nama}",
            'body'         => $this->rekomendasi,
            'student_id'   => $this->student->uuid,
            'student_nama' => $this->student->user->nama,
            'akumulasi'    => $this->akumulasi,
            'kelas'        => $this->student->schoolClass
                ? $this->student->schoolClass->tingkat->value . ' '
                  . $this->student->schoolClass->jurusan . ' - '
                  . $this->student->schoolClass->rombel
                : null,
            'url'          => "/siswa/{$this->student->uuid}/rekap",
        ];
    }
}
