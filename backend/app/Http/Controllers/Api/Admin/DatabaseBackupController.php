<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class DatabaseBackupController extends Controller
{
    private const RESTORE_CONFIRMATION = 'PULIHKAN';

    // GET /admin/backup/download — unduh backup penuh (format custom pg_dump, -Fc)
    public function download(Request $request): BinaryFileResponse
    {
        abort_unless($request->user()->role === UserRole::Admin, 403, 'Hanya admin yang dapat mengakses fitur backup.');

        $path = tempnam(sys_get_temp_dir(), 'backup_');
        $this->runDump($path);

        $filename = 'backup-agenda-' . now()->format('Y-m-d_His') . '.dump';

        return response()->download($path, $filename, [
            'Content-Type' => 'application/octet-stream',
        ])->deleteFileAfterSend(true);
    }

    // POST /admin/backup/restore — pulihkan database dari file backup .dump
    public function restore(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === UserRole::Admin, 403, 'Hanya admin yang dapat mengakses fitur restore.');

        $data = $request->validate([
            'file'         => ['required', 'file', 'max:512000'], // 500 MB
            'confirmation' => ['required', 'string'],
        ]);

        if (strtolower($request->file('file')->getClientOriginalExtension()) !== 'dump') {
            return response()->json([
                'message' => 'File harus berupa hasil backup (.dump) dari fitur ini.',
            ], 422);
        }

        if ($data['confirmation'] !== self::RESTORE_CONFIRMATION) {
            return response()->json([
                'message' => 'Konfirmasi tidak sesuai. Ketik "' . self::RESTORE_CONFIRMATION . '" persis untuk melanjutkan.',
            ], 422);
        }

        // Backup pengaman dari data saat ini SEBELUM restore dijalankan
        $safetyDir  = storage_path('app/backups');
        if (! is_dir($safetyDir)) mkdir($safetyDir, 0755, true);
        $safetyPath = $safetyDir . '/safety-' . now()->format('Y-m-d_His') . '.dump';
        $this->runDump($safetyPath);

        $uploadedPath = $request->file('file')->getRealPath();

        Log::warning('Database restore dijalankan', [
            'user_id'      => $request->user()->id,
            'user_email'   => $request->user()->email,
            'safety_backup'=> $safetyPath,
        ]);

        $config = config('database.connections.pgsql');

        $result = Process::env(['PGPASSWORD' => $config['password']])
            ->timeout(600)
            ->run([
                'pg_restore',
                '--clean', '--if-exists',
                '-h', $config['host'],
                '-p', (string) $config['port'],
                '-U', $config['username'],
                '-d', $config['database'],
                $uploadedPath,
            ]);

        if ($result->failed()) {
            return response()->json([
                'message' => 'Restore gagal. Backup pengaman tetap tersimpan di server.',
                'error'   => $result->errorOutput(),
            ], 500);
        }

        return response()->json([
            'message' => 'Restore berhasil. Backup pengaman data sebelumnya tersimpan di server.',
        ]);
    }

    private function runDump(string $outputPath): void
    {
        $config = config('database.connections.pgsql');

        $result = Process::env(['PGPASSWORD' => $config['password']])
            ->timeout(300)
            ->run([
                'pg_dump',
                '-h', $config['host'],
                '-p', (string) $config['port'],
                '-U', $config['username'],
                '-Fc',
                '-f', $outputPath,
                $config['database'],
            ]);

        abort_unless($result->successful(), 500, 'Gagal membuat backup: ' . $result->errorOutput());
    }
}
