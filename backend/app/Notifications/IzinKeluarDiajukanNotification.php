<?php

namespace App\Notifications;

use App\Models\IzinKeluar;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/** Ke guru piket: ada pengajuan izin keluar baru yang perlu diproses. */
class IzinKeluarDiajukanNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly IzinKeluar $izin) {}

    public function via(object $notifiable): array
    {
        return ['database', 'fcm'];
    }

    public function toDatabase(object $notifiable): array
    {
        $nama = $this->izin->student?->user?->nama ?? 'Seorang siswa';

        return [
            'type' => 'izin_keluar_diajukan',
            'title' => 'Pengajuan izin keluar',
            'body' => "{$nama} mengajukan izin keluar: {$this->izin->keperluan}",
            'url' => '/piket',
        ];
    }
}
