<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\PklPlacement;
use App\Models\PklSetting;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Support\PklMode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Menu PKL guru: muncul untuk pembimbing saat Mode PKL ON. Regresi bug 2026-07-21 —
 * `/auth/me` tak eager-load teacher, guard `relationLoaded` lama membuat is_pembimbing
 * selalu false → menu tak pernah muncul.
 */
class PklMenuVisibilityTest extends TestCase
{
    use RefreshDatabase;

    private AcademicYear $ay;

    protected function setUp(): void
    {
        parent::setUp();
        PklMode::flush();
        $this->ay = AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-01-05', 'tanggal_selesai' => '2026-06-19', 'aktif' => true,
        ]);
        PklSetting::instance()->update(['aktif' => true]);
        PklMode::flush();
    }

    protected function tearDown(): void
    {
        PklMode::flush();
        parent::tearDown();
    }

    private function guru(string $nama): Teacher
    {
        $u = User::create(['nama' => $nama, 'email' => str()->slug($nama).'@test.sch.id',
            'password' => 'secret123', 'role' => UserRole::Guru]);

        return Teacher::create(['user_id' => $u->id, 'is_bk' => false]);
    }

    public function test_pembimbing_dapat_menu_pkl_saat_mode_on(): void
    {
        $kelas = SchoolClass::create(['tingkat' => Tingkat::XII, 'jurusan' => 'Animasi', 'rombel' => 'A', 'academic_year_id' => $this->ay->id]);
        $pembimbing = $this->guru('Guru Pembimbing');

        $su = User::create(['nama' => 'Siswa PKL', 'email' => 'siswapkl@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Siswa]);
        $siswa = Student::create(['user_id' => $su->id, 'nis' => '9001', 'class_id' => $kelas->id]);
        PklPlacement::create([
            'student_id' => $siswa->id, 'class_id' => $kelas->id, 'academic_year_id' => $this->ay->id,
            'pembimbing_teacher_id' => $pembimbing->id,
            'tempat_pkl' => 'PT Uji', 'alamat_pkl' => 'Jl. Uji',
            'tanggal_mulai' => '2026-02-01', 'tanggal_selesai' => '2026-05-31',
        ]);
        PklMode::flush();

        // Simulasi /auth/me: user diambil TANPA eager-load teacher.
        Sanctum::actingAs($pembimbing->user->fresh());

        $this->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.pkl.mode_aktif', true)
            ->assertJsonPath('data.pkl.is_pembimbing', true);
    }

    public function test_guru_biasa_bukan_pembimbing_tidak_dapat_menu(): void
    {
        $guru = $this->guru('Guru Biasa');
        Sanctum::actingAs($guru->user->fresh());

        $this->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.pkl.is_pembimbing', false);
    }
}
