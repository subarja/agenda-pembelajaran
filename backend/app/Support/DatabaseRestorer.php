<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;

/**
 * Memulihkan database dari file dump, TANPA bergantung mutlak pada binary
 * `mysql`/`pg_restore`. Coba binary dulu; kalau gagal / tak tersedia (mis. shared
 * hosting yang menonaktifkannya, atau container dev), jatuh ke restore PHP-native:
 * pecah file .sql jadi pernyataan lalu jalankan via PDO.
 *
 * Pasangan dari [[DatabaseDumper]]. MySQL/MariaDB punya fallback PHP; PostgreSQL
 * hanya pg_restore (produksi proyek ini MySQL).
 */
class DatabaseRestorer
{
    /**
     * Pulihkan dari $path. Return metode: 'mysql' | 'pg_restore' | 'php'.
     *
     * @throws \RuntimeException bila semua metode gagal.
     */
    public static function fromFile(string $path): string
    {
        $driver = config('database.default');
        $conf = config("database.connections.{$driver}");

        if (self::binaryRestore($driver, $conf, $path)) {
            return $driver === 'pgsql' ? 'pg_restore' : 'mysql';
        }

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            self::phpMysqlRestore($path);

            return 'php';
        }

        throw new \RuntimeException(
            "Restore {$driver} butuh pg_restore yang tak tersedia, dan fallback PHP hanya untuk MySQL."
        );
    }

    private static function binaryRestore(string $driver, array $conf, string $path): bool
    {
        try {
            $result = $driver === 'pgsql'
                ? Process::env(['PGPASSWORD' => $conf['password']])->timeout(600)->run([
                    'pg_restore', '--clean', '--if-exists',
                    '-h', $conf['host'], '-p', (string) $conf['port'],
                    '-U', $conf['username'], '-d', $conf['database'], $path,
                ])
                : Process::env(['MYSQL_PWD' => $conf['password']])->timeout(600)
                    ->input(fopen($path, 'r'))
                    ->run([
                        'mysql', '--protocol=tcp', '-h', $conf['host'],
                        '-P', (string) $conf['port'], '-u', $conf['username'], $conf['database'],
                    ]);
        } catch (\Throwable $e) {
            return false; // binary tak ada / proc_open diblokir
        }

        return $result->successful();
    }

    /** Jalankan file .sql via PDO: pecah jadi pernyataan lalu exec satu per satu. */
    private static function phpMysqlRestore(string $path): void
    {
        @set_time_limit(0);

        $sql = file_get_contents($path);
        if ($sql === false) {
            throw new \RuntimeException("Tak bisa membaca file backup di {$path}");
        }

        $pdo = DB::connection()->getPdo();
        foreach (self::splitStatements($sql) as $stmt) {
            try {
                $pdo->exec($stmt);
            } catch (\Throwable $e) {
                throw new \RuntimeException(
                    'Gagal menjalankan pernyataan SQL: '.$e->getMessage().' — '.mb_substr($stmt, 0, 120)
                );
            }
        }
    }

    /**
     * Pecah teks SQL jadi pernyataan, sadar-string & sadar-komentar sehingga `;` di
     * dalam nilai string tidak salah memecah. Membuang komentar baris (dash-dash, hash)
     * dan komentar blok (slash-star ... star-slash), termasuk conditional comment MySQL
     * — itu sekadar pengaturan sesi, aman diabaikan karena koneksi Laravel sudah utf8mb4.
     *
     * @return array<int, string>
     */
    public static function splitStatements(string $sql): array
    {
        $out = [];
        $buf = '';
        $len = strlen($sql);
        $i = 0;
        $q = null; // kutip aktif: ' " `

        while ($i < $len) {
            $ch = $sql[$i];

            if ($q !== null) {
                $buf .= $ch;
                if ($ch === '\\' && $q !== '`' && $i + 1 < $len) { // escape (bukan di backtick)
                    $buf .= $sql[$i + 1];
                    $i += 2;

                    continue;
                }
                if ($ch === $q) {
                    if ($i + 1 < $len && $sql[$i + 1] === $q) { // kutip ganda '' → tetap dalam string
                        $buf .= $sql[$i + 1];
                        $i += 2;

                        continue;
                    }
                    $q = null;
                }
                $i++;

                continue;
            }

            // Komentar baris: `-- ` atau `#`
            if ($ch === '#'
                || ($ch === '-' && $i + 1 < $len && $sql[$i + 1] === '-'
                    && ($i + 2 >= $len || in_array($sql[$i + 2], [' ', "\t", "\n", "\r"], true)))) {
                while ($i < $len && $sql[$i] !== "\n") {
                    $i++;
                }

                continue;
            }

            // Komentar blok /* ... */
            if ($ch === '/' && $i + 1 < $len && $sql[$i + 1] === '*') {
                $i += 2;
                while ($i + 1 < $len && ! ($sql[$i] === '*' && $sql[$i + 1] === '/')) {
                    $i++;
                }
                $i += 2;

                continue;
            }

            if ($ch === "'" || $ch === '"' || $ch === '`') {
                $q = $ch;
                $buf .= $ch;
                $i++;

                continue;
            }

            if ($ch === ';') {
                $s = trim($buf);
                if ($s !== '') {
                    $out[] = $s;
                }
                $buf = '';
                $i++;

                continue;
            }

            $buf .= $ch;
            $i++;
        }

        $s = trim($buf);
        if ($s !== '') {
            $out[] = $s;
        }

        return $out;
    }
}
