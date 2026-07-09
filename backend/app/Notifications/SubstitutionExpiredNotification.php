<?php

namespace App\Notifications;

use App\Models\SubstitutionRequest;
use App\Notifications\Concerns\DescribesSubstitution;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * Ke KEDUA guru: tidak dijawab sampai sesinya lewat.
 *
 * Dikirim ke pengaju maupun calon pengganti dengan sengaja — pengaju perlu tahu bahwa
 * kewajibannya tidak pernah berpindah, dan calon pengganti perlu tahu bahwa ia melewatkan
 * permintaan. Tanpa ini, keduanya sama-sama mengira pihak lain yang mengurus.
 */
class SubstitutionExpiredNotification extends Notification implements ShouldQueue
{
    use DescribesSubstitution, Queueable;

    public function __construct(private readonly SubstitutionRequest $req) {}

    public function via(object $notifiable): array
    {
        return ['database', 'fcm'];
    }

    public function toDatabase(object $notifiable): array
    {
        $pengaju     = $this->req->requester->user?->nama ?? '—';
        $pengganti   = $this->req->substitute->user?->nama ?? '—';
        $untukPengaju = $notifiable->id === $this->req->requester->user?->id;

        return [
            'type'  => 'inval_kedaluwarsa',
            'title' => 'Permintaan inval kedaluwarsa tanpa jawaban',
            'body'  => $untukPengaju
                ? "{$pengganti} tidak menjawab sampai sesi lewat. Agenda sesi ini tetap kewajiban Anda: ".$this->ringkasanSesi($this->req)
                : "Anda tidak menjawab permintaan dari {$pengaju} sampai sesinya lewat: ".$this->ringkasanSesi($this->req),
            'inval_id' => $this->req->uuid,
            'url'      => $this->url(),
        ];
    }
}
