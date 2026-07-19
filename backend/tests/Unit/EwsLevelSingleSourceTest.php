<?php

namespace Tests\Unit;

use App\Enums\EwsLevel;
use PHPUnit\Framework\TestCase;

/**
 * T-02 (audit 2026-07-19): dulu ada TIGA rumus berbeda yang menulis kolom
 * `ews_statuses.level` yang sama, sehingga level tersimpan bergantung pada layanan
 * mana yang kebetulan jalan terakhir. Sekarang satu aturan di EwsLevel::dariKomponen().
 *
 * Test ini mengunci ambang & batas-batasnya. Kalau ada yang mengubah angka di sini,
 * itu keputusan sadar — bukan pergeseran diam-diam seperti sebelumnya.
 */
class EwsLevelSingleSourceTest extends TestCase
{
    /** Kondisi sehat sempurna. */
    public function test_tanpa_peringatan_hijau(): void
    {
        $this->assertSame(EwsLevel::Hijau, EwsLevel::dariKomponen(100.0, 10, 0, 90.0));
    }

    public function test_satu_peringatan_kuning(): void
    {
        $this->assertSame(EwsLevel::Kuning, EwsLevel::dariKomponen(70.0, 10, 0, 90.0));  // kehadiran
        $this->assertSame(EwsLevel::Kuning, EwsLevel::dariKomponen(100.0, -1, 0, 90.0)); // karakter
        $this->assertSame(EwsLevel::Kuning, EwsLevel::dariKomponen(100.0, 10, 3, 90.0)); // catatan
        $this->assertSame(EwsLevel::Kuning, EwsLevel::dariKomponen(100.0, 10, 0, 69.9)); // nilai
    }

    public function test_dua_peringatan_oranye_tiga_merah(): void
    {
        $this->assertSame(EwsLevel::Oranye, EwsLevel::dariKomponen(70.0, -1, 0, 90.0));
        $this->assertSame(EwsLevel::Merah, EwsLevel::dariKomponen(70.0, -1, 3, 90.0));
        $this->assertSame(EwsLevel::Merah, EwsLevel::dariKomponen(70.0, -1, 3, 60.0));
    }

    /** Batas persis — di ambang BUKAN peringatan, hanya di bawahnya. */
    public function test_nilai_batas(): void
    {
        $this->assertSame(EwsLevel::Hijau, EwsLevel::dariKomponen(80.0, 0, 2, 70.0), 'tepat di ambang = aman');
        $this->assertSame(EwsLevel::Kuning, EwsLevel::dariKomponen(79.99, 0, 2, 70.0), 'kehadiran di bawah ambang');
        $this->assertSame(EwsLevel::Kuning, EwsLevel::dariKomponen(80.0, -1, 2, 70.0), 'karakter negatif');
        $this->assertSame(EwsLevel::Kuning, EwsLevel::dariKomponen(80.0, 0, 3, 70.0), 'catatan >= 3');
        $this->assertSame(EwsLevel::Kuning, EwsLevel::dariKomponen(80.0, 0, 2, 69.99), 'nilai di bawah ambang');
    }

    /** Belum ada nilai aktivitas ≠ peringatan. */
    public function test_nilai_null_bukan_peringatan(): void
    {
        $this->assertSame(EwsLevel::Hijau, EwsLevel::dariKomponen(100.0, 0, 0, null));
        $this->assertSame(EwsLevel::Kuning, EwsLevel::dariKomponen(70.0, 0, 0, null));
    }

    /**
     * Kasus yang dulu memberi dua jawaban berbeda: kehadiran 78% + karakter −15
     * menghasilkan `oranye` menurut AlphaAlertService tapi `kuning` menurut
     * CharacterService. Sekarang hanya ada satu jawaban.
     */
    public function test_kasus_divergensi_lama_kini_tunggal(): void
    {
        $this->assertSame(EwsLevel::Oranye, EwsLevel::dariKomponen(78.0, -15, 0, null));
    }
}
