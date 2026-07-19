<?php

namespace Tests\Unit;

use App\Enums\Semester;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\KokurikulerProject;
use App\Models\PklPlacement;
use App\Models\PklSetting;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Support\KokurikulerMode;
use App\Support\PklMode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Nilai batas pembebasan tagihan agenda oleh Mode PKL dan Mode Kokurikuler.
 *
 * Test Feature yang ada membuktikan perilaku umum (dalam/di luar periode, draft tidak
 * membebaskan, saklar OFF tidak retroaktif). Yang belum terkunci adalah TEPI-nya:
 * tanggal mulai dan tanggal selesai periode itu sendiri, dan tanggal tepat sehari di
 * luarnya. Guru yang kehilangan atau mendapat tagihan palsu di hari pertama/terakhir
 * PKL adalah keluhan yang mahal untuk dilacak, dan murah untuk dicegah di sini.
 *
 * Waktu dibekukan Jumat 13 Mar 2026 supaya "lampau vs hari ini" pasti.
 */
class ModeExemptBoundaryTest extends TestCase
{
    use RefreshDatabase;

    private AcademicYear $ay;
    private SchoolClass $kelasXII;
    private SchoolClass $kelasXI;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-03-13 10:00', config('app.school_timezone')));
        PklMode::flush();
        KokurikulerMode::flush();

