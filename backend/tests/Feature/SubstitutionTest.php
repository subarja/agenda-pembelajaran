<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\SubstitutionStatus;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\Agenda;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\SubstitutionRequest;
use App\Models\SubstitutionSession;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use App\Support\SessionTeacher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Guru inval. Yang dikunci di sini bukan "endpoint membalas 200", melainkan satu invarian:
 *
 *   kewajiban mengisi agenda berpindah HANYA setelah pengganti menyetujui,
 *   dan sesudah itu tepat SATU guru yang bertanggung jawab — tidak nol, tidak dua.
 *
 * Kalau invarian itu bocor, ada sesi yang tidak pernah diisi siapa pun, atau hutang agenda
 * tercatat ganda di EWS Guru.
 */
class SubstitutionTest extends TestCase
{
    use RefreshDatabase;

    private User $pengaju;
    private User $pengganti;
    private User $pihakKetiga;
    private Schedule $jadwal;
    private string $tanggal;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();

        AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-02-09', 'tanggal_selesai' => '2026-06-19', 'aktif' => true,
        ]);

        $this->pengaju     = $this->guru('Pengaju');
        $this->pengganti   = $this->guru('Pengganti');
        $this->pihakKetiga = $this->guru('Pihak Ketiga');

        $kelas   = SchoolClass::create(['tingkat' => Tingkat::X, 'jurusan' => 'Mekatronika', 'rombel' => 'A', 'academic_year_id' => AcademicYear::first()->id]);
        $subject = Subject::create(['kode' => 'IND', 'nama' => 'B.Indonesia', 'aktif' => true]);

        // Sesi dipatok pada HARI INI supaya selalu di dalam batas isi agenda, apa pun
        // tanggal test dijalankan. `hari` harus cocok dengan tanggalnya — itu salah satu
        // aturan kelayakan yang divalidasi backend.
        $hariIni       = Carbon::now(config('app.school_timezone'));
        $this->tanggal = $hariIni->toDateString();

        $this->jadwal = Schedule::create([
            'class_id' => $kelas->id, 'subject_id' => $subject->id,
            'teacher_id' => $this->pengaju->teacher->id,
            'hari' => $this->namaHari($hariIni),
            'jam_mulai' => '07:00', 'jam_selesai' => '08:30', 'aktif' => true,
        ]);
    }

    private function namaHari(Carbon $t): string
    {
        return ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'][$t->dayOfWeek];
    }

    private function guru(string $nama): User
    {
        $user = User::create([
            'nama' => $nama, 'email' => str()->slug($nama).'@test.sch.id',
            'password' => 'secret123', 'role' => UserRole::Guru,
        ]);
        Teacher::create(['user_id' => $user->id, 'is_bk' => false]);

        return $user->fresh('teacher');
    }

    private function ajukan(): string
    {
        Sanctum::actingAs($this->pengaju);

        return $this->postJson('/api/v1/inval', [
            'substitute_teacher_id' => $this->pengganti->teacher->uuid,
            'alasan'                => 'Sakit',
            'pesan'                 => 'Kerjakan LKS hal 20',
            'link_tugas'            => 'https://drive.google.com/file/d/abc',
            'sesi'                  => [$this->jadwal->uuid.'|'.$this->tanggal],
        ])->assertCreated()->json('data.id');
    }

    private function idGuruEfektif(): int
    {
        return SessionTeacher::effectiveTeacherId($this->jadwal->id, $this->tanggal, $this->jadwal->teacher_id);
    }

    // ── Invarian utama ────────────────────────────────────────────────────────

    public function test_pengajuan_yang_menunggu_belum_memindahkan_kewajiban(): void
    {
        $this->ajukan();

        $this->assertSame($this->pengaju->teacher->id, $this->idGuruEfektif());
    }

    public function test_kewajiban_pindah_hanya_setelah_disetujui(): void
    {
        $id = $this->ajukan();

        Sanctum::actingAs($this->pengganti);
        $this->putJson("/api/v1/inval/{$id}/setujui")->assertOk();

        $this->assertSame($this->pengganti->teacher->id, $this->idGuruEfektif());
    }

    public function test_setelah_disetujui_pengaju_tidak_boleh_lagi_mengisi_agenda(): void
    {
        $id = $this->ajukan();
        Sanctum::actingAs($this->pengganti);
        $this->putJson("/api/v1/inval/{$id}/setujui")->assertOk();

        Sanctum::actingAs($this->pengaju);
        $this->postJson('/api/v1/agendas', [
            'schedule_id' => $this->jadwal->uuid, 'tanggal' => $this->tanggal, 'resume_kbm' => 'x',
        ])->assertForbidden();

        Sanctum::actingAs($this->pengganti);
        $this->postJson('/api/v1/agendas', [
            'schedule_id' => $this->jadwal->uuid, 'tanggal' => $this->tanggal, 'resume_kbm' => 'diisi pengganti',
        ])->assertCreated();
    }

    public function test_sesi_hilang_dari_perlu_diisi_pengaju_dan_muncul_di_pengganti(): void
    {
        $id = $this->ajukan();
        Sanctum::actingAs($this->pengganti);
        $this->putJson("/api/v1/inval/{$id}/setujui")->assertOk();

        Sanctum::actingAs($this->pengaju);
        $this->getJson('/api/v1/agendas/perlu-diisi')->assertOk()->assertJsonCount(0, 'data');

        Sanctum::actingAs($this->pengganti);
        $this->getJson('/api/v1/agendas/perlu-diisi')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.inval_dari', 'Pengaju');
    }

    // ── Penolakan, pembatalan, kedaluwarsa ────────────────────────────────────

    public function test_ditolak_maka_kewajiban_tetap_di_pengaju_dan_sesi_bisa_diajukan_ulang(): void
    {
        $id = $this->ajukan();

        Sanctum::actingAs($this->pengganti);
        $this->putJson("/api/v1/inval/{$id}/tolak", ['alasan_penolakan' => 'Ada rapat'])->assertOk();

        $this->assertSame($this->pengaju->teacher->id, $this->idGuruEfektif());

        // Sesi terbebas dari kunci `slot_aktif`, jadi boleh diajukan ke guru lain.
        $this->ajukan();
    }

    public function test_kedaluwarsa_tidak_pernah_memindahkan_kewajiban(): void
    {
        $id  = $this->ajukan();
        $req = SubstitutionRequest::where('uuid', $id)->firstOrFail();

        $this->travelTo(Carbon::now()->addDays(2));
        $this->artisan('inval:kedaluwarsa')->assertSuccessful();

        $this->assertSame(SubstitutionStatus::Kedaluwarsa, $req->fresh()->status);
        $this->assertSame($this->pengaju->teacher->id, $this->idGuruEfektif());
        $this->assertNull(SubstitutionSession::where('request_id', $req->id)->value('slot_aktif'));
    }

    // ── Otorisasi ─────────────────────────────────────────────────────────────

    public function test_hanya_guru_tujuan_yang_bisa_menyetujui_atau_menolak(): void
    {
        $id = $this->ajukan();

        Sanctum::actingAs($this->pihakKetiga);
        $this->putJson("/api/v1/inval/{$id}/setujui")->assertForbidden();

        Sanctum::actingAs($this->pengaju);
        $this->putJson("/api/v1/inval/{$id}/setujui")->assertForbidden();
    }

    public function test_hanya_pengaju_yang_bisa_membatalkan(): void
    {
        $id = $this->ajukan();

        Sanctum::actingAs($this->pengganti);
        $this->putJson("/api/v1/inval/{$id}/batal")->assertForbidden();

        Sanctum::actingAs($this->pengaju);
        $this->putJson("/api/v1/inval/{$id}/batal")->assertOk();
    }

    public function test_guru_tidak_bisa_mengajukan_sesi_milik_guru_lain(): void
    {
        Sanctum::actingAs($this->pengganti);

        $this->postJson('/api/v1/inval', [
            'substitute_teacher_id' => $this->pihakKetiga->teacher->uuid,
            'alasan'                => 'Menyerobot',
            'sesi'                  => [$this->jadwal->uuid.'|'.$this->tanggal],
        ])->assertForbidden();
    }

    public function test_satu_sesi_tidak_bisa_punya_dua_pengajuan_aktif(): void
    {
        $this->ajukan();

        Sanctum::actingAs($this->pengaju);
        $this->postJson('/api/v1/inval', [
            'substitute_teacher_id' => $this->pihakKetiga->teacher->uuid,
            'alasan'                => 'Dobel',
            'sesi'                  => [$this->jadwal->uuid.'|'.$this->tanggal],
        ])->assertStatus(422);
    }

    public function test_inval_mundur_di_luar_batas_isi_agenda_ditolak(): void
    {
        // Jauh melewati AgendaFillSetting (default 3 hari) — celah "alihkan hutang lama".
        $lampau = Carbon::now(config('app.school_timezone'))->subDays(28)->toDateString();

        Sanctum::actingAs($this->pengaju);
        $this->postJson('/api/v1/inval', [
            'substitute_teacher_id' => $this->pengganti->teacher->uuid,
            'alasan'                => 'Telat mengurus',
            'sesi'                  => [$this->jadwal->uuid.'|'.$lampau],
        ])->assertStatus(422);
    }

    public function test_sesi_yang_agendanya_sudah_diisi_tidak_bisa_diajukan(): void
    {
        Agenda::create(['schedule_id' => $this->jadwal->id, 'tanggal' => $this->tanggal, 'status' => 'submitted']);

        Sanctum::actingAs($this->pengaju);
        $this->postJson('/api/v1/inval', [
            'substitute_teacher_id' => $this->pengganti->teacher->uuid,
            'alasan'                => 'Sakit',
            'sesi'                  => [$this->jadwal->uuid.'|'.$this->tanggal],
        ])->assertStatus(422);
    }

    public function test_admin_melihat_semua_pengajuan_guru_tidak(): void
    {
        $this->ajukan();

        $admin = User::create(['nama' => 'Admin', 'email' => 'adm@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Admin]);

        Sanctum::actingAs($admin);
        $this->getJson('/api/v1/admin/inval')->assertOk()->assertJsonCount(1, 'data');

        Sanctum::actingAs($this->pihakKetiga);
        $this->getJson('/api/v1/admin/inval')->assertForbidden();
    }
}
