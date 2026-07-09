<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;

class DeployToolController extends Controller
{
    // Seeder yang boleh dijalankan lewat panel ini — sengaja TIDAK termasuk
    // DatabaseSeeder/FullDemoSeeder (isinya data fiktif ratusan siswa/guru), supaya
    // admin tidak bisa tidak sengaja menimpa/menambah data sekolah asli dengan data demo.
    private const ALLOWED_SEEDERS = ['AdminOnlySeeder', 'CharacterSeeder'];

    // GET /admin/deploy-tools/status — info file zip & folder saat ini, buat ditampilkan di UI
    public function status(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        return response()->json([
            'data' => [
                'vendor' => $this->zipStatus(base_path('vendor.zip'), base_path('vendor')),
                'dist' => $this->zipStatus($this->distZipPath(), $this->distDirPath()),
                'allowed_seeders' => self::ALLOWED_SEEDERS,
            ],
        ]);
    }

    // POST /admin/deploy-tools/migrate
    public function migrate(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        return response()->json(['log' => $this->runArtisan('migrate', ['--force' => true])]);
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

    // POST /admin/deploy-tools/deploy — migrate + hapus&extract dist.zip + clear semua cache
    public function deploy(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $log = $this->runArtisan('migrate', ['--force' => true]);
        $this->swapDirectoryFromZip($this->distDirPath(), $this->distZipPath(), $log);
        $log = array_merge($log, $this->runArtisan('optimize:clear'));

        return response()->json(['log' => $log]);
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
