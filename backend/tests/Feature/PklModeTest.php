<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\PklAttendance;
use App\Models\PklObjective;
use App\Models\PklPlacement;
use App\Models\PklSetting;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Schedule;
use App\Models\Teacher;
use App\Models\User;
use App\Support\PklMode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;
use Tests\TestCase;

/**
 * Invarian Mode PKL. Waktu dibekukan ke Rabu 11 Mar 2026 supaya matematika minggu
 * (Senin 9 Mar, Sen–Jum 9–13 Mar) deterministik.
 */
class PklModeTest extends TestCase
{
    use RefreshDatabase;

    private User $pembimbing;
    private User $guruLain;
    private User $admin;
    private SchoolClass $kelasXII;
    private SchoolClass $kelasXI;
    private Student $siswa;
    private string $minggu = '2026-03-09';   // Senin

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-03-11 10:00', config('app.school_timezone')));

        $ay = AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-01-05', 'tanggal_selesai' => '2026-06-19', 'aktif' => true,
        ]);

        $this->admin      = $this->makeUser(UserRole::Admin, 'Admin');
        $this->pembimbing = $this->makeTeacher('Pembimbing PKL');
        $this->guruLain   = $this->makeTeacher('Guru Lain');

        $this->kelasXII = SchoolClass::create(['tingkat' => Tingkat::XII, 'jurusan' => 'Animasi', 'rombel' => 'A', 'academic_year_id' => $ay->id]);
        $this->kelasXI  = SchoolClass::create(['tingkat' => Tingkat::XI,  'jurusan' => 'Animasi', 'rombel' => 'A', 'academic_year_id' => $ay->id]);

        $siswaUser   = $this->makeUser(UserRole::Siswa, 'Siswa PKL');
        $this->siswa = Student::create(['user_id' => $siswaUser->id, 'nis' => '3001', 'nisn' => '0099887766', 'class_id' => $this->kelasXII->id]);

        PklPlacement::create([
            'student_id' => $this->siswa->id, 'class_id' => $this->kelasXII->id, 'academic_year_id' => $ay->id,
            'pembimbing_teacher_id' => $this->pembimbing->teacher->id,
            'tempat_pkl' => 'PT Uji', 'alamat_pkl' => 'Jl. Uji',
            'tanggal_mulai' => '2026-03-02', 'tanggal_selesai' => '2026-05-29',
        ]);

        PklObjective::create(['deskripsi' => 'K3 umum', 'jurusan' => null, 'academic_year_id' => $ay->id, 'aktif' => true]);
        PklObjective::create(['deskripsi' => 'Khusus Animasi', 'jurusan' => 'Animasi', 'academic_year_id' => $ay->id, 'aktif' => true]);
        PklObjective::create(['deskripsi' => 'Khusus RPL', 'jurusan' => 'Rekayasa Perangkat Lunak', 'academic_year_id' => $ay->id, 'aktif' => true]);

        PklSetting::instance()->update(['aktif' => true]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeUser(UserRole $role, string $nama): User
    {
        return User::create(['nama' => $nama, 'email' => str()->slug($nama).'@test.sch.id', 'password' => 'secret123', 'role' => $role]);
    }

    private function makeTeacher(string $nama): User
    {
        $u = $this->makeUser(UserRole::Guru, $nama);
        Teacher::create(['user_id' => $u->id, 'is_bk' => false]);

        return $u->fresh();
    }

    // ── Rename mapel ───────────────────────────────────────────────────────────

    public function test_rename_hanya_untuk_kelas_xii(): void
    {
        $subject = Subject::create(['kode' => 'ANM', 'nama' => 'KK Animasi', 'aktif' => true]);
        $sXII = Schedule::create(['class_id' => $this->kelasXII->id, 'subject_id' => $subject->id, 'teacher_id' => $this->pembimbing->teacher->id, 'hari' => 'senin', 'jam_mulai' => '07:00', 'jam_selesai' => '08:30', 'aktif' => true])->load(['subject', 'schoolClass']);
        $sXI  = Schedule::create(['class_id' => $this->kelasXI->id,  'subject_id' => $subject->id, 'teacher_id' => $this->pembimbing->teacher->id, 'hari' => 'selasa', 'jam_mulai' => '07:00', 'jam_selesai' => '08:30', 'aktif' => true])->load(['subject', 'schoolClass']);

        $this->assertSame('Praktek Kerja Lapangan', PklMode::subjectLabelFor($sXII));
        $this->assertSame('KK Animasi', PklMode::subjectLabelFor($sXI));

        PklSetting::instance()->update(['aktif' => false]);
        $this->assertSame('KK Animasi', PklMode::subjectLabelFor($sXII->fresh(['subject', 'schoolClass'])));
    }

    // ── TP terfilter per jurusan ───────────────────────────────────────────────

    public function test_agenda_menampilkan_tp_umum_dan_jurusan_kelas_saja(): void
    {
        Sanctum::actingAs($this->pembimbing);

        $res = $this->getJson("/api/v1/pkl/agenda?class_id={$this->kelasXII->uuid}&minggu={$this->minggu}")
            ->assertOk();

        $deskripsi = collect($res->json('data.objectives'))->pluck('deskripsi')->all();
        $this->assertContains('K3 umum', $deskripsi);
        $this->assertContains('Khusus Animasi', $deskripsi);
        $this->assertNotContains('Khusus RPL', $deskripsi);   // jurusan lain tidak muncul
    }

    // ── Simpan agenda + presensi harian ────────────────────────────────────────

    public function test_pembimbing_simpan_agenda_dengan_presensi_harian(): void
    {
        Sanctum::actingAs($this->pembimbing);
        $obj = PklObjective::where('jurusan', null)->first();

        $this->postJson('/api/v1/pkl/agenda', [
            'class_id' => $this->kelasXII->uuid,
            'minggu'   => $this->minggu,
            'catatan'  => 'Monitoring oke',
            'objective_ids' => [$obj->uuid],
            'presensi' => [
                ['student_id' => $this->siswa->uuid, 'tanggal' => '2026-03-09', 'status' => 'hadir'],
                ['student_id' => $this->siswa->uuid, 'tanggal' => '2026-03-10', 'status' => 'izin'],
                // 2026-03-12 = Kamis (masa depan relatif ke Rabu 11) → HARUS diabaikan
                ['student_id' => $this->siswa->uuid, 'tanggal' => '2026-03-12', 'status' => 'hadir'],
            ],
        ])->assertOk();

        $this->assertDatabaseCount('pkl_attendances', 2);
        $this->assertDatabaseHas('pkl_attendances', ['student_id' => $this->siswa->id, 'tanggal' => '2026-03-09 00:00:00', 'status' => 'hadir']);
        $this->assertFalse(PklAttendance::where('tanggal', '2026-03-12')->exists(), 'tanggal masa depan tidak boleh tersimpan');
    }

    public function test_agenda_minggu_masa_depan_ditolak(): void
    {
        Sanctum::actingAs($this->pembimbing);

        // Minggu depan (Senin 16 Mar) belum berjalan pada Rabu 11 Mar.
        $this->postJson('/api/v1/pkl/agenda', [
            'class_id' => $this->kelasXII->uuid, 'minggu' => '2026-03-16', 'catatan' => 'x',
        ])->assertStatus(422);
    }

    // ── Otorisasi ──────────────────────────────────────────────────────────────

    public function test_guru_bukan_pembimbing_tidak_bisa_akses_kelas(): void
    {
        Sanctum::actingAs($this->guruLain);

        $this->getJson('/api/v1/pkl/overview')->assertOk()->assertJsonCount(0, 'data.classes');
        $this->getJson("/api/v1/pkl/agenda?class_id={$this->kelasXII->uuid}&minggu={$this->minggu}")->assertForbidden();
        $this->getJson("/api/v1/pkl/rekap-absen/export?class_id={$this->kelasXII->uuid}&format=excel")->assertForbidden();
    }

    public function test_hanya_admin_boleh_rekap_semua_kelas(): void
    {
        Sanctum::actingAs($this->pembimbing);
        $this->getJson('/api/v1/pkl/rekap-absen/export?class_id=semua&format=excel')->assertForbidden();

        Sanctum::actingAs($this->admin);
        $this->getJson('/api/v1/pkl/rekap-absen/export?class_id=semua&format=excel')->assertOk();
    }

    // ── Import penempatan ──────────────────────────────────────────────────────

    public function test_import_penempatan_cocok_nisn_dan_nama_guru(): void
    {
        $path = $this->makeXlsx([
            ['Nama', 'NISN', 'Kelas', 'Tempat PKL', 'Alamat PKL', 'Awal PKL', 'Akhir PKL', 'Guru Pembimbing'],
            // baris valid (NISN cocok, guru cocok)
            ['Siswa PKL', '0099887766', 'XII Animasi A', 'PT Baru', 'Jl. Baru', '2026-03-02', '2026-05-29', 'Pembimbing PKL'],
            // NISN tak dikenal
            ['Hantu', '0000000000', 'XII Animasi A', 'PT X', 'Jl. X', '2026-03-02', '2026-05-29', 'Pembimbing PKL'],
            // guru tak dikenal
            ['Siswa PKL', '0099887766', 'XII Animasi A', 'PT Y', 'Jl. Y', '2026-03-02', '2026-05-29', 'Guru Tidak Ada'],
        ]);

        Sanctum::actingAs($this->admin);
        $res = $this->postJson('/api/v1/admin/pkl/placements/import', [
            'file' => new \Illuminate\Http\UploadedFile($path, 'pkl.xlsx', null, null, true),
        ])->assertOk();

        $this->assertSame(1, $res->json('success_count'));
        $this->assertSame(2, $res->json('error_count'));
        // penempatan ter-update ke tempat baru (updateOrCreate atas unique student+AY)
        $this->assertDatabaseHas('pkl_placements', ['student_id' => $this->siswa->id, 'tempat_pkl' => 'PT Baru']);
    }

    private function makeXlsx(array $rows): string
    {
        $path   = tempnam(sys_get_temp_dir(), 'pkltest_').'.xlsx';
        $writer = new XlsxWriter();
        $writer->openToFile($path);
        foreach ($rows as $r) {
            $writer->addRow(Row::fromValues($r));
        }
        $writer->close();

        return $path;
    }
}
