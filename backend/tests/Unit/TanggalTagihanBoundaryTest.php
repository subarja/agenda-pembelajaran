<?php

namespace Tests\Unit;

use App\Enums\Semester;
use App\Models\AcademicYear;
use App\Models\NonEffectiveDay;
use App\Support\TanggalTagihan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Nilai batas rentang semester untuk TanggalTagihan::ditagih().
 *
 * TagihanWindowTest sudah membuktikan perilakunya lewat HTTP, tapi hanya pada tanggal
 * yang jauh dari tepi rentang. Perbandingan di TanggalTagihan memakai operator string
 * (`$tanggal < $rentang[0] || $tanggal > $rentang[1]`), yang berarti kedua tepi bersifat
 * INKLUSIF. Hari pertama dan hari terakhir semester adalah hari sekolah sungguhan;
 * kalau salah satunya tergeser satu hari, seluruh sekolah kehilangan atau mendapat
 * tagihan palsu satu hari penuh. Test ini mengunci keempat tanggal di sekitar tepi.
 */
class TanggalTagihanBoundaryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        AcademicYear::create([
            'tahun'           => '2026/2027',
            'semester'        => Semester::Ganjil,
            'tanggal_mulai'   => '2026-07-15',
            'tanggal_selesai' => '2026-12-04',
            'aktif'           => true,
        ]);

        TanggalTagihan::flush();
    }

    /** H-1 bebas, hari pertama ditagih — tepi bawah inklusif. */
    public function test_tepi_bawah_rentang_inklusif(): void
    {
        $this->assertFalse(TanggalTagihan::ditagih('2026-07-14'), 'sehari sebelum semester mulai tidak boleh ditagih');
        $this->assertTrue(TanggalTagihan::ditagih('2026-07-15'), 'hari pertama semester HARUS ditagih');
    }

    /** Hari terakhir ditagih, H+1 bebas — tepi atas inklusif. */
    public function test_tepi_atas_rentang_inklusif(): void
    {
        $this->assertTrue(TanggalTagihan::ditagih('2026-12-04'), 'hari terakhir semester HARUS ditagih');
        $this->assertFalse(TanggalTagihan::ditagih('2026-12-05'), 'sehari setelah semester selesai tidak boleh ditagih');
    }

    /** Hari tidak efektif di TENGAH rentang tetap bebas. */
    public function test_hari_tidak_efektif_menang_atas_rentang(): void
    {
        NonEffectiveDay::create([
            'tanggal'    => '2026-08-17',
            'status'     => 'tidak_efektif',
            'keterangan' => 'HUT RI',
        ]);
        TanggalTagihan::flush();

        $this->assertFalse(TanggalTagihan::ditagih('2026-08-17'));
        $this->assertTrue(TanggalTagihan::ditagih('2026-08-18'), 'hari setelah libur kembali ditagih');
    }

    /**
     * Hari tidak efektif tepat DI TEPI rentang: dua aturan menolak sekaligus,
     * hasilnya tetap satu jawaban tegas (false), bukan saling meniadakan.
     */
    public function test_hari_tidak_efektif_tepat_di_hari_pertama(): void
    {
        NonEffectiveDay::create([
            'tanggal'    => '2026-07-15',
            'status'     => 'tidak_efektif',
            'keterangan' => 'MPLS',
        ]);
        TanggalTagihan::flush();

        $this->assertFalse(TanggalTagihan::ditagih('2026-07-15'));
    }

    /**
     * Tanggal dengan komponen waktu tersimpan (datetime, bukan date) harus tetap
     * cocok — NonEffectiveDay dipangkas ke 10 karakter pertama di TanggalTagihan.
     */
    public function test_tanggal_tidak_efektif_bertimestamp_tetap_cocok(): void
    {
        NonEffectiveDay::create([
            'tanggal'    => '2026-09-01 00:00:00',
            'status'     => 'tidak_efektif',
            'keterangan' => 'Libur dengan timestamp',
        ]);
        TanggalTagihan::flush();

        $this->assertFalse(TanggalTagihan::ditagih('2026-09-01'));
    }

    /**
     * flush() benar-benar melepaskan cache statis. Tanpa ini, libur yang baru
     * ditambahkan admin tidak akan terlihat sampai request berikutnya.
     */
    public function test_flush_membuang_cache_statis(): void
    {
        $this->assertTrue(TanggalTagihan::ditagih('2026-10-01'));

        NonEffectiveDay::create([
            'tanggal'    => '2026-10-01',
            'status'     => 'tidak_efektif',
            'keterangan' => 'Ditambahkan setelah cache panas',
        ]);

        $this->assertTrue(
            TanggalTagihan::ditagih('2026-10-01'),
            'cache statis memang belum melihat libur baru sebelum flush()'
        );

        TanggalTagihan::flush();

        $this->assertFalse(TanggalTagihan::ditagih('2026-10-01'), 'setelah flush() libur baru harus terlihat');
    }
}
