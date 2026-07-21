<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Http\Controllers\Api\PklController;
use App\Models\AcademicYear;
use App\Models\NonEffectiveDay;
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
 * Daftar bimbingan PKL + rekap kehadiran per industri. % hadir = hadir / hari kerja
 * (Sen–Jum di luar libur nasional) yang SUDAH BERLALU.
 */
class PklBimbinganTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        PklMode::flush();
        parent::tearDown();
    }

    public function test_hari_kerja_hitung_senin_jumat_minus_libur_nasional(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-04-30 10:00', config('app.school_timezone'))); // Kamis

        $m = new \ReflectionMethod(PklController::class, 'hariKerjaPkl');
        $m->setAccessible(true);
        $ctrl = new PklController;

        // Periode 20 Apr (Sen) .. 13 Nov; hari ini 30 Apr → dihitung 20–30 Apr.
        // Sen–Jum: 20,21,22,23,24, 27,28,29,30 = 9 hari kerja.
        $this->assertSame(9, $m->invoke($ctrl, '2026-04-20', '2026-11-13', []));

        // Tandai 22 Apr libur nasional → 8.
        $this->assertSame(8, $m->invoke($ctrl, '2026-04-20', '2026-11-13', ['2026-04-22' => 0]));

        // Sebelum mulai (hari ini < mulai) → 0.
        Carbon::setTestNow(Carbon::parse('2026-04-10 10:00', config('app.school_timezone')));
        $this->assertSame(0, $m->invoke($ctrl, '2026-04-20', '2026-11-13', []));
    }

    public function test_my_students_menyertakan_rekap_per_industri(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-04-30 10:00', config('app.school_timezone')));
        $ay = AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-01-05', 'tanggal_selesai' => '2026-06-19', 'aktif' => true,
        ]);
        PklSetting::instance()->update(['aktif' => true]);
        PklMode::flush();

        NonEffectiveDay::create(['tanggal' => '2026-04-22', 'status' => 'tidak_efektif', 'libur_nasional' => true]);

        $kelas = SchoolClass::create(['tingkat' => Tingkat::XII, 'jurusan' => 'Animasi', 'rombel' => 'A', 'academic_year_id' => $ay->id]);
        $pu = User::create(['nama' => 'Pembimbing', 'email' => 'p@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru, 'must_change_password' => false]);
        $pembimbing = Teacher::create(['user_id' => $pu->id, 'is_bk' => false]);

        $su = User::create(['nama' => 'Andi', 'email' => 'andi@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Siswa, 'must_change_password' => false]);
        $siswa = Student::create(['user_id' => $su->id, 'nis' => '9001', 'nisn' => '111', 'class_id' => $kelas->id]);

        PklPlacement::create([
            'student_id' => $siswa->id, 'class_id' => $kelas->id, 'academic_year_id' => $ay->id,
            'pembimbing_teacher_id' => $pembimbing->id, 'telpon_siswa' => '081234567890',
            'tempat_pkl' => 'PT Maju', 'alamat_pkl' => 'Jl. Industri 1',
            'tanggal_mulai' => '2026-04-20', 'tanggal_selesai' => '2026-11-13',
        ]);
        PklMode::flush();

        Sanctum::actingAs($pu->fresh());
        $row = $this->getJson('/api/v1/pkl/my-students')->assertOk()->json('data.0');

        $this->assertSame('Andi', $row['nama']);
        $this->assertSame('PT Maju', $row['tempat_pkl']);
        $this->assertSame('6281234567890', $row['wa']); // 0 → 62
        $this->assertSame(8, $row['hari_kerja']);        // 9 hari kerja − 1 libur nasional
        $this->assertSame(0, $row['hadir']);             // belum ada presensi
        $this->assertEquals(0, $row['pct_hadir']);
    }
}
