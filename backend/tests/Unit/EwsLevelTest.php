<?php

namespace Tests\Unit;

use App\Enums\EwsLevel;
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

        // determineLevel kini meneruskan KOMPONEN ke EwsLevel::dariKomponen (satu aturan
        // untuk ketiga penulis), jadi susun array seperti yang dihasilkan calc*Batch:
        // nyala = di bawah/di atas ambang, mati = nilai aman.
        [$kh, $kar, $cat, $nil] = $warnings;
        $args = [
            ['score' => $kh ? 70.0 : 100.0, 'warning' => $kh],
            ['score' => $kar ? -5 : 10, 'warning' => $kar],
            ['count' => $cat ? 3 : 0, 'warning' => $cat],
            ['score' => $nil ? 60.0 : 90.0, 'warning' => $nil],
        ];

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
        // Ambangnya pindah ke App\Enums\EwsLevel saat ketiga penghitung disatukan;
        // konstanta di EwsController dipertahankan untuk perhitungan `warning` per baris.
        $this->assertSame(80.0, \App\Enums\EwsLevel::AMBANG_KEHADIRAN);
        $this->assertSame(0, \App\Enums\EwsLevel::AMBANG_KARAKTER);
        $this->assertSame(3, \App\Enums\EwsLevel::AMBANG_CATATAN);
        $this->assertSame(70.0, \App\Enums\EwsLevel::AMBANG_NILAI);

        $c = (new \ReflectionClass(EwsController::class))->getConstants();
        $this->assertSame(80.0, $c['THRESHOLD_KEHADIRAN']);
        $this->assertSame(0, $c['THRESHOLD_KARAKTER']);
        $this->assertSame(3, $c['THRESHOLD_CATATAN']);
        $this->assertSame(70.0, $c['THRESHOLD_NILAI']);
    }

    // ── Konsistensi lintas implementasi ──────────────────────────────────────

    /**
     * DULU divergen, KINI tunggal (T-02, diperbaiki 2026-07-19).
     *
     * Kolom `ews_statuses.level` sempat ditulis tiga penghitung dengan aturan berbeda:
     * EwsController (4 indikator), AlphaAlertService (3 indikator, membuang `nilai`),
     * dan CharacterService (ambang absolut kehadiran 85/75/50). Kasus kehadiran 78% +
     * karakter -15 menghasilkan `oranye` menurut yang satu dan `kuning` menurut yang
     * lain — tergantung layanan mana yang jalan terakhir.
     *
     * Sekarang ketiganya memanggil EwsLevel::dariKomponen(). Test ini menjaga agar
     * rumus-rumus terpisah itu tidak tumbuh lagi.
     */
    public function test_hanya_ada_satu_penghitung_level_siswa(): void
    {
        // Aturan tunggal itu jawabannya oranye untuk kasus divergensi lama.
        $this->assertSame('oranye', $this->levelSiswa([1, 1, 0, 0]));
        $this->assertSame(
            EwsLevel::Oranye,
            EwsLevel::dariKomponen(78.0, -15, 0, null),
            'EwsController & EwsLevel::dariKomponen wajib sepakat'
        );

        // Rumus tandingan yang dulu ada sudah dihapus — kalau muncul lagi, test ini gagal.
        foreach ([AlphaAlertService::class, CharacterService::class] as $kelas) {
            $this->assertFalse(
                method_exists($kelas, 'resolveLevel'),
                $kelas.' punya rumus level sendiri lagi — pakai EwsLevel::dariKomponen()'
            );
        }
    }
}
