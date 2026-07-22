<?php

namespace Tests\Feature;

use App\Enums\CharacterSifat;
use App\Enums\Semester;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\CharacterCategory;
use App\Models\CharacterInput;
use App\Models\CharacterSubitem;
use App\Models\IzinKesiangan;
use App\Models\PiketAssignment;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Services\CharacterService;
use App\Support\BellSchedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Sprint 5 modul Bel: izin kesiangan -> verifikasi piket -> poin KD-04 otomatis proporsional
 * (anti-dobel) + integrasi presensi "hadir terlambat X menit".
 */
class IzinKesianganTest extends TestCase
{
    use RefreshDatabase;

    private Student $siswa;
    private Teacher $piket;
    private CharacterSubitem $kd04;

    protected function setUp(): void
    {
        parent::setUp();
        BellSchedule::flush();
        Carbon::setTestNow('2026-03-09 07:20:00'); // Senin, 20 menit setelah masuk 07:00

        $ay = AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-02-09', 'tanggal_selesai' => '2026-06-19', 'aktif' => true,
        ]);
        $kelas = SchoolClass::create(['tingkat' => Tingkat::X, 'jurusan' => 'Mekatronika', 'rombel' => 'A', 'academic_year_id' => $ay->id]);

        // Bel Senin jam ke-1 mulai 07:00 -> jam masuk sekolah 07:00.
        \App\Models\BellPeriod::create(['hari' => 'senin', 'jam_ke' => 1, 'jam_mulai' => '07:00', 'jam_selesai' => '07:45']);

        $cat = CharacterCategory::create(['nama' => 'Kedisiplinan', 'aktif' => true]);
        $this->kd04 = CharacterSubitem::create(['category_id' => $cat->id, 'kode' => 'KD-04', 'deskripsi' => 'Terlambat masuk kelas', 'bobot' => -5, 'sifat' => CharacterSifat::Negatif, 'aktif' => true]);

        $su = User::create(['nama' => 'Andi Siswa', 'email' => 'andi@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Siswa]);
        $this->siswa = Student::create(['user_id' => $su->id, 'nis' => '12345', 'class_id' => $kelas->id]);

        $pu = User::create(['nama' => 'Pak Piket', 'email' => 'piket@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru]);
        $this->piket = Teacher::create(['user_id' => $pu->id, 'is_bk' => false]);
        PiketAssignment::create(['tanggal' => '2026-03-09', 'teacher_id' => $this->piket->id]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_ajukan_menghitung_keterlambatan_dari_jam_masuk(): void
    {
        Sanctum::actingAs($this->siswa->user);
        $this->postJson('/api/v1/izin-kesiangan', ['alasan' => 'Ban bocor'])
            ->assertCreated()
            ->assertJsonPath('data.terlambat_menit', 20);
    }

    public function test_verifikasi_menerapkan_poin_proporsional_sekali(): void
    {
        Sanctum::actingAs($this->siswa->user);
        $this->postJson('/api/v1/izin-kesiangan', [])->assertCreated();
        $uuid = IzinKesiangan::first()->uuid;

        Sanctum::actingAs($this->piket->user);
        $this->postJson("/api/v1/piket/kesiangan/{$uuid}/verifikasi", ['aksi' => 'setujui'])->assertOk();

        // 20 menit -> tier 16-30 -> -5.
        $input = CharacterInput::where('sumber', 'sistem')->where('subitem_id', $this->kd04->id)->first();
        $this->assertNotNull($input);
        $this->assertSame(-5, $input->poin_override);
        $this->assertSame('negatif', $input->sign->value);
        $this->assertSame($this->piket->id, $input->teacher_id);

        // Net score proporsional tier (-5), bukan bobot mentah.
        $this->assertSame(-5, app(CharacterService::class)->calculateNetScore($this->siswa));

        // Verifikasi ulang tidak menggandakan poin.
        $this->postJson("/api/v1/piket/kesiangan/{$uuid}/verifikasi", ['aksi' => 'setujui'])->assertOk();
        $this->assertSame(1, CharacterInput::where('sumber', 'sistem')->count());
    }

    public function test_ditolak_tetap_kena_poin(): void
    {
        Sanctum::actingAs($this->siswa->user);
        $this->postJson('/api/v1/izin-kesiangan', [])->assertCreated();
        $uuid = IzinKesiangan::first()->uuid;

        Sanctum::actingAs($this->piket->user);
        $this->postJson("/api/v1/piket/kesiangan/{$uuid}/verifikasi", ['aksi' => 'tolak'])->assertOk();

        $this->assertSame(1, CharacterInput::where('sumber', 'sistem')->count());
        $this->assertSame('ditolak', IzinKesiangan::first()->status->value);
    }

    public function test_ajukan_ganda_hari_sama_ditolak(): void
    {
        Sanctum::actingAs($this->siswa->user);
        $this->postJson('/api/v1/izin-kesiangan', [])->assertCreated();
        $this->postJson('/api/v1/izin-kesiangan', [])->assertStatus(422);
    }

    public function test_presensi_default_alpha_dan_hadir_terlambat(): void
    {
        // Kesiangan tercatat (20 menit) untuk siswa hari ini.
        IzinKesiangan::create(['student_id' => $this->siswa->id, 'tanggal' => '2026-03-09', 'status' => 'diajukan', 'waktu_tiba' => now(), 'terlambat_menit' => 20]);

        $subject = \App\Models\Subject::create(['kode' => 'IND', 'nama' => 'B.Indonesia', 'aktif' => true]);
        $schedule = \App\Models\Schedule::create([
            'class_id' => $this->siswa->class_id, 'subject_id' => $subject->id, 'teacher_id' => $this->piket->id,
            'hari' => 'senin', 'jam_mulai' => '07:00', 'jam_selesai' => '08:30', 'aktif' => true,
        ]);
        $agenda = \App\Models\Agenda::create(['schedule_id' => $schedule->id, 'tanggal' => '2026-03-09', 'status' => 'submitted']);

        Sanctum::actingAs($this->piket->user);

        // Index: siswa kesiangan default alpha (bukan hadir) + kesiangan_menit tampil.
        $rec = collect($this->getJson("/api/v1/agendas/{$agenda->uuid}/presensi")->json('data.records'))
            ->firstWhere('student_id', $this->siswa->uuid);
        $this->assertSame('alpha', $rec['status']);
        $this->assertSame(20, $rec['kesiangan_menit']);

        // Guru menandai HADIR -> durasi_terlambat mengikuti sistem (20 menit).
        $this->postJson("/api/v1/agendas/{$agenda->uuid}/presensi", [
            'records' => [['student_id' => $this->siswa->uuid, 'status' => 'hadir', 'durasi_terlambat' => 0]],
        ])->assertOk();

        $this->assertSame(20, \App\Models\StudentAttendance::first()->durasi_terlambat);
        $this->assertSame('hadir', \App\Models\StudentAttendance::first()->status->value);
    }

    public function test_poin_manual_guru_tetap_terhitung_terpisah(): void
    {
        // Poin sistem KD-04 + poin guru manual subitem lain harus dijumlah, tak saling timpa.
        IzinKesiangan::create(['student_id' => $this->siswa->id, 'tanggal' => '2026-03-09', 'status' => 'disetujui', 'waktu_tiba' => now(), 'terlambat_menit' => 20, 'diverifikasi_oleh' => $this->piket->id]);
        app(\App\Services\KesianganService::class)->terapkanPoin(IzinKesiangan::first());

        // Guru beri pelanggaran lain (bobot -3) manual, tanggal_kejadian NULL.
        CharacterInput::create(['student_id' => $this->siswa->id, 'subitem_id' => $this->kd04->id, 'teacher_id' => $this->piket->id, 'sign' => 'negatif', 'sumber' => 'guru']);

        // Dua baris berbeda (sistem tanggal terisi, guru NULL) -> tidak bentrok unique.
        $this->assertSame(2, CharacterInput::where('subitem_id', $this->kd04->id)->count());
    }
}
