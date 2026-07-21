<?php

namespace Tests\Unit;

use App\Support\SchemaSnapshot;
use PHPUnit\Framework\TestCase;

/**
 * Logika diff skema — inti deteksi "server tertinggal dari lokal".
 * Murni fungsi (tanpa DB), jadi cepat & deterministik.
 */
class SchemaSnapshotTest extends TestCase
{
    private array $lokal = [
        'students' => [
            'id' => ['type' => 'bigint unsigned', 'nullable' => false],
            'nis' => ['type' => 'varchar(20)', 'nullable' => false],
            'jenis_kelamin' => ['type' => 'varchar(1)', 'nullable' => true],
        ],
        'kokurikuler_projects' => [
            'id' => ['type' => 'bigint unsigned', 'nullable' => false],
            'selesai_pada' => ['type' => 'date', 'nullable' => true],
        ],
    ];

    public function test_identik_berarti_in_sync(): void
    {
        $diff = SchemaSnapshot::diff($this->lokal, $this->lokal);

        $this->assertTrue($diff['in_sync']);
        $this->assertEmpty($diff['missing_columns']);
        $this->assertEmpty($diff['missing_tables']);
    }

    public function test_kolom_hilang_di_server_terdeteksi(): void
    {
        // Server belum punya jenis_kelamin & selesai_pada (migrasi belum jalan).
        $server = $this->lokal;
        unset($server['students']['jenis_kelamin'], $server['kokurikuler_projects']['selesai_pada']);

        $diff = SchemaSnapshot::diff($this->lokal, $server);

        $this->assertFalse($diff['in_sync']);
        $this->assertContains('students.jenis_kelamin', $diff['missing_columns']);
        $this->assertContains('kokurikuler_projects.selesai_pada', $diff['missing_columns']);
    }

    public function test_tabel_hilang_di_server_terdeteksi(): void
    {
        $server = $this->lokal;
        unset($server['kokurikuler_projects']);

        $diff = SchemaSnapshot::diff($this->lokal, $server);

        $this->assertFalse($diff['in_sync']);
        $this->assertContains('kokurikuler_projects', $diff['missing_tables']);
    }

    public function test_kolom_berlebih_di_server_terdeteksi_tapi_tak_ganggu_in_sync_kolom_lokal(): void
    {
        $server = $this->lokal;
        $server['students']['kolom_asing'] = ['type' => 'int', 'nullable' => true];

        $diff = SchemaSnapshot::diff($this->lokal, $server);

        $this->assertContains('students.kolom_asing', $diff['extra_columns']);
        $this->assertFalse($diff['in_sync']); // ada perbedaan → tidak in_sync
    }

    public function test_beda_tipe_dilaporkan_tapi_tidak_menggagalkan_in_sync(): void
    {
        // Beda render tipe antar versi MySQL bukan drift nyata → in_sync tetap true.
        $server = $this->lokal;
        $server['students']['nis']['type'] = 'varchar(30)';

        $diff = SchemaSnapshot::diff($this->lokal, $server);

        $this->assertTrue($diff['in_sync']);
        $this->assertNotEmpty($diff['type_diff']);
        $this->assertStringContainsString('students.nis', $diff['type_diff'][0]);
    }
}
