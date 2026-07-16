<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Regresi audit 2026-07-17: POST /admin/classes tanpa academic_year_id / wali_kelas_id
 * (dua-duanya opsional) sempat 500 "Undefined array key" karena aturan `nullable` TIDAK
 * menambahkan key ke $validated saat field absen dari body. Harus 201.
 */
class ClassAdminStoreTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        AcademicYear::create([
            'tahun' => '2026/2027', 'semester' => Semester::Ganjil,
            'tanggal_mulai' => '2026-07-14', 'tanggal_selesai' => '2026-12-20', 'aktif' => true,
        ]);
    }

    public function test_buat_kelas_tanpa_field_opsional_tidak_500(): void
    {
        $admin = User::create(['nama' => 'Admin', 'email' => 'admin@t.sch.id', 'password' => 'secret123', 'role' => UserRole::Admin]);
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/admin/classes', [
            'tingkat' => 'XII', 'jurusan' => 'Rekayasa Perangkat Lunak', 'rombel' => 'Z',
        ])->assertCreated();

        $this->assertDatabaseHas('classes', ['jurusan' => 'Rekayasa Perangkat Lunak', 'rombel' => 'Z']);
    }

    public function test_non_admin_tidak_boleh_buat_kelas(): void
    {
        $siswa = User::create(['nama' => 'Siswa', 'email' => 'siswa@t.sch.id', 'password' => 'secret123', 'role' => UserRole::Siswa]);
        Sanctum::actingAs($siswa);

        $this->postJson('/api/v1/admin/classes', [
            'tingkat' => 'XII', 'jurusan' => 'RPL', 'rombel' => 'Z',
        ])->assertForbidden();
    }
}
