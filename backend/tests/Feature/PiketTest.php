<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\BellPeriod;
use App\Models\PiketShift;
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

    public function test_kapabilitas_piket_berbasis_hari_dalam_seminggu(): void
    {
        $user = $this->guru->user;

        $this->assertFalse(PiketAccess::isPetugas($user, '2026-03-09'));

        // Shift hari Senin -> petugas pada Senin mana pun (pola mingguan), bukan tanggal spesifik.
        $shift = PiketShift::create(['hari' => 'senin', 'nama_shift' => 'Pagi', 'jam_mulai' => '06:00', 'jam_selesai' => '11:00']);
        $shift->teachers()->attach($this->guru->id);

        $this->assertTrue(PiketAccess::isPetugas($user, '2026-03-09'));  // Senin
        $this->assertTrue(PiketAccess::isPetugas($user, '2026-03-16'));  // Senin berikutnya

        // Bukan petugas pada hari tanpa shift.
        $this->assertFalse(PiketAccess::isPetugas($user, '2026-03-10')); // Selasa
    }

    public function test_petugas_users_presisi_shift_aktif_dengan_fallback(): void
    {
        $u2 = User::create(['nama' => 'Bu Siang', 'email' => 'siang@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru]);
        $guru2 = Teacher::create(['user_id' => $u2->id, 'is_bk' => false]);

        $pagi = PiketShift::create(['hari' => 'senin', 'nama_shift' => 'Pagi', 'jam_mulai' => '06:00', 'jam_selesai' => '11:00']);
        $pagi->teachers()->attach($this->guru->id);
        $siang = PiketShift::create(['hari' => 'senin', 'nama_shift' => 'Siang', 'jam_mulai' => '11:00', 'jam_selesai' => '15:00']);
        $siang->teachers()->attach($guru2->id);

        // Jam 09:00 -> hanya petugas shift Pagi.
        $this->assertEquals(
            [$this->guru->user->id],
            PiketAccess::petugasUsers('2026-03-09', '09:00:00')->pluck('id')->all(),
        );

        // Batas eksklusif: tepat 11:00 masuk shift Siang, bukan Pagi.
        $this->assertEquals(
            [$guru2->user->id],
            PiketAccess::petugasUsers('2026-03-09', '11:00:00')->pluck('id')->all(),
        );

        // Di luar semua jam shift (05:00) -> fallback ke seluruh petugas hari itu.
        $this->assertEqualsCanonicalizing(
            [$this->guru->user->id, $guru2->user->id],
            PiketAccess::petugasUsers('2026-03-09', '05:00:00')->pluck('id')->all(),
        );

        // Hari tanpa shift (Selasa) -> kosong.
        $this->assertTrue(PiketAccess::petugasUsers('2026-03-10', '09:00:00')->isEmpty());
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
        $shift = PiketShift::create(['hari' => 'senin', 'nama_shift' => 'Pagi', 'jam_mulai' => '06:00', 'jam_selesai' => '11:00']);
        $shift->teachers()->attach($this->guru->id);

        Sanctum::actingAs($this->guru->user);
        $res = $this->getJson('/api/v1/piket/ringkasan')->assertOk();
        Carbon::setTestNow();

        $res->assertJsonPath('data.tanggal', '2026-03-09')
            ->assertJsonPath('data.petugas.0', 'Pak Piket')
            ->assertJsonPath('data.shifts.0.nama_shift', 'Pagi')
            ->assertJsonPath('data.shifts.0.aktif_sekarang', true);
        $this->assertNotEmpty($res->json('data.events'));
    }

    public function test_admin_membuat_shift_set_petugas_dan_melihat(): void
    {
        Sanctum::actingAs($this->admin());

        $create = $this->postJson('/api/v1/admin/piket/shifts', [
            'hari' => 'senin', 'nama_shift' => 'Pagi', 'jam_mulai' => '06:00', 'jam_selesai' => '11:00',
        ])->assertCreated();
        $shiftId = $create->json('data.id');

        $this->assertDatabaseHas('piket_shifts', ['hari' => 'senin', 'nama_shift' => 'Pagi']);

        $this->putJson("/api/v1/admin/piket/shifts/{$shiftId}/petugas", [
            'teacher_uuid' => [$this->guru->uuid],
        ])->assertOk();

        $this->assertDatabaseHas('piket_shift_teacher', ['piket_shift_id' => $shiftId, 'teacher_id' => $this->guru->id]);

        $this->getJson('/api/v1/admin/piket/shifts')
            ->assertOk()
            ->assertJsonPath('data.0.nama_shift', 'Pagi')
            ->assertJsonPath('data.0.petugas.0.nama', 'Pak Piket');
    }

    public function test_shift_tumpang_tindih_ditolak(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/v1/admin/piket/shifts', [
            'hari' => 'senin', 'nama_shift' => 'Pagi', 'jam_mulai' => '06:00', 'jam_selesai' => '11:00',
        ])->assertCreated();

        // Jam bertumpuk pada hari yang sama -> 422.
        $this->postJson('/api/v1/admin/piket/shifts', [
            'hari' => 'senin', 'nama_shift' => 'Pagi 2', 'jam_mulai' => '10:00', 'jam_selesai' => '13:00',
        ])->assertStatus(422);

        // Batas [mulai, selesai): shift mulai tepat saat yang lain selesai -> boleh.
        $this->postJson('/api/v1/admin/piket/shifts', [
            'hari' => 'senin', 'nama_shift' => 'Siang', 'jam_mulai' => '11:00', 'jam_selesai' => '15:00',
        ])->assertCreated();

        $this->assertSame(2, PiketShift::count());
    }

    public function test_set_petugas_idempoten(): void
    {
        Sanctum::actingAs($this->admin());
        $shiftId = $this->postJson('/api/v1/admin/piket/shifts', [
            'hari' => 'senin', 'nama_shift' => 'Pagi', 'jam_mulai' => '06:00', 'jam_selesai' => '11:00',
        ])->json('data.id');

        $payload = ['teacher_uuid' => [$this->guru->uuid]];
        $this->putJson("/api/v1/admin/piket/shifts/{$shiftId}/petugas", $payload)->assertOk();
        $this->putJson("/api/v1/admin/piket/shifts/{$shiftId}/petugas", $payload)->assertOk();

        $this->assertSame(1, PiketShift::find($shiftId)->teachers()->count());
    }
}
