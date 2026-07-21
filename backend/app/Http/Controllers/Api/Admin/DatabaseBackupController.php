<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Support\DatabaseDumper;
use App\Support\DatabaseRestorer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class DatabaseBackupController extends Controller
{
    private const RESTORE_CONFIRMATION = 'PULIHKAN';

    // Driver database yang didukung fitur backup/restore ini, beserta ekstensi filenya.
    private const SUPPORTED_DRIVERS = [
        'pgsql' => 'dump',
        'mysql' => 'sql',
    ];

    // GET /admin/backup/download — unduh backup penuh database
    public function download(Request $request): BinaryFileResponse
    {
        abort_unless($request->user()->role === UserRole::Admin, 403, 'Hanya admin yang dapat mengakses fitur backup.');

        $extension = $this->dumpExtension();
        $path = tempnam(sys_get_temp_dir(), 'backup_');
        $this->runDump($path);

        $filename = 'backup-agenda-'.now()->format('Y-m-d_His').'.'.$extension;

        return response()->download($path, $filename, [
            'Content-Type' => 'application/octet-stream',
        ])->deleteFileAfterSend(true);
    }

    // POST /admin/backup/restore — pulihkan database dari file backup
    public function restore(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === UserRole::Admin, 403, 'Hanya admin yang dapat mengakses fitur restore.');

        $extension = $this->dumpExtension();

        $data = $request->validate([
            'file' => ['required', 'file', 'max:512000'], // 500 MB
            'confirmation' => ['required', 'string'],
        ]);

        if (strtolower($request->file('file')->getClientOriginalExtension()) !== $extension) {
            return response()->json([
                'message' => "File harus berupa hasil backup (.{$extension}) dari fitur ini.",
            ], 422);
        }

        if ($data['confirmation'] !== self::RESTORE_CONFIRMATION) {
            return response()->json([
                'message' => 'Konfirmasi tidak sesuai. Ketik "'.self::RESTORE_CONFIRMATION.'" persis untuk melanjutkan.',
            ], 422);
        }

        // Backup pengaman dari data saat ini SEBELUM restore dijalankan
        $safetyDir = storage_path('app/backups');
        if (! is_dir($safetyDir)) {
            mkdir($safetyDir, 0755, true);
        }
        $safetyPath = $safetyDir.'/safety-'.now()->format('Y-m-d_His').'.'.$extension;
        $this->runDump($safetyPath);

        $uploadedPath = $request->file('file')->getRealPath();

        Log::warning('Database restore dijalankan', [
            'user_id' => $request->user()->id,
            'user_email' => $request->user()->email,
            'safety_backup' => $safetyPath,
        ]);

        // Coba binary mysql/pg_restore; kalau tak tersedia, otomatis jatuh ke restore
        // PHP-native via PDO (pola sama dengan backup — lihat DatabaseRestorer).
        try {
            DatabaseRestorer::fromFile($uploadedPath);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Restore gagal. Backup pengaman tetap tersimpan di server.',
                'error' => $e->getMessage(),
            ], 500);
        }

        return response()->json([
            'message' => 'Restore berhasil. Backup pengaman data sebelumnya tersimpan di server.',
        ]);
    }

    private function dumpExtension(): string
    {
        return self::SUPPORTED_DRIVERS[config('database.default')] ?? 'dump';
    }

    private function runDump(string $outputPath): void
    {
        // Coba mysqldump/pg_dump; kalau tak tersedia (mis. dev container atau shared
        // hosting yang menonaktifkannya), otomatis jatuh ke dump PHP-native via PDO.
        try {
            DatabaseDumper::toFile($outputPath);
        } catch (\Throwable $e) {
            abort(500, 'Gagal membuat backup: '.$e->getMessage());
        }
    }
}
