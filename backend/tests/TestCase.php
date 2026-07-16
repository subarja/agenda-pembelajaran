<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    /** Satu-satunya database yang boleh disentuh test. RefreshDatabase menghapus isinya. */
    private const TEST_DATABASE = 'agenda_test';

    /**
     * Paksa koneksi test ke database uji, di level KONFIGURASI — bukan lewat variabel
     * lingkungan.
     *
     * `<env>` di phpunit.xml tidak bisa diandalkan untuk ini, bahkan dengan force="true":
     * PHPUnit menulis ke putenv()/$_ENV, sedangkan Env repository Laravel membaca $_SERVER
     * lebih dulu — dan docker-compose menaruh DB_DATABASE=agenda_db persis di sana. Efeknya
     * `php artisan test` menjalankan migrate:fresh pada database produksi lokal dan
     * menghapus seluruh data guru & siswa (terjadi 2026-07-08, lalu terulang 2026-07-09).
     *
     * refreshApplication() dipanggil parent::setUp() SEBELUM setUpTraits(), jadi
     * RefreshDatabase sudah melihat konfigurasi yang benar saat ia mulai bekerja.
     */
    protected function refreshApplication(): void
    {
        parent::refreshApplication();

        config(['database.connections.'.config('database.default').'.database' => self::TEST_DATABASE]);

        // Buang koneksi yang sudah terlanjur terbuka ke database lama, kalau ada.
        DB::purge(config('database.default'));
    }

    /**
     * Palang terakhir sebelum RefreshDatabase menjalankan migrate:fresh.
     *
     * Satu baris konfigurasi yang bisa hilang saat merge tidak layak menjadi satu-satunya
     * yang berdiri antara `php artisan test` dan kehilangan data. Pemeriksaan ini GAGAL
     * KERAS, bukan menghapus.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $database = DB::connection()->getDatabaseName();

        if ($database !== self::TEST_DATABASE) {
            throw new RuntimeException(
                "Test dihentikan: koneksi mengarah ke database '{$database}', bukan '".self::TEST_DATABASE."'. ".
                'RefreshDatabase akan MENGHAPUS SELURUH ISI database itu. '.
                'Pastikan database uji sudah dibuat: CREATE DATABASE '.self::TEST_DATABASE.';'
            );
        }

        // Cache statis per-request hidup melewati batas test dalam satu proses PHPUnit —
        // data test sebelumnya bisa bocor ke test berikutnya. Reset terpusat di sini
        // supaya tiap test class tidak wajib ingat mem-flush sendiri.
        \App\Support\BellSchedule::flush();
        \App\Support\PklMode::flush();
        \App\Support\KokurikulerMode::flush();
        \App\Support\TanggalTagihan::flush();
    }
}
