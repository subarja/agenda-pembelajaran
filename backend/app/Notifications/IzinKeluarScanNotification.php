<?php

namespace App\Notifications;

use App\Models\IzinKeluar;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/** Ke guru piket: siswa terpindai keluar/masuk oleh sekuriti (real-time). */
class IzinKeluarScanNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly IzinKeluar $izin, private readonly string $arah) {}

    public function via(object $notifiable): array
    {
        return ['database', 'fcm'];
    }

    public function toDatabase(object $notifiable): array
    {
        $nama = $this->izin->student?->user?->nama ?? 'Seorang siswa';
        $arahLabel = $this->arah === 'keluar' ? 'keluar sekolah' : 'kembali ke sekolah';

        return [
            'type' => 'izin_keluar_scan',
            'title' => 'Siswa '.($this->arah === 'keluar' ? 'keluar' : 'kembali'),
            'body' => "{$nama} terpindai {$arahLabel}.",
            'url' => '/piket',
        ];
    }
}
