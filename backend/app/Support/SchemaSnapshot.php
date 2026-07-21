<?php

namespace App\Support;

use Illuminate\Support\Facades\Schema;

/**
 * Potret skema database (tabel + kolom) yang bisa dibandingkan antar lingkungan.
 * Dipakai untuk mendeteksi apakah skema SERVER tertinggal dari LOKAL — mis. kolom
 * yang seharusnya dibuat migrasi tapi belum ada di server (migrate belum jalan).
 *
 * Alur: `php artisan schema:snapshot` di LOKAL menulis database/schema-snapshot.json
 * (skema referensi = lokal). File itu ikut git → sampai ke server. Endpoint
 * deploy-tools/schema-diff membandingkan skema LIVE server vs snapshot itu.
 */
class SchemaSnapshot
{
    /**
     * Potret skema aktif: [ tabel => [ kolom => ['type' => ..., 'nullable' => bool] ] ].
     * Terurut agar diff & file JSON stabil (tidak berubah tanpa perubahan skema nyata).
     */
    public static function capture(): array
    {
        $tables = Schema::getTableListing();
        sort($tables);

        $out = [];
        foreach ($tables as $table) {
            $cols = [];
            foreach (Schema::getColumns($table) as $c) {
                $cols[$c['name']] = [
                    'type' => $c['type'] ?? ($c['type_name'] ?? ''),
                    'nullable' => (bool) ($c['nullable'] ?? false),
                ];
            }
            ksort($cols);
            $out[$table] = $cols;
        }

        return $out;
    }

    /**
     * Bandingkan snapshot (lokal, referensi) dengan skema live (server).
     * `inSync` hanya memperhitungkan tabel/kolom yang HILANG atau BERLEBIH — beda TIPE
     * dilaporkan terpisah (bisa sekadar beda render antar versi MySQL, bukan drift nyata).
     *
     * @param  array  $snapshot  hasil capture() dari lokal
     * @param  array  $live  hasil capture() di server
     */
    public static function diff(array $snapshot, array $live): array
    {
        $snapTables = array_keys($snapshot);
        $liveTables = array_keys($live);

        $missingTables = array_values(array_diff($snapTables, $liveTables)); // di lokal, belum di server
        $extraTables = array_values(array_diff($liveTables, $snapTables)); // hanya di server

        $missingColumns = [];
        $extraColumns = [];
        $typeDiff = [];

        foreach (array_intersect($snapTables, $liveTables) as $table) {
            $sc = $snapshot[$table];
            $lc = $live[$table];

            foreach (array_diff(array_keys($sc), array_keys($lc)) as $col) {
                $missingColumns[] = "{$table}.{$col}";
            }
            foreach (array_diff(array_keys($lc), array_keys($sc)) as $col) {
                $extraColumns[] = "{$table}.{$col}";
            }
            foreach (array_intersect(array_keys($sc), array_keys($lc)) as $col) {
                $st = (string) ($sc[$col]['type'] ?? '');
                $lt = (string) ($lc[$col]['type'] ?? '');
                if ($st !== $lt) {
                    $typeDiff[] = "{$table}.{$col}: lokal={$st}, server={$lt}";
                }
            }
        }

        sort($missingColumns);
        sort($extraColumns);
        sort($typeDiff);

        $inSync = ! $missingTables && ! $extraTables && ! $missingColumns && ! $extraColumns;

        return [
            'in_sync' => $inSync,
            'missing_tables' => $missingTables,
            'extra_tables' => $extraTables,
            'missing_columns' => $missingColumns,
            'extra_columns' => $extraColumns,
            'type_diff' => $typeDiff,
        ];
    }
}
