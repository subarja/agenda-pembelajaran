<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\DailyAttendance;
use App\Models\PiketAssignment;
use App\Models\PiketResume;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Sprint 6 modul Bel: absensi harian piket (daily_attendances, recorded_by=piket, lintas kelas)
 * + Resume Piket gabungan + ekspor PDF/Excel.
 */
class PiketAbsensiResumeTest extends TestCase
{
    use RefreshDatabase;

    private SchoolClass $kelas;
    private Student $siswa;
    private Teacher $piket;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-03-09 08:00:00'); // Senin

        $ay = AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-02-09', 'tanggal_selesai' => '2026-06-19', 'aktif' => true,
        ]);
        $this->kelas = SchoolClass::create(['tingkat' => Tingkat::X, 'jurusan' => 'Mekatronika', 'rombel' => 'A', 'academic_year_id' => $ay->id]);

        $su = User::create(['nama' => 'Andi', 'email' => 'andi@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Siswa]);
        $this->siswa = Student::create(['user_id' => $su->id, 'nis' => '12345', 'class_id' => $this->kelas->id]);

        $pu = User::create(['nama' => 'Pak Piket', 'email' => 'piket@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru]);
        $this->piket = Teacher::create(['user_id' => $pu->id, 'is_bk' => false]);
        PiketAssignment::create(['tanggal' => '2026-03-09', 'teacher_id' => $this->piket->id]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_piket_absen_kelas_mana_pun_recorded_by_piket(): void
    {
        Sanctum::actingAs($this->piket->user);

        $this->getJson("/api/v1/piket/absensi?class_id={$this->kelas->uuid}")
            ->assertOk()
            ->assertJsonPath('data.records.0.nama', 'Andi')
            ->assertJsonPath('data.is_filled', false);

        $this->postJson('/api/v1/piket/absensi', [
            'class_id' => $this->kelas->uuid,
            'records'  => [['student_id' => $this->siswa->uuid, 'status' => 'alpha']],
        ])->assertOk();

        $rec = DailyAttendance::where('student_id', $this->siswa->id)->first();
        $this->assertSame('alpha', $rec->status);
        $this->assertSame($this->piket->user->id, $rec->recorded_by);
    }

    public function test_resume_gabungan_simpan_dan_baca(): void
    {
        Sanctum::actingAs($this->piket->user);

        $this->postJson('/api/v1/piket/resume', ['ringkasan' => 'Hari aman terkendali', 'kejadian_penting' => 'Tidak ada'])->assertOk();
        $this->getJson('/api/v1/piket/resume')
            ->assertOk()
            ->assertJsonPath('data.ringkasan', 'Hari aman terkendali')
            ->assertJsonPath('data.penyunting', 'Pak Piket');

        $this->assertSame(1, PiketResume::count());

        // Simpan lagi -> tetap satu resume gabungan (unique tanggal).
        $this->postJson('/api/v1/piket/resume', ['ringkasan' => 'Update'])->assertOk();
        $this->assertSame(1, PiketResume::count());
    }

    public function test_export_pdf_preview_base64(): void
    {
        PiketResume::create(['tanggal' => '2026-03-09', 'ringkasan' => 'Ringkasan uji', 'teacher_id' => $this->piket->id]);
        Sanctum::actingAs($this->piket->user);

        $this->getJson('/api/v1/piket/resume/export?format=pdf&preview=1')
            ->assertOk()
            ->assertJsonStructure(['filename', 'base64']);
    }

    public function test_bukan_petugas_403(): void
    {
        $gu = User::create(['nama' => 'Lain', 'email' => 'lain@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru]);
        Teacher::create(['user_id' => $gu->id, 'is_bk' => false]);
        Sanctum::actingAs($gu);

        $this->getJson("/api/v1/piket/absensi?class_id={$this->kelas->uuid}")->assertStatus(403);
        $this->postJson('/api/v1/piket/resume', ['ringkasan' => 'x'])->assertStatus(403);
    }
}
