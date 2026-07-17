<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\PklObjective;
use App\Models\PklPlacement;
use App\Models\PklSetting;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use App\Support\BellSchedule;
use App\Support\PklMode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Invarian akses agenda PKL & pembebasan tagihan:
 *  - alur agenda PKL HANYA utk pembimbing (penugasan placement) — ploting jadwal XII
 *    saja tidak memberi akses (keputusan 2026-07-17);
 *  - pembimbing melihat & mengabsen HANYA siswa bimbingannya;
 *  - tagihan agenda PKL mingguan pembimbing muncul di perlu-diisi, dibatasi minggu
 *    yang beririsan periode semester aktif;
 *  - sesi XII semasa periode PKL tidak pernah ditagih sebagai agenda reguler — termasuk
 *    SETELAH mode dimatikan (tidak retroaktif);
 *  - Beban Mengajar merekap ploting (JP) + penugasan PKL non-ploting.
 *
 * Waktu dibekukan Rabu 11 Mar 2026 (minggu PKL berjalan: Senin 9 Mar).
 */
class PklScheduleAccessTest extends TestCase
{
    use RefreshDatabase;

    private User $pembimbing;      // penugasan (placement), TANPA ploting XII
    private User $guruPloting;     // ploting jadwal XII, TANPA penugasan
    private User $guruLuar;        // tidak keduanya
    private SchoolClass $kelasXII;
    private Subject $subject;
    private string $minggu = '2026-03-09';

