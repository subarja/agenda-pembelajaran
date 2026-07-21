<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Schema;

/**
 * Membuat dump database yang bisa dipulihkan, TANPA bergantung mutlak pada binary
 * `mysqldump`/`pg_dump`. Coba binary dulu (cepat & lengkap); kalau gagal / tak tersedia
 * (mis. container dev MariaDB ke MySQL 8, atau shared hosting yang menonaktifkan
 * mysqldump), jatuh ke dump PHP-native lewat PDO yang sudah tersambung.
 *
 * MySQL/MariaDB: punya fallback PHP. PostgreSQL: hanya pg_dump (produksi proyek ini MySQL).
 */
class DatabaseDumper
{
    /**
     * Tulis dump ke $path. Return metode yang dipakai: 'mysqldump' | 'pg_dump' | 'php'.
     *
     * @throws \RuntimeException bila semua metode gagal.
     */
    public static function toFile(string $path): string
    {
        $driver = config('database.default');
        $conf = config("database.connections.{$driver}");

        // 1) Coba binary native (cepat, paling faithful).
        if (self::binaryDump($driver, $conf, $path)) {
            return $driver === 'pgsql' ? 'pg_dump' : 'mysqldump';
        }

        // 2) Fallback PHP — hanya MySQL/MariaDB.
        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            self::phpMysqlDump($path);

            return 'php';
        }

        throw new \RuntimeException(
            "Backup gagal: {$driver} butuh pg_dump yang tak tersedia, dan fallback PHP hanya untuk MySQL."
        );
    }

    /** Ekstensi file dump per driver (sesuai fitur restore lama). */
    public static function extension(): string
    {
        return config('database.default') === 'pgsql' ? 'dump' : 'sql';
    }

    private static function binaryDump(string $driver, array $conf, string $path): bool
    {
        try {
            $result = $driver === 'pgsql'
                ? Process::env(['PGPASSWORD' => $conf['password']])->timeout(600)->run([
                    'pg_dump', '-h', $conf['host'], '-p', (string) $conf['port'],
                    '-U', $conf['username'], '-Fc', '-f', $path, $conf['database'],
                ])
                : Process::env(['MYSQL_PWD' => $conf['password']])->timeout(600)->run([
                    'mysqldump', '--protocol=tcp', '-h', $conf['host'], '-P', (string) $conf['port'],
                    '-u', $conf['username'], '--single-transaction', '--add-drop-table',
                    '--no-tablespaces', '--result-file='.$path, $conf['database'],
                ]);
        } catch (\Throwable $e) {
            return false; // binary tak ada / proc_open diblokir
        }

        if ($result->successful() && is_file($path) && filesize($path) > 0) {
            return true;
        }

        // Bersihkan file parsial supaya fallback menulis dari nol.
        if (is_file($path)) {
            @unlink($path);
        }

        return false;
    }

    /**
     * Dump MySQL murni PHP: SHOW CREATE TABLE + INSERT bertahap via cursor (hemat memori).
     * FOREIGN_KEY_CHECKS dimatikan agar urutan DROP/CREATE tak masalah saat restore.
     */
    private static function phpMysqlDump(string $path): void
    {
        @set_time_limit(0);

        $pdo = DB::connection()->getPdo();
        $fh = fopen($path, 'w');
        if ($fh === false) {
            throw new \RuntimeException("Tak bisa menulis file backup di {$path}");
        }

        fwrite($fh, '-- Backup PHP-native '.now()->toDateTimeString()." (Agenda Pembelajaran)\n");
        fwrite($fh, "SET FOREIGN_KEY_CHECKS=0;\nSET NAMES utf8mb4;\n\n");

        foreach (Schema::getTableListing() as $table) {
            $create = DB::selectOne("SHOW CREATE TABLE `{$table}`");
            $ddl = $create->{'Create Table'} ?? null;
            if ($ddl === null) {
                continue; // lewati view / objek non-tabel
            }

            fwrite($fh, "DROP TABLE IF EXISTS `{$table}`;\n{$ddl};\n\n");

            // Kolom GENERATED (mis. learning_objectives.active_unique_flag — emulasi
            // partial unique index) TIDAK boleh masuk INSERT; nilainya dihitung DB.
            $generated = [];
            foreach (Schema::getColumns($table) as $c) {
                if (! empty($c['generation'])) {
                    $generated[$c['name']] = true;
                }
            }

            $cols = null;
            $rows = [];
            foreach (DB::table($table)->cursor() as $row) {
                $arr = (array) $row;
                foreach ($generated as $g => $_) {
                    unset($arr[$g]);
                }
                if ($cols === null) {
                    $cols = '`'.implode('`,`', array_keys($arr)).'`';
                }
                $vals = array_map(
                    fn ($v) => $v === null ? 'NULL' : $pdo->quote((string) $v),
                    array_values($arr)
                );
                $rows[] = '('.implode(',', $vals).')';

                if (count($rows) >= 200) {
                    self::flushInsert($fh, $table, $cols, $rows);
                    $rows = [];
                }
            }
            if ($rows) {
                self::flushInsert($fh, $table, $cols, $rows);
            }
            fwrite($fh, "\n");
        }

        fwrite($fh, "SET FOREIGN_KEY_CHECKS=1;\n");
        fclose($fh);
    }

    private static function flushInsert($fh, string $table, ?string $cols, array $rows): void
    {
        if ($cols === null || ! $rows) {
            return;
        }
        fwrite($fh, "INSERT INTO `{$table}` ({$cols}) VALUES\n".implode(",\n", $rows).";\n");
    }
}
