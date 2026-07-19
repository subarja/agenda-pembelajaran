<?php

namespace Tests\Unit;

use App\Enums\Semester;
use App\Enums\SubstitutionStatus;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
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
use Tests\TestCase;

/**
 * SessionTeacher punya DUA jalur untuk menjawab pertanyaan yang sama:
 *
 *   - per-guru : delegatedAwayKeys() / delegatedToKeys()  (dipakai perlu-diisi)
 *   - batch    : delegationMapFor()                        (dipakai EWS Guru, agar 97
 *                guru tidak menjadi 194 query)
 *
 * SubstitutionTest sudah mengunci invarian "hanya disetujui yang memindahkan kewajiban"
 * lewat jalur per-guru. Yang belum pernah diuji adalah KESETARAAN kedua jalur itu.
 * Kalau keduanya menjawab berbeda, hutang agenda seorang guru akan tampil berbeda di
 * dashboard-nya dibanding di rekap EWS yang dibaca manajemen — persis jenis
 * ketidakcocokan yang sulit dipercaya saat dilaporkan pengguna.
 */
class SessionTeacherBatchTest extends TestCase
{
    use RefreshDatabase;

    private Teacher $pengaju;
    private Teacher $pengganti;
    private Teacher $pihakKetiga;
    private Schedule $jadwal;
    private string $tanggal = '2026-03-11';   // Rabu

    protected function setUp(): void
    {
        parent::setUp();

        $ay = AcademicYear::create([
            'tahun' => '2025/2026', 'semester' => Semester::Genap,
            'tanggal_mulai' => '2026-01-05', 'tanggal_selesai' => '2026-06-19', 'aktif' => true,
        ]);

        $this->pengaju     = $this->guru('Pengaju Batch');
        $this->pengganti   = $this->guru('Pengganti Batch');
        $this->pihakKetiga = $this->guru('Pihak Ketiga Batch');

        $kelas   = SchoolClass::create(['tingkat' => Tingkat::X, 'jurusan' => 'Mekatronika', 'rombel' => 'A', 'academic_year_id' => $ay->id]);
        $subject = Subject::create(['kode' => 'IND', 'nama' => 'B.Indonesia', 'aktif' => true]);

        $this->jadwal = Schedule::create([
            'class_id' => $kelas->id, 'subject_id' => $subject->id,
            'teacher_id' => $this->pengaju->id,
            'hari' => 'rabu', 'jam_mulai' => '07:00', 'jam_selesai' => '08:30', 'aktif' => true,
        ]);
    }

    private function guru(string $nama): Teacher
    {
        $user = User::create([
            'nama' => $nama, 'email' => str()->slug($nama).'@test.sch.id',
            'password' => 'secret123', 'role' => UserRole::Guru,
        ]);

        return Teacher::create(['user_id' => $user->id, 'is_bk' => false]);
    }

    private function pengajuan(SubstitutionStatus $status): SubstitutionRequest
    {
        $req = SubstitutionRequest::create([
            'requester_teacher_id'  => $this->pengaju->id,
            'substitute_teacher_id' => $this->pengganti->id,
            'alasan'                => 'Sakit',
            'status'                => $status,
        ]);

        SubstitutionSession::create([
            'request_id'  => $req->id,
            'schedule_id' => $this->jadwal->id,
            'tanggal'     => $this->tanggal,
        ]);

        return $req;
    }

    private function kunci(): string
    {
        return $this->jadwal->id.'|'.$this->tanggal;
    }

    /**
     * Pengajuan DISETUJUI: jalur per-guru dan jalur batch harus menyebut kunci sesi
     * yang sama persis, pada guru yang sama.
     */
    public function test_batch_setara_dengan_per_guru_saat_disetujui(): void
    {
        $this->pengajuan(SubstitutionStatus::Disetujui);

        $ids = [$this->pengaju->id, $this->pengganti->id, $this->pihakKetiga->id];
        $map = SessionTeacher::delegationMapFor($ids);

        $awayPerGuru = SessionTeacher::delegatedAwayKeys($this->pengaju->id)->all();
        $toPerGuru   = SessionTeacher::delegatedToKeys($this->pengganti->id)->all();

        $this->assertSame([$this->kunci()], $awayPerGuru);
        $this->assertSame([$this->kunci()], $toPerGuru);

        $this->assertSame(
            $awayPerGuru,
            $map['away'][$this->pengaju->id] ?? [],
            'delegationMapFor() harus menyebut sesi "dialihkan keluar" yang sama dengan delegatedAwayKeys()'
        );
        $this->assertSame(
            $toPerGuru,
            $map['to'][$this->pengganti->id] ?? [],
            'delegationMapFor() harus menyebut sesi "diterima" yang sama dengan delegatedToKeys()'
        );
    }

