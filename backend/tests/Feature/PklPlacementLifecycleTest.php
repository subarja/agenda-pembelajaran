<?php

namespace Tests\Feature;

use App\Enums\PklPlacementStatus;
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
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Siklus hidup penempatan PKL: selesai (lebih awal), mengundurkan diri, pindah tempat.
 * Menagih agenda/absen berhenti di TANGGAL EFEKTIF berakhir; riwayat sebelumnya tetap.
 */
class PklPlacementLifecycleTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        PklMode::flush();
        parent::tearDown();
    }

    /** @return array{0:AcademicYear,1:SchoolClass,2:User,3:Teacher,4:User,5:Student} */
    private function skenario(): array
    {
        Carbon::setTestNow(Carbon::parse('2026-04-30 10:00', config('app.school_timezone'))); // Kamis
        $ay = AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-01-05', 'tanggal_selesai' => '2026-12-20', 'aktif' => true,
        ]);
        PklSetting::instance()->update(['aktif' => true]);
        PklMode::flush();

        $kelas = SchoolClass::create(['tingkat' => Tingkat::XII, 'jurusan' => 'Animasi', 'rombel' => 'A', 'academic_year_id' => $ay->id]);
        $pu = User::create(['nama' => 'Pembimbing', 'email' => 'p@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru, 'must_change_password' => false]);
        $pembimbing = Teacher::create(['user_id' => $pu->id, 'is_bk' => false]);
        $su = User::create(['nama' => 'Andi', 'email' => 'andi@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Siswa, 'must_change_password' => false]);
        $siswa = Student::create(['user_id' => $su->id, 'nis' => '9001', 'nisn' => '111', 'class_id' => $kelas->id, 'status' => 'aktif']);

        return [$ay, $kelas, $pu, $pembimbing, $su, $siswa];
    }

    private function buatPlacement(Student $siswa, SchoolClass $kelas, Teacher $pembimbing, AcademicYear $ay): PklPlacement
    {
        return PklPlacement::create([
            'student_id' => $siswa->id, 'class_id' => $kelas->id, 'academic_year_id' => $ay->id,
            'pembimbing_teacher_id' => $pembimbing->id, 'tempat_pkl' => 'PT Maju', 'alamat_pkl' => 'Jl. 1',
            'tanggal_mulai' => '2026-04-20', 'tanggal_selesai' => '2026-11-13',
        ]);
    }

    public function test_selesai_lebih_awal_memangkas_hari_kerja_dan_menandai_status(): void
    {
        [$ay, $kelas, $pu, $pembimbing, , $siswa] = $this->skenario();
        $p = $this->buatPlacement($siswa, $kelas, $pembimbing, $ay);

        Sanctum::actingAs($pu->fresh());

        // Sebelum ditutup: hari kerja 20–30 Apr (Sen–Jum) = 9.
        $this->assertSame(9, $this->getJson('/api/v1/pkl/my-students')->assertOk()->json('data.0.hari_kerja'));

        // Tandai selesai lebih awal per 24 Apr.
        $this->postJson("/api/v1/pkl/placements/{$p->uuid}/status", [
            'status' => 'selesai', 'tanggal_berakhir_aktual' => '2026-04-24', 'alasan_berakhir' => 'target tercapai',
        ])->assertOk();

        $row = $this->getJson('/api/v1/pkl/my-students')->assertOk()->json('data.0');
        $this->assertSame(5, $row['hari_kerja']);              // 20,21,22,23,24
        $this->assertSame('selesai', $row['status_efektif']);
        $this->assertSame('2026-04-24', $row['berakhir_aktual']);
    }

    public function test_mengundurkan_diri_membuka_slot_untuk_penempatan_baru(): void
    {
        [$ay, $kelas, $pu, $pembimbing, , $siswa] = $this->skenario();
        $p = $this->buatPlacement($siswa, $kelas, $pembimbing, $ay);

        Sanctum::actingAs($pu->fresh());

        // Selagi A masih berlangsung (s.d. 13 Nov), penempatan baru 1 Mei bertumpuk → ditolak.
        $this->postJson('/api/v1/pkl/placements', [
            'student_id' => $siswa->uuid, 'tempat_pkl' => 'PT Kedua',
            'tanggal_mulai' => '2026-05-01', 'tanggal_selesai' => '2026-06-15',
        ])->assertStatus(422);

        // Tutup A per 25 Apr (mengundurkan diri).
        $this->postJson("/api/v1/pkl/placements/{$p->uuid}/status", [
            'status' => 'mengundurkan_diri', 'tanggal_berakhir_aktual' => '2026-04-25',
        ])->assertOk();
        $this->assertSame(PklPlacementStatus::MengundurkanDiri, $p->fresh()->status);

        // Kini 1 Mei tidak lagi bertumpuk (tanggal efektif A = 25 Apr) → boleh.
        $this->postJson('/api/v1/pkl/placements', [
            'student_id' => $siswa->uuid, 'tempat_pkl' => 'PT Kedua',
            'tanggal_mulai' => '2026-05-01', 'tanggal_selesai' => '2026-06-15',
        ])->assertCreated();

        $this->assertSame(2, PklPlacement::where('student_id', $siswa->id)->count());
    }

    public function test_admin_mengundurkan_diri_dengan_keluar_sekolah_menonaktifkan_siswa(): void
    {
        [$ay, $kelas, , $pembimbing, , $siswa] = $this->skenario();
        $p = $this->buatPlacement($siswa, $kelas, $pembimbing, $ay);

        $au = User::create(['nama' => 'Admin', 'email' => 'admin@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Admin, 'must_change_password' => false]);
        Sanctum::actingAs($au);

        $this->postJson("/api/v1/admin/pkl/placements/{$p->uuid}/status", [
            'status' => 'mengundurkan_diri', 'tanggal_berakhir_aktual' => '2026-04-25', 'keluar_sekolah' => true,
        ])->assertOk();

        $siswa->refresh();
        $this->assertSame('keluar', $siswa->status);
        $this->assertSame('2026-04-25', $siswa->tanggal_keluar->toDateString());
    }

    public function test_status_selesai_otomatis_saat_tanggal_terlewati(): void
    {
        [$ay, $kelas, , $pembimbing, , $siswa] = $this->skenario();
        // Placement yang tanggal selesainya sudah lewat (hari ini 30 Apr).
        $p = PklPlacement::create([
            'student_id' => $siswa->id, 'class_id' => $kelas->id, 'academic_year_id' => $ay->id,
            'pembimbing_teacher_id' => $pembimbing->id, 'tempat_pkl' => 'PT Lampau',
            'tanggal_mulai' => '2026-03-01', 'tanggal_selesai' => '2026-04-10',
        ]);

        // Tanpa penutupan manual, status DB tetap berlangsung tapi status EFEKTIF = selesai.
        $this->assertSame(PklPlacementStatus::Berlangsung, $p->status);
        $this->assertSame(PklPlacementStatus::Selesai, $p->effectiveStatus());
    }
}
