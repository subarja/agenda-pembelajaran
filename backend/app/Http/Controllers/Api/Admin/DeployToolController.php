<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Support\DatabaseDumper;
use App\Support\SchemaSnapshot;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class DeployToolController extends Controller
{
    // Seeder yang boleh dijalankan lewat panel ini — sengaja TIDAK termasuk
    // DatabaseSeeder/FullDemoSeeder (isinya data fiktif ratusan siswa/guru), supaya
    // admin tidak bisa tidak sengaja menimpa/menambah data sekolah asli dengan data demo.
    private const ALLOWED_SEEDERS = ['AdminOnlySeeder', 'CharacterSeeder', 'KokurikulerDimensionSeeder'];

    // GET /admin/deploy-tools/status — info file zip & folder + migrasi PENDING (preflight),
    // supaya admin tahu perubahan DB apa yang akan diterapkan SEBELUM menekan Deploy/Migrate.
    public function status(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        return response()->json([
            'data' => [
                'vendor' => $this->zipStatus(base_path('vendor.zip'), base_path('vendor')),
                'dist' => $this->zipStatus($this->distZipPath(), $this->distDirPath()),
                'allowed_seeders' => self::ALLOWED_SEEDERS,
                'migrations' => $this->migrationsInfo(),
                'backup_supported' => $this->backupSupported(),
            ],
        ]);
    }

    // POST /admin/deploy-tools/migrate — backup DULU, baru migrate --force (aditif).
    // Body opsional: { skip_backup: bool } — hanya bila admin sudah backup manual.
    public function migrate(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $log = [];
        if (! $this->guardBackup($request->boolean('skip_backup'), $log, $err)) {
            return response()->json(['log' => $log, 'message' => $err], 422);
        }
        $log = array_merge($log, $this->runArtisan('migrate', ['--force' => true]));

        return response()->json(['log' => $log]);
    }

    // POST /admin/deploy-tools/verify — cek kesehatan PASCA-deploy (read-only).
    // Cek utama & future-proof: migrasi 0 pending (menjamin SEMUA kolom/tabel — termasuk
    // yang akan datang — sudah diterapkan). Ditambah cek APP_KEY, koneksi DB, symlink storage.
    public function verify(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $mig = $this->migrationsInfo();
        $checks = [
            ['nama' => 'Semua migrasi diterapkan (0 pending)', 'ok' => $mig['pending_count'] === 0,
                'detail' => $mig['pending_count'].' pending'],
            ['nama' => 'APP_KEY terpasang', 'ok' => (bool) config('app.key'),
                'detail' => config('app.key') ? 'ada' : 'KOSONG — data terenkripsi tak terbaca'],
            ['nama' => 'Database terhubung', 'ok' => $this->databaseReachable()],
            ['nama' => 'Bukan mode maintenance', 'ok' => ! app()->isDownForMaintenance()],
            ['nama' => 'Symlink storage (public/storage)', 'ok' => file_exists(public_path('storage')),
                'detail' => file_exists(public_path('storage')) ? 'ada' : 'hilang — foto/dokumen tak tampil'],
        ];
        $ok = ! collect($checks)->contains(fn ($c) => $c['ok'] === false);

        return response()->json(['data' => ['ok' => $ok, 'checks' => $checks, 'migrations' => $mig]]);
    }

    // POST /admin/deploy-tools/schema-diff — bandingkan skema LIVE (server) vs snapshot
    // LOKAL (database/schema-snapshot.json, dibuat `php artisan schema:snapshot` + commit).
    // Mendeteksi kolom/tabel yang HILANG di server (mis. migrasi belum jalan) atau berlebih.
    public function schemaDiff(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $path = database_path('schema-snapshot.json');
        if (! is_file($path)) {
            return response()->json([
                'message' => 'Snapshot skema belum ada. Di LOKAL jalankan `php artisan schema:snapshot`, '
                    .'commit database/schema-snapshot.json, lalu pull ke server.',
            ], 422);
        }

        $snapshot = json_decode((string) file_get_contents($path), true)['tables'] ?? [];
        $diff = SchemaSnapshot::diff($snapshot, SchemaSnapshot::capture());

        return response()->json(['data' => $diff]);
    }

    // POST /admin/deploy-tools/build-vendor — hapus vendor/ lama, extract vendor.zip
    public function buildVendor(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $log = [];
        $this->swapDirectoryFromZip(base_path('vendor'), base_path('vendor.zip'), $log);

        return response()->json(['log' => $log]);
    }

    // POST /admin/deploy-tools/build-dist — hapus frontend/dist/ lama, extract dist.zip
    public function buildDist(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $log = [];
        $this->swapDirectoryFromZip($this->distDirPath(), $this->distZipPath(), $log);

        return response()->json(['log' => $log]);
    }

    // POST /admin/deploy-tools/seed — body: { class: 'AdminOnlySeeder' | 'CharacterSeeder' }
    public function seed(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $data = $request->validate([
            'class' => ['required', 'string', 'in:'.implode(',', self::ALLOWED_SEEDERS)],
        ]);

        $log = $this->runArtisan('db:seed', [
            '--class' => 'Database\\Seeders\\'.$data['class'],
            '--force' => true,
        ]);

        return response()->json(['log' => $log]);
    }

    // POST /admin/deploy-tools/deploy — backup DULU → migrate + seeder master + extract
    // dist.zip + clear cache. Body opsional: { skip_backup: bool } (backup manual).
    public function deploy(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $log = [];
        if (! $this->guardBackup($request->boolean('skip_backup'), $log, $err)) {
            return response()->json(['log' => $log, 'message' => $err], 422);
        }

        $log = array_merge($log, $this->runArtisan('migrate', ['--force' => true]));
        // Seeder master yang idempoten ikut dijalankan otomatis — updateOrCreate by kode,
        // aman diulang di produksi, dan memastikan 8 Dimensi Profil Lulusan selalu terisi.
        $log = array_merge($log, $this->runArtisan('db:seed', [
            '--class' => 'KokurikulerDimensionSeeder', '--force' => true,
        ]));
        $this->swapDirectoryFromZip($this->distDirPath(), $this->distZipPath(), $log);
        $log = array_merge($log, $this->runArtisan('optimize:clear'));

        return response()->json(['log' => $log]);
    }

    // ── Keamanan data: backup sebelum migrasi ────────────────────────────────

    /**
     * Jaring pengaman: backup database SEBELUM skema disentuh. Kalau backup gagal dan
     * admin tidak menyatakan sudah backup manual, migrasi DIBATALKAN (return false).
     */
    private function guardBackup(bool $skip, array &$log, ?string &$err): bool
    {
        $err = null;

        if ($skip) {
            $log[] = '⚠ Backup otomatis DILEWATI (admin menyatakan sudah backup manual).';

            return true;
        }

        if ($this->backupDatabase($log) !== null) {
            return true;
        }

        $err = 'Backup database otomatis GAGAL — migrasi DIBATALKAN demi keamanan data. '
             .'Unduh backup manual lewat menu "Backup Database" dulu, lalu ulangi sambil mencentang '
             .'"Saya sudah backup manual".';

        return false;
    }

    /** Dump DB ke storage/app/backups/predeploy-*.{sql,dump}. Return path atau null bila gagal. */
    private function backupDatabase(array &$log): ?string
    {
        $driver = config('database.default');
        if (! in_array($driver, ['mysql', 'mariadb', 'pgsql'], true)) {
            $log[] = "Lewati backup: driver '{$driver}' tidak didukung dump otomatis.";

            return null;
        }

        $dir = storage_path('app/backups');
        if (! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $ext = DatabaseDumper::extension();
        $path = $dir.'/predeploy-'.now()->format('Y-m-d_His').'.'.$ext;

        try {
            // Coba mysqldump; kalau gagal, otomatis fallback dump PHP-native (via PDO).
            $metode = DatabaseDumper::toFile($path);
        } catch (\Throwable $e) {
            $log[] = 'GAGAL backup: '.$e->getMessage();
            if (is_file($path)) {
                @unlink($path);
            }

            return null;
        }

        $log[] = "Backup dibuat ({$metode}): ".basename($path).' ('.number_format(filesize($path) / 1024).' KB)';
        $this->pruneBackups($dir, $ext);

        return $path;
    }

    /** Simpan 20 backup predeploy terbaru, hapus sisanya. */
    private function pruneBackups(string $dir, string $ext): void
    {
        $files = glob($dir.'/predeploy-*.'.$ext) ?: [];
        usort($files, fn ($a, $b) => filemtime($b) <=> filemtime($a));
        foreach (array_slice($files, 20) as $old) {
            @unlink($old);
        }
    }

    private function backupSupported(): bool
    {
        return in_array(config('database.default'), ['mysql', 'mariadb', 'pgsql'], true);
    }

    /** Info migrasi: jumlah yang sudah jalan + daftar & jumlah yang PENDING. */
    private function migrationsInfo(): array
    {
        $migrator = app('migrator');
        $repo = $migrator->getRepository();
        $ran = $repo->repositoryExists() ? $repo->getRan() : [];
        $files = $migrator->getMigrationFiles(database_path('migrations'));
        $pending = array_keys(array_diff_key($files, array_flip($ran)));
        sort($pending);

        return [
            'applied_count' => count($ran),
            'pending_count' => count($pending),
            'pending' => array_values($pending),
        ];
    }

    private function databaseReachable(): bool
    {
        try {
            DB::select('select 1');

            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }

    // Fitur ini bisa hapus vendor/dist, migrate, dan seed — hanya Admin (bukan Wakasek,
    // walau route group-nya dipakai bareng), sama pola dgn DatabaseBackupController.
    private function ensureAdmin(Request $request): void
    {
        abort_unless($request->user()->role === UserRole::Admin, 403, 'Hanya admin yang dapat mengakses Tools Deploy & Maintenance.');
    }

    private function distZipPath(): string
    {
        return config('deploy.frontend_path').'/dist.zip';
    }

    private function distDirPath(): string
    {
        return config('deploy.frontend_path').'/dist';
    }

    private function runArtisan(string $command, array $params = []): array
    {
        $log = ["\$ php artisan {$command}"];

        try {
            Artisan::call($command, $params);
            $output = trim(Artisan::output());
            if ($output !== '') {
                $log[] = $output;
            }
        } catch (\Throwable $e) {
            $log[] = 'GAGAL: '.$e->getMessage();
        }

        return $log;
    }

    // Extract ke folder sementara dulu, baru hapus folder lama + pindahkan hasil extract
    // ke tempatnya — supaya kalau proses extract gagal di tengah jalan, folder lama
    // (vendor/dist yang masih dipakai request lain) tidak ikut hilang/rusak.
    private function swapDirectoryFromZip(string $targetDir, string $zipPath, array &$log): void
    {
        $name = basename($targetDir);
        $log[] = "Ganti folder '{$name}' dari ".basename($zipPath);

        if (! is_file($zipPath)) {
            $log[] = "GAGAL: file zip tidak ditemukan di {$zipPath}";

            return;
        }

        $parent = dirname($targetDir);
        $tempDir = $parent.'/.'.$name.'-new-'.uniqid();

        $zip = new \ZipArchive;
        if ($zip->open($zipPath) !== true) {
            $log[] = "GAGAL: tidak bisa membuka {$zipPath}";

            return;
        }
        $zip->extractTo($tempDir);
        $zip->close();

        $extractedRoot = $tempDir.'/'.$name;
        if (! is_dir($extractedRoot)) {
            File::deleteDirectory($tempDir);
            $log[] = "GAGAL: struktur zip tidak sesuai — tidak ada folder '{$name}/' di dalam {$zipPath}";

            return;
        }

        if (is_dir($targetDir)) {
            File::deleteDirectory($targetDir);
        }
        rename($extractedRoot, $targetDir);
        File::deleteDirectory($tempDir);

        $log[] = "Berhasil — '{$name}' diganti dari ".date('Y-m-d H:i:s', filemtime($zipPath));
    }

    private function zipStatus(string $zipPath, string $dirPath): array
    {
        return [
            'zip_exists' => is_file($zipPath),
            'zip_updated_at' => is_file($zipPath) ? date('Y-m-d H:i:s', filemtime($zipPath)) : null,
            'dir_exists' => is_dir($dirPath),
        ];
    }
}