    /**
     * Status selain `disetujui` tidak memindahkan apa pun — dan kedua jalur harus
     * SAMA-SAMA kosong. Jalur batch yang lupa menyaring status akan membuat sesi
     * hilang dari hutang guru asal di EWS, padahal masih kewajibannya.
     */
    public function test_batch_mengabaikan_status_selain_disetujui(): void
    {
        $selainDisetujui = [
            SubstitutionStatus::Diajukan,
            SubstitutionStatus::Ditolak,
            SubstitutionStatus::Dibatalkan,
            SubstitutionStatus::Kedaluwarsa,
        ];

        foreach ($selainDisetujui as $status) {
            SubstitutionSession::query()->delete();
            SubstitutionRequest::query()->delete();

            $this->pengajuan($status);

            $map = SessionTeacher::delegationMapFor([$this->pengaju->id, $this->pengganti->id]);

            $this->assertSame([], $map['away'], "status {$status->value} tidak boleh memindahkan kewajiban (batch)");
            $this->assertSame([], $map['to'], "status {$status->value} tidak boleh memindahkan kewajiban (batch)");

            $this->assertCount(0, SessionTeacher::delegatedAwayKeys($this->pengaju->id));
            $this->assertCount(0, SessionTeacher::delegatedToKeys($this->pengganti->id));

            $this->assertSame(
                $this->pengaju->id,
                SessionTeacher::effectiveTeacherId($this->jadwal->id, $this->tanggal, $this->jadwal->teacher_id),
                "status {$status->value}: guru efektif harus tetap guru terjadwal"
            );
        }
    }

    /** Guru yang tidak terlibat sama sekali tidak muncul di peta batch. */
    public function test_guru_tak_terlibat_tidak_muncul_di_peta(): void
    {
        $this->pengajuan(SubstitutionStatus::Disetujui);

        $map = SessionTeacher::delegationMapFor([
            $this->pengaju->id, $this->pengganti->id, $this->pihakKetiga->id,
        ]);

        $this->assertArrayNotHasKey($this->pihakKetiga->id, $map['away']);
        $this->assertArrayNotHasKey($this->pihakKetiga->id, $map['to']);
    }

    /**
     * Tepat SATU guru bertanggung jawab setelah pengalihan — tidak nol, tidak dua.
     * Diuji dari sisi peta batch: sesi yang sama muncul di `away` pengaju DAN `to`
     * pengganti, dan tidak di tempat lain.
     */
    public function test_tepat_satu_penanggung_jawab_setelah_dialihkan(): void
    {
        $this->pengajuan(SubstitutionStatus::Disetujui);

        $map = SessionTeacher::delegationMapFor([
            $this->pengaju->id, $this->pengganti->id, $this->pihakKetiga->id,
        ]);

        $this->assertContains($this->kunci(), $map['away'][$this->pengaju->id]);
        $this->assertContains($this->kunci(), $map['to'][$this->pengganti->id]);

        $this->assertSame(
            $this->pengganti->id,
            SessionTeacher::effectiveTeacherId($this->jadwal->id, $this->tanggal, $this->jadwal->teacher_id)
        );

        $this->assertFalse(
            SessionTeacher::isResponsible($this->pengaju->id, $this->jadwal->id, $this->tanggal, $this->jadwal->teacher_id),
            'pengaju tidak lagi bertanggung jawab setelah pengalihan disetujui'
        );
        $this->assertTrue(
            SessionTeacher::isResponsible($this->pengganti->id, $this->jadwal->id, $this->tanggal, $this->jadwal->teacher_id)
        );
    }

    /** Daftar guru kosong tidak meledak dan tidak mengembalikan data siapa pun. */
    public function test_daftar_guru_kosong_aman(): void
    {
        $this->pengajuan(SubstitutionStatus::Disetujui);

        $map = SessionTeacher::delegationMapFor([]);

        $this->assertSame([], $map['away']);
        $this->assertSame([], $map['to']);
    }
}
