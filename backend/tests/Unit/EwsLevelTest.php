<?php

namespace Tests\Unit;

use App\Http\Controllers\Api\Admin\TeacherEwsController;
use App\Http\Controllers\Api\EwsController;
use App\Services\AlphaAlertService;
use App\Services\CharacterService;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Nilai batas pewarnaan EWS — murni aritmetika, tanpa DB.
 *
 * Dua tangga level yang berbeda hidup berdampingan di aplikasi ini:
 *  1. EWS GURU  — persentase sesi terisi → merah/oranye/kuning/hijau (ambang 50/75/90).
 *  2. EWS SISWA — jumlah indikator yang menyalakan peringatan → merah/oranye/kuning/hijau.
 *
 * Keduanya sebelumnya hanya teruji lewat HTTP, jadi pergeseran satu tanda `<` menjadi
 * `<=` tidak akan pernah tertangkap. Test ini mengunci ambangnya persis, terutama pada
 * angka bulat 50, 75, dan 90 yang menjadi sumber klasik off-by-one.
 */
class EwsLevelTest extends TestCase
{
    private function levelGuru(?float $pct): string
    {
        $m = new ReflectionMethod(TeacherEwsController::class, 'resolveLevel');
        $m->setAccessible(true);

        return $m->invoke((new \ReflectionClass(TeacherEwsController::class))->newInstanceWithoutConstructor(), $pct);
    }

    /** @param array<int> $warnings 4 indikator: kehadiran, karakter, catatan, nilai */
    private function levelSiswa(array $warnings): string
    {
        $m = new ReflectionMethod(EwsController::class, 'determineLevel');
        $m->setAccessible(true);

        $args = array_map(fn ($w) => ['warning' => $w], $warnings);

        return $m->invoke((new \ReflectionClass(EwsController::class))->newInstanceWithoutConstructor(), ...$args);
    }

    // ── EWS Guru: pct_terisi → warna ─────────────────────────────────────────

    /**
     * Ambang atas tiap pita adalah EKSKLUSIF: 50 sudah oranye (bukan merah),
     * 75 sudah kuning, 90 sudah hijau. Nilai tepat di bawahnya masih pita lama.
     */
    public function test_ews_guru_ambang_persis_50_75_90(): void
    {
        // Batas merah|oranye
        $this->assertSame('merah', $this->levelGuru(49.9));
        $this->assertSame('oranye', $this->levelGuru(50.0), '50% persis harus ORANYE, bukan merah');

        // Batas oranye|kuning
        $this->assertSame('oranye', $this->levelGuru(74.9));
        $this->assertSame('kuning', $this->levelGuru(75.0), '75% persis harus KUNING, bukan oranye');

        // Batas kuning|hijau
        $this->assertSame('kuning', $this->levelGuru(89.9));
        $this->assertSame('hijau', $this->levelGuru(90.0), '90% persis harus HIJAU, bukan kuning');
    }

    public function test_ews_guru_ujung_rentang(): void
    {
        $this->assertSame('merah', $this->levelGuru(0.0));
        $this->assertSame('hijau', $this->levelGuru(100.0));
    }

    /**
     * Guru tanpa jadwal sama sekali → 'n/a', BUKAN 'hijau'. Membedakan
     * "tidak punya kewajiban" dari "menuntaskan seluruh kewajiban" penting agar
     * rekap manajemen tidak menghitung guru tanpa jadwal sebagai berkinerja baik.
     */
    public function test_ews_guru_tanpa_jadwal_bukan_hijau(): void
    {
        $this->assertSame('n/a', $this->levelGuru(null));
    }

    // ── EWS Siswa: jumlah peringatan → level ─────────────────────────────────

