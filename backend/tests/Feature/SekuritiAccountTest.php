<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Akun SEKURITI (pemindai QR izin keluar) bisa dibuat & dikelola admin lewat Panel
 * Admin › Pengguna — sebelumnya role sekuriti tidak masuk MANAGED_ROLES sehingga tak
 * ada cara membuat akunnya walau halaman /sekuriti/scan sudah ada.
 */
class SekuritiAccountTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-02-09', 'tanggal_selesai' => '2026-06-19', 'aktif' => true,
        ]);
    }

    public function test_admin_bisa_membuat_dan_melihat_akun_sekuriti(): void
    {
        $admin = User::create(['nama' => 'Admin', 'email' => 'admin@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Admin]);
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/admin/users', [
            'nama' => 'Pak Satpam', 'email' => 'satpam@test.sch.id', 'role' => 'sekuriti',
        ])->assertCreated();

        $u = User::where('email', 'satpam@test.sch.id')->first();
        $this->assertSame('sekuriti', $u->role->value);

        // Muncul di daftar pengguna terkelola (Admin/BK/Orang Tua/Sekuriti).
        $this->getJson('/api/v1/admin/users')->assertOk()
            ->assertJsonFragment(['email' => 'satpam@test.sch.id']);
    }
}
