<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\SubstitutionStatus;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\AgendaFillSetting;
use App\Models\CharacterManualNote;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\SubstitutionRequest;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Nilai tambah dibatasi ke kelas yang diampu, DENGAN satu pengecualian: guru inval.
 *
 * Dua hal yang harus benar sekaligus, dan gampang salah satunya saja:
 *   1. Guru inval boleh memberi nilai, tapi hanya di jendela sesi yang ia gantikan.
 *   2. Entrinya dicatat ATAS NAMA guru pengampu — rekap kelas tetap milik pengampu,
 *      sementara `teacher_id` + `created_at` merekam siapa yang memberi dan kapan.
 *
 * Guru inval di tes ini sengaja TIDAK punya jadwal apa pun, supaya kalau pemeriksaan
 * inval dihapus ia langsung jatuh ke 403 dan tes gagal keras.
 */
class NilaiTambahInvalTest extends TestCase
{
    use RefreshDatabase;

    private User $pengampu;
    private User $inval;
    private Student $siswaB;
    private SchoolClass $kelasB;
    private SchoolClass $kelasLain;
    private Schedule $jadwalB;
    private string $tanggalSesi;

    protected function setUp(): void
    {
        parent::setUp();

        AgendaFillSetting::instance();   // default: batas 3 hari 0 jam

        $ay = AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-02-09', 'tanggal_selesai' => '2026-06-19', 'aktif' => true,
        ]);

        $this->pengampu = $this->makeTeacher('Guru Pengampu');
        $this->inval    = $this->makeTeacher('Guru Inval');

        $this->kelasB    = SchoolClass::create(['tingkat' => Tingkat::X, 'jurusan' => 'Mekatronika', 'rombel' => 'B', 'academic_year_id' => $ay->id]);
        $this->kelasLain = SchoolClass::create(['tingkat' => Tingkat::X, 'jurusan' => 'Mekatronika', 'rombel' => 'C', 'academic_year_id' => $ay->id]);

        $subject = Subject::create(['kode' => 'MTK', 'nama' => 'Matematika', 'aktif' => true]);

        $this->jadwalB = Schedule::create([
            'class_id' => $this->kelasB->id, 'subject_id' => $subject->id,
            'teacher_id' => $this->pengampu->teacher->id,
            'hari' => 'senin', 'jam_mulai' => '07:00', 'jam_selesai' => '08:30', 'aktif' => true,
        ]);

        $siswaUser    = $this->makeUser(UserRole::Siswa, 'Siswa Kelas B');
        $this->siswaB = Student::create(['user_id' => $siswaUser->id, 'nis' => '2001', 'class_id' => $this->kelasB->id]);

        $this->tanggalSesi = Carbon::now(config('app.school_timezone'))->toDateString();
        $this->buatInvalDisetujui($this->tanggalSesi);
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

    /** Pengajuan inval yang disetujui lewat jalur resminya — slot_aktif tidak ditulis manual. */
    private function buatInvalDisetujui(string $tanggal): SubstitutionRequest
    {
        $req = SubstitutionRequest::create([
            'requester_teacher_id'  => $this->pengampu->teacher->id,
            'substitute_teacher_id' => $this->inval->teacher->id,
            'alasan'                => 'sakit',
            'status'                => SubstitutionStatus::Diajukan,
        ]);

        $req->sessions()->create(['schedule_id' => $this->jadwalB->id, 'tanggal' => $tanggal]);
        $req->pindahStatus(SubstitutionStatus::Disetujui);

        return $req;
    }

    private function beriNilaiTambah(User $guru, Student $siswa, int $nilai = 5)
    {
        Sanctum::actingAs($guru);

        return $this->postJson('/api/v1/character-manual-notes/nilai-tambah', [
            'student_id' => $siswa->uuid,
            'nilai'      => $nilai,
            'catatan'    => 'aktif di kelas',
        ]);
    }

    /** Waktu sekolah pada tanggal sesi, jam tertentu. */
    private function padaSesi(string $jam = '09:00'): Carbon
    {
        return Carbon::parse("{$this->tanggalSesi} {$jam}", config('app.school_timezone'));
    }

    // ── Jendela waktu ─────────────────────────────────────────────────────────

    public function test_guru_inval_boleh_memberi_nilai_tambah_di_kelas_yang_diinvalnya(): void
    {
        $this->travelTo($this->padaSesi('09:00'));

        $this->beriNilaiTambah($this->inval, $this->siswaB)->assertCreated();
    }

    public function test_guru_inval_ditolak_sebelum_tanggal_sesinya_tiba(): void
    {
        // Pengajuan sudah disetujui, tapi sesinya baru besok: belum ada kelas yang ia pegang.
        $this->travelTo($this->padaSesi('09:00')->subDay());

        $this->beriNilaiTambah($this->inval, $this->siswaB)->assertForbidden();
    }

    public function test_guru_inval_ditolak_setelah_batas_pengisian_agenda_lewat(): void
    {
        // Deadline = jadwal selesai (08:30) + 3 hari. Satu jam sesudahnya harus ditolak.
        $this->travelTo($this->padaSesi('08:30')->addDays(3)->addHour());

        $this->beriNilaiTambah($this->inval, $this->siswaB)->assertForbidden();
    }

    public function test_guru_inval_tetap_ditolak_di_kelas_lain_yang_bukan_invalnya(): void
    {
        $lain  = $this->makeUser(UserRole::Siswa, 'Siswa Kelas C');
        $siswaC = Student::create(['user_id' => $lain->id, 'nis' => '2002', 'class_id' => $this->kelasLain->id]);

        $this->travelTo($this->padaSesi('09:00'));

        $this->beriNilaiTambah($this->inval, $siswaC)->assertForbidden();
    }

    // ── Atribusi rekap ────────────────────────────────────────────────────────

    public function test_entri_inval_dicatat_atas_nama_guru_pengampu_lengkap_dgn_pemberi_dan_waktu(): void
    {
        $this->travelTo($this->padaSesi('09:15'));

        $res = $this->beriNilaiTambah($this->inval, $this->siswaB)->assertCreated();

        // Pemberi = guru inval; pemilik rekap = pengampu. Keduanya harus terbaca di API.
        $res->assertJsonPath('data.teacher.nama', 'Guru Inval')
            ->assertJsonPath('data.atas_nama.nama', 'Guru Pengampu')
            ->assertJsonPath('data.oleh_inval', true);

        $note = CharacterManualNote::firstOrFail();
        $this->assertSame($this->inval->teacher->id, $note->teacher_id, 'teacher_id harus pemberi sebenarnya');
        $this->assertSame($this->pengampu->teacher->id, $note->atas_nama_teacher_id, 'rekap harus jatuh ke pengampu');
        $this->assertSame('09:15', $note->created_at->timezone(config('app.school_timezone'))->format('H:i'));
    }

    public function test_entri_guru_biasa_atas_nama_dirinya_sendiri_bukan_ditandai_inval(): void
    {
        $this->travelTo($this->padaSesi('09:00'));

        $this->beriNilaiTambah($this->pengampu, $this->siswaB)
            ->assertCreated()
            ->assertJsonPath('data.oleh_inval', false)
            ->assertJsonPath('data.atas_nama.nama', 'Guru Pengampu');

        $note = CharacterManualNote::firstOrFail();
        $this->assertSame($note->teacher_id, $note->atas_nama_teacher_id);
    }

    // ── Pemilih kelas ikut jendela yang sama ──────────────────────────────────

    public function test_pemilih_kelas_menawarkan_kelas_inval_hanya_selama_jendelanya(): void
    {
        Sanctum::actingAs($this->inval);

        // Guru inval tidak mengampu kelas apa pun; satu-satunya kelas yang muncul
        // adalah kelas yang sedang ia inval.
        $this->travelTo($this->padaSesi('09:00'));
        $this->getJson('/api/v1/character/classes?scope=diampu')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $this->kelasB->uuid);

        // Lewat deadline → kelas itu hilang lagi dari pilihannya.
        $this->travelTo($this->padaSesi('08:30')->addDays(3)->addHour());
        $this->getJson('/api/v1/character/classes?scope=diampu')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }
}