    public function test_ews_siswa_tangga_jumlah_peringatan(): void
    {
        $this->assertSame('hijau', $this->levelSiswa([0, 0, 0, 0]));
        $this->assertSame('kuning', $this->levelSiswa([1, 0, 0, 0]));
        $this->assertSame('oranye', $this->levelSiswa([1, 1, 0, 0]));
        $this->assertSame('merah', $this->levelSiswa([1, 1, 1, 0]));
        $this->assertSame('merah', $this->levelSiswa([1, 1, 1, 1]), '4 peringatan tetap merah (bukan naik pita lain)');
    }

    /** Level ditentukan JUMLAH indikator, bukan indikator mana yang menyala. */
    public function test_ews_siswa_tidak_bergantung_indikator_mana(): void
    {
        $this->assertSame('oranye', $this->levelSiswa([1, 1, 0, 0]));
        $this->assertSame('oranye', $this->levelSiswa([0, 0, 1, 1]));
        $this->assertSame('oranye', $this->levelSiswa([1, 0, 0, 1]));
    }

    // ── Ambang indikator siswa ───────────────────────────────────────────────

    /**
     * Kehadiran < 80% menyalakan peringatan; 80,0% persis TIDAK.
     * Karakter < 0 menyala; 0 persis TIDAK. Catatan >= 3 menyala; 2 TIDAK.
     * Nilai < 70 menyala; 70,0 persis TIDAK; null (belum ada nilai) TIDAK.
     */
    public function test_ambang_indikator_terdokumentasi_di_konstanta(): void
    {
        $r = new \ReflectionClass(EwsController::class);
        $c = $r->getConstants();

        $this->assertSame(80.0, $c['THRESHOLD_KEHADIRAN']);
        $this->assertSame(0, $c['THRESHOLD_KARAKTER']);
        $this->assertSame(3, $c['THRESHOLD_CATATAN']);
        $this->assertSame(70.0, $c['THRESHOLD_NILAI']);
    }

    // ── Konsistensi lintas implementasi ──────────────────────────────────────

    /**
     * PENANDA DIVERGENSI (lihat laporan): kolom `ews_status.level` ditulis oleh tiga
     * penghitung berbeda dengan aturan berbeda — EwsController (4 indikator),
     * AlphaAlertService (3 indikator, tanpa `nilai`), dan CharacterService (ambang
     * absolut kehadiran/karakter). Test ini tidak menuntut ketiganya sama; ia
     * MEMBUKTIKAN bahwa ketiganya berbeda, supaya fakta itu tidak hilang diam-diam.
     *
     * Kasus: kehadiran 78% (di bawah 80) + karakter -15 + catatan 0 + nilai null.
     */
    public function test_tiga_penghitung_level_siswa_memberi_jawaban_berbeda(): void
    {
        // EwsController: kehadiran(1) + karakter(1) + catatan(0) + nilai(0) = 2 → oranye
        $this->assertSame('oranye', $this->levelSiswa([1, 1, 0, 0]));

        // AlphaAlertService: w = kehadiran(1) + karakter(1) + catatan(0) = 2 → Oranye
        $alpha = new ReflectionMethod(AlphaAlertService::class, 'resolveLevel');
        $alpha->setAccessible(true);
        $hasilAlpha = $alpha->invoke(
            (new \ReflectionClass(AlphaAlertService::class))->newInstanceWithoutConstructor(),
            -15, 78.0, 0
        );

        // CharacterService: karakter -15 <= -10 → Kuning (kehadiran 78 >= 75)
        $char = new ReflectionMethod(CharacterService::class, 'resolveLevel');
        $char->setAccessible(true);
        $hasilChar = $char->invoke(
            (new \ReflectionClass(CharacterService::class))->newInstanceWithoutConstructor(),
            -15, 78.0
        );

        $this->assertSame('oranye', $hasilAlpha->value);
        $this->assertSame('kuning', $hasilChar->value, 'CharacterService memakai tangga ambang absolut, bukan hitung-peringatan');

        $this->assertNotSame(
            $hasilChar->value,
            $hasilAlpha->value,
            'Terdokumentasi: dua layanan menulis kolom ews_status.level yang SAMA dengan aturan berbeda.'
        );
    }
}
