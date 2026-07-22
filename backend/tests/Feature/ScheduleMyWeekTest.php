<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * GET /schedules/my-week — jadwal mingguan terstruktur untuk halaman "Jadwal Saya".
 *  - guru  → jadwal ampu sendiri, kolom "kelas" + ruangan, dikelompokkan per hari;
 *  - siswa → jadwal kelasnya, kolom "guru" + ruangan;
 *  - ruangan ikut tampil; has_pdf mengikuti ada/tidaknya jadwal_pdf.
 */
class ScheduleMyWeekTest extends TestCase
{
    use RefreshDatabase;

    private User $guru;

    private User $siswa;

    protected function setUp(): void
    {
        parent::setUp();

        $ay = AcademicYear::create([
            'tahun' => '2026/2027', 'semester' => Semester::Ganjil,
            'tanggal_mulai' => '2026-07-15', 'tanggal_selesai' => '2026-12-04', 'aktif' => true,
        ]);

        $gu = User::create(['nama' => 'Pak Budi', 'email' => 'budi@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru]);
        $teacher = Teacher::create(['user_id' => $gu->id, 'is_bk' => false]);
        $this->guru = $gu->fresh();

        $kelas = SchoolClass::create(['tingkat' => Tingkat::XII, 'jurusan' => 'Rekayasa Perangkat Lunak', 'rombel' => 'A', 'academic_year_id' => $ay->id]);
        $subject = Subject::create(['kode' => 'MTK', 'nama' => 'Matematika', 'aktif' => true]);

        foreach (['senin', 'selasa'] as $hari) {
            Schedule::create([
                'class_id' => $kelas->id, 'subject_id' => $subject->id, 'teacher_id' => $teacher->id,
                'hari' => $hari, 'jam_mulai' => '07:00', 'jam_selesai' => '08:30',
                'ruangan' => 'Ruang E1', 'aktif' => true,
            ]);
        }

        $su = User::create(['nama' => 'Siswa Uji', 'email' => 'siswa@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Siswa]);
        Student::create(['user_id' => $su->id, 'nis' => '9001', 'class_id' => $kelas->id]);
        $this->siswa = $su->fresh();
    }

    public function test_guru_melihat_jadwal_mingguan_dengan_kelas_dan_ruangan(): void
    {
        Sanctum::actingAs($this->guru);

        $res = $this->getJson('/api/v1/schedules/my-week')->assertOk();

        $res->assertJsonPath('role', 'guru');
        $res->assertJsonPath('has_pdf', false);
        $this->assertCount(1, $res->json('data.senin'));
        $this->assertCount(1, $res->json('data.selasa'));
        // Tanpa seed program_keahlians, label() fallback ke nama jurusan penuh.
        $this->assertSame('XII Rekayasa Perangkat Lunak A', $res->json('data.senin.0.kelas'));
        $this->assertSame('Ruang E1', $res->json('data.senin.0.ruangan'));
        $this->assertSame('Matematika', $res->json('data.senin.0.subject.nama'));
    }

    public function test_siswa_melihat_jadwal_kelas_dengan_guru_dan_ruangan(): void
    {
        Sanctum::actingAs($this->siswa);

        $res = $this->getJson('/api/v1/schedules/my-week')->assertOk();

        $res->assertJsonPath('role', 'siswa');
        $this->assertSame('Pak Budi', $res->json('data.senin.0.guru'));
        $this->assertSame('Ruang E1', $res->json('data.senin.0.ruangan'));
    }

    public function test_admin_ditolak(): void
    {
        $admin = User::create(['nama' => 'Admin', 'email' => 'admin@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Admin]);
        Sanctum::actingAs($admin);

        $this->getJson('/api/v1/schedules/my-week')->assertStatus(403);
    }
}
