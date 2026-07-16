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

    public function test_rekap_semua_kelas_terbatas_sesuai_hak(): void
    {
        // Pembimbing: 'semua' = seluruh kelas bimbingannya sendiri (bukan se-sekolah).
        Sanctum::actingAs($this->pembimbing);
        $this->getJson('/api/v1/pkl/rekap-absen/export?class_id=semua&format=excel')->assertOk();

        // Guru tanpa bimbingan & tanpa perwalian: tidak ada kelas → ditolak.
        Sanctum::actingAs($this->guruLain);
        $this->getJson('/api/v1/pkl/rekap-absen/export?class_id=semua&format=excel')->assertForbidden();

        Sanctum::actingAs($this->admin);
        $this->getJson('/api/v1/pkl/rekap-absen/export?class_id=semua&format=excel')->assertOk();
    }

    // ── Import penempatan ──────────────────────────────────────────────────────

    public function test_import_penempatan_cocok_nisn_dan_nama_guru(): void
    {
        $path = $this->makeXlsx([
            ['Nama', 'NIS', 'NISN', 'Kelas', 'No. HP Siswa', 'Tempat PKL', 'Alamat PKL', 'Awal PKL', 'Akhir PKL', 'Guru Pembimbing'],
            // perusahaan SAMA ('PT Uji' dari setUp) → menimpa/melengkapi baris lama;
            // telpon 08… dinormalisasi ke 62…
            ['Siswa PKL', '', '0099887766', 'XII Animasi A', '081234567890', 'PT Uji', 'Jl. Uji Baru', '2026-03-09', '2026-05-29', 'Pembimbing PKL'],
            // NISN tak dikenal
            ['Hantu', '', '0000000000', 'XII Animasi A', '', 'PT X', 'Jl. X', '2026-03-02', '2026-05-29', 'Pembimbing PKL'],
            // guru tak dikenal
            ['Siswa PKL', '', '0099887766', 'XII Animasi A', '', 'PT Uji', 'Jl. Y', '2026-03-02', '2026-05-29', 'Guru Tidak Ada'],
        ]);

        Sanctum::actingAs($this->admin);
        $res = $this->postJson('/api/v1/admin/pkl/placements/import', [
            'file' => new \Illuminate\Http\UploadedFile($path, 'pkl.xlsx', null, null, true),
        ])->assertOk();

        $this->assertSame(1, $res->json('success_count'));
        $this->assertSame(2, $res->json('error_count'));
        $this->assertSame(1, PklPlacement::where('student_id', $this->siswa->id)->count());
        $this->assertDatabaseHas('pkl_placements', [
            'student_id' => $this->siswa->id, 'tempat_pkl' => 'PT Uji',
            'alamat_pkl' => 'Jl. Uji Baru', 'telpon_siswa' => '6281234567890',
            'tanggal_mulai' => '2026-03-09',
        ]);
    }

    public function test_normalisasi_telpon_semua_varian_format(): void
    {
        // Semua bentuk penulisan nomor HP harus berakhir 62… siap tautan wa.me.
        $this->assertSame('6281234567890', PklPlacement::normalizeTelpon('081234567890'));
        $this->assertSame('6281234567890', PklPlacement::normalizeTelpon('81234567890'));      // Excel menelan 0
        $this->assertSame('6281234567890', PklPlacement::normalizeTelpon('+6281234567890'));
        $this->assertSame('6281234567890', PklPlacement::normalizeTelpon('6281234567890'));
        $this->assertSame('6281234567890', PklPlacement::normalizeTelpon('+62 0812-3456-7890')); // 62 + nol sisipan
        $this->assertSame('6281234567890', PklPlacement::normalizeTelpon('(0812) 3456 7890'));
        $this->assertNull(PklPlacement::normalizeTelpon(''));
        $this->assertNull(PklPlacement::normalizeTelpon('  -  '));
    }

    public function test_import_penempatan_fallback_nis_saat_nisn_kosong(): void
    {
        $this->siswa->update(['nis' => '232400123']);

        $path = $this->makeXlsx([
            ['Nama', 'NIS', 'NISN', 'Kelas', 'No. HP Siswa', 'Tempat PKL', 'Alamat PKL', 'Awal PKL', 'Akhir PKL', 'Guru Pembimbing'],
            // NISN kosong → cocok lewat NIS; perusahaan BEDA + periode TIDAK bertumpuk
            // → jadi tempat PKL kedua; telpon Excel numerik kehilangan 0 depan (8…)
            ['Siswa PKL', '232400123', '', 'XII Animasi A', '81299998888', 'PT Via NIS', 'Jl. NIS', '2026-06-01', '2026-06-30', 'Pembimbing PKL'],
        ]);

        Sanctum::actingAs($this->admin);
        $res = $this->postJson('/api/v1/admin/pkl/placements/import', [
            'file' => new \Illuminate\Http\UploadedFile($path, 'pkl.xlsx', null, null, true),
        ])->assertOk();

        $this->assertSame(1, $res->json('success_count'));
        $this->assertSame(2, PklPlacement::where('student_id', $this->siswa->id)->count());
        $this->assertDatabaseHas('pkl_placements', [
            'student_id' => $this->siswa->id, 'tempat_pkl' => 'PT Via NIS', 'telpon_siswa' => '6281299998888',
        ]);
    }

    public function test_import_periode_bertumpuk_perusahaan_beda_ditolak(): void
    {
        $path = $this->makeXlsx([
            ['Nama', 'NIS', 'NISN', 'Kelas', 'No. HP Siswa', 'Tempat PKL', 'Alamat PKL', 'Awal PKL', 'Akhir PKL', 'Guru Pembimbing'],
            // perusahaan beda, periode bertumpuk dengan 'PT Uji' (Mar–Mei) → kesalahan data
            ['Siswa PKL', '', '0099887766', 'XII Animasi A', '', 'PT Tabrakan', 'Jl. T', '2026-04-01', '2026-04-30', 'Pembimbing PKL'],
        ]);

        Sanctum::actingAs($this->admin);
        $res = $this->postJson('/api/v1/admin/pkl/placements/import', [
            'file' => new \Illuminate\Http\UploadedFile($path, 'pkl.xlsx', null, null, true),
        ])->assertOk();

        $this->assertSame(0, $res->json('success_count'));
        $this->assertSame(1, $res->json('error_count'));
        $this->assertStringContainsString('bertumpuk', $res->json('errors.0'));
        $this->assertSame(1, PklPlacement::where('student_id', $this->siswa->id)->count());
    }

    public function test_import_perusahaan_mirip_ditanya_dulu_lalu_keputusan_dihormati(): void
    {
        $rows = [
            ['Nama', 'NIS', 'NISN', 'Kelas', 'No. HP Siswa', 'Tempat PKL', 'Alamat PKL', 'Awal PKL', 'Akhir PKL', 'Guru Pembimbing'],
            // 'PT Ujii' mirip 'PT Uji' → ditahan, tanyakan dulu
            ['Siswa PKL', '', '0099887766', 'XII Animasi A', '', 'PT Ujii', 'Jl. U', '2026-03-02', '2026-05-29', 'Pembimbing PKL'],
        ];

        Sanctum::actingAs($this->admin);
        $res = $this->postJson('/api/v1/admin/pkl/placements/import', [
            'file' => new \Illuminate\Http\UploadedFile($this->makeXlsx($rows), 'pkl.xlsx', null, null, true),
        ])->assertOk();

        $this->assertSame(0, $res->json('success_count'));
        $this->assertCount(1, $res->json('pending_matches'));
        $this->assertSame('PT Uji', $res->json('pending_matches.0.tempat_lama'));
        $key = $res->json('pending_matches.0.key');

        // Keputusan 'timpa' → baris lama diganti nama perusahaan barunya.
        $res2 = $this->postJson('/api/v1/admin/pkl/placements/import', [
            'file'      => new \Illuminate\Http\UploadedFile($this->makeXlsx($rows), 'pkl.xlsx', null, null, true),
            'decisions' => json_encode([$key => 'timpa']),
        ])->assertOk();

        $this->assertSame(1, $res2->json('success_count'));
        $this->assertSame(1, PklPlacement::where('student_id', $this->siswa->id)->count());
        $this->assertDatabaseHas('pkl_placements', ['student_id' => $this->siswa->id, 'tempat_pkl' => 'PT Ujii']);
    }

    // ── Edit & tambah penempatan oleh pembimbing ───────────────────────────────

    public function test_pembimbing_edit_penempatan_bimbingannya_sendiri(): void
    {
        $p = PklPlacement::where('student_id', $this->siswa->id)->first();

        // Guru lain (bukan pembimbingnya) ditolak.
        Sanctum::actingAs($this->guruLain);
        $this->putJson("/api/v1/pkl/placements/{$p->uuid}", [
            'tempat_pkl' => 'PT Disusupi', 'tanggal_mulai' => '2026-03-02', 'tanggal_selesai' => '2026-05-29',
        ])->assertStatus(403);

        // Pembimbingnya sendiri boleh — edit perusahaan, periode, telpon.
        Sanctum::actingAs($this->pembimbing);
        $this->putJson("/api/v1/pkl/placements/{$p->uuid}", [
            'tempat_pkl' => 'PT Uji Revisi', 'alamat_pkl' => 'Jl. Revisi',
            'telpon' => '0813333444', 'tanggal_mulai' => '2026-03-02', 'tanggal_selesai' => '2026-06-05',
        ])->assertOk();

        $this->assertDatabaseHas('pkl_placements', [
            'id' => $p->id, 'tempat_pkl' => 'PT Uji Revisi', 'telpon_siswa' => '62813333444',
        ]);
    }

    public function test_pembimbing_tambah_tempat_kedua_dan_tolak_periode_bertumpuk(): void
    {
        Sanctum::actingAs($this->pembimbing);

        // Bertumpuk dengan Mar–Mei → ditolak.
        $this->postJson('/api/v1/pkl/placements', [
            'student_id' => $this->siswa->uuid, 'tempat_pkl' => 'PT Kedua',
            'tanggal_mulai' => '2026-05-01', 'tanggal_selesai' => '2026-06-15',
        ])->assertStatus(422);

        // Periode berbeda → tempat kedua sah.
        $this->postJson('/api/v1/pkl/placements', [
            'student_id' => $this->siswa->uuid, 'tempat_pkl' => 'PT Kedua',
            'telpon' => '08155556666', 'tanggal_mulai' => '2026-06-01', 'tanggal_selesai' => '2026-06-30',
        ])->assertCreated();

        $this->assertSame(2, PklPlacement::where('student_id', $this->siswa->id)->count());

        // Guru lain tidak bisa menambahkan untuk siswa yang bukan bimbingannya.
        Sanctum::actingAs($this->guruLain);
        $this->postJson('/api/v1/pkl/placements', [
            'student_id' => $this->siswa->uuid, 'tempat_pkl' => 'PT Susup',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2026-07-31',
        ])->assertStatus(403);
    }

    public function test_admin_tambah_manual_edit_dan_export(): void
    {
        Sanctum::actingAs($this->admin);

        // Tambah manual per anak (via NISN).
        $this->postJson('/api/v1/admin/pkl/placements', [
            'nisn' => '0099887766', 'tempat_pkl' => 'CV Manual', 'telpon' => '087700001111',
            'tanggal_mulai' => '2026-06-01', 'tanggal_selesai' => '2026-06-30', 'pembimbing' => 'Pembimbing PKL',
        ])->assertCreated();

        $baru = PklPlacement::where('tempat_pkl', 'CV Manual')->firstOrFail();
        $this->assertSame('6287700001111', $baru->telpon_siswa);

        // Edit manual: perusahaan, awal, akhir, telpon.
        $this->putJson("/api/v1/admin/pkl/placements/{$baru->uuid}", [
            'tempat_pkl' => 'CV Manual Revisi', 'telpon' => '087700002222',
            'tanggal_mulai' => '2026-06-02', 'tanggal_selesai' => '2026-06-29',
        ])->assertOk();
        $this->assertDatabaseHas('pkl_placements', ['id' => $baru->id, 'tempat_pkl' => 'CV Manual Revisi', 'telpon_siswa' => '6287700002222']);

        // Export peserta PKL (format sama dengan template import).
        $this->get('/api/v1/admin/pkl/placements/export')
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
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
