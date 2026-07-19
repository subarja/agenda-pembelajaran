<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\ActionThreshold;
use App\Models\Recommendation;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use App\Services\CharacterService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Temuan audit menyeluruh 2026-07-19 yang ditutup di sini:
 *
 * K-01 — endpoint laporan berbasis kelas tidak punya otorisasi sama sekali; akun siswa
 *        terbukti mengunduh rekap kehadiran kelas lain lengkap dengan nama & NIS.
 * K-02 — seluruh /admin/* berada di bawah satu middleware role:admin,wakasek sehingga
 *        wakasek bisa membuat akun ber-role admin (eskalasi hak).
 * K-03 — DIDUGA mesin rekomendasi terbalik; ternyata BUKAN bug. Ambang memakai rentang
 *        BERTANDA (lihat FullDemoSeeder: min=-19, max=-10, sifat=negatif) dan `sifat`
 *        hanyalah label. Konvensi itu dikunci di sini supaya tidak "diperbaiki" keliru.
 */
class ReportAndAdminAccessTest extends TestCase
{
    use RefreshDatabase;

    private AcademicYear $ay;

    private SchoolClass $kelasA;

    private SchoolClass $kelasB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ay = AcademicYear::create([
            'tahun' => '2026/2027', 'semester' => Semester::Ganjil,
            'tanggal_mulai' => '2026-07-15', 'tanggal_selesai' => '2026-12-04', 'aktif' => true,
        ]);

