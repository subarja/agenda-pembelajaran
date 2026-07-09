<?php

namespace App\Notifications;

use App\Models\SubstitutionRequest;
use App\Notifications\Concerns\DescribesSubstitution;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/** Ke pengaju: ditolak. Kewajiban agenda tetap miliknya — sebut itu terang-terangan. */
class SubstitutionRejectedNotification extends Notification implements ShouldQueue
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

        return [
            'type'     => 'inval_ditolak',
            'title'    => "{$pengganti} menolak permintaan inval Anda",
            'body'     => ($this->req->alasan_penolakan ?: 'Tanpa alasan')
                          .' — sesi ini tetap kewajiban Anda. Ajukan ke guru lain bila perlu.',
            'inval_id' => $this->req->uuid,
            'url'      => $this->url(),
        ];
    }
}
