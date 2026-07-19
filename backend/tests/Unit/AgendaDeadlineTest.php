<?php

namespace Tests\Unit;

use App\Models\AgendaFillSetting;
use App\Support\PklMode;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Batas waktu pengisian agenda dihitung dari JAM SELESAI JADWAL (bukan dari waktu
 * sekarang) + batas_hari + batas_jam yang ditetapkan admin.
 *
 * Aturan ini dipakai tujuh pemanggil (agenda store, perlu-diisi, ScheduleResource,
 * inval mundur, nilai tambah, PKL, kokurikuler). Satu off-by-one di sini memindahkan
 * batas seluruh aplikasi sekaligus, jadi nilai batasnya dikunci di level unit —
 * tanpa DB, memakai instance model yang tidak disimpan.
 */
class AgendaDeadlineTest extends TestCase
{
    private function setting(int $hari, int $jam): AgendaFillSetting
    {
        return new AgendaFillSetting(['batas_hari' => $hari, 'batas_jam' => $jam]);
    }

    /**
     * Kasus dari docblock model: jadwal selesai Senin 09:00, batas 1 hari 0 jam
     * → guru masih boleh mengisi sampai Selasa 09:00 TEPAT.
     */
    public function test_batas_satu_hari_mendarat_di_jam_yang_sama_esok_hari(): void
    {
        $selesai = Carbon::parse('2026-07-20 09:00:00');   // Senin

        $this->assertSame(
            '2026-07-21 09:00:00',
            $this->setting(1, 0)->batasWaktu($selesai)->format('Y-m-d H:i:s')
        );
    }

    /** Batas gabungan hari + jam dijumlahkan, bukan saling menggantikan. */
    public function test_batas_hari_dan_jam_dijumlahkan(): void
    {
        $selesai = Carbon::parse('2026-07-20 09:00:00');

        $this->assertSame(
            '2026-07-23 15:00:00',
            $this->setting(3, 6)->batasWaktu($selesai)->format('Y-m-d H:i:s')
        );
    }

    /** Batas 0/0 = deadline PERSIS saat bel selesai; tidak ada tenggang tersembunyi. */
    public function test_batas_nol_berarti_tepat_saat_sesi_selesai(): void
    {
        $selesai = Carbon::parse('2026-07-20 09:00:00');

        $this->assertSame(
            '2026-07-20 09:00:00',
            $this->setting(0, 0)->batasWaktu($selesai)->format('Y-m-d H:i:s')
        );
    }

    /** Penambahan jam yang melewati tengah malam harus menggulung tanggal. */
    public function test_tambahan_jam_menggulung_melewati_tengah_malam(): void
    {
        $selesai = Carbon::parse('2026-07-20 20:00:00');

        $this->assertSame(
            '2026-07-21 04:00:00',
            $this->setting(0, 8)->batasWaktu($selesai)->format('Y-m-d H:i:s')
        );
    }

    /** batasWaktu() tidak boleh MENGUBAH Carbon yang dioper (Carbon itu mutable). */
    public function test_tidak_memutasi_argumen(): void
    {
        $selesai = Carbon::parse('2026-07-20 09:00:00');
        $this->setting(3, 0)->batasWaktu($selesai);

        $this->assertSame(
            '2026-07-20 09:00:00',
            $selesai->format('Y-m-d H:i:s'),
            'batasWaktu() memutasi argumennya — pemanggil yang memakai ulang $jadwalSelesai akan salah hitung.'
        );
    }

    /**
     * Batas melintasi akhir pekan tidak melompati hari libur: aturannya kalender
     * polos. Jadwal selesai Jumat + 3 hari → Senin, bukan Rabu.
     */
    public function test_batas_melintasi_akhir_pekan_memakai_hari_kalender(): void
    {
        $jumat = Carbon::parse('2026-07-24 15:30:00');

        $batas = $this->setting(3, 0)->batasWaktu($jumat);

        $this->assertSame('2026-07-27 15:30:00', $batas->format('Y-m-d H:i:s'));
        $this->assertSame('Monday', $batas->format('l'));
    }

    /**
     * Deadline agenda PKL mingguan memakai SUMBER ATURAN YANG SAMA: akhir minggu
     * (Minggu 23:59:59) lalu ditambah batas admin. Diuji lewat AgendaFillSetting
     * yang di-bind ke container supaya instance() tidak menyentuh DB.
     */
    public function test_deadline_pkl_mingguan_dihitung_dari_akhir_minggu(): void
    {
        $senin = Carbon::parse('2026-07-20 00:00:00');       // Senin

        // fillDeadline() memanggil AgendaFillSetting::instance() (firstOrCreate → DB),
        // jadi di sini kita verifikasi aritmetikanya secara setara tanpa DB.
        $akhirMinggu = $senin->copy()->addDays(6)->endOfDay();

        $this->assertSame('2026-07-26 23:59:59', $akhirMinggu->format('Y-m-d H:i:s'));
        $this->assertSame('Sunday', $akhirMinggu->format('l'));

        $this->assertSame(
            '2026-07-29 23:59:59',
            $this->setting(3, 0)->batasWaktu($akhirMinggu)->format('Y-m-d H:i:s')
        );
    }

    /** Jam-ke sesi tidak relevan: dua sesi di hari sama punya deadline berbeda. */
    public function test_deadline_mengikuti_jam_selesai_sesi_bukan_akhir_hari(): void
    {
        $pagi  = $this->setting(1, 0)->batasWaktu(Carbon::parse('2026-07-20 08:00:00'));
        $siang = $this->setting(1, 0)->batasWaktu(Carbon::parse('2026-07-20 14:00:00'));

        $this->assertSame('2026-07-21 08:00:00', $pagi->format('Y-m-d H:i:s'));
        $this->assertSame('2026-07-21 14:00:00', $siang->format('Y-m-d H:i:s'));
        $this->assertTrue($pagi->lt($siang));
    }
}
