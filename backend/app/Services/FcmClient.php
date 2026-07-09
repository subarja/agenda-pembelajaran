<?php

namespace App\Services;

use App\Models\FcmSetting;
use Google\Auth\Credentials\ServiceAccountCredentials;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Pengirim Firebase Cloud Messaging lewat HTTP v1 API.
 *
 * Sengaja TIDAK memakai kreait/firebase-php. Kelas ini cuma butuh dua hal: token OAuth2
 * dari service account, dan satu POST JSON. `google/auth` (yang menyediakan token itu)
 * sudah lebih dulu ikut terpasang sebagai dependensi google/apiclient — dipakai modul
 * Google Calendar — jadi FCM berjalan TANPA menambah satu pun paket Composer baru.
 * Itu penting: deploy ke cPanel dilakukan tanpa terminal, lewat vendor.zip yang di-commit,
 * sehingga setiap dependensi baru berarti satu artefak besar yang harus dibangun ulang.
 */
class FcmClient
{
    private const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

    /** Balasan FCM yang berarti token itu mati permanen dan harus dibuang dari DB. */
    private const DEAD_TOKEN_ERRORS = ['UNREGISTERED', 'INVALID_ARGUMENT', 'SENDER_ID_MISMATCH', 'NOT_FOUND'];

    public function __construct(private readonly FcmSetting $setting) {}

    public static function fromSettings(): self
    {
        return new self(FcmSetting::instance());
    }

    public function isEnabled(): bool
    {
        return $this->setting->aktif && $this->setting->isServerConfigured();
    }

    /**
     * Kirim satu payload ke banyak token.
     *
     * FCM HTTP v1 tidak punya endpoint multicast (endpoint batch lama sudah dimatikan
     * Google), jadi satu token = satu request. Dikirim paralel per 50 request supaya
     * wali kelas dengan 3–4 perangkat tidak menjadi 4x latensi berurutan.
     *
     * @return array{sent:int, failed:int, pruned:string[]} `pruned` = token mati yang sudah dihapus.
     */
    public function send(array $tokens, array $payload): array
    {
        $tokens = array_values(array_unique(array_filter($tokens)));

        if (! $this->isEnabled() || $tokens === []) {
            return ['sent' => 0, 'failed' => 0, 'pruned' => []];
        }

        try {
            $accessToken = $this->accessToken();
        } catch (\Throwable $e) {
            // Service account salah/dicabut. Notifikasi database sudah tersimpan lebih
            // dulu oleh channel 'database', jadi pengguna tidak kehilangan informasi —
            // cukup catat dan menyerah, jangan lempar ke atas dan menggagalkan job.
            report($e);

            return ['sent' => 0, 'failed' => count($tokens), 'pruned' => []];
        }

        $url    = "https://fcm.googleapis.com/v1/projects/{$this->setting->project_id}/messages:send";
        $sent   = 0;
        $failed = 0;
        $pruned = [];

        foreach (array_chunk($tokens, 50) as $chunk) {
            $responses = Http::pool(fn ($pool) => array_map(
                fn (string $token) => $pool
                    ->withToken($accessToken)
                    ->timeout(10)
                    ->post($url, ['message' => $this->buildMessage($token, $payload)]),
                $chunk,
            ));

            foreach ($responses as $i => $response) {
                $token = $chunk[$i];

                if ($response instanceof \Throwable) {
                    $failed++;
                    report($response);

                    continue;
                }

                if ($response->successful()) {
                    $sent++;

                    continue;
                }

                $failed++;

                if ($this->isDeadToken($response->json())) {
                    $pruned[] = $token;
                } else {
                    Log::warning('Push FCM gagal', ['status' => $response->status(), 'body' => $response->body()]);
                }
            }
        }

        return ['sent' => $sent, 'failed' => $failed, 'pruned' => $pruned];
    }

    /**
     * Pesan DATA-ONLY, tanpa blok `notification`.
     *
     * Kalau blok `notification` disertakan, browser menampilkan notifikasinya SENDIRI
     * *dan* `onBackgroundMessage` di service worker ikut jalan — pengguna melihat dua
     * notifikasi kembar untuk satu kejadian. Data-only membuat service worker jadi
     * satu-satunya yang menampilkan, sekaligus memberi kita kendali penuh atas ikon,
     * tag (menggabungkan notifikasi sejenis), dan tujuan klik.
     *
     * Seluruh nilai di `data` WAJIB string — FCM v1 menolak angka/boolean/null di sini.
     */
    private function buildMessage(string $token, array $payload): array
    {
        $data = [
            'type'  => (string) ($payload['type'] ?? 'info'),
            'title' => (string) ($payload['title'] ?? 'Agenda Pembelajaran'),
            'body'  => (string) ($payload['body'] ?? ''),
            'url'   => (string) ($payload['url'] ?? '/'),
        ];

        return [
            'token'   => $token,
            'data'    => $data,
            'webpush' => [
                'headers' => [
                    'Urgency' => 'high',
                    // Notifikasi ini terikat waktu (EWS, alpha hari ini). Kalau HP guru
                    // mati lebih dari sehari, menyampaikannya kemudian cuma membingungkan.
                    'TTL'     => '86400',
                ],
            ],
            'android' => ['priority' => 'high'],
        ];
    }

    private function isDeadToken(?array $body): bool
    {
        $status = $body['error']['status'] ?? null;
        $reason = $body['error']['details'][0]['errorCode'] ?? null;

        return in_array($status, self::DEAD_TOKEN_ERRORS, true)
            || in_array($reason, self::DEAD_TOKEN_ERRORS, true);
    }

    /**
     * Token OAuth2 berlaku 1 jam; di-cache 55 menit supaya tidak ada round-trip tanda
     * tangan JWT ke Google di setiap push. Kunci cache mengandung sidik jari kredensial,
     * jadi begitu admin mengganti service account, token lama otomatis tidak terpakai.
     */
    private function accessToken(): string
    {
        $credentials = $this->setting->credentials();

        if (! $credentials) {
            throw new \RuntimeException('Service account Firebase belum diisi atau bukan JSON yang valid.');
        }

        $fingerprint = substr(hash('sha256', $credentials['client_email'].$credentials['private_key']), 0, 16);

        return Cache::remember("fcm:access_token:{$fingerprint}", 3300, function () use ($credentials) {
            $token = (new ServiceAccountCredentials(self::SCOPE, $credentials))->fetchAuthToken();

            if (empty($token['access_token'])) {
                throw new \RuntimeException('Google tidak mengembalikan access_token untuk service account ini.');
            }

            return $token['access_token'];
        });
    }
}
