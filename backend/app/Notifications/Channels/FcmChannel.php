<?php

namespace App\Notifications\Channels;

use App\Models\NotificationPreference;
use App\Models\PushSubscription;
use App\Models\User;
use App\Services\FcmClient;
use Illuminate\Notifications\Notification;

/**
 * Channel 'fcm' — mengirim isi notifikasi sebagai push ke seluruh perangkat pengguna.
 *
 * Semua keputusan "boleh dikirim atau tidak" (push dimatikan, jenis di-opt-out, jam
 * tenang, tidak ada perangkat terdaftar, Firebase belum disetel) dikumpulkan DI SINI,
 * bukan disebar ke `via()` masing-masing notifikasi. Alasannya: kelima notifikasi cuma
 * perlu menyatakan "aku layak di-push", dan menambah jenis baru nanti tidak berisiko
 * lupa menyalin salah satu pemeriksaan. Channel 'database' tidak pernah tersentuh
 * aturan-aturan ini — lonceng in-app selalu terisi.
 */
class FcmChannel
{
    public function __construct(private readonly FcmClient $client) {}

    public function send(object $notifiable, Notification $notification): void
    {
        if (! $notifiable instanceof User || ! $this->client->isEnabled()) {
            return;
        }

        // Notifikasi boleh menyediakan toFcm() untuk teks yang lebih ringkas di layar
        // kunci HP; kalau tidak, payload database dipakai apa adanya — bentuknya sudah
        // tepat (punya type/title/body/url).
        $payload = method_exists($notification, 'toFcm')
            ? $notification->toFcm($notifiable)
            : $notification->toDatabase($notifiable);

        $preference = NotificationPreference::for($notifiable);

        if (! $preference->allowsPush($payload['type'] ?? 'info') || $preference->inQuietHours()) {
            return;
        }

        $tokens = $notifiable->pushSubscriptions()->pluck('token')->all();

        if ($tokens === []) {
            return;
        }

        $result = $this->client->send($tokens, $payload);

        // Token yang ditolak permanen (browser di-uninstall, izin dicabut, cache situs
        // dibersihkan) dibuang supaya tidak dicoba lagi selamanya di setiap push.
        if ($result['pruned'] !== []) {
            PushSubscription::whereIn('token', $result['pruned'])->delete();
        }
    }
}
