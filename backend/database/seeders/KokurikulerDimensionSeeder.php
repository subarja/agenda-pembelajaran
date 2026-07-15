<?php

namespace Database\Seeders;

use App\Models\KokurikulerDimension;
use Illuminate\Database\Seeder;

/**
 * 8 Dimensi Profil Lulusan (Permendikdasmen No. 10/2025) + sub-dimensi turunan
 * dari kalimat deskripsi Panduan Kokurikuler 2025. Sub-dimensi boleh diedit admin.
 * Idempoten: aman dijalankan berulang (updateOrCreate berdasarkan kode).
 */
class KokurikulerDimensionSeeder extends Seeder
{
    public function run(): void
    {
        $data = [
            ['kode' => 'keimanan_ketakwaan', 'nama' => 'Keimanan dan Ketakwaan terhadap Tuhan YME', 'sub' => [
                'Keyakinan dan pengamalan ajaran agama/kepercayaan',
                'Akhlak mulia',
                'Hubungan dengan Tuhan YME, sesama manusia, dan lingkungan',
            ]],
            ['kode' => 'kewargaan', 'nama' => 'Kewargaan', 'sub' => [
                'Bangga akan identitas dan budaya',
                'Menghargai keberagaman',
                'Menjaga persatuan bangsa',
                'Menaati aturan bernegara dan bermasyarakat',
                'Menjaga keberlanjutan kehidupan dan lingkungan',
            ]],
            ['kode' => 'penalaran_kritis', 'nama' => 'Penalaran Kritis', 'sub' => [
                'Rasa ingin tahu',
                'Berpikir logis dan analitis',
                'Menganalisis dan menyelesaikan permasalahan',
                'Berargumentasi logis',
                'Memanfaatkan literasi dan numerasi untuk memecahkan masalah',
            ]],
            ['kode' => 'kreativitas', 'nama' => 'Kreativitas', 'sub' => [
                'Berperilaku produktif',
                'Menciptakan inovasi',
                'Merumuskan solusi bagi permasalahan di sekitarnya',
            ]],
            ['kode' => 'kolaborasi', 'nama' => 'Kolaborasi', 'sub' => [
                'Peduli dan berbagi',
                'Membangun kerja sama dengan berbagai kalangan di lingkungan sekitar',
            ]],
            ['kode' => 'kemandirian', 'nama' => 'Kemandirian', 'sub' => [
                'Bertanggung jawab',
                'Berinisiatif',
                'Beradaptasi dalam pembelajaran dan pengembangan diri',
            ]],
            ['kode' => 'kesehatan', 'nama' => 'Kesehatan', 'sub' => [
                'Hidup bersih dan sehat',
                'Kebugaran, kesehatan fisik, dan kesehatan mental',
                'Berkontribusi secara positif terhadap lingkungan',
            ]],
            ['kode' => 'komunikasi', 'nama' => 'Komunikasi', 'sub' => [
                'Menyimak',
                'Membaca',
                'Berbicara',
                'Menulis dengan baik dan benar sesuai etika',
            ]],
        ];

        foreach ($data as $i => $d) {
            $dim = KokurikulerDimension::updateOrCreate(
                ['kode' => $d['kode']],
                ['nama' => $d['nama'], 'urutan' => $i + 1, 'aktif' => true],
            );

            foreach ($d['sub'] as $j => $nama) {
                $dim->subdimensions()->updateOrCreate(['nama' => $nama], ['urutan' => $j + 1]);
            }
        }
    }
}
