<?php

namespace App\Providers;

use App\Models\R2Setting;
use App\Notifications\Channels\FcmChannel;
use App\Services\FcmClient;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Dibaca dari DB (bukan .env) agar admin bisa mengganti kredensial Firebase dari
        // Admin Panel — pola yang sama dengan R2Setting. Diikat sebagai closure supaya
        // query-nya baru jalan saat notifikasi benar-benar dikirim, bukan saat boot.
        $this->app->bind(FcmClient::class, fn () => FcmClient::fromSettings());
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Pencarian case-insensitive yang portable di MySQL maupun PostgreSQL
        // (ILIKE hanya ada di Postgres, kolasi MySQL tidak selalu case-insensitive) DAN
        // otomatis membungkus wildcard `%...%` (pencarian substring).
        //
        // PENTING: dinamai `whereLikeCi` (BUKAN `whereLike`) dengan sengaja. Laravel 11
        // menambahkan `whereLike` NATIVE pada Query Builder, dan method native SELALU
        // menang atas macro (macro cuma dipakai utk method yang belum ada). Jadi bila
        // macro ini dinamai `whereLike`, ia tak pernah terpakai dan yang jalan adalah
        // native `whereLike` — yang TIDAK menambah `%` maupun LOWER() → pencarian jadi
        // cocok-persis dan "ketik apa pun tidak muncul apa-apa". Nama unik mencegah itu.
        QueryBuilder::macro('whereLikeCi', function (string $column, ?string $value, string $boolean = 'and') {
            /** @var QueryBuilder $this */
            return $this->whereRaw('LOWER('.$column.') LIKE ?', ['%'.mb_strtolower(trim((string) $value)).'%'], $boolean);
        });

        QueryBuilder::macro('orWhereLikeCi', function (string $column, ?string $value) {
            /** @var QueryBuilder $this */
            return $this->whereLikeCi($column, $value, 'or');
        });

        $this->configurePublicDiskFromR2Setting();

        // Mendaftarkan channel 'fcm' sehingga notifikasi cukup menulis 'fcm' di via().
        // Notification::resolved() dipakai (bukan Notification::extend() langsung) agar
        // channel manager tidak ikut dibangun di setiap request yang tidak mengirim
        // notifikasi sama sekali — yaitu hampir semuanya.
        Notification::resolved(function ($channelManager) {
            $channelManager->extend('fcm', fn ($app) => $app->make(FcmChannel::class));
        });
    }

    // Kalau admin sudah aktifkan R2 lewat Admin Panel, disk 'public' (dipakai ~30 tempat
    // via Storage::disk('public')) dialihkan ke R2 di sini — tidak perlu ubah .env ataupun
    // kode lain sama sekali. Default tetap disk lokal (config/filesystems.php) kalau R2
    // belum di-setup/di-nonaktifkan, termasuk di semua environment dev lokal.
    //
    // PENTING: ini jalan di SETIAP request (boot() provider) — TERMASUK saat `composer
    // install` build Docker image (post-autoload-dump menjalankan `artisan package:
    // discover` yang ikut boot() semua provider, padahal DB belum tentu bisa diakses
    // sama sekali di tahap build). SELURUH isi method — termasuk Schema::hasTable() itu
    // sendiri — WAJIB di dalam try/catch; DB unreachable/tabel belum ada/APP_KEY beda
    // (DecryptException) semuanya harus jatuh balik diam-diam ke disk lokal, tidak boleh
    // ada satupun exception di sini yang lolos ke atas dan mematikan boot aplikasi/build.
    private function configurePublicDiskFromR2Setting(): void
    {
        try {
            if (! Schema::hasTable('r2_settings')) {
                return;
            }

            $r2 = R2Setting::query()->first();
            if (! $r2 || ! $r2->aktif || ! $r2->isConfigured()) {
                return;
            }

            config(['filesystems.disks.public' => $r2->diskConfig()]);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
