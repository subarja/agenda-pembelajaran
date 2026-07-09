<?php

namespace App\Notifications;

use App\Models\CharacterManualNote;
use App\Models\Student;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class ManualNoteSubmittedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly CharacterManualNote $note,
        private readonly Student $student,
        private readonly User $guru,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'fcm'];
    }

    public function toDatabase(object $notifiable): array
    {
        $preview = mb_strlen($this->note->catatan) > 80
            ? mb_substr($this->note->catatan, 0, 80) . '…'
            : $this->note->catatan;

        $nilaiText = $this->note->nilai !== null
            ? ' (nilai: ' . ($this->note->nilai > 0 ? '+' : '') . $this->note->nilai . ')'
            : '';

        return [
            'type'       => 'catatan_manual',
            'title'      => "Catatan Manual: {$this->student->user->nama}",
            'body'       => "Guru {$this->guru->nama} mengirim catatan manual{$nilaiText}: {$preview}",
            'student_id' => $this->student->uuid,
            'note_id'    => $this->note->uuid,
            'url'        => '/admin?tab=nilai-manual',
        ];
    }
}
