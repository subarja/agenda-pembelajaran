<?php

namespace Tests\Feature;

use App\Support\DatabaseRestorer;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Restore PHP-native end-to-end pada tabel PROBE sendiri (aman — tak menyentuh tabel
 * aplikasi maupun data asli). Membuktikan DDL + INSERT + kutip rumit jalan via PDO.
 * Sengaja TANPA RefreshDatabase: kita kelola tabel probe sendiri.
 */
class DatabaseRestoreTest extends TestCase
{
    protected function tearDown(): void
    {
        DB::statement('DROP TABLE IF EXISTS zzz_restore_probe');
        parent::tearDown();
    }

    public function test_restore_php_menjalankan_ddl_insert_dan_kutip_rumit(): void
    {
        DB::statement('DROP TABLE IF EXISTS zzz_restore_probe');

        $dump = "SET FOREIGN_KEY_CHECKS=0;\n"
            ."DROP TABLE IF EXISTS `zzz_restore_probe`;\n"
            ."CREATE TABLE `zzz_restore_probe` (`id` int NOT NULL, `nama` varchar(100));\n"
            ."INSERT INTO `zzz_restore_probe` (`id`,`nama`) VALUES (1,'Budi; ada koma'),(2,'Ani''s data');\n"
            ."SET FOREIGN_KEY_CHECKS=1;\n";

        $path = tempnam(sys_get_temp_dir(), 'restore_');
        file_put_contents($path, $dump);

        $m = new \ReflectionMethod(DatabaseRestorer::class, 'phpMysqlRestore');
        $m->setAccessible(true);
        $m->invoke(null, $path);
        @unlink($path);

        $rows = DB::table('zzz_restore_probe')->orderBy('id')->get();

        $this->assertCount(2, $rows);
        $this->assertSame('Budi; ada koma', $rows[0]->nama); // `;` dalam string aman
        $this->assertSame("Ani's data", $rows[1]->nama);      // kutip ganda '' → '
    }
}
