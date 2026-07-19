<?php

namespace Tests\Unit;

use App\Support\BellSchedule;
use Tests\TestCase;

/**
 * Aritmetika pergeseran mode bel (Apel = 0, Tanpa Apel = −60 menit) secara terisolasi.
 *
 * BellScheduleTest sudah menguji prioritas resolusi (override tanggal → default hari →
 * default global) lewat DB. Yang belum terkunci adalah aritmetika shift() itu sendiri:
 * normalisasi format, penggulungan jam, dan perilaku pada nilai kosong. Fungsi ini
 * menyentuh SETIAP tampilan jam sesi di aplikasi, jadi murah untuk dikunci dan mahal
 * kalau salah.
 */
class BellShiftTest extends TestCase
{
    // ── Mode Apel (offset 0) ─────────────────────────────────────────────────

    /**
     * Offset 0 tidak mengubah jam, tapi TETAP menormalkan H:i menjadi H:i:s.
     * Pemanggil membandingkan string jam; "07:00" dan "07:00:00" yang bercampur
     * membuat perbandingan gagal secara senyap.
     */
    public function test_apel_offset_nol_menormalkan_format_tanpa_menggeser(): void
    {
        $this->assertSame('07:00:00', BellSchedule::shift('07:00', 0));
        $this->assertSame('07:00:00', BellSchedule::shift('07:00:00', 0));
        $this->assertSame('13:45:00', BellSchedule::shift('13:45', 0));
    }

    // ── Mode Tanpa Apel (offset −60) ─────────────────────────────────────────

    /** Tanpa Apel memajukan seluruh sesi satu jam penuh. */
    public function test_tanpa_apel_memajukan_enam_puluh_menit(): void
    {
        $this->assertSame('06:00:00', BellSchedule::shift('07:00', -60));
        $this->assertSame('06:45:00', BellSchedule::shift('07:45', -60));
        $this->assertSame('14:30:00', BellSchedule::shift('15:30:00', -60));
    }

    /** Pergeseran yang melintasi batas jam menggulung menit dengan benar. */
    public function test_pergeseran_melintasi_batas_jam(): void
    {
        $this->assertSame('06:30:00', BellSchedule::shift('07:15', -45));
        $this->assertSame('08:05:00', BellSchedule::shift('07:50', 15));
        $this->assertSame('07:00:00', BellSchedule::shift('06:35', 25));
    }

    /**
     * Sesi jam pertama pada Tanpa Apel tidak boleh menggulung mundur ke hari
     * sebelumnya: 07:00 − 60 = 06:00, masih di hari yang sama.
     */
    public function test_sesi_paling_pagi_tidak_menggulung_ke_hari_sebelumnya(): void
    {
        $this->assertSame('06:00:00', BellSchedule::shift('07:00', -60));
        $this->assertSame('00:00:00', BellSchedule::shift('01:00', -60));
    }

    // ── Nilai kosong ─────────────────────────────────────────────────────────

    /**
     * Jadwal tanpa jam tersimpan (null) harus lewat apa adanya, bukan menjadi
     * "00:00:00" — jam palsu lebih berbahaya daripada jam yang jelas-jelas kosong.
     */
    public function test_jam_kosong_lewat_apa_adanya(): void
    {
        $this->assertNull(BellSchedule::shift(null, 0));
        $this->assertNull(BellSchedule::shift(null, -60));
        $this->assertSame('', BellSchedule::shift('', -60));
    }

    // ── Sifat aljabar ────────────────────────────────────────────────────────

    /** Menggeser lalu membalikkannya mengembalikan jam semula. */
    public function test_pergeseran_dapat_dibalik(): void
    {
        $awal = '07:45:00';
        $this->assertSame($awal, BellSchedule::shift(BellSchedule::shift($awal, -60), 60));
    }

    /**
     * Durasi sesi TIDAK berubah oleh mode — Tanpa Apel memindahkan jam, bukan
     * memendekkan pelajaran. Jumat (35 menit) tetap 35 menit setelah digeser.
     */
    public function test_mode_tidak_mengubah_durasi_sesi(): void
    {
        // Jumat jam ke-1: 07:00–07:35 (35 menit)
        $mulai   = BellSchedule::shift('07:00', -60);
        $selesai = BellSchedule::shift('07:35', -60);

        $this->assertSame('06:00:00', $mulai);
        $this->assertSame('06:35:00', $selesai);

        $durasi = strtotime($selesai) - strtotime($mulai);
        $this->assertSame(35 * 60, $durasi, 'durasi sesi Jumat harus tetap 35 menit setelah digeser');
    }

    /** Hari biasa (45 menit) juga mempertahankan durasinya. */
    public function test_durasi_hari_biasa_tetap_empat_puluh_lima_menit(): void
    {
        $mulai   = BellSchedule::shift('07:00', -60);
        $selesai = BellSchedule::shift('07:45', -60);

        $durasi = strtotime($selesai) - strtotime($mulai);
        $this->assertSame(45 * 60, $durasi);
    }
}
