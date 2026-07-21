<?php

namespace App\Console\Commands;

use App\Support\SchemaSnapshot;
use Illuminate\Console\Command;

/**
 * Rekam skema DB LOKAL ke database/schema-snapshot.json — file referensi yang ikut
 * git dan dibandingkan dengan skema server (tombol "Bandingkan Skema" / endpoint
 * deploy-tools/schema-diff). Jalankan di lokal setelah menambah/ubah migrasi, lalu commit.
 */
class SchemaSnapshotCommand extends Command
{
    protected $signature = 'schema:snapshot {--path= : Lokasi output (default database/schema-snapshot.json)}';

    protected $description = 'Rekam skema database lokal ke JSON untuk dibandingkan dengan server';

    public function handle(): int
    {
        $path = $this->option('path') ?: database_path('schema-snapshot.json');

        // Tanpa timestamp — supaya file hanya berubah saat SKEMA berubah (bukan tiap run).
        $data = [
            'note' => 'Snapshot skema LOKAL. Regenerasi: php artisan schema:snapshot (lalu commit). Jangan edit manual.',
            'tables' => SchemaSnapshot::capture(),
        ];

        file_put_contents(
            $path,
            json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)."\n"
        );

        $this->info('Snapshot skema ditulis: '.$path.' ('.count($data['tables']).' tabel)');

        return self::SUCCESS;
    }
}
