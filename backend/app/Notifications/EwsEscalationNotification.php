<?php

namespace App\Notifications;

use App\Models\EwsStatus;
use App\Models\Student;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class EwsEscalationNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly Student $student,
        private readonly string $levelLama,
        private readonly string $levelBaru,
    ) {}

    public function via(object $notifiable): array
    {
        // Kirim email hanya untuk eskalasi ke oranye/merah
        $viaEmail = in_array($this->levelBaru, ['oranye', 'merah']);
        return $viaEmail ? ['database', 'mail'] : ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        $levelLabel = ['hijau' => 'Hijau', 'kuning' => 'Kuning', 'oranye' => 'Oranye', 'merah' => 'Merah'];
        return [
            'type'         => 'ews_escalation',
            'title'        => "EWS Naik Level: {$this->student->user->nama}",
            'body'         => "Status EWS {$this->student->user->nama} berubah dari {$levelLabel[$this->levelLama]} menjadi {$levelLabel[$this->levelBaru]}.",
            'student_id'   => $this->student->uuid,
            'student_nama' => $this->student->user->nama,
            'level_lama'   => $this->levelLama,
            'level_baru'   => $this->levelBaru,
            'kelas'        => $this->student->schoolClass
                ? $this->student->schoolClass->tingkat->value . ' '
                  . $this->student->schoolClass->jurusan . ' - '
                  . $this->student->schoolClass->rombel
                : null,
            'url'          => "/siswa/{$this->student->uuid}/rekap",
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $levelLabel = ['kuning' => 'Kuning ⚠️', 'oranye' => 'Oranye 🟠', 'merah' => 'Merah 🔴'];
        $levelBaru  = $levelLabel[$this->levelBaru] ?? strtoupper($this->levelBaru);
        $frontendUrl = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')), '/');

        return (new MailMessage)
            ->subject("EWS {$levelBaru} — {$this->student->user->nama}")
            ->greeting("Yth. {$notifiable->nama},")
            ->line("Status Early Warning System (EWS) salah satu siswa binaan Anda **berubah**.")
            ->line("**Nama Siswa:** {$this->student->user->nama}")
            ->line("**Kelas:** " . ($this->student->schoolClass ? $this->student->schoolClass->tingkat->value . ' ' . $this->student->schoolClass->jurusan . ' - ' . $this->student->schoolClass->rombel : '—'))
            ->line("**Status sebelumnya:** " . ucfirst($this->levelLama))
            ->line("**Status sekarang:** **{$levelBaru}**")
            ->action('Lihat Rekap Lengkap Siswa', "{$frontendUrl}/siswa/{$this->student->uuid}/rekap")
            ->line('Harap segera tindaklanjuti sesuai rekomendasi yang tersedia di sistem.')
            ->salutation('Salam,')
            ->salutation('Sistem Agenda Pembelajaran — SMKN 2 Cimahi');
    }
}
