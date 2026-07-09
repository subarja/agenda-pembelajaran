<?php

namespace App\Notifications;

use App\Models\SubstitutionRequest;
use App\Notifications\Concerns\DescribesSubstitution;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/** Ke guru pengganti: ada yang meminta Anda menggantikan. */
class SubstitutionRequestedNotification extends Notification implements ShouldQueue
{
    use DescribesSubstitution, Queueable;

    public function __construct(private readonly SubstitutionRequest $req) {}

    public function via(object $notifiable): array
    {
        return ['database', 'fcm'];
    }

    public function toDatabase(object $notifiable): array
    {
        $pengaju = $this->req->requester->user?->nama ?? 'Seorang guru';

        return [
            'type'       => 'inval_diajukan',
            'title'      => "Permintaan mengajar pengganti dari {$pengaju}",
            'body'       => $this->ringkasanSesi($this->req).' — alasan: '.$this->req->alasan,
            'inval_id'   => $this->req->uuid,
            'url'        => $this->url(),
        ];
    }
}
