<?php

namespace App\Notifications;

use App\Models\IzinKeluar;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/** Ke guru piket: siswa sudah keluar tapi BELUM kembali melewati batas berlaku izin. */
class IzinKeluarTerlambatNotification extends Notification implements ShouldQueue
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
        $batas = $this->izin->berlaku_sampai?->format('H:i');

        return [
            'type' => 'izin_keluar_terlambat',
            'title' => 'Siswa belum kembali',
            'body' => "{$nama} melewati batas kembali (pukul {$batas}) dan belum terpindai masuk.",
            'url' => '/piket/izin-keluar',
        ];
    }
}
