<?php

namespace Tests\Unit;

use App\Support\DatabaseRestorer;
use PHPUnit\Framework\TestCase;

/**
 * Pemecah pernyataan SQL — bagian paling rawan restore PHP-native. Harus tahan
 * terhadap `;` di dalam string, kutip ganda/escape, dan berbagai komentar.
 */
class DatabaseRestorerTest extends TestCase
{
    public function test_titik_koma_di_dalam_string_tidak_memecah(): void
    {
        $stmts = DatabaseRestorer::splitStatements("INSERT INTO t VALUES ('a; b'); SELECT 1;");

        $this->assertCount(2, $stmts);
        $this->assertStringContainsString("'a; b'", $stmts[0]);
        $this->assertSame('SELECT 1', $stmts[1]);
    }

    public function test_kutip_ganda_dan_escape_backslash(): void
    {
        // 'Ani''s; x'  → kutip ganda; 'c\'; d' → escape backslash. Keduanya SATU string.
        $stmts = DatabaseRestorer::splitStatements("INSERT INTO t VALUES ('Ani''s; x'),('c\\'; d');");

        $this->assertCount(1, $stmts, 'semicolon di dalam string tak boleh memecah pernyataan');
    }

    public function test_komentar_dibuang(): void
    {
        $sql = "-- komentar baris\nSELECT 1;\n/* komentar blok */\nSELECT 2;\n# hash\nSELECT 3;";

        $this->assertSame(['SELECT 1', 'SELECT 2', 'SELECT 3'], DatabaseRestorer::splitStatements($sql));
    }

    public function test_dash_dalam_ekspresi_bukan_komentar(): void
    {
        // "1 - -2" bukan komentar (butuh `-- ` diikuti spasi/EOL).
        $stmts = DatabaseRestorer::splitStatements('SELECT 1 - -2;');

        $this->assertSame(['SELECT 1 - -2'], $stmts);
    }

    public function test_pernyataan_terakhir_tanpa_titik_koma_tetap_terambil(): void
    {
        $this->assertSame(['SELECT 1', 'SELECT 2'], DatabaseRestorer::splitStatements("SELECT 1;\nSELECT 2"));
    }
}
