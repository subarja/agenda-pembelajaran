<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\CharacterCategory;
use App\Models\CharacterInput;
use App\Models\CharacterSubitem;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use App\Services\CharacterService;
use App\Support\ClassAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Pergantian tahun ajaran. Invarian yang dikunci:
 *
 *   1. Jadwal TA lama tidak pernah bocor ke tampilan/otorisasi TA aktif (scoping).
 *   2. Wizard Naik Kelas memindahkan siswa dengan benar: X→XI, XI→XII, XII→lulus,
 *      tinggal kelas → tingkat sama di TA baru; data TA lama tidak disentuh.
 *   3. Poin karakter dihitung per TA — siswa mulai semester baru dari nol.
 *   4. Salin Jadwal menyalin ke kelas padanan TA aktif tanpa menduplikat.
 */
class YearTransitionTest extends TestCase
{
    use RefreshDatabase;

    private AcademicYear $taLama;
    private AcademicYear $taBaru;
    private User $admin;
    private User $guruUser;
    private Subject $mapel;
    private SchoolClass $kelasX;
    private SchoolClass $kelasXII;
    private Student $siswaX;
    private Student $siswaXTinggal;
    private Student $siswaXII;

    protected function setUp(): void
    {
        parent::setUp();

        $this->taLama = AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-02-09', 'tanggal_selesai' => '2026-06-19', 'aktif' => true,
        ]);
        $this->taBaru = AcademicYear::create([
            'tahun' => '2026/2027', 'semester' => Semester::Ganjil,
            'tanggal_mulai' => '2026-07-13', 'tanggal_selesai' => '2026-12-18', 'aktif' => false,
        ]);

        $this->admin = User::create([
            'nama' => 'Admin', 'email' => 'admin@test.sch.id',
            'password' => 'secret123', 'role' => UserRole::Admin,
        ]);

        $this->guruUser = User::create([
            'nama' => 'Guru', 'email' => 'guru@test.sch.id',
            'password' => 'secret123', 'role' => UserRole::Guru,
        ]);
        Teacher::create(['user_id' => $this->guruUser->id, 'is_bk' => false]);
        $this->guruUser = $this->guruUser->fresh('teacher');

        $this->mapel = Subject::create(['kode' => 'MTK', 'nama' => 'Matematika', 'aktif' => true]);

        $this->kelasX   = SchoolClass::create(['tingkat' => Tingkat::X, 'jurusan' => 'Mekatronika', 'rombel' => 'A', 'academic_year_id' => $this->taLama->id]);
        $this->kelasXII = SchoolClass::create(['tingkat' => Tingkat::XII, 'jurusan' => 'Mekatronika', 'rombel' => 'A', 'academic_year_id' => $this->taLama->id]);

        $this->siswaX        = $this->siswa('Siswa X Naik', '1001', $this->kelasX);
        $this->siswaXTinggal = $this->siswa('Siswa X Tinggal', '1002', $this->kelasX);
        $this->siswaXII      = $this->siswa('Siswa XII Lulus', '3001', $this->kelasXII);

        Schedule::create([
            'class_id' => $this->kelasX->id, 'subject_id' => $this->mapel->id,
            'teacher_id' => $this->guruUser->teacher->id,
            'hari' => 'senin', 'jam_mulai' => '07:00', 'jam_selesai' => '08:30', 'aktif' => true,
        ]);
    }

    private function siswa(string $nama, string $nis, SchoolClass $kelas): Student
    {
        $u = User::create([
            'nama' => $nama, 'email' => "s{$nis}@test.sch.id",
            'password' => 'secret123', 'role' => UserRole::Siswa,
        ]);

        return Student::create(['user_id' => $u->id, 'nis' => $nis, 'class_id' => $kelas->id]);
    }

    // ── 1. Scoping jadwal ─────────────────────────────────────────────────────

    public function test_jadwal_ta_lama_tidak_bocor_setelah_ta_baru_aktif(): void
    {
        // Selama TA lama aktif: guru mengampu kelas X (via jadwal)
        $this->assertTrue(
            ClassAccess::taughtClassIds($this->guruUser)->contains($this->kelasX->id),
            'Guru harus mengampu kelas X selama TA lama aktif.',
        );

        // Aktifkan TA baru — jadwal lama masih aktif=true (arsip) tapi TIDAK boleh terbaca
        $this->taLama->update(['aktif' => false]);
        $this->taBaru->update(['aktif' => true]);

        $this->assertTrue(
            ClassAccess::taughtClassIds($this->guruUser->fresh('teacher'))->isEmpty(),
            'Jadwal TA lama bocor ke otorisasi TA baru.',
        );

        Sanctum::actingAs($this->guruUser);
        $this->getJson('/api/v1/agendas/perlu-diisi')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    // ── 2. Wizard Naik Kelas ──────────────────────────────────────────────────

    public function test_naik_kelas_memindahkan_meninggalkan_dan_meluluskan(): void
    {
        Sanctum::actingAs($this->admin);

        $preview = $this->getJson('/api/v1/admin/promotion/preview?target_academic_year_id=' . $this->taBaru->uuid)
            ->assertOk()
            ->json('data');

        $this->assertCount(2, $preview['classes']);

        $this->postJson('/api/v1/admin/promotion/execute', [
            'target_academic_year_id' => $this->taBaru->uuid,
            'tinggal' => [$this->kelasX->uuid => [$this->siswaXTinggal->uuid]],
        ])->assertOk();

        // X naik → XI Mekatronika A di TA baru
        $kelasXIBaru = SchoolClass::where([
            'academic_year_id' => $this->taBaru->id, 'tingkat' => 'XI',
            'jurusan' => 'Mekatronika', 'rombel' => 'A',
        ])->first();
        $this->assertNotNull($kelasXIBaru, 'Kelas XI TA baru harus dibuat otomatis.');
        $this->assertEquals($kelasXIBaru->id, $this->siswaX->fresh()->class_id);

        // Tinggal kelas → X Mekatronika A di TA BARU (bukan tetap di kelas arsip)
        $kelasXBaru = SchoolClass::where([
            'academic_year_id' => $this->taBaru->id, 'tingkat' => 'X',
            'jurusan' => 'Mekatronika', 'rombel' => 'A',
        ])->first();
        $this->assertNotNull($kelasXBaru);
        $this->assertEquals($kelasXBaru->id, $this->siswaXTinggal->fresh()->class_id);
        $this->assertEquals('aktif', $this->siswaXTinggal->fresh()->status);

        // XII lulus: status berubah, kelas TIDAK berubah (arsip), akun nonaktif
        $xii = $this->siswaXII->fresh();
        $this->assertEquals('lulus', $xii->status);
        $this->assertEquals($this->kelasXII->id, $xii->class_id);
        $this->assertEquals('nonaktif', $xii->user->status->value);

        // Kelas & jadwal TA lama tidak disentuh
        $this->assertDatabaseHas('classes', ['id' => $this->kelasX->id, 'academic_year_id' => $this->taLama->id]);
        $this->assertEquals(1, Schedule::where('class_id', $this->kelasX->id)->count());
    }

    // ── 3. Poin karakter per TA ───────────────────────────────────────────────

    public function test_poin_karakter_mulai_dari_nol_di_ta_baru(): void
    {
        $kategori = CharacterCategory::create(['nama' => 'Disiplin', 'aktif' => true]);
        $subitem  = CharacterSubitem::create([
            'category_id' => $kategori->id, 'kode' => 'D01',
            'deskripsi' => 'Terlambat', 'sign' => 'negatif', 'bobot' => 5, 'aktif' => true,
        ]);

        CharacterInput::create([
            'student_id' => $this->siswaX->id, 'subitem_id' => $subitem->id,
            'teacher_id' => $this->guruUser->teacher->id, 'sign' => 'negatif',
        ]);

        $svc = app(CharacterService::class);
        $this->assertEquals(-5, $svc->calculateNetScore($this->siswaX), 'Poin TA aktif harus terhitung.');

        // Ganti TA aktif → skor mulai dari nol; poin lama tetap terbaca di TA-nya sendiri
        $this->taLama->update(['aktif' => false]);
        $this->taBaru->update(['aktif' => true]);

        $this->assertEquals(0, $svc->calculateNetScore($this->siswaX->fresh()), 'Poin TA lama bocor ke TA baru.');
        $this->assertEquals(-5, $svc->calculateNetScore($this->siswaX->fresh(), $this->taLama->id));
    }

    // ── Enrollment: riwayat roster kelas lama tetap bisa direkonstruksi ──────

    public function test_roster_kelas_lama_terekam_di_enrollment(): void
    {
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/v1/admin/promotion/execute', [
            'target_academic_year_id' => $this->taBaru->uuid,
            'tinggal' => [$this->kelasX->uuid => [$this->siswaXTinggal->uuid]],
        ])->assertOk();

        // Roster kelas X TA LAMA masih lengkap — walau students.class_id sudah pindah
        $roster = $this->getJson("/api/v1/admin/classes/{$this->kelasX->uuid}/roster")
            ->assertOk()->json('data.siswa');

        $byNis = collect($roster)->keyBy('nis');
        $this->assertCount(2, $roster);
        $this->assertEquals('naik', $byNis['1001']['status']);
        $this->assertEquals('tinggal', $byNis['1002']['status']);

        $rosterXII = $this->getJson("/api/v1/admin/classes/{$this->kelasXII->uuid}/roster")
            ->assertOk()->json('data.siswa');
        $this->assertEquals('lulus', $rosterXII[0]['status']);
    }

    // ── Kunci semester ────────────────────────────────────────────────────────

    public function test_semester_terkunci_menolak_tulis_dan_tidak_bisa_diaktifkan(): void
    {
        Sanctum::actingAs($this->admin);

        // TA aktif tidak bisa dikunci
        $this->putJson("/api/v1/admin/academic-years/{$this->taLama->uuid}", ['locked' => true])
            ->assertStatus(422);

        // Aktifkan TA baru, kunci TA lama
        $this->putJson("/api/v1/admin/academic-years/{$this->taBaru->uuid}", ['aktif' => true])->assertOk();
        $this->putJson("/api/v1/admin/academic-years/{$this->taLama->uuid}", ['locked' => true])->assertOk();

        // TA terkunci tidak bisa diaktifkan lagi tanpa dibuka
        $this->putJson("/api/v1/admin/academic-years/{$this->taLama->uuid}", ['aktif' => true])
            ->assertStatus(422);

        // Jadwal kelas TA terkunci menolak perubahan (423 Locked)
        $jadwalLama = Schedule::where('class_id', $this->kelasX->id)->first();
        $this->putJson("/api/v1/admin/schedules/{$jadwalLama->uuid}", ['jam_selesai' => '09:00'])
            ->assertStatus(423);

        // Naik kelas DARI TA terkunci ditolak
        $this->postJson('/api/v1/admin/promotion/execute', [
            'source_academic_year_id' => $this->taLama->uuid,
            'target_academic_year_id' => $this->taBaru->uuid,
        ])->assertStatus(423);

        // Buka kunci → bisa lagi
        $this->putJson("/api/v1/admin/academic-years/{$this->taLama->uuid}", ['locked' => false])->assertOk();
        $this->putJson("/api/v1/admin/schedules/{$jadwalLama->uuid}", ['jam_selesai' => '09:00'])
            ->assertOk();
    }

    // ── 4. Salin jadwal ───────────────────────────────────────────────────────

    public function test_salin_jadwal_ke_kelas_padanan_tanpa_duplikat(): void
    {
        // Buat kelas padanan di TA baru (X Mekatronika A) lalu aktifkan TA baru
        $kelasXBaru = SchoolClass::create([
            'tingkat' => Tingkat::X, 'jurusan' => 'Mekatronika', 'rombel' => 'A',
            'academic_year_id' => $this->taBaru->id,
        ]);
        $this->taLama->update(['aktif' => false]);
        $this->taBaru->update(['aktif' => true]);

        Sanctum::actingAs($this->admin);

        $preview = $this->getJson('/api/v1/admin/schedules/copy-preview?source_academic_year_id=' . $this->taLama->uuid)
            ->assertOk()->json('data');
        $this->assertEquals(1, $preview['jumlah_jadwal']);
        // Kelas XII lama tidak punya padanan di TA baru → dilaporkan, bukan digagalkan
        $this->assertContains('XII Mekatronika - A', $preview['tanpa_padanan']);

        $this->postJson('/api/v1/admin/schedules/copy-from', [
            'source_academic_year_id' => $this->taLama->uuid,
        ])->assertOk();

        $this->assertEquals(1, Schedule::where('class_id', $kelasXBaru->id)->count());

        // Idempoten: jalankan lagi → tetap 1 (di-update, bukan diduplikat)
        $this->postJson('/api/v1/admin/schedules/copy-from', [
            'source_academic_year_id' => $this->taLama->uuid,
        ])->assertOk();
        $this->assertEquals(1, Schedule::where('class_id', $kelasXBaru->id)->count());

        // Dan jadwal salinan kini terbaca oleh scoping TA aktif
        $this->assertTrue(
            ClassAccess::taughtClassIds($this->guruUser->fresh('teacher'))->contains($kelasXBaru->id),
        );
    }
}
