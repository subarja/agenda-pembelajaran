<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\Agenda;
use App\Models\BellPeriod;
use App\Models\PiketShift;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\StudentAttendance;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use App\Support\BellSchedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * GET /piket/pantau — petugas piket memantau jadwal hari ini: tiap sesi + status agenda,
 * status presensi (hadir/total), siapa tidak hadir + alasan, ringkasan, dan kesiangan.
 */
class PiketPantauTest extends TestCase
{
    use RefreshDatabase;

    private Teacher $piket;

    private SchoolClass $kelas;

    private Schedule $schedule;

    private Student $siswa;

    protected function setUp(): void
    {
        parent::setUp();
        BellSchedule::flush();
        // Senin 09:00 — shift piket 06–15 aktif.
        Carbon::setTestNow('2026-03-09 09:00:00');

        $ay = AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-02-09', 'tanggal_selesai' => '2026-06-19', 'aktif' => true,
        ]);

        foreach ([1 => ['07:00', '07:45'], 2 => ['07:45', '08:30']] as $ke => [$m, $s]) {
            BellPeriod::create(['hari' => 'senin', 'jam_ke' => $ke, 'jam_mulai' => $m, 'jam_selesai' => $s]);
        }

        $pu = User::create(['nama' => 'Pak Piket', 'email' => 'piket@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru]);
        $this->piket = Teacher::create(['user_id' => $pu->id, 'is_bk' => false]);
        $shift = PiketShift::create(['hari' => 'senin', 'nama_shift' => 'Pagi', 'jam_mulai' => '06:00', 'jam_selesai' => '15:00']);
        $shift->teachers()->attach($this->piket->id);

        $gu = User::create(['nama' => 'Bu Guru', 'email' => 'guru@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru]);
        $guru = Teacher::create(['user_id' => $gu->id, 'is_bk' => false]);

        $this->kelas = SchoolClass::create(['tingkat' => Tingkat::XII, 'jurusan' => 'Rekayasa Perangkat Lunak', 'rombel' => 'A', 'academic_year_id' => $ay->id]);
        $subject = Subject::create(['kode' => 'MTK', 'nama' => 'Matematika', 'aktif' => true]);

        $this->schedule = Schedule::create([
            'class_id' => $this->kelas->id, 'subject_id' => $subject->id, 'teacher_id' => $guru->id,
            'hari' => 'senin', 'jam_ke_mulai' => 1, 'jam_ke_selesai' => 2,
            'jam_mulai' => '07:00', 'jam_selesai' => '08:30', 'ruangan' => 'E1', 'aktif' => true,
        ]);

        $su = User::create(['nama' => 'Andi', 'email' => 'andi@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Siswa]);
        $this->siswa = Student::create(['user_id' => $su->id, 'nis' => '9001', 'class_id' => $this->kelas->id]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_pantau_menampilkan_sesi_status_agenda_dan_presensi(): void
    {
        $agenda = Agenda::create(['schedule_id' => $this->schedule->id, 'tanggal' => '2026-03-09', 'status' => 'submitted']);
        StudentAttendance::create(['agenda_id' => $agenda->id, 'student_id' => $this->siswa->id, 'status' => 'alpha', 'catatan' => 'tanpa kabar']);

        Sanctum::actingAs($this->piket->user);
        $res = $this->getJson('/api/v1/piket/pantau')->assertOk();

        $res->assertJsonPath('data.sesi.0.kelas', 'XII Rekayasa Perangkat Lunak A')
            ->assertJsonPath('data.sesi.0.mapel', 'Matematika')
            ->assertJsonPath('data.sesi.0.ruangan', 'E1')
            ->assertJsonPath('data.sesi.0.guru', 'Bu Guru')
            ->assertJsonPath('data.sesi.0.is_inval', false)
            ->assertJsonPath('data.sesi.0.agenda_status', 'submitted')
            ->assertJsonPath('data.sesi.0.presensi_terisi', true)
            ->assertJsonPath('data.sesi.0.hadir', 0)
            ->assertJsonPath('data.sesi.0.total', 1)
            ->assertJsonPath('data.sesi.0.tidak_hadir.0.status', 'alpha')
            ->assertJsonPath('data.sesi.0.tidak_hadir.0.alasan', 'tanpa kabar')
            ->assertJsonPath('data.ringkasan.total_sesi', 1)
            ->assertJsonPath('data.ringkasan.agenda_terisi', 1);
    }

    public function test_pantau_sesi_tanpa_agenda_ditandai_kosong(): void
    {
        Sanctum::actingAs($this->piket->user);
        $res = $this->getJson('/api/v1/piket/pantau')->assertOk();

        $res->assertJsonPath('data.sesi.0.agenda_status', 'kosong')
            ->assertJsonPath('data.sesi.0.presensi_terisi', false)
            ->assertJsonPath('data.sesi.0.total', 1)   // fallback ke jumlah roster kelas
            ->assertJsonPath('data.ringkasan.agenda_kosong', 1);
    }

    public function test_pantau_ditolak_untuk_bukan_petugas(): void
    {
        $gu = User::create(['nama' => 'Guru Lain', 'email' => 'lain@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru]);
        Teacher::create(['user_id' => $gu->id, 'is_bk' => false]);

        Sanctum::actingAs($gu->fresh());
        $this->getJson('/api/v1/piket/pantau')->assertStatus(403);
    }
}
