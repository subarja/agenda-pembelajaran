<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\DailyAttendance;
use App\Models\PiketResume;
use App\Models\PiketShift;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Absensi harian piket (daily_attendances, recorded_by=piket, lintas kelas), Resume Piket
 * PER SHIFT + snapshot rekap + ekspor PDF/Excel, dan cek kehadiran murid (cari kelas/nama).
 */
class PiketAbsensiResumeTest extends TestCase
{
    use RefreshDatabase;

    private SchoolClass $kelas;

    private Student $siswa;

    private Teacher $piket;

    private int $shiftId;

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
        $shift = PiketShift::create(['hari' => 'senin', 'nama_shift' => 'Pagi', 'jam_mulai' => '06:00', 'jam_selesai' => '15:00']);
        $shift->teachers()->attach($this->piket->id);
        $this->shiftId = $shift->id;
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
            'records' => [['student_id' => $this->siswa->uuid, 'status' => 'alpha']],
        ])->assertOk();

        $rec = DailyAttendance::where('student_id', $this->siswa->id)->first();
        $this->assertSame('alpha', $rec->status);
        $this->assertSame($this->piket->user->id, $rec->recorded_by);
    }

    public function test_resume_per_shift_simpan_baca_dan_rekap(): void
    {
        Sanctum::actingAs($this->piket->user);

        $this->postJson('/api/v1/piket/resume', ['ringkasan' => 'Hari aman terkendali', 'kejadian_penting' => 'Tidak ada'])->assertOk();
        $this->getJson('/api/v1/piket/resume')
            ->assertOk()
            ->assertJsonPath('data.ringkasan', 'Hari aman terkendali')
            ->assertJsonPath('data.penyunting', 'Pak Piket')
            ->assertJsonPath('data.shift.nama', 'Pagi')
            ->assertJsonStructure(['data' => ['rekap' => ['waktu', 'kehadiran_kelas', 'agenda', 'presensi']]]);

        // Resume terikat ke shift + snapshot rekap tersimpan.
        $resume = PiketResume::first();
        $this->assertSame($this->shiftId, $resume->piket_shift_id);
        $this->assertIsArray($resume->rekap);

        // Simpan lagi -> tetap satu resume untuk (tanggal, shift).
        $this->postJson('/api/v1/piket/resume', ['ringkasan' => 'Update'])->assertOk();
        $this->assertSame(1, PiketResume::count());
    }

    public function test_rekap_melanjutkan_dari_waktu_resume_shift_sebelumnya_tanpa_jeda(): void
    {
        // Pagi 06:00–11:00, Siang 11:00–15:00, petugas sama.
        PiketShift::where('nama_shift', 'Pagi')->update(['jam_selesai' => '11:00']);
        $siang = PiketShift::create(['hari' => 'senin', 'nama_shift' => 'Siang', 'jam_mulai' => '11:00', 'jam_selesai' => '15:00']);
        $siang->teachers()->attach($this->piket->id);

        Sanctum::actingAs($this->piket->user);

        // Pagi menyimpan resume LEBIH AWAL (10:00, sebelum shiftnya habis 11:00).
        Carbon::setTestNow('2026-03-09 10:00:00');
        $this->postJson('/api/v1/piket/resume', ['ringkasan' => 'Pagi aman'])->assertOk();

        // Aktivitas terjadi 10:30 — di "jeda" antara resume Pagi (10:00) & jam mulai Siang (11:00).
        Carbon::setTestNow('2026-03-09 10:30:00');
        DailyAttendance::create(['student_id' => $this->siswa->id, 'class_id' => $this->kelas->id, 'tanggal' => '2026-03-09', 'status' => 'hadir', 'recorded_by' => $this->piket->user->id]);

        // Siang buka resume 12:00 → window MULAI dari akhir resume Pagi (10:00), bukan 11:00.
        Carbon::setTestNow('2026-03-09 12:00:00');
        $this->getJson('/api/v1/piket/resume')
            ->assertJsonPath('data.shift.nama', 'Siang')
            ->assertJsonPath('data.rekap.mulai', '10:00')            // melanjutkan dari resume Pagi
            ->assertJsonPath('data.rekap.kehadiran_total.total', 1); // aktivitas 10:30 TIDAK hilang (tak ada jeda kosong)
    }

    public function test_rantai_berdasar_urutan_shift_melompati_yang_tanpa_resume(): void
    {
        // Pagi 06–10, Siang 10–13, Sore 13–16. Petugas sama.
        PiketShift::where('nama_shift', 'Pagi')->update(['jam_selesai' => '10:00']);
        foreach ([['Siang', '10:00', '13:00'], ['Sore', '13:00', '16:00']] as [$n, $m, $s]) {
            PiketShift::create(['hari' => 'senin', 'nama_shift' => $n, 'jam_mulai' => $m, 'jam_selesai' => $s])
                ->teachers()->attach($this->piket->id);
        }
        Sanctum::actingAs($this->piket->user);

        // Pagi simpan 09:00. Siang TIDAK simpan resume.
        Carbon::setTestNow('2026-03-09 09:00:00');
        $this->postJson('/api/v1/piket/resume', ['ringkasan' => 'Pagi'])->assertOk();

        // Sore buka 14:00 → rantai berdasar URUTAN shift, melompati Siang (tanpa resume)
        // ke Pagi (09:00). Bukan jam mulai Sore (13:00).
        Carbon::setTestNow('2026-03-09 14:00:00');
        $this->getJson('/api/v1/piket/resume')
            ->assertJsonPath('data.shift.nama', 'Sore')
            ->assertJsonPath('data.rekap.mulai', '09:00');
    }

    public function test_periode_mulai_immutable_saat_disimpan_ulang(): void
    {
        // Pagi 06:00–11:00, Siang 11:00–15:00 supaya shift aktif tak ambigu.
        PiketShift::where('nama_shift', 'Pagi')->update(['jam_selesai' => '11:00']);
        $siang = PiketShift::create(['hari' => 'senin', 'nama_shift' => 'Siang', 'jam_mulai' => '11:00', 'jam_selesai' => '15:00']);
        $siang->teachers()->attach($this->piket->id);
        Sanctum::actingAs($this->piket->user);

        // Pagi simpan 10:00 → jadi cutoff untuk shift berikutnya.
        Carbon::setTestNow('2026-03-09 10:00:00');
        $this->postJson('/api/v1/piket/resume', ['ringkasan' => 'Pagi'])->assertOk();

        // Siang simpan pertama 12:00 → periode_mulai = 10:00 (cutoff Pagi).
        Carbon::setTestNow('2026-03-09 12:00:00');
        $this->postJson('/api/v1/piket/resume', ['ringkasan' => 'Siang v1'])->assertOk();
        $siangResume = PiketResume::where('piket_shift_id', $siang->id)->first();
        $this->assertSame('10:00', $siangResume->periode_mulai->format('H:i'));

        // Siang simpan ulang 13:00 → periode_mulai TETAP 10:00 (immutable), bukan bergeser.
        Carbon::setTestNow('2026-03-09 13:00:00');
        $this->postJson('/api/v1/piket/resume', ['ringkasan' => 'Siang v2'])->assertOk();
        $this->assertSame('10:00', $siangResume->fresh()->periode_mulai->format('H:i'));
    }

    public function test_export_pdf_preview_base64(): void
    {
        PiketResume::create(['tanggal' => '2026-03-09', 'piket_shift_id' => $this->shiftId, 'ringkasan' => 'Ringkasan uji', 'teacher_id' => $this->piket->id]);
        Sanctum::actingAs($this->piket->user);

        $this->getJson('/api/v1/piket/resume/export?format=pdf&preview=1')
            ->assertOk()
            ->assertJsonStructure(['filename', 'base64']);
    }

    public function test_export_xlsx_dengan_blok_ttd_tidak_error(): void
    {
        PiketResume::create(['tanggal' => '2026-03-09', 'piket_shift_id' => $this->shiftId, 'ringkasan' => 'Uji', 'teacher_id' => $this->piket->id]);
        Sanctum::actingAs($this->piket->user);

        $this->get('/api/v1/piket/resume/export?format=xlsx')
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }

    public function test_cek_kehadiran_cari_kelas_dan_nama(): void
    {
        DailyAttendance::create(['student_id' => $this->siswa->id, 'class_id' => $this->kelas->id, 'tanggal' => '2026-03-09', 'status' => 'sakit', 'catatan' => 'demam', 'recorded_by' => $this->piket->user->id]);
        Sanctum::actingAs($this->piket->user);

        $this->getJson("/api/v1/piket/cek-kehadiran?class_id={$this->kelas->uuid}")
            ->assertOk()
            ->assertJsonPath('data.0.nama', 'Andi')
            ->assertJsonPath('data.0.status', 'sakit')
            ->assertJsonPath('data.0.catatan', 'demam');

        // Pencarian per nama.
        $this->getJson('/api/v1/piket/cek-kehadiran?nama=and')
            ->assertOk()
            ->assertJsonPath('data.0.nama', 'Andi');

        // Tanpa kelas & nama < 2 huruf -> kosong + pesan.
        $this->getJson('/api/v1/piket/cek-kehadiran')
            ->assertOk()
            ->assertJsonPath('data', [])
            ->assertJsonStructure(['message']);
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
