<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Models\AcademicYear;
use App\Models\Subject;
use App\Support\DatabaseDumper;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Dump PHP-native (fallback saat mysqldump tak tersedia). Regresi utama: kolom
 * GENERATED tidak boleh masuk INSERT — kalau masuk, restore gagal
 * (ERROR 3105: value specified for generated column).
 */
class DatabaseDumpTest extends TestCase
{
    use RefreshDatabase;

    private function invokePhpDump(string $path): void
    {
        $m = new \ReflectionMethod(DatabaseDumper::class, 'phpMysqlDump');
        $m->setAccessible(true);
        $m->invoke(null, $path);
    }

    public function test_dump_php_menyalin_struktur_dan_data(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'dumptest_');
        $this->invokePhpDump($path);
        $sql = file_get_contents($path);
        @unlink($path);

        $this->assertStringContainsString('CREATE TABLE `users`', $sql);
        $this->assertStringContainsString('SET FOREIGN_KEY_CHECKS=0', $sql);
        $this->assertStringContainsString('SET FOREIGN_KEY_CHECKS=1', $sql);
    }

    public function test_kolom_generated_tidak_masuk_insert(): void
    {
        $ay = AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-01-05', 'tanggal_selesai' => '2026-06-19', 'aktif' => true,
        ]);
        $subject = Subject::create(['kode' => 'MTK', 'nama' => 'Matematika', 'aktif' => true]);

        DB::table('learning_objectives')->insert([
            'uuid' => (string) Str::uuid(),
            'subject_id' => $subject->id,
            'fase' => 'F',
            'academic_year_id' => $ay->id,
            'kode' => 'TP.1',
            'deskripsi' => 'Memahami konsep uji',
            'semester' => 'ganjil',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $path = tempnam(sys_get_temp_dir(), 'dumptest_');
        $this->invokePhpDump($path);
        $sql = file_get_contents($path);
        @unlink($path);

        // Baris data harus ada,
        $this->assertStringContainsString('TP.1', $sql);
        // tapi daftar kolom INSERT-nya TIDAK boleh memuat kolom generated.
        preg_match('/INSERT INTO `learning_objectives` \(([^)]*)\) VALUES/', $sql, $m);
        $this->assertNotEmpty($m, 'INSERT learning_objectives tidak ditemukan');
        $this->assertStringNotContainsString('active_unique_flag', $m[1]);
    }
}
