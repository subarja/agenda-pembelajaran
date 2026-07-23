<?php

namespace Tests\Feature;

use App\Enums\IzinKeluarStatus;
use App\Enums\Semester;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\IzinKeluar;
use App\Models\PiketShift;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Notifications\IzinKeluarTerlambatNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Sprint 4 modul Bel: siklus izin keluar QR — siswa ajukan, piket setujui (QR terbit),
 * sekuriti scan keluar lalu masuk. Termasuk guard peran & validasi masa berlaku / token.
 */
class IzinKeluarTest extends TestCase
{
    use RefreshDatabase;

    private Student $siswa;

    private Teacher $piket;

    private User $sekuriti;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-03-09 09:00:00'); // Senin 09:00

        $ay = AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-02-09', 'tanggal_selesai' => '2026-06-19', 'aktif' => true,
        ]);
        $kelas = SchoolClass::create(['tingkat' => Tingkat::X, 'jurusan' => 'Mekatronika', 'rombel' => 'A', 'academic_year_id' => $ay->id]);

        $su = User::create(['nama' => 'Andi Siswa', 'email' => 'andi@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Siswa]);
        $this->siswa = Student::create(['user_id' => $su->id, 'nis' => '12345', 'class_id' => $kelas->id]);

        $pu = User::create(['nama' => 'Pak Piket', 'email' => 'piket@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru]);
        $this->piket = Teacher::create(['user_id' => $pu->id, 'is_bk' => false]);
        $shift = PiketShift::create(['hari' => 'senin', 'nama_shift' => 'Pagi', 'jam_mulai' => '06:00', 'jam_selesai' => '15:00']);
        $shift->teachers()->attach($this->piket->id);

        $this->sekuriti = User::create(['nama' => 'Satpam', 'email' => 'satpam@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Sekuriti]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** Siswa yang sudah keluar tapi lewat batas & belum masuk = terlambat kembali. */
    private function izinTerlambat(): IzinKeluar
    {
        return IzinKeluar::create([
            'student_id' => $this->siswa->id, 'tanggal' => '2026-03-09', 'keperluan' => 'Berobat',
            'status' => IzinKeluarStatus::Keluar,
            'berlaku_dari' => Carbon::parse('2026-03-09 07:00', 'Asia/Jakarta'),
            'berlaku_sampai' => Carbon::parse('2026-03-09 08:00', 'Asia/Jakarta'),  // lewat (now 09:00)
            'waktu_keluar' => Carbon::parse('2026-03-09 07:05', 'Asia/Jakarta'),
        ]);
    }

    public function test_piket_lihat_penanda_terlambat_kembali(): void
    {
        $this->izinTerlambat();
        Sanctum::actingAs($this->piket->user);

        $this->getJson('/api/v1/piket/izin-keluar')
            ->assertOk()
            ->assertJsonPath('data.0.terlambat_kembali', true)
            ->assertJsonPath('data.0.terlambat_menit', 60);
    }

    public function test_command_notifikasi_terlambat_sekali_saja(): void
    {
        Notification::fake();
        $izin = $this->izinTerlambat();

        $this->artisan('izin-keluar:terlambat')->assertExitCode(0);
        Notification::assertSentTo($this->piket->user, IzinKeluarTerlambatNotification::class);
        $this->assertTrue($izin->fresh()->terlambat_dinotifikasi);

        // Jalan lagi -> tidak mengirim ulang (flag sudah ditandai).
        Notification::fake();
        $this->artisan('izin-keluar:terlambat')->assertExitCode(0);
        Notification::assertNothingSent();
    }

    public function test_siklus_lengkap_ajukan_setujui_keluar_masuk(): void
    {
        // 1. Siswa ajukan
        Sanctum::actingAs($this->siswa->user);
        $r = $this->postJson('/api/v1/izin-keluar', ['keperluan' => 'Berobat', 'alasan' => 'Sakit gigi'])->assertCreated();
        $uuid = IzinKeluar::first()->uuid;
        $this->assertNull($this->aktifQr());

        // 2. Piket setujui + set masa berlaku -> QR terbit
        Sanctum::actingAs($this->piket->user);
        $this->postJson("/api/v1/piket/izin-keluar/{$uuid}/proses", [
            'aksi' => 'setujui', 'berlaku_sampai' => '11:00',
        ])->assertOk();

        Sanctum::actingAs($this->siswa->user);
        $token = $this->aktifQr();
        $this->assertNotNull($token, 'QR harus muncul setelah disetujui');

        // 3. Sekuriti scan keluar
        Sanctum::actingAs($this->sekuriti);
        $this->postJson('/api/v1/sekuriti/scan', ['qr_token' => $token])
            ->assertOk()->assertJsonPath('arah', 'keluar')->assertJsonPath('data.nama', 'Andi Siswa');
        $this->assertSame('keluar', IzinKeluar::first()->status->value);

        // 4. Sekuriti scan masuk (QR sama)
        $this->postJson('/api/v1/sekuriti/scan', ['qr_token' => $token])
            ->assertOk()->assertJsonPath('arah', 'masuk');
        $izin = IzinKeluar::first();
        $this->assertSame('kembali', $izin->status->value);
        $this->assertNotNull($izin->waktu_keluar);
        $this->assertNotNull($izin->waktu_masuk);
    }

    public function test_qr_tak_bisa_dipakai_ketiga_kali(): void
    {
        $token = $this->izinSampaiKeluar();
        Sanctum::actingAs($this->sekuriti);
        $this->postJson('/api/v1/sekuriti/scan', ['qr_token' => $token])->assertOk(); // masuk
        $this->postJson('/api/v1/sekuriti/scan', ['qr_token' => $token])->assertStatus(422); // sudah kembali
    }

    public function test_scan_diluar_masa_berlaku_ditolak(): void
    {
        Sanctum::actingAs($this->siswa->user);
        $this->postJson('/api/v1/izin-keluar', ['keperluan' => 'Berobat'])->assertCreated();
        $uuid = IzinKeluar::first()->uuid;

        Sanctum::actingAs($this->piket->user);
        $this->postJson("/api/v1/piket/izin-keluar/{$uuid}/proses", ['aksi' => 'setujui', 'berlaku_sampai' => '09:30'])->assertOk();

        Sanctum::actingAs($this->siswa->user);
        $token = $this->aktifQr();

        // Lewat jam 09:30
        Carbon::setTestNow('2026-03-09 10:00:00');
        Sanctum::actingAs($this->sekuriti);
        $this->postJson('/api/v1/sekuriti/scan', ['qr_token' => $token])->assertStatus(422);
        $this->assertSame('disetujui', IzinKeluar::first()->status->value);
    }

    public function test_token_asing_ditolak(): void
    {
        Sanctum::actingAs($this->sekuriti);
        $this->postJson('/api/v1/sekuriti/scan', ['qr_token' => 'palsu-123'])->assertStatus(422);
    }

    public function test_non_sekuriti_tak_bisa_scan(): void
    {
        Sanctum::actingAs($this->piket->user);
        $this->postJson('/api/v1/sekuriti/scan', ['qr_token' => 'x'])->assertStatus(403);
    }

    public function test_non_petugas_tak_bisa_proses(): void
    {
        // Guru lain (bukan petugas piket)
        $gu = User::create(['nama' => 'Guru Lain', 'email' => 'lain@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru]);
        Teacher::create(['user_id' => $gu->id, 'is_bk' => false]);

        Sanctum::actingAs($this->siswa->user);
        $this->postJson('/api/v1/izin-keluar', ['keperluan' => 'Berobat'])->assertCreated();
        $uuid = IzinKeluar::first()->uuid;

        Sanctum::actingAs($gu);
        $this->postJson("/api/v1/piket/izin-keluar/{$uuid}/proses", ['aksi' => 'setujui', 'berlaku_sampai' => '11:00'])->assertStatus(403);
    }

    public function test_izin_ganda_aktif_ditolak(): void
    {
        Sanctum::actingAs($this->siswa->user);
        $this->postJson('/api/v1/izin-keluar', ['keperluan' => 'A'])->assertCreated();
        $this->postJson('/api/v1/izin-keluar', ['keperluan' => 'B'])->assertStatus(422);
    }

    // ── Helper ───────────────────────────────────────────────────────────────
    private function aktifQr(): ?string
    {
        return $this->getJson('/api/v1/izin-keluar/aktif')->json('data.0.qr_token');
    }

    private function izinSampaiKeluar(): string
    {
        Sanctum::actingAs($this->siswa->user);
        $this->postJson('/api/v1/izin-keluar', ['keperluan' => 'Berobat'])->assertCreated();
        $uuid = IzinKeluar::first()->uuid;
        Sanctum::actingAs($this->piket->user);
        $this->postJson("/api/v1/piket/izin-keluar/{$uuid}/proses", ['aksi' => 'setujui', 'berlaku_sampai' => '11:00'])->assertOk();
        Sanctum::actingAs($this->siswa->user);
        $token = $this->aktifQr();
        Sanctum::actingAs($this->sekuriti);
        $this->postJson('/api/v1/sekuriti/scan', ['qr_token' => $token])->assertOk(); // keluar

        return $token;
    }
}
