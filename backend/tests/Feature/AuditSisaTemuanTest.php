<?php

namespace Tests\Feature;

use App\Enums\CharacterSign;
use App\Enums\Semester;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\ActionThreshold;
use App\Models\Recommendation;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\User;
use App\Services\CharacterService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Sisa temuan audit 2026-07-19 yang belum ditutup di dua commit sebelumnya:
 * K-03 (ambang tindakan mengabaikan `sifat`), R-01 (500 `Route [login] not defined`),
 * R-02 (placement_id asing dibalas 200), R-03 (404 utk keadaan kosong wajar).
 */
class AuditSisaTemuanTest extends TestCase
{
    use RefreshDatabase;

    private Student $siswa;

    protected function setUp(): void
    {
        parent::setUp();

        $ay = AcademicYear::create([
            'tahun' => '2026/2027', 'semester' => Semester::Ganjil,
            'tanggal_mulai' => '2026-07-15', 'tanggal_selesai' => '2026-12-04', 'aktif' => true,
        ]);

        $wali = User::create(['nama' => 'Wali Uji', 'email' => 'waliuji@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Guru]);

        $kelas = SchoolClass::create([
            'tingkat' => 'XI', 'jurusan' => 'RPL', 'rombel' => 'A',
            'academic_year_id' => $ay->id, 'wali_kelas_id' => $wali->id,
        ]);

        $userSiswa = User::create(['nama' => 'Siswa Uji', 'email' => 'siswauji@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Siswa]);
        $this->siswa = Student::create(['user_id' => $userSiswa->id, 'nis' => '1234567', 'class_id' => $kelas->id]);
    }

    /**
     * K-03 — inti temuannya. Ambang bersifat NEGATIF dengan `max_point` kosong: rentangnya
     * saja (>= 5, tanpa batas atas) terpenuhi oleh siswa berpoin +20, jadi sebelum
     * perbaikan siswa berprestasi ikut dipanggil orang tuanya.
     */
    public function test_ambang_negatif_tak_terpicu_oleh_poin_positif(): void
    {
        $threshold = ActionThreshold::create([
            'min_point' => 5, 'max_point' => null, 'sifat' => CharacterSign::Negatif,
            'rekomendasi' => 'Panggil orang tua dan konseling BK', 'aktif' => true,
        ]);

        app(CharacterService::class)->checkThresholdsAndRecommend($this->siswa, 20);

        $this->assertDatabaseMissing('recommendations', [
            'student_id' => $this->siswa->id, 'threshold_id' => $threshold->id,
        ]);
    }

    /** Kebalikannya wajib tetap jalan: poin negatif memang harus memicu ambang negatif. */
    public function test_ambang_negatif_tetap_terpicu_oleh_poin_negatif(): void
    {
        $threshold = ActionThreshold::create([
            'min_point' => -9999, 'max_point' => -10, 'sifat' => CharacterSign::Negatif,
            'rekomendasi' => 'Panggil orang tua dan konseling BK', 'aktif' => true,
        ]);

        app(CharacterService::class)->checkThresholdsAndRecommend($this->siswa, -15);

        $this->assertDatabaseHas('recommendations', [
            'student_id' => $this->siswa->id, 'threshold_id' => $threshold->id,
        ]);
    }

    /** Ambang positif (apresiasi) tidak boleh terpicu oleh skor minus. */
    public function test_ambang_positif_tak_terpicu_oleh_poin_negatif(): void
    {
        $threshold = ActionThreshold::create([
            'min_point' => -9999, 'max_point' => 9999, 'sifat' => CharacterSign::Positif,
            'rekomendasi' => 'Berikan penghargaan', 'aktif' => true,
        ]);

        app(CharacterService::class)->checkThresholdsAndRecommend($this->siswa, -15);

        $this->assertSame(0, Recommendation::where('student_id', $this->siswa->id)->count());
    }

    /** Skor 0 netral — tidak memicu ambang sifat apa pun. */
    public function test_skor_nol_tidak_memicu_apa_pun(): void
    {
        ActionThreshold::create([
            'min_point' => -9999, 'max_point' => 9999, 'sifat' => CharacterSign::Negatif,
            'rekomendasi' => 'Konseling', 'aktif' => true,
        ]);
        ActionThreshold::create([
            'min_point' => -9999, 'max_point' => 9999, 'sifat' => CharacterSign::Positif,
            'rekomendasi' => 'Apresiasi', 'aktif' => true,
        ]);

        app(CharacterService::class)->checkThresholdsAndRecommend($this->siswa, 0);

        $this->assertSame(0, Recommendation::where('student_id', $this->siswa->id)->count());
    }

    /**
     * R-01 — token ngawur TANPA header `Accept: application/json`. Dulu masuk ke jalur
     * redirect-tamu Laravel dan meledak 500 `Route [login] not defined`, membocorkan
     * stack trace saat APP_DEBUG hidup.
     */
    public function test_token_ngawur_tanpa_accept_json_balas_401_bukan_500(): void
    {
        $response = $this->get('/api/v1/auth/me', [
            'Authorization' => 'Bearer token-ngawur-tanpa-accept-header',
        ]);

        $response->assertStatus(401);
        $response->assertJsonStructure(['message']);
    }

    /** Tanpa token sama sekali, juga tanpa Accept — tetap 401 JSON. */
    public function test_tanpa_token_tanpa_accept_json_balas_401(): void
    {
        $this->get('/api/v1/auth/me')->assertStatus(401);
    }
}
