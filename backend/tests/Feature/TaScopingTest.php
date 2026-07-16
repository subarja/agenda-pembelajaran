<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\ArchiveWriteSetting;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use App\Support\SemesterLock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

/**
 * Scoping tahun ajaran per-login: query operasional mengikuti TA yang dipilih user
 * saat login (users.current_academic_year_id), bukan TA aktif global. TA non-aktif
 * = arsip baca-saja secara default; admin bisa membuka lewat saklar ArchiveWriteSetting.
 */
class TaScopingTest extends TestCase
{
    use RefreshDatabase;

    private AcademicYear $oldAy;
    private AcademicYear $newAy;
    private User $guru;
    private SchoolClass $oldClass;
    private SchoolClass $newClass;

    protected function setUp(): void
    {
        parent::setUp();

        $this->oldAy = AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-02-09', 'tanggal_selesai' => '2026-06-19', 'aktif' => false,
        ]);
        $this->newAy = AcademicYear::create([
            'tahun' => '2026/2027', 'semester' => Semester::Ganjil,
            'tanggal_mulai' => '2026-07-15', 'tanggal_selesai' => '2026-12-04', 'aktif' => true,
        ]);

        $this->guru = User::create(['nama' => 'Guru Scoping', 'email' => 'guruscoping@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru]);
        Teacher::create(['user_id' => $this->guru->id, 'is_bk' => false]);
        $this->guru = $this->guru->fresh();

        $subject = Subject::create(['kode' => 'MTK', 'nama' => 'Matematika', 'aktif' => true]);

        $this->oldClass = SchoolClass::create(['tingkat' => Tingkat::XI, 'jurusan' => 'Animasi', 'rombel' => 'A', 'academic_year_id' => $this->oldAy->id]);
        $this->newClass = SchoolClass::create(['tingkat' => Tingkat::XII, 'jurusan' => 'Animasi', 'rombel' => 'A', 'academic_year_id' => $this->newAy->id]);

        // Jadwal guru hanya ada di TA LAMA — pembeda tegas untuk uji scoping.
        Schedule::create([
            'class_id' => $this->oldClass->id, 'subject_id' => $subject->id,
            'teacher_id' => $this->guru->teacher->id,
            'hari' => 'senin', 'jam_mulai' => '07:00', 'jam_selesai' => '08:30', 'aktif' => true,
        ]);
    }

    public function test_beban_mengajar_mengikuti_ta_yang_dipilih_saat_login(): void
    {
        // Login memilih TA lama → jadwal TA lama terlihat.
        $this->guru->update(['current_academic_year_id' => $this->oldAy->id]);
        Sanctum::actingAs($this->guru->fresh());
        $rows = $this->getJson('/api/v1/beban-mengajar')->assertOk()->json('data.rows');
        $this->assertCount(1, $rows);
        $this->assertSame('XI Animasi A', $rows[0]['kelas']);

        // Login memilih TA baru (aktif) → jadwal TA lama TIDAK ikut terbaca.
        $this->guru->update(['current_academic_year_id' => $this->newAy->id]);
        Sanctum::actingAs($this->guru->fresh());
        $rows = $this->getJson('/api/v1/beban-mengajar')->assertOk()->json('data.rows');
        $this->assertCount(0, $rows);
    }

    public function test_ta_non_aktif_baca_saja_secara_default(): void
    {
        try {
            SemesterLock::assertAyWritable($this->oldAy);
            $this->fail('TA arsip seharusnya ditolak tulis saat saklar tertutup.');
        } catch (HttpException $e) {
            $this->assertSame(423, $e->getStatusCode());
            $this->assertStringContainsString('arsip baca-saja', $e->getMessage());
        }
    }

    public function test_saklar_admin_membuka_tulis_ta_arsip(): void
    {
        ArchiveWriteSetting::instance()->update(['izinkan_tulis' => true]);

        SemesterLock::assertAyWritable($this->oldAy); // tidak boleh melempar
        $this->assertTrue(true);
    }

    public function test_ta_aktif_selalu_bisa_ditulis(): void
    {
        SemesterLock::assertAyWritable($this->newAy);
        $this->assertTrue(true);
    }

    public function test_ta_terkunci_tetap_tertutup_walau_saklar_terbuka(): void
    {
        ArchiveWriteSetting::instance()->update(['izinkan_tulis' => true]);
        $this->oldAy->update(['locked' => true]);

        try {
            SemesterLock::assertAyWritable($this->oldAy->fresh());
            $this->fail('TA terkunci seharusnya selalu ditolak tulis.');
        } catch (HttpException $e) {
            $this->assertSame(423, $e->getStatusCode());
        }
    }

    public function test_endpoint_saklar_hanya_untuk_admin(): void
    {
        Sanctum::actingAs($this->guru->fresh());
        $this->putJson('/api/v1/admin/archive-write-settings', ['izinkan_tulis' => true])
            ->assertStatus(403);

        $admin = User::create(['nama' => 'Admin Arsip', 'email' => 'adminarsip@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Admin]);
        Sanctum::actingAs($admin);
        $this->putJson('/api/v1/admin/archive-write-settings', ['izinkan_tulis' => true])->assertOk();
        $this->assertTrue(ArchiveWriteSetting::instance()->izinkan_tulis);
    }
}
