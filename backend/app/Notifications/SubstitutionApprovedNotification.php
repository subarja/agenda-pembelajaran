<?php

namespace App\Notifications;

use App\Models\SubstitutionRequest;
use App\Notifications\Concerns\DescribesSubstitution;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/** Ke pengaju: permintaan Anda diterima, lengkap dengan cap waktunya. */
class SubstitutionApprovedNotification extends Notification implements ShouldQueue
{
    use DescribesSubstitution, Queueable;

    public function __construct(private readonly SubstitutionRequest $req) {}

    public function via(object $notifiable): array
    {
        return ['database', 'fcm'];
    }

    public function toDatabase(object $notifiable): array
    {
        $pengganti = $this->req->substitute->user?->nama ?? 'Guru pengganti';
        $waktu     = $this->req->responded_at?->timezone(config('app.school_timezone'))->format('d/m/Y H:i');

        return [
            'type'     => 'inval_disetujui',
            'title'    => "{$pengganti} menyetujui permintaan inval Anda",
            // Cap waktu ikut di badan pesan, bukan cuma di halaman — guru sering hanya
            // membaca notifikasinya dan tidak membuka aplikasi.
            'body'     => $this->ringkasanSesi($this->req).($waktu ? " — diterima {$waktu}" : ''),
            'inval_id' => $this->req->uuid,
            'url'      => $this->url(),
        ];
    }
}
