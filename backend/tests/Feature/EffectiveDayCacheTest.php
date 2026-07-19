<?php

namespace Tests\Feature;

use App\Enums\Hari;
use App\Enums\Semester;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\NonEffectiveDay;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use App\Services\EffectiveDayService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * S-02 (audit 2026-07-19) + tindak lanjutnya.
 *
 * `/admin/effective-days/export` dulu 5160 ms / 3140 query karena tahun ajaran,
 * jadwal, dan seluruh tabel hari-tidak-efektif diambil ULANG tiap pemanggilan
 * (979 invokasi), padahal semuanya loop-invariant. Lalu ketahuan jadwal kelas yang
 * sama masih ditembak dua kali — sekali untuk menghitung hari, sekali untuk
 * mengenumerasi mapel.
 *
 * Test ini mengunci DUA hal sekaligus, karena optimasi cache paling gampang
 * merusak kebenaran secara diam-diam:
 *   1. jumlah query tetap konstan saat jumlah mapel bertambah
 *   2. keluarannya tetap sama persis dengan perhitungan per-mapel
 */
class EffectiveDayCacheTest extends TestCase
{
    use RefreshDatabase;

    private AcademicYear $ay;
    private SchoolClass $kelas;
    private array $subjectIds = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->ay = AcademicYear::create([
            'tahun' => '2026/2027', 'semester' => Semester::Ganjil,
            'tanggal_mulai' => '2026-07-13', 'tanggal_selesai' => '2026-09-30', 'aktif' => true,
        ]);

        $guru = User::create([
            'nama' => 'Guru Cache', 'email' => 'gurucache@test.sch.id',
            'password' => 'secret123', 'role' => UserRole::Guru,
        ]);
        $teacher = Teacher::create(['user_id' => $guru->id, 'nip' => '198501012010011002', 'is_bk' => false]);

        $this->kelas = SchoolClass::create([
            'tingkat' => 'XI', 'jurusan' => 'RPL', 'rombel' => 'A',
            'academic_year_id' => $this->ay->id, 'wali_kelas_id' => $guru->id,
        ]);

        // Enam mapel di kelas yang sama — inilah pengali yang dulu bikin query meledak.
        foreach (['MTK', 'BIN', 'BIG', 'PKN', 'PJK', 'SEJ'] as $i => $kode) {
            $subject = Subject::create(['nama' => "Mapel {$kode}", 'kode' => $kode]);
            $this->subjectIds[] = $subject->id;

            // jam_mulai wajib unik per (kelas, hari) — ada unique index
            // `schedules_class_hari_jam_unique`. Jam digeser per mapel supaya enam
            // jadwal ini muat di tiga hari tanpa bentrok.
            $jam = 7 + $i;

            Schedule::create([
                'class_id'    => $this->kelas->id,
                'subject_id'  => $subject->id,
                'teacher_id'  => $teacher->id,
                'hari'        => [Hari::Senin, Hari::Selasa, Hari::Rabu][$i % 3],
                'jam_mulai'   => sprintf('%02d:00:00', $jam),
                'jam_selesai' => sprintf('%02d:30:00', $jam),
                'aktif'       => true,
            ]);
        }

        // 17 Agustus 2026 jatuh hari SENIN — beririsan dengan jadwal Senin di atas,
        // jadi minimal satu mapel pasti punya minggu tidak efektif.
        NonEffectiveDay::create([
            'tanggal'    => '2026-08-17',
            'keterangan' => 'HUT RI',
        ]);
    }

    /**
     * Inti S-02: query TIDAK boleh tumbuh mengikuti jumlah mapel. Kalau cache
     * lepas, angka ini melonjak berlipat sesuai jumlah mapel.
     */
    public function test_jumlah_query_tidak_tumbuh_mengikuti_jumlah_mapel(): void
    {
        $svc = app(EffectiveDayService::class);

        DB::enableQueryLog();
        $hasil = $svc->rekapMingguAllByClass($this->kelas->id, $this->ay->id);
        $jumlahQuery = count(DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertCount(6, $hasil, 'Enam mapel harus terekap semua.');

        // 6 mapel dilayani <= 5 query: jadwal(1) + tahun ajaran(1) + hari tidak efektif(1)
        // + sedikit ruang gerak. Sebelum perbaikan, angkanya belasan dan naik per mapel.
        $this->assertLessThanOrEqual(
            5,
            $jumlahQuery,
            "Rekap 6 mapel memakai {$jumlahQuery} query — cache lepas, query tumbuh per mapel."
        );
    }

    /**
     * Penjaga kebenaran: cache tidak boleh mengubah hasil. Rekap sekaligus harus
     * identik dengan menghitung tiap mapel satu per satu.
     */
    public function test_hasil_rekap_identik_dengan_perhitungan_per_mapel(): void
    {
        $svc = app(EffectiveDayService::class);

        $sekaligus = collect($svc->rekapMingguAllByClass($this->kelas->id, $this->ay->id))
            ->keyBy('subject_kode');

        foreach ($this->subjectIds as $subjectId) {
            // Instance BARU tiap mapel — tanpa cache sama sekali, jadi ini benar-benar
            // pembanding independen, bukan membaca cache yang sama.
            $satuan = app()->make(EffectiveDayService::class)
                ->calculateMinggu($this->kelas->id, $subjectId, $this->ay->id);

            $kode = Subject::find($subjectId)->kode;
            $ref  = $sekaligus->get($kode);

            $this->assertNotNull($ref, "Mapel {$kode} hilang dari rekap sekaligus.");
            $this->assertSame($satuan['total_minggu'], $ref['total_minggu'], "total_minggu {$kode} beda.");
            $this->assertSame($satuan['total_efektif'], $ref['total_efektif'], "total_efektif {$kode} beda.");
            $this->assertSame(
                $satuan['total_tidak_efektif'],
                $ref['total_tidak_efektif'],
                "total_tidak_efektif {$kode} beda."
            );
        }
    }

    /** Hari libur harus benar-benar terhitung — supaya angka di atas bukan nol semua. */
    public function test_hari_tidak_efektif_benar_benar_terhitung(): void
    {
        $svc = app(EffectiveDayService::class);
        $hasil = $svc->rekapMingguAllByClass($this->kelas->id, $this->ay->id);

        $adaYangTidakEfektif = collect($hasil)->contains(fn ($r) => $r['total_tidak_efektif'] > 0);

        $this->assertTrue(
            $adaYangTidakEfektif,
            'HUT RI 17 Agustus jatuh Senin 2026 — minimal satu mapel harus punya minggu tidak efektif.'
        );
    }
}
