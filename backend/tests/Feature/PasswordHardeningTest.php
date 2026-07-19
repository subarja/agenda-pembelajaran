<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Hardening password default: nilai tidak lagi di-hardcode (wajib dari .env via
 * config accounts.*), respons API tidak membocorkan password, dan akun berpassword
 * sementara dikunci dari seluruh API sampai mengganti passwordnya sendiri.
 */
class PasswordHardeningTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $guru;

    protected function setUp(): void
    {
        parent::setUp();

        AcademicYear::create([
            'tahun' => '2026/2027', 'semester' => Semester::Ganjil,
            'tanggal_mulai' => '2026-07-15', 'tanggal_selesai' => '2026-12-04', 'aktif' => true,
        ]);

        $this->admin = User::create(['nama' => 'Admin Uji', 'email' => 'adminuji@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Admin]);

        $this->guru = User::create(['nama' => 'Guru Uji', 'email' => 'guruuji@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru]);
        Teacher::create(['user_id' => $this->guru->id, 'nip' => '198001012005011001', 'is_bk' => false]);
    }

    public function test_generate_akun_ditolak_bila_password_default_belum_dikonfigurasi(): void
    {
        config(['accounts.default_teacher_password' => null]);
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/v1/admin/generate-accounts?type=guru')
            ->assertStatus(422)
            ->assertJsonFragment(['message' => 'Password default belum diatur. Isi lewat Panel Admin > Pengguna > Password Default, atau DEFAULT_TEACHER_PASSWORD di file .env server, lalu coba lagi.']);
    }

    public function test_password_default_dari_panel_admin_mengalahkan_env(): void
    {
        config(['accounts.default_teacher_password' => 'DariEnv#2026']);
        Sanctum::actingAs($this->admin);

        $this->putJson('/api/v1/admin/password-defaults', ['teacher_password' => 'DariPanel#2026'])->assertOk();
        $this->postJson('/api/v1/admin/generate-accounts?type=guru')->assertOk();

        $this->assertTrue(Hash::check('DariPanel#2026', $this->guru->fresh()->password));
    }

    public function test_endpoint_password_default_tidak_pernah_mengembalikan_nilai_asli(): void
    {
        Sanctum::actingAs($this->admin);
        $this->putJson('/api/v1/admin/password-defaults', ['student_password' => 'RahasiaSiswa#2026'])->assertOk();

        $res = $this->getJson('/api/v1/admin/password-defaults')->assertOk();

        $this->assertStringNotContainsString('RahasiaSiswa#2026', $res->getContent());
        $this->assertSame('panel', $res->json('data.siswa.sumber'));
        $this->assertTrue($res->json('data.siswa.is_set'));
    }

    public function test_password_default_hanya_bisa_diakses_admin(): void
    {
        Sanctum::actingAs($this->guru);

        $this->getJson('/api/v1/admin/password-defaults')->assertForbidden();
        $this->putJson('/api/v1/admin/password-defaults', ['teacher_password' => 'CobaTembus#2026'])->assertForbidden();
    }

    public function test_generate_akun_memakai_config_menandai_wajib_ganti_dan_tidak_membocorkan_password(): void
    {
        config(['accounts.default_teacher_password' => 'RahasiaGuru#2026']);
        Sanctum::actingAs($this->admin);

        $res = $this->postJson('/api/v1/admin/generate-accounts?type=guru')->assertOk();

        $this->assertStringNotContainsString('RahasiaGuru#2026', $res->json('message'));
        $this->assertSame(1, $res->json('count'));

        $guru = $this->guru->fresh();
        $this->assertTrue($guru->must_change_password);
        $this->assertTrue(Hash::check('RahasiaGuru#2026', $guru->password));
    }

    public function test_generate_akun_siswa_memakai_config_terpisah(): void
    {
        $userSiswa = User::create(['nama' => 'Siswa Uji', 'email' => 'siswauji@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Siswa]);
        Student::create(['user_id' => $userSiswa->id, 'nis' => '232410001', 'nisn' => '0071234567']);

        config(['accounts.default_student_password' => 'RahasiaSiswa#2026']);
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/v1/admin/generate-accounts?type=siswa')->assertOk();

        $userSiswa->refresh();
        $this->assertTrue($userSiswa->must_change_password);
        $this->assertTrue(Hash::check('RahasiaSiswa#2026', $userSiswa->password));
    }

    public function test_reset_password_admin_menandai_wajib_ganti(): void
    {
        Sanctum::actingAs($this->admin);

        $this->putJson("/api/v1/admin/users/{$this->guru->uuid}/reset-password", ['password' => 'sementara99'])
            ->assertOk();

        $this->assertTrue($this->guru->fresh()->must_change_password);
    }

    public function test_akun_wajib_ganti_password_diblokir_dari_endpoint_lain(): void
    {
        $this->guru->update(['must_change_password' => true]);
        Sanctum::actingAs($this->guru->fresh());

        $this->getJson('/api/v1/agendas/perlu-diisi')
            ->assertStatus(403)
            ->assertJsonFragment(['code' => 'must_change_password']);
    }

    public function test_akun_wajib_ganti_password_masih_boleh_me_ganti_password_dan_logout(): void
    {
        $this->guru->update(['password' => Hash::make('sementara99'), 'must_change_password' => true]);
        Sanctum::actingAs($this->guru->fresh());

        $this->getJson('/api/v1/auth/me')->assertOk();

        $this->putJson('/api/v1/profile/password', [
            'password_lama'              => 'sementara99',
            'password_baru'              => 'milikku-sendiri-1',
            'password_baru_confirmation' => 'milikku-sendiri-1',
        ])->assertOk();

        $guru = $this->guru->fresh();
        $this->assertFalse($guru->must_change_password);

        // Setelah ganti password, seluruh API terbuka kembali.
        Sanctum::actingAs($guru);
        $this->getJson('/api/v1/agendas/perlu-diisi')->assertOk();
    }
}
