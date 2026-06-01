<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPasswordNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly string $token,
        private readonly string $frontendUrl,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $resetUrl = "{$this->frontendUrl}/reset-password?token={$this->token}&email=" . urlencode($notifiable->email);

        return (new MailMessage)
            ->subject('Reset Password — Agenda Pembelajaran SMKN 2 Cimahi')
            ->greeting("Halo, {$notifiable->nama}!")
            ->line('Kami menerima permintaan reset password untuk akun Anda.')
            ->action('Reset Password Sekarang', $resetUrl)
            ->line('Link ini berlaku selama **60 menit**.')
            ->line('Jika Anda tidak meminta reset password, abaikan email ini.')
            ->salutation('Salam,')
            ->salutation('Tim Aplikasi Agenda Pembelajaran — SMKN 2 Cimahi');
    }
}
