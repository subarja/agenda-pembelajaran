<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Process;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Tools Deploy & Maintenance di panel admin — jalur deploy tanpa Terminal/SSH.
 * Fokus keamanan: migrasi didahului backup, ada preflight (pending) & verify.
 */
class DeployToolsTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::create([
            'nama' => 'Admin Deploy', 'email' => 'admindeploy@test.sch.id',
            'password' => 'secret123', 'role' => UserRole::Admin,
        ]);
    }

    public function test_status_menyertakan_info_migrasi_pending(): void
    {
        Sanctum::actingAs($this->admin());

        $this->getJson('/api/v1/admin/deploy-tools/status')
            ->assertOk()
            ->assertJsonStructure(['data' => ['migrations' => ['applied_count', 'pending_count', 'pending'], 'backup_supported']]);
    }

    public function test_verify_mengembalikan_cek_kesehatan(): void
    {
        Sanctum::actingAs($this->admin());

        $res = $this->postJson('/api/v1/admin/deploy-tools/verify')
            ->assertOk()
            ->assertJsonStructure(['data' => ['ok', 'checks' => [['nama', 'ok']], 'migrations']])
            ->json('data');

        // Setelah RefreshDatabase semua migrasi terterap → cek "0 pending" harus lolos.
        $migCheck = collect($res['checks'])->firstWhere('nama', 'Semua migrasi diterapkan (0 pending)');
        $this->assertTrue($migCheck['ok']);
    }

    public function test_migrate_dengan_skip_backup_dilewati_backup(): void
    {
        Sanctum::actingAs($this->admin());

        $log = $this->postJson('/api/v1/admin/deploy-tools/migrate', ['skip_backup' => true])
            ->assertOk()
            ->json('log');

        $this->assertTrue(collect($log)->contains(fn ($l) => str_contains($l, 'DILEWATI')));
    }

    public function test_migrate_pakai_fallback_php_saat_mysqldump_gagal(): void
    {
        Sanctum::actingAs($this->admin());

        // Simulasikan binary mysqldump GAGAL/absen → DatabaseDumper jatuh ke dump
        // PHP-native (via PDO), backup TETAP terbuat, dan migrasi lanjut (tidak 422).
        Process::fake(['*' => Process::result(exitCode: 1, errorOutput: 'mysqldump tak tersedia (uji)')]);

        $log = $this->postJson('/api/v1/admin/deploy-tools/migrate')
            ->assertOk()
            ->json('log');

        $this->assertTrue(
            collect($log)->contains(fn ($l) => str_contains($l, 'Backup dibuat (php)')),
            'Backup harus tetap dibuat via fallback PHP. Log: '.json_encode($log)
        );
    }

    public function test_schema_diff_in_sync_saat_snapshot_cocok_dengan_db(): void
    {
        Sanctum::actingAs($this->admin());

        // Snapshot committed (database/schema-snapshot.json) dibuat dari migrasi yang
        // sama dengan DB uji → harus in_sync (tidak ada kolom/tabel yang hilang).
        $this->postJson('/api/v1/admin/deploy-tools/schema-diff')
            ->assertOk()
            ->assertJsonStructure(['data' => ['in_sync', 'missing_tables', 'missing_columns', 'extra_columns', 'type_diff']])
            ->assertJsonPath('data.missing_columns', [])
            ->assertJsonPath('data.missing_tables', []);
    }

    public function test_non_admin_ditolak(): void
    {
        $wakasek = User::create([
            'nama' => 'Wakasek', 'email' => 'wk@test.sch.id',
            'password' => 'secret123', 'role' => UserRole::Wakasek,
        ]);
        Sanctum::actingAs($wakasek);

        $this->postJson('/api/v1/admin/deploy-tools/verify')->assertForbidden();
        $this->postJson('/api/v1/admin/deploy-tools/schema-diff')->assertForbidden();
        $this->getJson('/api/v1/admin/deploy-tools/status')->assertForbidden();
    }
}
