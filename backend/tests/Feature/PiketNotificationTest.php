<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\IzinKeluar;
use App\Models\PiketAssignment;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Notifications\IzinKeluarDiajukanNotification;
use App\Notifications\IzinKeluarScanNotification;
use App\Notifications\IzinKesianganDiajukanNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Sprint 7 modul Bel: notifikasi FCM (via database+fcm) ke guru piket hari itu saat izin
 * keluar/kesiangan diajukan & saat sekuriti memindai keluar/masuk.
 */
class PiketNotificationTest extends TestCase
{
    use RefreshDatabase;

    private Student $siswa;
    private User $piketUser;
    private User $sekuriti;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-03-09 09:00:00');

        $ay = AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-02-09', 'tanggal_selesai' => '2026-06-19', 'aktif' => true,
        ]);
        $kelas = SchoolClass::create(['tingkat' => Tingkat::X, 'jurusan' => 'Mekatronika', 'rombel' => 'A', 'academic_year_id' => $ay->id]);

        $su = User::create(['nama' => 'Andi', 'email' => 'andi@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Siswa]);
        $this->siswa = Student::create(['user_id' => $su->id, 'nis' => '12345', 'class_id' => $kelas->id]);

        $this->piketUser = User::create(['nama' => 'Pak Piket', 'email' => 'piket@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru]);
        $piket = Teacher::create(['user_id' => $this->piketUser->id, 'is_bk' => false]);
        PiketAssignment::create(['tanggal' => '2026-03-09', 'teacher_id' => $piket->id]);

        $this->sekuriti = User::create(['nama' => 'Satpam', 'email' => 'satpam@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Sekuriti]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_izin_keluar_diajukan_menotifikasi_piket(): void
    {
        Notification::fake();
        Sanctum::actingAs($this->siswa->user);
        $this->postJson('/api/v1/izin-keluar', ['keperluan' => 'Berobat'])->assertCreated();

        Notification::assertSentTo($this->piketUser, IzinKeluarDiajukanNotification::class);
    }

    public function test_izin_kesiangan_diajukan_menotifikasi_piket(): void
    {
        Notification::fake();
        Sanctum::actingAs($this->siswa->user);
        $this->postJson('/api/v1/izin-kesiangan', [])->assertCreated();

        Notification::assertSentTo($this->piketUser, IzinKesianganDiajukanNotification::class);
    }

    public function test_scan_keluar_menotifikasi_piket(): void
    {
        $izin = IzinKeluar::create([
            'student_id' => $this->siswa->id, 'tanggal' => '2026-03-09', 'keperluan' => 'Berobat',
            'status' => 'disetujui', 'qr_token' => 'tok-scan',
            'berlaku_dari' => '2026-03-09 08:00:00', 'berlaku_sampai' => '2026-03-09 11:00:00',
        ]);

        Notification::fake();
        Sanctum::actingAs($this->sekuriti);
        $this->postJson('/api/v1/sekuriti/scan', ['qr_token' => 'tok-scan'])->assertOk();

        Notification::assertSentTo($this->piketUser, IzinKeluarScanNotification::class);
    }
}
