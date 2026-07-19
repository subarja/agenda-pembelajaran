<?php

namespace Tests\Feature;

use App\Enums\CharacterSign;
use App\Enums\Semester;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\CharacterManualNote;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Kebocoran otorisasi: siswa membaca data pribadi siswa LAIN.
 *
 * Audit 19 Juli menemukan tiga temuan kritis dengan pola identik — endpoint
 * memvalidasi bentuk input lalu `firstOrFail()` TANPA memeriksa otorisasi. Perbaikan
 * saat itu diterapkan ke `CharacterController::indexInputs()` dan `::summary()`, tapi
 * `CharacterManualNoteController::index()` TERLEWAT: siswa mana pun bisa memanggil
 * `GET /character-manual-notes?student_id=<uuid siswa lain>` dan membaca seluruh
 * catatan manual karakter siswa itu — isi catatan, nilai, dan nama guru pemberinya.
 * Data yang tunduk UU PDP 27/2022.
 *
 * Test ini menutup ketiganya sekaligus supaya endpoint keempat yang lupa dijaga
 * langsung ketahuan, bukan menunggu audit berikutnya.
 */
class KebocoranOtorisasiTest extends TestCase
{
    use RefreshDatabase;

    private User $siswaA;
    private Student $studentA;
    private Student $studentB;

    protected function setUp(): void
    {
        parent::setUp();

        $ay = AcademicYear::create([
            'tahun' => '2026/2027', 'semester' => Semester::Ganjil,
            'tanggal_mulai' => '2026-07-13', 'tanggal_selesai' => '2026-12-04', 'aktif' => true,
        ]);

        $guru = User::create([
            'nama' => 'Guru Uji', 'email' => 'guruotor@test.sch.id',
            'password' => 'secret123', 'role' => UserRole::Guru,
        ]);
        $teacher = Teacher::create(['user_id' => $guru->id, 'nip' => '198601012011011003', 'is_bk' => false]);

        $kelas = SchoolClass::create([
            'tingkat' => 'XI', 'jurusan' => 'RPL', 'rombel' => 'A',
            'academic_year_id' => $ay->id, 'wali_kelas_id' => $guru->id,
        ]);

        $this->siswaA = User::create([
            'nama' => 'Siswa A', 'email' => 'siswaa@test.sch.id',
            'password' => 'secret123', 'role' => UserRole::Siswa,
        ]);
        $this->studentA = Student::create([
            'user_id' => $this->siswaA->id, 'nis' => '2000001', 'class_id' => $kelas->id,
        ]);

        $siswaB = User::create([
            'nama' => 'Siswa B', 'email' => 'siswab@test.sch.id',
            'password' => 'secret123', 'role' => UserRole::Siswa,
        ]);
        $this->studentB = Student::create([
            'user_id' => $siswaB->id, 'nis' => '2000002', 'class_id' => $kelas->id,
        ]);

        // Catatan milik siswa B — inilah yang tidak boleh terbaca oleh siswa A.
        CharacterManualNote::create([
            'student_id'       => $this->studentB->id,
            'teacher_id'       => $teacher->id,
            'academic_year_id' => $ay->id,
            'catatan'          => 'RAHASIA: catatan pribadi siswa B',
            'sifat'            => CharacterSign::Negatif,
            'status'           => 'pending',
        ]);
    }

    public function test_siswa_tidak_bisa_membaca_catatan_manual_siswa_lain(): void
    {
        Sanctum::actingAs($this->siswaA);

        $this->getJson('/api/v1/character-manual-notes?student_id='.$this->studentB->uuid)
            ->assertStatus(403);
    }

    public function test_isi_catatan_siswa_lain_tidak_pernah_ikut_terkirim(): void
    {
        Sanctum::actingAs($this->siswaA);

        $response = $this->getJson('/api/v1/character-manual-notes?student_id='.$this->studentB->uuid);

        // Bukan cuma status — pastikan teks rahasianya benar-benar tidak ada di badan respons.
        $this->assertStringNotContainsString('RAHASIA', $response->getContent());
    }

    public function test_siswa_tetap_bisa_membaca_catatan_miliknya_sendiri(): void
    {
        Sanctum::actingAs($this->siswaA);

        $this->getJson('/api/v1/character-manual-notes?student_id='.$this->studentA->uuid)
            ->assertStatus(200);
    }

    /** Endpoint sekeluarga yang sudah dijaga sejak audit — jangan sampai regresi. */
    public function test_endpoint_karakter_sekeluarga_tetap_terjaga(): void
    {
        Sanctum::actingAs($this->siswaA);

        $this->getJson('/api/v1/character-inputs?student_id='.$this->studentB->uuid)
            ->assertStatus(403);

        $this->getJson('/api/v1/character-summary?student_id='.$this->studentB->uuid)
            ->assertStatus(403);
    }
}
