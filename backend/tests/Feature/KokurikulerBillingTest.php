<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\KokurikulerProject;
use App\Models\KokurikulerProjectClass;
use App\Models\KokurikulerReport;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use App\Support\KokurikulerMode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Invarian tagihan saat projek kokurikuler berjalan:
 *  - SEMUA guru pengampu kelas ber-tingkat projek bebas tagihan agenda reguler pada
 *    periode projek — cukup lewat field `tingkat`, tanpa perlu tiap kelas terdaftar
 *    eksplisit (dulu hanya baris kelas eksplisit yang bebas → guru XI tetap ditagih);
 *  - fasilitator DITAGIH laporan harian kokurikuler sebagai ganti agenda reguler;
 *  - sesi di luar periode tetap ditagih normal; projek draft tidak membebaskan apa pun.
 *
 * Waktu dibekukan Rabu 11 Mar 2026; periode projek Senin 9 Mar – Jumat 13 Mar 2026.
 */
class KokurikulerBillingTest extends TestCase
{
    use RefreshDatabase;

    private User $guruXi;       // pengajar XI, BUKAN fasilitator

    private User $waliXi;       // wali kelas XI = fasilitator projek

    private SchoolClass $kelasXiA;

    private SchoolClass $kelasXA;

    private KokurikulerProject $project;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-03-11 10:00', config('app.school_timezone')));
        KokurikulerMode::flush();

