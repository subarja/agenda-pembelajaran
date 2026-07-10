<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\StudentCaseNote;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Kunci regresi untuk kebocoran otorisasi yang ditemukan pada audit 2026-07-09.
 *
 * Akar semua temuan itu satu: KAPABILITAS ("apakah orang ini wali kelas?") diperlakukan
 * sebagai IZIN ("berarti ia boleh melihat siswa mana pun"). Tes ini memakai dua wali kelas
 * yang berbeda supaya cacat itu tidak bisa lolos: kalau pemeriksaan kepemilikan kelas
 * dihapus lagi, `wali B` akan bisa membaca data siswa `wali A` dan tes gagal.
 */
class StudentDataAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private User $waliA;
    private User $waliB;
    private User $guruMapel;
    private User $admin;
    private User $siswaUser;
    private Student $siswaA;   // di kelas perwalian waliA
    private SchoolClass $kelasA;
    private SchoolClass $kelasB;

    protected function setUp(): void
    {
        parent::setUp();

        $ay = AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-02-09', 'tanggal_selesai' => '2026-06-19', 'aktif' => true,
        ]);

        $this->admin     = $this->makeUser(UserRole::Admin, 'Admin Sekolah');
        $this->waliA     = $this->makeTeacher('Wali A');
        $this->waliB     = $this->makeTeacher('Wali B');
        $this->guruMapel = $this->makeTeacher('Guru Mapel');

        $this->kelasA = SchoolClass::create(['tingkat' => Tingkat::X, 'jurusan' => 'Mekatronika', 'rombel' => 'A', 'wali_kelas_id' => $this->waliA->id, 'academic_year_id' => $ay->id]);
        $this->kelasB = SchoolClass::create(['tingkat' => Tingkat::X, 'jurusan' => 'Mekatronika', 'rombel' => 'B', 'wali_kelas_id' => $this->waliB->id, 'academic_year_id' => $ay->id]);

        // Guru mapel MENGAJAR di kelas A tapi bukan wali kelasnya. Inilah pembeda penting:
        // ia boleh melihat daftar absen kelas A, tapi tidak boleh membuka rekap pembinaan
        // maupun catatan konseling siswanya.
        $subject = Subject::create(['kode' => 'IND', 'nama' => 'B.Indonesia', 'aktif' => true]);
        Schedule::create([
            'class_id' => $this->kelasA->id, 'subject_id' => $subject->id,
            'teacher_id' => $this->guruMapel->teacher->id,
            'hari' => 'senin', 'jam_mulai' => '07:00', 'jam_selesai' => '08:30', 'aktif' => true,
        ]);

        $this->siswaUser = $this->makeUser(UserRole::Siswa, 'Siswa A');
        $this->siswaA    = Student::create(['user_id' => $this->siswaUser->id, 'nis' => '1001', 'class_id' => $this->kelasA->id]);
    }

    private function makeUser(UserRole $role, string $nama): User
    {
        return User::create(['nama' => $nama, 'email' => str()->slug($nama).'@test.sch.id', 'password' => 'secret123', 'role' => $role]);
    }

    private function makeTeacher(string $nama): User
    {
        $user = $this->makeUser(UserRole::Guru, $nama);
        Teacher::create(['user_id' => $user->id, 'is_bk' => false]);

        return $user->fresh();
    }

    // ── Daftar & pencarian siswa ──────────────────────────────────────────────

    public function test_akun_siswa_tidak_bisa_menelusuri_siswa_lain(): void
    {
        Sanctum::actingAs($this->siswaUser);

        $this->getJson('/api/v1/students?search=sis')->assertForbidden();
        $this->getJson("/api/v1/students?class_id={$this->kelasB->uuid}")->assertForbidden();
    }

    public function test_wali_kelas_tidak_bisa_membuka_daftar_siswa_kelas_lain(): void
    {
        Sanctum::actingAs($this->waliB);

        $this->getJson("/api/v1/students?class_id={$this->kelasA->uuid}")->assertForbidden();
    }

    public function test_guru_mapel_boleh_membuka_daftar_siswa_kelas_yang_diajarnya(): void
    {
        Sanctum::actingAs($this->guruMapel);

        $this->getJson("/api/v1/students?class_id={$this->kelasA->uuid}")->assertOk();
        $this->getJson("/api/v1/students?class_id={$this->kelasB->uuid}")->assertForbidden();
    }

    public function test_semua_guru_tetap_boleh_mencari_siswa_lintas_kelas_untuk_input_karakter(): void
    {
        // Prinsip produk "karakter sebagai aset kolektif": guru piket harus tetap bisa
        // mencatat pelanggaran siswa di luar kelas yang ia ajar. Ini BUKAN kebocoran.
        Sanctum::actingAs($this->guruMapel);

        $this->getJson('/api/v1/students?search=Siswa')->assertOk();
    }

    // ── Pemilih kelas untuk penilaian karakter ────────────────────────────────

    public function test_guru_mapel_boleh_membuka_daftar_absen_kelas_yang_tidak_diampu_untuk_karakter(): void
    {
        // Kembaran longgar dari /students?class_id=. Guru mapel kelas A harus bisa memilih
        // kelas B di grid karakter — ia tetap tidak boleh melihatnya lewat /students.
        Sanctum::actingAs($this->guruMapel);

        $this->getJson("/api/v1/character/students?class_id={$this->kelasB->uuid}")->assertOk();
        $this->getJson("/api/v1/students?class_id={$this->kelasB->uuid}")->assertForbidden();
    }

    public function test_pemilih_kelas_karakter_menawarkan_seluruh_kelas_sekolah(): void
    {
        Sanctum::actingAs($this->guruMapel);

        $this->getJson('/api/v1/character/classes')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_pemilih_kelas_scope_diampu_hanya_kelas_yang_diajar_atau_diwalikelasi(): void
    {
        // Guru mapel: mengajar kelas A saja.
        Sanctum::actingAs($this->guruMapel);
        $this->getJson('/api/v1/character/classes?scope=diampu')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $this->kelasA->uuid);

        // Wali B: tidak punya jadwal mengajar sama sekali, tapi mewalikelasi kelas B.
        // Kalau scope=diampu hanya melihat jadwal, kelas perwaliannya akan hilang.
        Sanctum::actingAs($this->waliB);
        $this->getJson('/api/v1/character/classes?scope=diampu')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $this->kelasB->uuid);
    }

    // ── Nilai Tambah: TIDAK lintas kelas (beda dari penilaian karakter) ───────

    public function test_guru_boleh_memberi_nilai_tambah_di_kelas_yang_diampunya(): void
    {
        Sanctum::actingAs($this->guruMapel);

        $this->postJson('/api/v1/character-manual-notes/nilai-tambah', [
            'student_id' => $this->siswaA->uuid,   // kelas A, yang ia ajar
            'nilai'      => 5,
        ])->assertCreated();
    }

    public function test_guru_tidak_boleh_memberi_nilai_tambah_di_kelas_yang_tidak_diampunya(): void
    {
        // Pembeda dari penilaian karakter: nilainya bebas (±20) DAN langsung final tanpa
        // review, jadi tidak boleh diberikan lintas kelas seperti poin karakter terstandar.
        $lain   = $this->makeUser(UserRole::Siswa, 'Siswa Kelas B');
        $siswaB = Student::create(['user_id' => $lain->id, 'nis' => '1004', 'class_id' => $this->kelasB->id]);

        Sanctum::actingAs($this->guruMapel);

        $this->postJson('/api/v1/character-manual-notes/nilai-tambah', [
            'student_id' => $siswaB->uuid,
            'nilai'      => 20,
        ])->assertForbidden();

        // Tapi poin karakter terstandar ke siswa yang sama tetap boleh.
        $kategori = \App\Models\CharacterCategory::create(['nama' => 'Disiplin', 'aktif' => true]);
        $subitem  = \App\Models\CharacterSubitem::create([
            'category_id' => $kategori->id, 'kode' => 'D1', 'deskripsi' => 'Terlambat',
            'bobot' => 5, 'sifat' => \App\Enums\CharacterSifat::Negatif, 'aktif' => true,
        ]);

        $this->postJson('/api/v1/character-inputs', [
            'student_id' => $siswaB->uuid,
            'subitem_id' => $subitem->uuid,
        ])->assertCreated();
    }

    public function test_wali_kelas_boleh_memberi_nilai_tambah_di_kelas_perwaliannya_walau_tak_mengajar(): void
    {
        Sanctum::actingAs($this->waliA);   // wali kelas A, tanpa jadwal mengajar

        $this->postJson('/api/v1/character-manual-notes/nilai-tambah', [
            'student_id' => $this->siswaA->uuid,
            'nilai'      => 3,
        ])->assertCreated();
    }

    public function test_akun_siswa_tidak_bisa_memakai_pemilih_kelas_karakter(): void
    {
        Sanctum::actingAs($this->siswaUser);

        $this->getJson('/api/v1/character/classes')->assertForbidden();
        $this->getJson("/api/v1/character/students?class_id={$this->kelasB->uuid}")->assertForbidden();
    }

    // ── Rekap siswa ───────────────────────────────────────────────────────────

    public function test_wali_kelas_lain_tidak_bisa_membuka_rekap_siswa(): void
    {
        Sanctum::actingAs($this->waliB);

        $this->getJson("/api/v1/students/{$this->siswaA->uuid}/rekap")->assertForbidden();
    }

    public function test_guru_mapel_tidak_bisa_membuka_rekap_siswa_yang_ia_ajar(): void
    {
        Sanctum::actingAs($this->guruMapel);

        $this->getJson("/api/v1/students/{$this->siswaA->uuid}/rekap")->assertForbidden();
    }

    public function test_wali_kelas_sendiri_dan_admin_boleh_membuka_rekap(): void
    {
        Sanctum::actingAs($this->waliA);
        $this->getJson("/api/v1/students/{$this->siswaA->uuid}/rekap")->assertOk();

        Sanctum::actingAs($this->admin);
        $this->getJson("/api/v1/students/{$this->siswaA->uuid}/rekap")->assertOk();
    }

    public function test_siswa_hanya_bisa_membuka_rekapnya_sendiri(): void
    {
        $lain = $this->makeUser(UserRole::Siswa, 'Siswa B');
        $siswaB = Student::create(['user_id' => $lain->id, 'nis' => '1002', 'class_id' => $this->kelasB->id]);

        Sanctum::actingAs($this->siswaUser);
        $this->getJson("/api/v1/students/{$this->siswaA->uuid}/rekap")->assertOk();
        $this->getJson("/api/v1/students/{$siswaB->uuid}/rekap")->assertForbidden();
    }

    // ── Catatan konseling ─────────────────────────────────────────────────────

    public function test_wali_kelas_lain_tidak_bisa_membaca_catatan_konseling(): void
    {
        StudentCaseNote::create([
            'student_id' => $this->siswaA->id, 'author_id' => $this->waliA->id,
            'jenis' => 'wali_kelas', 'catatan' => 'Masalah keluarga', 'tanggal' => '2026-03-02',
            'konfidensial' => false,
        ]);

        Sanctum::actingAs($this->waliB);
        $this->getJson("/api/v1/student-case-notes?student_id={$this->siswaA->uuid}")->assertForbidden();

        Sanctum::actingAs($this->waliA);
        $this->getJson("/api/v1/student-case-notes?student_id={$this->siswaA->uuid}")
            ->assertOk()
            ->assertJsonPath('data.0.catatan', 'Masalah keluarga');
    }

    public function test_wali_kelas_lain_tidak_bisa_menulis_catatan_konseling(): void
    {
        Sanctum::actingAs($this->waliB);

        $this->postJson('/api/v1/student-case-notes', [
            'student_id' => $this->siswaA->uuid, 'jenis' => 'wali_kelas',
            'catatan' => 'Menyusup', 'tanggal' => '2026-03-02',
        ])->assertForbidden();

        $this->assertDatabaseCount('student_case_notes', 0);
    }

    // ── Karakter ──────────────────────────────────────────────────────────────

    public function test_akun_siswa_tidak_bisa_membaca_karakter_siswa_lain(): void
    {
        $lain   = $this->makeUser(UserRole::Siswa, 'Siswa C');
        $siswaC = Student::create(['user_id' => $lain->id, 'nis' => '1003', 'class_id' => $this->kelasB->id]);

        Sanctum::actingAs($this->siswaUser);
        $this->getJson("/api/v1/character-summary?student_id={$siswaC->uuid}")->assertForbidden();
        $this->getJson("/api/v1/character-inputs?student_id={$siswaC->uuid}")->assertForbidden();

        // Miliknya sendiri tetap boleh.
        $this->getJson("/api/v1/character-summary?student_id={$this->siswaA->uuid}")->assertOk();
    }
}