    protected function setUp(): void
    {
        parent::setUp();
        // Jumat 13 Mar 2026 — agenda PKL baru bisa diisi mulai Jumat, jadi minggu
        // berjalan (Senin 9 Mar) sudah dapat diisi tepat hari ini.
        Carbon::setTestNow(Carbon::parse('2026-03-13 10:00', config('app.school_timezone')));
        PklMode::flush();
        BellSchedule::flush();

        $ay = AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-01-05', 'tanggal_selesai' => '2026-06-19', 'aktif' => true,
        ]);

        $this->pembimbing  = $this->makeTeacher('Pembimbing Penugasan');
        $this->guruPloting = $this->makeTeacher('Guru Ploting XII');
        $this->guruLuar    = $this->makeTeacher('Guru Luar');

        $this->kelasXII = SchoolClass::create(['tingkat' => Tingkat::XII, 'jurusan' => 'Animasi', 'rombel' => 'A', 'academic_year_id' => $ay->id]);
        $this->subject  = Subject::create(['kode' => 'ANM', 'nama' => 'KK Animasi', 'aktif' => true]);

        // Ploting guruPloting di kelas XII: Rabu 07:00-08:30 (2 JP dari durasi 90 menit).
        Schedule::create([
            'class_id' => $this->kelasXII->id, 'subject_id' => $this->subject->id,
            'teacher_id' => $this->guruPloting->teacher->id,
            'hari' => 'rabu', 'jam_mulai' => '07:00', 'jam_selesai' => '08:30', 'aktif' => true,
        ]);

        // Dua siswa PKL: satu bimbingan $pembimbing, satu bimbingan guru lain —
        // guru ploting harus melihat KEDUANYA (satu kelas penuh).
        foreach ([['3001', $this->pembimbing], ['3002', $this->guruLuar]] as [$nis, $guru]) {
            $u = User::create(['nama' => "Siswa $nis", 'email' => "s$nis@test.sch.id", 'password' => 'secret123', 'role' => UserRole::Siswa]);
            $s = Student::create(['user_id' => $u->id, 'nis' => $nis, 'class_id' => $this->kelasXII->id]);
            PklPlacement::create([
                'student_id' => $s->id, 'class_id' => $this->kelasXII->id, 'academic_year_id' => $ay->id,
                'pembimbing_teacher_id' => $guru->teacher->id,
                'tempat_pkl' => 'PT Uji', 'alamat_pkl' => 'Jl. Uji',
                'tanggal_mulai' => '2026-03-02', 'tanggal_selesai' => '2026-05-29',
            ]);
        }

        PklObjective::create(['deskripsi' => 'K3 umum', 'jurusan' => null, 'academic_year_id' => $ay->id, 'aktif' => true]);
        PklSetting::instance()->update(['aktif' => true]);
        PklMode::flush();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        PklMode::flush();
        parent::tearDown();
    }

    private function makeTeacher(string $nama): User
    {
        $u = User::create(['nama' => $nama, 'email' => str()->slug($nama).'@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru]);
        Teacher::create(['user_id' => $u->id, 'is_bk' => false]);

        return $u->fresh();
    }

    // ── Akses HANYA untuk pembimbing ─────────────────────────────────────────

    public function test_guru_ploting_xii_tanpa_penugasan_tidak_punya_akses_pkl(): void
    {
        Sanctum::actingAs($this->guruPloting);

        // Ploting jadwal XII saja tidak memberi menu/daftar apa pun.
        $overview = $this->getJson('/api/v1/pkl/overview')->assertOk()->json('data.classes');
        $this->assertSame([], $overview);

        // weeks agregat: tanpa penempatan → daftar kosong, bukan error.
        $this->assertSame([], $this->getJson('/api/v1/pkl/weeks')->assertOk()->json('data.weeks'));
        // showAgenda & storeAgenda menolak non-pembimbing.
        $this->getJson("/api/v1/pkl/agenda?minggu={$this->minggu}")->assertStatus(403);
        $this->postJson('/api/v1/pkl/agenda', [
            'minggu' => $this->minggu, 'catatan' => 'Coba isi tanpa penugasan',
        ])->assertStatus(403);
    }

    public function test_pembimbing_hanya_melihat_dan_mengabsen_siswa_bimbingannya(): void
    {
        Sanctum::actingAs($this->pembimbing);

        $overview = $this->getJson('/api/v1/pkl/overview')->assertOk()->json('data.classes');
        $this->assertCount(1, $overview);
        $this->assertSame(1, $overview[0]['jumlah_siswa']); // hanya bimbingannya, bukan sekelas

        // Daftar bimbingan lintas kelas (tanpa class_id) → hanya siswa 3001.
        $rows = $this->getJson('/api/v1/pkl/my-students')->assertOk()->json('data');
        $this->assertCount(1, $rows);
        $this->assertSame('3001', $rows[0]['nis']);
        $this->assertSame('XII Animasi A', $rows[0]['kelas']);

        // showAgenda agregat: hanya siswa bimbingannya yang muncul.
        $form = $this->getJson("/api/v1/pkl/agenda?minggu={$this->minggu}")->assertOk()->json('data');
        $this->assertCount(1, $form['students']);
        $this->assertSame('XII Animasi A', $form['students'][0]['kelas']);

        // Presensi siswa 3002 (bimbingan guru lain) diabaikan diam-diam.
        $this->postJson('/api/v1/pkl/agenda', [
            'minggu'   => $this->minggu,
            'catatan'  => 'Monitoring minggu ke-2',
            'presensi' => [
                ['student_id' => Student::where('nis', '3001')->first()->uuid, 'tanggal' => '2026-03-09', 'status' => 'hadir'],
                ['student_id' => Student::where('nis', '3002')->first()->uuid, 'tanggal' => '2026-03-09', 'status' => 'hadir'],
            ],
        ])->assertOk();

        $this->assertDatabaseCount('pkl_attendances', 1); // hanya siswa bimbingannya
    }

    // ── Tagihan agenda PKL mingguan di perlu-diisi ───────────────────────────

    public function test_tagihan_agenda_pkl_muncul_di_perlu_diisi_pembimbing(): void
    {
        Sanctum::actingAs($this->pembimbing);

        $rows = collect($this->getJson('/api/v1/agendas/perlu-diisi')->assertOk()->json('data'))
            ->where('jenis', 'pkl')->values();

        // Placement mulai 2 Mar; hari ini Jumat 13 Mar → Jumat 2 minggu sudah lewat
        // (Senin 2 Mar & Senin 9 Mar), keduanya belum diisi. AGREGAT: 1 baris per minggu.
        $this->assertCount(2, $rows);
        $this->assertStringContainsString('XII Animasi A', $rows[0]['kelas']);
        $this->assertSame('Agenda PKL Mingguan', $rows[0]['mapel']);
        $this->assertContains('2026-03-09', $rows->pluck('minggu')->all());

        // Setelah minggu berjalan diisi (satu form agregat), tagihannya hilang.
        $this->postJson('/api/v1/pkl/agenda', [
            'minggu' => $this->minggu, 'catatan' => 'ok',
        ])->assertOk();
        $sisa = collect($this->getJson('/api/v1/agendas/perlu-diisi')->assertOk()->json('data'))
            ->where('jenis', 'pkl')->pluck('minggu');
        $this->assertNotContains('2026-03-09', $sisa->all());

        // Guru ploting (bukan pembimbing) tidak pernah dapat tagihan PKL.
        Sanctum::actingAs($this->guruPloting);
        $rows = collect($this->getJson('/api/v1/agendas/perlu-diisi')->assertOk()->json('data'))
            ->where('jenis', 'pkl');
        $this->assertCount(0, $rows);
    }

    public function test_minggu_di_luar_periode_semester_tidak_ditagih(): void
    {
        // Perpanjang penempatan siswa bimbingan sampai melewati akhir semester (19 Jun).
        PklPlacement::where('pembimbing_teacher_id', $this->pembimbing->teacher->id)
            ->update(['tanggal_selesai' => '2026-07-31']);
        PklMode::flush();

        Sanctum::actingAs($this->pembimbing);

        // Daftar minggu (agregat) berhenti di minggu yang masih beririsan dgn semester.
        $weeks = $this->getJson('/api/v1/pkl/weeks')->assertOk()->json('data.weeks');
        $this->assertNotEmpty($weeks);
        $maxSenin = collect($weeks)->pluck('minggu_mulai')->max();
        $this->assertLessThanOrEqual('2026-06-19', $maxSenin);

        // Tagihan perlu-diisi juga tak pernah menembus akhir semester — uji dgn maju
        // ke akhir Juni: minggu-minggu Juli tidak muncul.
        Carbon::setTestNow(Carbon::parse('2026-07-15 10:00', config('app.school_timezone')));
        $tagihan = collect($this->getJson('/api/v1/agendas/perlu-diisi')->assertOk()->json('data'))
            ->where('jenis', 'pkl')->pluck('minggu');
        $this->assertTrue($tagihan->every(fn ($m) => $m <= '2026-06-19'));
    }

    public function test_guru_tanpa_ploting_dan_tanpa_penugasan_ditolak(): void
    {
        Sanctum::actingAs($this->guruLuar->fresh());
        // guruLuar adalah pembimbing siswa 3002 — pakai guru benar-benar luar:
        $luar = $this->makeTeacher('Benar Benar Luar');
        Sanctum::actingAs($luar);

        // Non-pembimbing: weeks agregat kosong, showAgenda 403.
        $this->assertSame([], $this->getJson('/api/v1/pkl/weeks')->assertOk()->json('data.weeks'));
        $this->getJson("/api/v1/pkl/agenda?minggu={$this->minggu}")->assertStatus(403);
        $this->assertFalse(PklMode::canFillAgenda($luar));
        $this->assertFalse(PklMode::canFillAgenda($this->guruPloting)); // ploting saja ≠ akses
        $this->assertTrue(PklMode::canFillAgenda($this->pembimbing));
    }

    // ── Pembebasan tagihan tidak retroaktif ──────────────────────────────────

    public function test_sesi_xii_semasa_pkl_tidak_ditagih_walau_mode_sudah_off(): void
    {
        // Mode ON → sesi Rabu (hari ini) kelas XII tidak muncul di perlu-diisi.
        Sanctum::actingAs($this->guruPloting);
        $this->assertSame([], $this->getJson('/api/v1/agendas/perlu-diisi')->assertOk()->json('data'));

        // Mode OFF, tanggal masih dalam periode placement (2 Mar–29 Mei) → tetap bebas.
        PklSetting::instance()->update(['aktif' => false]);
        PklMode::flush();
        $this->assertSame([], $this->getJson('/api/v1/agendas/perlu-diisi')->assertOk()->json('data'));

        // Di luar periode PKL (setelah 29 Mei) → sesi reguler ditagih normal kembali.
        Carbon::setTestNow(Carbon::parse('2026-06-03 10:00', config('app.school_timezone'))); // Rabu
        $rows = $this->getJson('/api/v1/agendas/perlu-diisi')->assertOk()->json('data');
        $this->assertNotEmpty($rows);
    }

    public function test_saklar_on_tanpa_penempatan_tidak_menghilangkan_tagihan(): void
    {
        // Kelas XII kedua TANPA penempatan — saklar ON tidak boleh membebaskannya:
        // tanpa penempatan guru juga tak bisa isi agenda PKL, kewajiban jangan lenyap.
        $kelasB = SchoolClass::create(['tingkat' => Tingkat::XII, 'jurusan' => 'Animasi', 'rombel' => 'B', 'academic_year_id' => AcademicYear::first()->id]);
        Schedule::create([
            'class_id' => $kelasB->id, 'subject_id' => $this->subject->id,
            'teacher_id' => $this->guruPloting->teacher->id,
            'hari' => 'rabu', 'jam_mulai' => '10:00', 'jam_selesai' => '11:30', 'aktif' => true,
        ]);

        Sanctum::actingAs($this->guruPloting);
        $kelas = array_column($this->getJson('/api/v1/agendas/perlu-diisi')->assertOk()->json('data'), 'kelas');

        $this->assertContains('XII Animasi B', $kelas);    // tanpa penempatan → tetap ditagih
        $this->assertNotContains('XII Animasi A', $kelas); // dalam periode penempatan → bebas
    }

    public function test_isagendaexempt_membaca_periode_placement(): void
    {
        PklSetting::instance()->update(['aktif' => false]);
        PklMode::flush();

        $this->assertTrue(PklMode::isAgendaExempt($this->kelasXII->id, '2026-03-11'));  // dalam periode
        $this->assertFalse(PklMode::isAgendaExempt($this->kelasXII->id, '2026-06-03')); // di luar periode
        $this->assertFalse(PklMode::isAgendaExempt(null, '2026-03-11'));
    }

    // ── Beban Mengajar ───────────────────────────────────────────────────────

    public function test_beban_mengajar_merekap_ploting_dan_penugasan_pkl(): void
    {
        // Guru ploting: 1 baris jadwal 90 menit = 2 JP; tanpa penugasan → pkl kosong.
        Sanctum::actingAs($this->guruPloting);
        $data = $this->getJson('/api/v1/beban-mengajar')->assertOk()->json('data');
        $this->assertSame(2, $data['total_jp']);
        $this->assertCount(1, $data['rows']);
        $this->assertSame('KK Animasi', $data['rows'][0]['mapel']);
        $this->assertSame('Rabu', $data['rows'][0]['hari']);
        $this->assertSame([], $data['pkl']);

        // Pembimbing: tanpa ploting → rows kosong, tapi penugasan PKL terekap.
        Sanctum::actingAs($this->pembimbing);
        $data = $this->getJson('/api/v1/beban-mengajar')->assertOk()->json('data');
        $this->assertSame(0, $data['total_jp']);
        $this->assertSame([], $data['rows']);
        $this->assertCount(1, $data['pkl']);
        $this->assertSame(1, $data['pkl'][0]['jumlah_siswa']);

        // Siswa tidak punya menu ini.
        Sanctum::actingAs(User::where('role', UserRole::Siswa)->firstOrFail());
        $this->getJson('/api/v1/beban-mengajar')->assertStatus(403);
    }

    public function test_beban_mengajar_pakai_jam_ke_bila_ada(): void
    {
        // Jadwal hasil import XML menyimpan jam-ke: JP = rentang jam-ke, bukan durasi.
        Schedule::create([
            'class_id' => $this->kelasXII->id, 'subject_id' => $this->subject->id,
            'teacher_id' => $this->guruPloting->teacher->id,
            'hari' => 'kamis', 'jam_ke_mulai' => 3, 'jam_ke_selesai' => 6,
            'jam_mulai' => '09:00', 'jam_selesai' => '11:00', 'aktif' => true,
        ]);

        Sanctum::actingAs($this->guruPloting);
        $data = $this->getJson('/api/v1/beban-mengajar')->assertOk()->json('data');
        $this->assertSame(6, $data['total_jp']); // 2 (durasi) + 4 (jam-ke 3..6)
        $this->assertSame(1, count($data['rows'])); // kelas+mapel sama → satu baris, 2 sesi
        $this->assertSame(2, $data['rows'][0]['jumlah_sesi']);
        $this->assertSame('Rabu, Kamis', $data['rows'][0]['hari']);
    }
}
