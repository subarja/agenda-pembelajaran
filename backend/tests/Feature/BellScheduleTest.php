<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\BellDayDefault;
use App\Models\BellMode;
use App\Models\BellModeOverride;
use App\Models\BellPeriod;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use App\Support\BellSchedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Invarian Jam & Bel: "pukul berapa sesi ini" diselesaikan dari bel per hari (jam ke-)
 * + mode pergeseran (Apel/Tanpa Apel) dengan prioritas override tanggal → default hari
 * → default global. Jadwal tanpa jam-ke tetap ikut bergeser oleh mode.
 */
class BellScheduleTest extends TestCase
{
    use RefreshDatabase;

    private Schedule $senin;
    private Schedule $jumat;

    protected function setUp(): void
    {
        parent::setUp();
        BellSchedule::flush();

        AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-02-09', 'tanggal_selesai' => '2026-06-19', 'aktif' => true,
        ]);

        $kelas   = SchoolClass::create(['tingkat' => Tingkat::X, 'jurusan' => 'Mekatronika', 'rombel' => 'A', 'academic_year_id' => AcademicYear::first()->id]);
        $subject = Subject::create(['kode' => 'IND', 'nama' => 'B.Indonesia', 'aktif' => true]);

        $user = User::create(['nama' => 'Guru Bel', 'email' => 'gurubel@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru]);
        $guru = Teacher::create(['user_id' => $user->id, 'is_bk' => false]);

        // Bel Senin 45 menit/jam-ke, Jumat 35 menit/jam-ke — meniru kasus nyata:
        // durasi Jumat beda dan tidak pernah ada di XML.
        foreach ([1 => ['07:00', '07:45'], 2 => ['07:45', '08:30']] as $ke => [$m, $s]) {
            BellPeriod::create(['hari' => 'senin', 'jam_ke' => $ke, 'jam_mulai' => $m, 'jam_selesai' => $s]);
        }
        foreach ([1 => ['07:00', '07:35'], 2 => ['07:35', '08:10']] as $ke => [$m, $s]) {
            BellPeriod::create(['hari' => 'jumat', 'jam_ke' => $ke, 'jam_mulai' => $m, 'jam_selesai' => $s]);
        }

        $base = [
            'class_id' => $kelas->id, 'subject_id' => $subject->id, 'teacher_id' => $guru->id,
            'jam_ke_mulai' => 1, 'jam_ke_selesai' => 2,
            'jam_mulai' => '07:00', 'jam_selesai' => '08:30', 'aktif' => true,
        ];
        $this->senin = Schedule::create([...$base, 'hari' => 'senin']);
        $this->jumat = Schedule::create([...$base, 'hari' => 'jumat']);
    }

    private function admin(): User
    {
        return User::create(['nama' => 'Admin', 'email' => 'admin@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Admin]);
    }

    // ── Resolusi dasar ────────────────────────────────────────────────────────

    public function test_bel_per_hari_menentukan_durasi_jumat_yang_beda(): void
    {
        $this->assertSame(
            ['jam_mulai' => '07:00:00', 'jam_selesai' => '08:30:00'],
            BellSchedule::resolve($this->senin, '2026-03-09'),
        );

        // Jam-ke sama, tapi bel Jumat lebih pendek → selesai 08:10, bukan 08:30 tersimpan.
        $this->assertSame(
            ['jam_mulai' => '07:00:00', 'jam_selesai' => '08:10:00'],
            BellSchedule::resolve($this->jumat, '2026-03-13'),
        );
    }

    public function test_jadwal_tanpa_jam_ke_memakai_jam_tersimpan(): void
    {
        $this->senin->update(['jam_ke_mulai' => null, 'jam_ke_selesai' => null]);

        $jam = BellSchedule::resolve($this->senin->fresh(), '2026-03-09');
        $this->assertSame('08:30:00', $jam['jam_selesai']);
    }

    public function test_jam_ke_tanpa_baris_bel_jatuh_ke_jam_tersimpan(): void
    {
        BellPeriod::where('hari', 'senin')->where('jam_ke', 2)->delete();
        BellSchedule::flush();

        $jam = BellSchedule::resolve($this->senin, '2026-03-09');
        $this->assertSame('07:00:00', $jam['jam_mulai']);   // jam-ke 1 masih dari bel
        $this->assertSame('08:30:00', $jam['jam_selesai']); // jam-ke 2 fallback tersimpan
    }

    // ── Mode Apel / Tanpa Apel ───────────────────────────────────────────────

    public function test_default_global_tanpa_apel_menggeser_semua_hari(): void
    {
        BellMode::where('nama', 'Apel')->update(['is_default' => false]);
        BellMode::where('nama', 'Tanpa Apel')->update(['is_default' => true]);
        BellSchedule::flush();

        $this->assertSame('06:00:00', BellSchedule::resolve($this->senin, '2026-03-09')['jam_mulai']);
        // Jumat tetap memakai bel Jumat, hanya bergeser -60.
        $this->assertSame(
            ['jam_mulai' => '06:00:00', 'jam_selesai' => '07:10:00'],
            BellSchedule::resolve($this->jumat, '2026-03-13'),
        );
    }

    public function test_override_tanggal_hanya_menggeser_tanggal_itu(): void
    {
        $tanpaApel = BellMode::where('nama', 'Tanpa Apel')->first();
        BellModeOverride::create(['tanggal' => '2026-03-09', 'bell_mode_id' => $tanpaApel->id]);
        BellSchedule::flush();

        $this->assertSame('06:00:00', BellSchedule::resolve($this->senin, '2026-03-09')['jam_mulai']);
        $this->assertSame('07:00:00', BellSchedule::resolve($this->senin, '2026-03-16')['jam_mulai']);
    }

    public function test_default_per_hari_mengalahkan_default_global(): void
    {
        $tanpaApel = BellMode::where('nama', 'Tanpa Apel')->first();
        BellDayDefault::create(['hari' => 'jumat', 'bell_mode_id' => $tanpaApel->id]);
        BellSchedule::flush();

        $this->assertSame('06:00:00', BellSchedule::resolve($this->jumat, '2026-03-13')['jam_mulai']);
        $this->assertSame('07:00:00', BellSchedule::resolve($this->senin, '2026-03-09')['jam_mulai']);
    }

    public function test_mode_menggeser_jadwal_tanpa_jam_ke_juga(): void
    {
        $this->senin->update(['jam_ke_mulai' => null, 'jam_ke_selesai' => null]);
        $tanpaApel = BellMode::where('nama', 'Tanpa Apel')->first();
        BellModeOverride::create(['tanggal' => '2026-03-09', 'bell_mode_id' => $tanpaApel->id]);
        BellSchedule::flush();

        $this->assertSame(
            ['jam_mulai' => '06:00:00', 'jam_selesai' => '07:30:00'],
            BellSchedule::resolve($this->senin->fresh(), '2026-03-09'),
        );
    }

    // ── Istirahat terkunci (tidak bergeser oleh mode) ────────────────────────

    /**
     * Periode terkunci (istirahat) mempertahankan jam dindingnya walau mode
     * Tanpa Apel menggeser awal hari −60. Jam pelajaran biasa tetap ikut bergeser.
     */
    public function test_periode_terkunci_tidak_bergeser_oleh_mode(): void
    {
        // Istirahat jam ke-5, 10:00–10:15, terkunci pada jam dinding.
        BellPeriod::create([
            'hari' => 'senin', 'jam_ke' => 5, 'jam_mulai' => '10:00', 'jam_selesai' => '10:15',
            'is_istirahat' => true, 'terkunci_offset' => true,
        ]);
        $istirahat = Schedule::create([
            'class_id' => $this->senin->class_id, 'subject_id' => $this->senin->subject_id,
            'teacher_id' => $this->senin->teacher_id, 'hari' => 'senin',
            'jam_ke_mulai' => 5, 'jam_ke_selesai' => 5,
            'jam_mulai' => '10:00', 'jam_selesai' => '10:15', 'aktif' => true,
        ]);

        BellMode::where('nama', 'Apel')->update(['is_default' => false]);
        BellMode::where('nama', 'Tanpa Apel')->update(['is_default' => true]);
        BellSchedule::flush();

        // Jam pelajaran biasa bergeser −60 …
        $this->assertSame('06:00:00', BellSchedule::resolve($this->senin, '2026-03-09')['jam_mulai']);
        // … tapi istirahat terkunci tetap di jam dinding aslinya.
        $this->assertSame(
            ['jam_mulai' => '10:00:00', 'jam_selesai' => '10:15:00'],
            BellSchedule::resolve($istirahat, '2026-03-09'),
        );
    }

    // ── Jam masuk sekolah (basis keterlambatan) ──────────────────────────────

    public function test_jam_masuk_sekolah_ikut_mode_apel_dan_tanpa_apel(): void
    {
        // Apel (default) → jam ke-1 senin mulai 07:00.
        $this->assertSame('07:00:00', BellSchedule::jamMasukSekolah('2026-03-09'));

        BellMode::where('nama', 'Apel')->update(['is_default' => false]);
        BellMode::where('nama', 'Tanpa Apel')->update(['is_default' => true]);
        BellSchedule::flush();

        // Tanpa Apel → maju −60 menit.
        $this->assertSame('06:00:00', BellSchedule::jamMasukSekolah('2026-03-09'));
    }

    public function test_jam_masuk_sekolah_null_untuk_hari_tanpa_bel(): void
    {
        // Minggu (2026-03-15) tidak punya bel jam ke-1.
        $this->assertNull(BellSchedule::jamMasukSekolah('2026-03-15'));
    }

    // ── API admin ────────────────────────────────────────────────────────────

    public function test_admin_bisa_mengganti_bel_satu_hari(): void
    {
        Sanctum::actingAs($this->admin());

        $this->putJson('/api/v1/admin/bell-schedule/periods', [
            'hari'    => 'jumat',
            'periods' => [
                ['jam_ke' => 1, 'jam_mulai' => '07:00', 'jam_selesai' => '07:30'],
                ['jam_ke' => 2, 'jam_mulai' => '07:30', 'jam_selesai' => '08:00'],
            ],
        ])->assertOk();

        $this->assertSame('08:00:00', BellSchedule::resolve($this->jumat, '2026-03-13')['jam_selesai']);
        // Bel hari lain tidak tersentuh.
        $this->assertSame('08:30:00', BellSchedule::resolve($this->senin, '2026-03-09')['jam_selesai']);
    }

    public function test_admin_bisa_menambah_pengecualian_banyak_tanggal_sekaligus(): void
    {
        Sanctum::actingAs($this->admin());
        $tanpaApel = BellMode::where('nama', 'Tanpa Apel')->first();

        $this->postJson('/api/v1/admin/bell-schedule/overrides', [
            'tanggal'      => ['2026-03-09', '2026-03-10'],
            'bell_mode_id' => $tanpaApel->id,
            'keterangan'   => 'Cuaca panas — masuk lebih awal',
        ])->assertCreated();

        $this->assertSame('06:00:00', BellSchedule::resolve($this->senin, '2026-03-09')['jam_mulai']);
        $this->assertDatabaseCount('bell_mode_overrides', 2);
    }

    public function test_mode_default_tidak_bisa_dihapus_dan_selalu_tepat_satu(): void
    {
        Sanctum::actingAs($this->admin());
        $apel      = BellMode::where('nama', 'Apel')->first();
        $tanpaApel = BellMode::where('nama', 'Tanpa Apel')->first();

        $this->deleteJson("/api/v1/admin/bell-schedule/modes/{$apel->id}")->assertStatus(422);

        $this->putJson("/api/v1/admin/bell-schedule/modes/{$tanpaApel->id}", ['is_default' => true])->assertOk();
        $this->assertSame(1, BellMode::where('is_default', true)->count());
        $this->assertTrue($tanpaApel->fresh()->is_default);

        // Setelah default pindah, Apel boleh dihapus.
        $this->deleteJson("/api/v1/admin/bell-schedule/modes/{$apel->id}")->assertOk();
    }
}