        $this->kelasA = SchoolClass::create(['tingkat' => Tingkat::XI, 'jurusan' => 'Mekatronika', 'rombel' => 'A', 'academic_year_id' => $this->ay->id]);
        $this->kelasB = SchoolClass::create(['tingkat' => Tingkat::XI, 'jurusan' => 'Mekatronika', 'rombel' => 'B', 'academic_year_id' => $this->ay->id]);
    }

    private function buatGuru(string $nama): User
    {
        $u = User::create([
            'nama' => $nama, 'email' => str()->slug($nama).'@test.sch.id',
            'password' => 'secret123', 'role' => UserRole::Guru,
            'current_academic_year_id' => $this->ay->id,
        ]);
        Teacher::create(['user_id' => $u->id, 'is_bk' => false]);

        return $u;
    }

    private function buatSiswa(SchoolClass $kelas, string $nama): User
    {
        $u = User::create([
            'nama' => $nama, 'email' => str()->slug($nama).'@test.sch.id',
            'password' => 'secret123', 'role' => UserRole::Siswa,
            'current_academic_year_id' => $this->ay->id,
        ]);
        Student::create(['user_id' => $u->id, 'nis' => (string) random_int(10000000, 99999999), 'class_id' => $kelas->id]);

        return $u;
    }

    private function urlKehadiran(SchoolClass $kelas): string
    {
        return '/api/v1/reports/kehadiran?class_id='.$kelas->uuid
            .'&tanggal_mulai=2026-07-15&tanggal_akhir=2026-07-19&format=excel';
    }

    // ── K-01 ────────────────────────────────────────────────────────────────

    public function test_siswa_tidak_bisa_mengunduh_rekap_kehadiran_kelas_mana_pun(): void
    {
        $siswa = $this->buatSiswa($this->kelasA, 'Siswa Uji');
        $this->buatSiswa($this->kelasB, 'Siswa Kelas Lain');

        Sanctum::actingAs($siswa);

        // Kelas lain MAUPUN kelasnya sendiri: rekap sekelas bukan konsumsi siswa.
        $this->get($this->urlKehadiran($this->kelasB))->assertStatus(403);
        $this->get($this->urlKehadiran($this->kelasA))->assertStatus(403);
    }

    public function test_guru_hanya_bisa_mengunduh_rekap_kelas_yang_ia_ajar(): void
    {
        $guru = $this->buatGuru('Guru Mapel');
        $mapel = Subject::create(['kode' => 'MTK', 'nama' => 'Matematika', 'aktif' => true]);
        Schedule::create([
            'class_id' => $this->kelasA->id, 'subject_id' => $mapel->id,
            'teacher_id' => $guru->teacher->id, 'hari' => 'senin',
            'jam_mulai' => '07:00', 'jam_selesai' => '08:30', 'aktif' => true,
            'academic_year_id' => $this->ay->id,
        ]);

        Sanctum::actingAs($guru->fresh());

        $this->get($this->urlKehadiran($this->kelasA))->assertOk();          // diajar
        $this->get($this->urlKehadiran($this->kelasB))->assertStatus(403);   // tidak diajar
    }

    public function test_wali_kelas_bisa_mengunduh_rekap_kelas_perwaliannya(): void
    {
        $wali = $this->buatGuru('Wali Kelas');
        $this->kelasA->update(['wali_kelas_id' => $wali->id]);

        Sanctum::actingAs($wali->fresh());

        $this->get($this->urlKehadiran($this->kelasA))->assertOk();
        $this->get($this->urlKehadiran($this->kelasB))->assertStatus(403);
    }

    public function test_admin_tetap_bisa_mengunduh_rekap_kelas_mana_pun(): void
    {
        $admin = User::create([
            'nama' => 'Admin', 'email' => 'admin@test.sch.id', 'password' => 'secret123',
            'role' => UserRole::Admin, 'current_academic_year_id' => $this->ay->id,
        ]);

        Sanctum::actingAs($admin);

        $this->get($this->urlKehadiran($this->kelasA))->assertOk();
        $this->get($this->urlKehadiran($this->kelasB))->assertOk();
    }

    // ── K-02 ────────────────────────────────────────────────────────────────

    private function wakasek(): User
    {
        return User::create([
            'nama' => 'Wakasek Uji', 'email' => 'wakasek@test.sch.id', 'password' => 'secret123',
            'role' => UserRole::Wakasek, 'current_academic_year_id' => $this->ay->id,
        ]);
    }

    public function test_wakasek_tidak_bisa_membuat_akun_admin(): void
    {
        Sanctum::actingAs($this->wakasek());

        $this->postJson('/api/v1/admin/users', [
            'nama' => 'Akun Selundupan', 'email' => 'selundupan@test.sch.id',
            'password' => 'RahasiaBaru1', 'role' => 'admin', 'status' => 'aktif',
        ])->assertForbidden();

        $this->assertSame(0, User::where('role', UserRole::Admin)->count());
    }

    public function test_wakasek_tidak_bisa_menyentuh_pengaturan_sensitif(): void
    {
        Sanctum::actingAs($this->wakasek());

        $this->putJson('/api/v1/admin/password-defaults', ['teacher_password' => 'CobaTembus1'])->assertForbidden();
        $this->getJson('/api/v1/admin/password-defaults')->assertForbidden();
        $this->getJson('/api/v1/admin/r2/settings')->assertForbidden();
        $this->getJson('/api/v1/admin/fcm/settings')->assertForbidden();
        $this->getJson('/api/v1/admin/credentials/export')->assertForbidden();
        $this->getJson('/api/v1/admin/backup/download')->assertForbidden();
        $this->getJson('/api/v1/admin/deploy-tools/status')->assertForbidden();
        $this->getJson('/api/v1/admin/users')->assertForbidden();
    }

    public function test_wakasek_tetap_bisa_membaca_pemantauan_kurikulum(): void
    {
        Sanctum::actingAs($this->wakasek());

        // Peran wakasek = konsumen laporan & EWS; jangan sampai perbaikan K-02
        // ikut mematikan pekerjaan sahnya.
        $this->getJson('/api/v1/admin/teacher-ews?tanggal_mulai=2026-07-15&tanggal_akhir=2026-07-19')->assertOk();
        $this->getJson('/api/v1/admin/kokurikuler/projects')->assertOk();
    }

    public function test_laporan_ews_tetap_hanya_untuk_pembina_bukan_guru_mapel(): void
    {
        // authorizeEwsExport() tulisan tangan diganti ClassAccess::pastoralClassIds.
        // Perilakunya harus persis sama: wali & BK pengampu boleh, guru mapel tidak.
        $wali = $this->buatGuru('Wali EWS');
        $this->kelasA->update(['wali_kelas_id' => $wali->id]);

        $mapelGuru = $this->buatGuru('Guru Mapel EWS');
        $mapel = Subject::create(['kode' => 'IND', 'nama' => 'B.Indonesia', 'aktif' => true]);
        Schedule::create([
            'class_id' => $this->kelasA->id, 'subject_id' => $mapel->id,
            'teacher_id' => $mapelGuru->teacher->id, 'hari' => 'senin',
            'jam_mulai' => '07:00', 'jam_selesai' => '08:30', 'aktif' => true,
            'academic_year_id' => $this->ay->id,
        ]);

        $url = '/api/v1/reports/ews?class_id='.$this->kelasA->uuid.'&format=excel';

        Sanctum::actingAs($wali->fresh());
        $this->get($url)->assertOk();

        // Mengajar di kelas itu TIDAK memberi hak atas data pembinaannya.
        Sanctum::actingAs($mapelGuru->fresh());
        $this->get($url)->assertStatus(403);
    }

    // ── T-01 ────────────────────────────────────────────────────────────────

    public function test_wali_bisa_presensi_kelas_perwalian_meski_tidak_mengajar_di_situ(): void
    {
        // Kasus mayoritas di lapangan: 19 dari 35 wali tidak mengajar di kelas
        // perwaliannya. Sengaja TANPA membuat jadwal apa pun untuk guru ini.
        $wali = $this->buatGuru('Wali Tanpa Jadwal');
        $this->kelasA->update(['wali_kelas_id' => $wali->id]);
        $this->buatSiswa($this->kelasA, 'Siswa Perwalian');

        Sanctum::actingAs($wali->fresh());

        $res = $this->getJson('/api/v1/daily-attendance?class_id='.$this->kelasA->uuid)->assertOk();
        $this->assertSame($this->kelasA->uuid, $res->json('data.kelas.id'));
        $this->assertCount(1, $res->json('data.siswa'));

        // Tanpa class_id pun harus mendarat di kelas perwaliannya, bukan kelas acak.
        $this->getJson('/api/v1/daily-attendance')
            ->assertOk()
            ->assertJsonPath('data.kelas.id', $this->kelasA->uuid);
    }

    public function test_guru_tidak_bisa_presensi_kelas_yang_bukan_haknya(): void
    {
        $guru = $this->buatGuru('Guru Luar');
        Sanctum::actingAs($guru->fresh());

        $this->getJson('/api/v1/daily-attendance?class_id='.$this->kelasB->uuid)->assertStatus(403);
        $this->postJson('/api/v1/daily-attendance', [
            'tanggal' => '2026-07-17', 'class_id' => $this->kelasB->uuid,
            'records' => [['student_id' => 'x', 'status' => 'hadir']],
        ])->assertStatus(403);
    }

    public function test_presensi_tidak_mengembalikan_kelas_tahun_ajaran_lama(): void
    {
        $lama = AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-01-05', 'tanggal_selesai' => '2026-06-19', 'aktif' => false,
        ]);
        $kelasLama = SchoolClass::create([
            'tingkat' => Tingkat::XI, 'jurusan' => 'Mekatronika', 'rombel' => 'C',
            'academic_year_id' => $lama->id,
        ]);

        $wali = $this->buatGuru('Wali Dua TA');
        $kelasLama->update(['wali_kelas_id' => $wali->id]);   // perwalian TA lama
        $this->kelasA->update(['wali_kelas_id' => $wali->id]); // perwalian TA aktif

        Sanctum::actingAs($wali->fresh());

        $this->getJson('/api/v1/daily-attendance')
            ->assertOk()
            ->assertJsonPath('data.kelas.id', $this->kelasA->uuid);

        $this->getJson('/api/v1/daily-attendance?class_id='.$kelasLama->uuid)->assertStatus(403);
    }

    // ── K-03 (bukan bug — konvensi dikunci) ─────────────────────────────────

    public function test_ambang_rekomendasi_memakai_rentang_bertanda_bukan_besaran(): void
    {
        $siswaUser = $this->buatSiswa($this->kelasA, 'Siswa Ambang');
        $siswa = $siswaUser->student;

        // Konvensi asli (FullDemoSeeder): rentang ditulis dalam poin BERTANDA.
        $negatif = ActionThreshold::create([
            'character_category_id' => null, 'min_point' => -19, 'max_point' => -10,
            'sifat' => 'negatif', 'rekomendasi' => 'Panggil siswa untuk pembinaan.', 'aktif' => true,
        ]);
        $positif = ActionThreshold::create([
            'character_category_id' => null, 'min_point' => 15, 'max_point' => 29,
            'sifat' => 'positif', 'rekomendasi' => 'Berikan apresiasi.', 'aktif' => true,
        ]);

        $service = app(CharacterService::class);

        // Skor −15 masuk rentang negatif, bukan positif.
        $service->checkThresholdsAndRecommend($siswa, -15);
        $this->assertSame(1, Recommendation::where('student_id', $siswa->id)->count());
        $this->assertSame($negatif->id, Recommendation::where('student_id', $siswa->id)->value('threshold_id'));

        // Skor +5 tidak masuk rentang mana pun — tidak boleh memicu apa pun.
        Recommendation::query()->delete();
        $service->checkThresholdsAndRecommend($siswa, 5);
        $this->assertSame(0, Recommendation::where('student_id', $siswa->id)->count());

        // Skor +20 masuk rentang positif.
        $service->checkThresholdsAndRecommend($siswa, 20);
        $this->assertSame($positif->id, Recommendation::where('student_id', $siswa->id)->value('threshold_id'));
    }
}