        $ay = AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-01-05', 'tanggal_selesai' => '2026-06-19', 'aktif' => true,
        ]);

        $this->guruXi = $this->makeTeacher('Guru Sebelas');
        $this->waliXi = $this->makeTeacher('Wali Sebelas');

        $this->kelasXiA = SchoolClass::create(['tingkat' => Tingkat::XI, 'jurusan' => 'Animasi', 'rombel' => 'A', 'academic_year_id' => $ay->id, 'wali_kelas_id' => $this->waliXi->id]);
        $this->kelasXA = SchoolClass::create(['tingkat' => Tingkat::X,  'jurusan' => 'Animasi', 'rombel' => 'A', 'academic_year_id' => $ay->id]);

        $subject = Subject::create(['kode' => 'ANM', 'nama' => 'KK Animasi', 'aktif' => true]);

        // guruXi mengajar Rabu di XI A (hari ini) dan Rabu di X A (pembanding).
        foreach ([$this->kelasXiA, $this->kelasXA] as $kelas) {
            Schedule::create([
                'class_id' => $kelas->id, 'subject_id' => $subject->id,
                'teacher_id' => $this->guruXi->teacher->id,
                'hari' => 'rabu', 'jam_mulai' => '07:00', 'jam_selesai' => '08:30', 'aktif' => true,
            ]);
        }

        // Projek AKTIF tingkat XI, Senin–Jumat minggu ini. HANYA field tingkat —
        // kelas XI A sengaja TIDAK didaftarkan eksplisit (skenario bug di lapangan).
        $this->project = KokurikulerProject::create([
            'academic_year_id' => $ay->id, 'judul' => 'Projek Gaya Hidup Berkelanjutan',
            'tema' => 'P5', 'tingkat' => 'XI',
            'tanggal_mulai' => '2026-03-09', 'tanggal_selesai' => '2026-03-13',
            'status' => 'aktif',
        ]);
        KokurikulerMode::flush();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        KokurikulerMode::flush();
        parent::tearDown();
    }

    private function makeTeacher(string $nama): User
    {
        $u = User::create(['nama' => $nama, 'email' => str()->slug($nama).'@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru]);
        Teacher::create(['user_id' => $u->id, 'is_bk' => false]);

        return $u->fresh();
    }

    // ── Pembebasan berbasis tingkat ──────────────────────────────────────────

    public function test_guru_kelas_tingkat_projek_bebas_tagihan_tanpa_daftar_kelas_eksplisit(): void
    {
        Sanctum::actingAs($this->guruXi);
        $rows = $this->getJson('/api/v1/agendas/perlu-diisi')->assertOk()->json('data');

        // Sesi XI A hari ini bebas; sesi X A tetap ditagih.
        $kelas = array_column($rows, 'kelas');
        $this->assertNotContains('XI Animasi A', $kelas);
        $this->assertContains('X Animasi A', $kelas);
    }

    public function test_di_luar_periode_projek_kembali_ditagih(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-03-18 10:00', config('app.school_timezone'))); // Rabu berikutnya

        Sanctum::actingAs($this->guruXi);
        $kelas = array_column($this->getJson('/api/v1/agendas/perlu-diisi')->json('data'), 'kelas');
        $this->assertContains('XI Animasi A', $kelas);
    }

    public function test_projek_draft_tidak_membebaskan(): void
    {
        $this->project->update(['status' => 'draft']);
        KokurikulerMode::flush();

        Sanctum::actingAs($this->guruXi);
        $kelas = array_column($this->getJson('/api/v1/agendas/perlu-diisi')->json('data'), 'kelas');
        $this->assertContains('XI Animasi A', $kelas);
    }

    // ── Tagihan fasilitator ──────────────────────────────────────────────────

    public function test_fasilitator_ditagih_laporan_harian_kokurikuler(): void
    {
        KokurikulerProjectClass::create([
            'project_id' => $this->project->id, 'class_id' => $this->kelasXiA->id,
            'fasilitator_user_id' => $this->waliXi->id,
        ]);
        KokurikulerMode::flush();

        Sanctum::actingAs($this->waliXi);
        $rows = collect($this->getJson('/api/v1/agendas/perlu-diisi')->assertOk()->json('data'));

        $kk = $rows->where('jenis', 'kokurikuler')->values();
        // Senin 9, Selasa 10, Rabu 11 (hari ini) — 3 hari pelaksanaan belum dilaporkan.
        $this->assertCount(3, $kk);
        $this->assertSame(['2026-03-09', '2026-03-10', '2026-03-11'], $kk->pluck('tanggal')->all());
        $this->assertTrue($kk->every(fn ($r) => str_contains($r['mapel'], 'Kokurikuler')));
        $this->assertTrue((bool) $kk->firstWhere('tanggal', '2026-03-11')['bisa_diisi']);

        // Setelah laporan Senin diisi, tagihannya hilang; hari lain tetap.
        KokurikulerReport::create([
            'project_id' => $this->project->id, 'class_id' => $this->kelasXiA->id,
            'tanggal' => '2026-03-09', 'isi' => 'Orientasi projek', 'created_by' => $this->waliXi->id,
        ]);
        $kk = collect($this->getJson('/api/v1/agendas/perlu-diisi')->json('data'))
            ->where('jenis', 'kokurikuler')->values();
        $this->assertSame(['2026-03-10', '2026-03-11'], $kk->pluck('tanggal')->all());
    }

    // ── Anti-footgun: update projek tidak boleh diam-diam menghapus kelas ────

    public function test_put_tanpa_key_classes_tidak_menghapus_kelas_terdaftar(): void
    {
        KokurikulerProjectClass::create([
            'project_id' => $this->project->id, 'class_id' => $this->kelasXiA->id,
            'fasilitator_user_id' => $this->waliXi->id,
        ]);

        $admin = User::create(['nama' => 'Admin', 'email' => 'admin@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Admin]);
        Sanctum::actingAs($admin);

        // Simulasi klien yang hanya mengubah status — tanpa key classes/dimensi.
        $this->putJson("/api/v1/admin/kokurikuler/projects/{$this->project->uuid}", [
            'judul' => $this->project->judul, 'status' => 'aktif',
            'tanggal_mulai' => '2026-03-09', 'tanggal_selesai' => '2026-03-13',
        ])->assertOk();

        $this->assertDatabaseCount('kokurikuler_project_classes', 1); // TIDAK terhapus

        // Kirim classes eksplisit kosong = memang melepas semua (perilaku sengaja).
        $this->putJson("/api/v1/admin/kokurikuler/projects/{$this->project->uuid}", [
            'judul' => $this->project->judul, 'status' => 'aktif',
            'tanggal_mulai' => '2026-03-09', 'tanggal_selesai' => '2026-03-13',
            'classes' => [],
        ])->assertOk();

        $this->assertDatabaseCount('kokurikuler_project_classes', 0);
    }

    /**
     * Ditutup lebih awal via API (status → selesai pada 11 Mar, sedangkan
     * tanggal_selesai terjadwal 13 Mar): `selesai_pada` tercatat = hari ini, dan
     * pembebasan agenda BERHENTI di hari itu — kelas langsung kembali ke mode
     * mengajar tanpa menunggu 13 Mar. Dibuka kembali (aktif) → `selesai_pada` bersih.
     */
    public function test_tutup_lebih_awal_via_api_hentikan_pembebasan_seketika(): void
    {
        $admin = User::create(['nama' => 'Admin Tutup', 'email' => 'admintutup@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Admin]);
        Sanctum::actingAs($admin);

        $this->putJson("/api/v1/admin/kokurikuler/projects/{$this->project->uuid}", [
            'judul' => $this->project->judul, 'status' => 'selesai',
            'tanggal_mulai' => '2026-03-09', 'tanggal_selesai' => '2026-03-13',
        ])->assertOk();

        $this->assertSame('2026-03-11', $this->project->fresh()->selesai_pada->toDateString());

        KokurikulerMode::flush();
        $id = $this->kelasXiA->id;
        $this->assertTrue(KokurikulerMode::isAgendaExempt($id, '2026-03-10'), 'H-1 penutupan (selama projek) tetap bebas');
        $this->assertFalse(KokurikulerMode::isAgendaExempt($id, '2026-03-11'), 'HARI INI dinyatakan selesai → langsung mode mengajar');
        $this->assertFalse(KokurikulerMode::isAgendaExempt($id, '2026-03-12'), 'sesudah penutupan tetap mode mengajar');
        $this->assertFalse(KokurikulerMode::isAgendaExempt($id, '2026-03-13'), 'tanggal_selesai terjadwal tak lagi membebaskan');

        // Dibuka kembali → tanggal penutupan dihapus, periode bebas penuh lagi.
        $this->putJson("/api/v1/admin/kokurikuler/projects/{$this->project->uuid}", [
            'judul' => $this->project->judul, 'status' => 'aktif',
            'tanggal_mulai' => '2026-03-09', 'tanggal_selesai' => '2026-03-13',
        ])->assertOk();

        $this->assertNull($this->project->fresh()->selesai_pada);
        KokurikulerMode::flush();
        $this->assertTrue(KokurikulerMode::isAgendaExempt($id, '2026-03-13'), 'projek aktif lagi → 13 Mar bebas kembali');
    }

    public function test_periode_di_luar_tahun_ajaran_aktif_ditolak(): void
    {
        $admin = User::create(['nama' => 'Admin Tiga', 'email' => 'admin3@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Admin]);
        Sanctum::actingAs($admin);

        // TA aktif 2026-01-05..2026-06-19; projek Juli SELURUHNYA di luar → tolak.
        $this->postJson('/api/v1/admin/kokurikuler/projects', [
            'judul' => 'Projek Salah TA', 'status' => 'draft',
            'tanggal_mulai' => '2026-07-15', 'tanggal_selesai' => '2026-07-21',
        ])->assertStatus(422);

        // Menyentuh rentang TA (walau melewati batas akhir) tetap boleh.
        $this->postJson('/api/v1/admin/kokurikuler/projects', [
            'judul' => 'Projek Ujung Semester', 'status' => 'draft',
            'tanggal_mulai' => '2026-06-15', 'tanggal_selesai' => '2026-06-22',
        ])->assertCreated();
    }

    public function test_kelas_tak_dikenal_ditolak_bukan_diskip_diam_diam(): void
    {
        $admin = User::create(['nama' => 'Admin Dua', 'email' => 'admin2@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Admin]);
        Sanctum::actingAs($admin);

        $this->putJson("/api/v1/admin/kokurikuler/projects/{$this->project->uuid}", [
            'judul' => $this->project->judul, 'status' => 'aktif',
            'tanggal_mulai' => '2026-03-09', 'tanggal_selesai' => '2026-03-13',
            'classes' => [['id' => 'uuid-tidak-ada', 'fasilitator_user_id' => null]],
        ])->assertStatus(422);
    }

    public function test_guru_non_fasilitator_tidak_dapat_tagihan_kokurikuler(): void
    {
        KokurikulerProjectClass::create([
            'project_id' => $this->project->id, 'class_id' => $this->kelasXiA->id,
            'fasilitator_user_id' => $this->waliXi->id,
        ]);
        KokurikulerMode::flush();

        Sanctum::actingAs($this->guruXi);
        $rows = collect($this->getJson('/api/v1/agendas/perlu-diisi')->json('data'));
        $this->assertCount(0, $rows->where('jenis', 'kokurikuler'));
    }
}
