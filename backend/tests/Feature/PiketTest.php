<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\BellPeriod;
use App\Models\PiketAssignment;
use App\Models\Teacher;
use App\Models\User;
use App\Support\BellSchedule;
use App\Support\PiketAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Sprint 3 modul Bel: role sekuriti, kapabilitas piket (petugas hari itu), guard PiketAccess,
 * dashboard ringkasan bel real-time, dan penugasan piket oleh admin.
 */
class PiketTest extends TestCase
{
    use RefreshDatabase;

    private Teacher $guru;

    protected function setUp(): void
    {
        parent::setUp();
        BellSchedule::flush();

        AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-02-09', 'tanggal_selesai' => '2026-06-19', 'aktif' => true,
        ]);

        foreach ([1 => ['07:00', '07:45'], 2 => ['07:45', '08:30']] as $ke => [$m, $s]) {
            BellPeriod::create(['hari' => 'senin', 'jam_ke' => $ke, 'jam_mulai' => $m, 'jam_selesai' => $s]);
        }

        $u = User::create(['nama' => 'Pak Piket', 'email' => 'piket@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru]);
        $this->guru = Teacher::create(['user_id' => $u->id, 'is_bk' => false]);
    }

    private function admin(): User
    {
        return User::create(['nama' => 'Admin', 'email' => 'admin@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Admin]);
    }

    public function test_role_sekuriti_bisa_dibuat(): void
    {
        $u = User::create(['nama' => 'Satpam', 'email' => 'satpam@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Sekuriti]);
        $this->assertSame('sekuriti', $u->fresh()->role->value);
    }

    public function test_kapabilitas_piket_hanya_saat_bertugas(): void
    {
        $user = $this->guru->user;
        $hariIni = Carbon::now('Asia/Jakarta')->toDateString();

        $this->assertFalse(PiketAccess::isPetugas($user));

        PiketAssignment::create(['tanggal' => $hariIni, 'teacher_id' => $this->guru->id]);
        $this->assertTrue(PiketAccess::isPetugas($user));

        // Bukan petugas untuk tanggal lain.
        $this->assertFalse(PiketAccess::isPetugas($user, '2026-03-02'));
    }

    public function test_ringkasan_403_untuk_bukan_petugas(): void
    {
        Sanctum::actingAs($this->guru->user);
        $this->getJson('/api/v1/piket/ringkasan')->assertStatus(403);
    }

    public function test_ringkasan_untuk_petugas_berisi_jadwal_bel(): void
    {
        // Pilih hari Senin sebagai "hari ini" supaya ada bel.
        Carbon::setTestNow('2026-03-09 07:10:00');
        PiketAssignment::create(['tanggal' => '2026-03-09', 'teacher_id' => $this->guru->id]);

        Sanctum::actingAs($this->guru->user);
        $res = $this->getJson('/api/v1/piket/ringkasan')->assertOk();
        Carbon::setTestNow();

        $res->assertJsonPath('data.tanggal', '2026-03-09')
            ->assertJsonPath('data.petugas.0', 'Pak Piket');
        $this->assertNotEmpty($res->json('data.events'));
    }

    public function test_admin_menugaskan_dan_melihat_piket(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/v1/admin/piket/assignments', [
            'tanggal' => '2026-03-09',
            'teacher_uuid' => [$this->guru->uuid],
        ])->assertCreated();

        $this->assertDatabaseHas('piket_assignments', ['tanggal' => '2026-03-09', 'teacher_id' => $this->guru->id]);

        $this->getJson('/api/v1/admin/piket/assignments?dari=2026-03-01&sampai=2026-03-31')
            ->assertOk()
            ->assertJsonPath('data.0.nama_guru', 'Pak Piket');
    }

    public function test_menugaskan_ulang_idempoten(): void
    {
        Sanctum::actingAs($this->admin());
        $payload = ['tanggal' => '2026-03-09', 'teacher_uuid' => [$this->guru->uuid]];

        $this->postJson('/api/v1/admin/piket/assignments', $payload)->assertCreated();
        $this->postJson('/api/v1/admin/piket/assignments', $payload)->assertCreated();

        $this->assertSame(1, PiketAssignment::count());
    }
}