        $this->ay = AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-01-05', 'tanggal_selesai' => '2026-06-19', 'aktif' => true,
        ]);

        $this->kelasXII = SchoolClass::create([
            'tingkat' => Tingkat::XII, 'jurusan' => 'Animasi', 'rombel' => 'A',
            'academic_year_id' => $this->ay->id,
        ]);
        $this->kelasXI = SchoolClass::create([
            'tingkat' => Tingkat::XI, 'jurusan' => 'Animasi', 'rombel' => 'A',
            'academic_year_id' => $this->ay->id,
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        PklMode::flush();
        KokurikulerMode::flush();
        parent::tearDown();
    }

    private function placement(SchoolClass $kelas, string $mulai, string $selesai): void
    {
        $u = User::create([
            'nama' => 'Guru Bimbing '.$kelas->id, 'email' => "gb{$kelas->id}@test.sch.id",
            'password' => 'secret123', 'role' => UserRole::Guru,
        ]);
        $t = Teacher::create(['user_id' => $u->id, 'is_bk' => false]);

        $su = User::create([
            'nama' => 'Siswa '.$kelas->id, 'email' => "sp{$kelas->id}@test.sch.id",
            'password' => 'secret123', 'role' => UserRole::Siswa,
        ]);
        $s = Student::create(['user_id' => $su->id, 'nis' => '90'.$kelas->id, 'class_id' => $kelas->id]);

        PklPlacement::create([
            'student_id' => $s->id, 'class_id' => $kelas->id, 'academic_year_id' => $this->ay->id,
            'pembimbing_teacher_id' => $t->id,
            'tempat_pkl' => 'PT Uji', 'alamat_pkl' => 'Jl. Uji',
            'tanggal_mulai' => $mulai, 'tanggal_selesai' => $selesai,
        ]);

        PklMode::flush();
    }

    // ── PKL: tepi periode penempatan ─────────────────────────────────────────

    /**
     * Periode 2–31 Mar dengan saklar ON. Hari pertama & terakhir periode HARUS
     * bebas; sehari sebelum/sesudahnya ditagih reguler.
     */
    public function test_pkl_tepi_periode_inklusif(): void
    {
        PklSetting::instance()->update(['aktif' => true]);
        $this->placement($this->kelasXII, '2026-03-02', '2026-03-31');

        $id = $this->kelasXII->id;

        $this->assertFalse(PklMode::isAgendaExempt($id, '2026-03-01'), 'H-1 periode masih ditagih reguler');
        $this->assertTrue(PklMode::isAgendaExempt($id, '2026-03-02'), 'hari PERTAMA periode PKL harus bebas');
        $this->assertTrue(PklMode::isAgendaExempt($id, '2026-03-31'), 'hari TERAKHIR periode PKL harus bebas');
        $this->assertFalse(PklMode::isAgendaExempt($id, '2026-04-01'), 'H+1 periode kembali ditagih reguler');
    }

    /**
     * Saklar ON tanpa penempatan sama sekali tidak membebaskan apa pun — kalau
     * tidak, kewajiban lenyap dua-duanya (reguler bebas, PKL tak bisa diisi).
     */
    public function test_pkl_saklar_on_tanpa_penempatan_tidak_membebaskan(): void
    {
        PklSetting::instance()->update(['aktif' => true]);
        PklMode::flush();

        $this->assertFalse(PklMode::isAgendaExempt($this->kelasXII->id, '2026-03-10'));
    }

    /**
     * Saklar OFF: batas berlaku KE DEPAN. Tanggal lampau tetap bebas (tidak
     * retroaktif), tapi HARI INI dan ke depan kembali ditagih reguler.
     * Tepi yang diuji adalah "hari ini" itu sendiri — 13 Mar 2026.
     */
    public function test_pkl_saklar_off_tepi_hari_ini(): void
    {
        PklSetting::instance()->update(['aktif' => false]);
        $this->placement($this->kelasXII, '2026-03-02', '2026-03-31');

        $id = $this->kelasXII->id;

        $this->assertTrue(PklMode::isAgendaExempt($id, '2026-03-12'), 'kemarin (lampau) tetap bebas');
        $this->assertFalse(PklMode::isAgendaExempt($id, '2026-03-13'), 'HARI INI kembali ditagih reguler');
        $this->assertFalse(PklMode::isAgendaExempt($id, '2026-03-14'), 'besok ditagih reguler');
    }

    /** Kelas tanpa penempatan tidak terpengaruh, apa pun status saklarnya. */
    public function test_pkl_kelas_xi_tanpa_penempatan_tidak_pernah_bebas(): void
    {
        PklSetting::instance()->update(['aktif' => true]);
        $this->placement($this->kelasXII, '2026-03-02', '2026-03-31');

        $this->assertFalse(
            PklMode::isAgendaExempt($this->kelasXI->id, '2026-03-10'),
            'kelas XI tidak pernah terpengaruh Mode PKL'
        );
    }

    /**
     * Gating tingkat untuk pelabelan mapel: HANYA XII yang berganti nama menjadi
     * "Praktek Kerja Lapangan".
     */
    public function test_pkl_gating_tingkat_hanya_xii(): void
    {
        $this->assertTrue(PklMode::isPklClass(Tingkat::XII));
        $this->assertFalse(PklMode::isPklClass(Tingkat::XI));
        $this->assertFalse(PklMode::isPklClass(Tingkat::X));
        $this->assertFalse(PklMode::isPklClass(null));
    }

    /** class_id null (sesi tanpa kelas) tidak pernah dibebaskan. */
    public function test_pkl_class_id_null_tidak_bebas(): void
    {
        PklSetting::instance()->update(['aktif' => true]);
        $this->placement($this->kelasXII, '2026-03-02', '2026-03-31');

        $this->assertFalse(PklMode::isAgendaExempt(null, '2026-03-10'));
    }

    // ── Kokurikuler: status projek & tepi periode ────────────────────────────

    private function projek(string $status, string $mulai, string $selesai, ?string $tingkat = 'XI'): KokurikulerProject
    {
        $p = KokurikulerProject::create([
            'judul'            => "Projek {$status}",
            'status'           => $status,
            'tingkat'          => $tingkat,
            'academic_year_id' => $this->ay->id,
            'tanggal_mulai'    => $mulai,
            'tanggal_selesai'  => $selesai,
        ]);

        KokurikulerMode::flush();

        return $p;
    }

    /** Projek AKTIF membebaskan, dan tepi periodenya inklusif. */
    public function test_kokurikuler_tepi_periode_inklusif(): void
    {
        $this->projek('aktif', '2026-03-02', '2026-03-06');

        $id = $this->kelasXI->id;

        $this->assertFalse(KokurikulerMode::isAgendaExempt($id, '2026-03-01'), 'H-1 projek masih ditagih');
        $this->assertTrue(KokurikulerMode::isAgendaExempt($id, '2026-03-02'), 'hari PERTAMA projek harus bebas');
        $this->assertTrue(KokurikulerMode::isAgendaExempt($id, '2026-03-06'), 'hari TERAKHIR projek harus bebas');
        $this->assertFalse(KokurikulerMode::isAgendaExempt($id, '2026-03-07'), 'H+1 projek kembali ditagih');
    }

    /** Projek DRAFT tidak membebaskan apa pun — belum berjalan. */
    public function test_kokurikuler_draft_tidak_membebaskan(): void
    {
        $this->projek('draft', '2026-03-02', '2026-03-06');

        $this->assertFalse(KokurikulerMode::isAgendaExempt($this->kelasXI->id, '2026-03-04'));
    }

    /**
     * Projek SELESAI tetap membebaskan tanggal lamanya — sesi semasa kokurikuler
     * tidak boleh berubah menjadi hutang tagihan hanya karena projeknya ditutup.
     */
    public function test_kokurikuler_selesai_tetap_membebaskan_tanggal_lampau(): void
    {
        $this->projek('selesai', '2026-03-02', '2026-03-06');

        $this->assertTrue(
            KokurikulerMode::isAgendaExempt($this->kelasXI->id, '2026-03-04'),
            'projek selesai harus tetap membebaskan tanggal dalam periodenya'
        );
    }

    /** Pembebasan per-tingkat hanya menyentuh tingkat yang disebut projek. */
    public function test_kokurikuler_tingkat_lain_tidak_ikut_bebas(): void
    {
        $this->projek('aktif', '2026-03-02', '2026-03-06', 'XI');

        $this->assertTrue(KokurikulerMode::isAgendaExempt($this->kelasXI->id, '2026-03-04'));
        $this->assertFalse(
            KokurikulerMode::isAgendaExempt($this->kelasXII->id, '2026-03-04'),
            'projek bertingkat XI tidak boleh membebaskan kelas XII'
        );
    }

    /** tingkat null = seluruh tingkat pada TA projek ikut bebas. */
    public function test_kokurikuler_tingkat_null_membebaskan_semua(): void
    {
        $this->projek('aktif', '2026-03-02', '2026-03-06', null);

        $this->assertTrue(KokurikulerMode::isAgendaExempt($this->kelasXI->id, '2026-03-04'));
        $this->assertTrue(KokurikulerMode::isAgendaExempt($this->kelasXII->id, '2026-03-04'));
    }

    /** Dua pembebasan berlaku bersamaan & independen (matriks PKL × Kokurikuler). */
    public function test_pkl_dan_kokurikuler_independen(): void
    {
        PklSetting::instance()->update(['aktif' => true]);
        $this->placement($this->kelasXII, '2026-03-02', '2026-03-31');
        $this->projek('aktif', '2026-03-02', '2026-03-06', 'XI');

        // XII bebas karena PKL, bukan karena kokurikuler.
        $this->assertTrue(PklMode::isAgendaExempt($this->kelasXII->id, '2026-03-04'));
        $this->assertFalse(KokurikulerMode::isAgendaExempt($this->kelasXII->id, '2026-03-04'));

        // XI bebas karena kokurikuler, bukan karena PKL.
        $this->assertTrue(KokurikulerMode::isAgendaExempt($this->kelasXI->id, '2026-03-04'));
        $this->assertFalse(PklMode::isAgendaExempt($this->kelasXI->id, '2026-03-04'));
    }

    /** class_id null tidak pernah dibebaskan kokurikuler. */
    public function test_kokurikuler_class_id_null_tidak_bebas(): void
    {
        $this->projek('aktif', '2026-03-02', '2026-03-06');

        $this->assertFalse(KokurikulerMode::isAgendaExempt(null, '2026-03-04'));
    }
}
