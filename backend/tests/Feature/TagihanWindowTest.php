<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\NonEffectiveDay;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Invarian jendela tagihan agenda: tanggal SEBELUM semester mulai dan hari tidak
 * efektif tidak pernah ditagih. Kasus nyata: semester 2026/2027 ganjil mulai Rabu
 * 15 Jul — jendela mundur perlu-diisi (batas_hari) menembus ke Senin–Selasa 13–14 Jul
 * dan menagih sesi yang belum pernah ada.
 *
 * Waktu dibekukan Kamis 16 Jul 2026; semester mulai Rabu 15 Jul 2026.
 */
class TagihanWindowTest extends TestCase
{
    use RefreshDatabase;

    private User $guru;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-07-16 10:00', config('app.school_timezone')));

        $ay = AcademicYear::create([
            'tahun' => '2026/2027', 'semester' => Semester::Ganjil,
            'tanggal_mulai' => '2026-07-15', 'tanggal_selesai' => '2026-12-04', 'aktif' => true,
        ]);

        $this->guru = User::create(['nama' => 'Guru Window', 'email' => 'guruwindow@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru]);
        Teacher::create(['user_id' => $this->guru->id, 'is_bk' => false]);
        $this->guru = $this->guru->fresh();

        $kelas   = SchoolClass::create(['tingkat' => Tingkat::XI, 'jurusan' => 'Mekatronika', 'rombel' => 'B', 'academic_year_id' => $ay->id]);
        $subject = Subject::create(['kode' => 'ING', 'nama' => 'B.Inggris', 'aktif' => true]);

        // Jadwal Senin–Kamis — Senin 13 & Selasa 14 Jul jatuh SEBELUM semester mulai.
        foreach (['senin', 'selasa', 'rabu', 'kamis'] as $hari) {
            Schedule::create([
                'class_id' => $kelas->id, 'subject_id' => $subject->id,
                'teacher_id' => $this->guru->teacher->id,
                'hari' => $hari, 'jam_mulai' => '07:30', 'jam_selesai' => '10:40', 'aktif' => true,
            ]);
        }
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_tanggal_sebelum_semester_mulai_tidak_ditagih(): void
    {
        Sanctum::actingAs($this->guru);
        $tanggal = collect($this->getJson('/api/v1/agendas/perlu-diisi')->assertOk()->json('data'))
            ->pluck('tanggal')->all();

        $this->assertNotContains('2026-07-13', $tanggal); // Senin — sebelum semester
        $this->assertNotContains('2026-07-14', $tanggal); // Selasa — sebelum semester
        $this->assertContains('2026-07-15', $tanggal);    // Rabu — hari pertama semester
        $this->assertContains('2026-07-16', $tanggal);    // Kamis — hari ini
    }

    public function test_hari_tidak_efektif_tidak_ditagih(): void
    {
        NonEffectiveDay::create(['tanggal' => '2026-07-15', 'status' => 'tidak_efektif', 'keterangan' => 'Libur uji']);
        \App\Support\TanggalTagihan::flush();

        Sanctum::actingAs($this->guru);
        $tanggal = collect($this->getJson('/api/v1/agendas/perlu-diisi')->json('data'))
            ->pluck('tanggal')->all();

        $this->assertNotContains('2026-07-15', $tanggal); // libur → bebas
        $this->assertContains('2026-07-16', $tanggal);
    }
}
