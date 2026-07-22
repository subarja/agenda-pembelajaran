<?php

namespace App\Notifications;

use App\Models\IzinKesiangan;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/** Ke guru piket: ada siswa mengajukan izin masuk kesiangan (perlu verifikasi). */
class IzinKesianganDiajukanNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly IzinKesiangan $izin) {}

    public function via(object $notifiable): array
    {
        return ['database', 'fcm'];
    }

    public function toDatabase(object $notifiable): array
    {
        $nama = $this->izin->student?->user?->nama ?? 'Seorang siswa';

        return [
            'type' => 'izin_kesiangan_diajukan',
            'title' => 'Pengajuan izin kesiangan',
            'body' => "{$nama} kesiangan {$this->izin->terlambat_menit} menit, menunggu verifikasi.",
            'url' => '/piket',
        ];
    }
}
