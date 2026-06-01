<?php

namespace Database\Seeders;

use App\Enums\CharacterSifat;
use App\Models\CharacterCategory;
use App\Models\CharacterSubitem;
use Illuminate\Database\Seeder;

class CharacterSeeder extends Seeder
{
    public function run(): void
    {
        $data = [
            [
                'nama'     => 'Kedisiplinan',
                'deskripsi'=> 'Penilaian ketepatan waktu, kehadiran, dan kepatuhan aturan sekolah.',
                'subitems' => [
                    ['kode' => 'KD-01', 'deskripsi' => 'Tepat waktu masuk kelas',          'bobot' =>  5, 'sifat' => CharacterSifat::Positif],
                    ['kode' => 'KD-02', 'deskripsi' => 'Berseragam lengkap dan rapi',       'bobot' =>  3, 'sifat' => CharacterSifat::Positif],
                    ['kode' => 'KD-03', 'deskripsi' => 'Tidak berseragam lengkap',          'bobot' => -5, 'sifat' => CharacterSifat::Negatif],
                    ['kode' => 'KD-04', 'deskripsi' => 'Terlambat masuk kelas',             'bobot' => -5, 'sifat' => CharacterSifat::Negatif],
                    ['kode' => 'KD-05', 'deskripsi' => 'Membawa / menggunakan HP tanpa izin','bobot' =>-10, 'sifat' => CharacterSifat::Negatif],
                    ['kode' => 'KD-06', 'deskripsi' => 'Tidak mengerjakan tugas/PR',        'bobot' => -5, 'sifat' => CharacterSifat::Negatif],
                ],
            ],
            [
                'nama'     => 'Sopan Santun',
                'deskripsi'=> 'Penilaian perilaku dan etika terhadap guru dan sesama.',
                'subitems' => [
                    ['kode' => 'SS-01', 'deskripsi' => 'Menyapa dan menghormati guru',      'bobot' =>  3, 'sifat' => CharacterSifat::Positif],
                    ['kode' => 'SS-02', 'deskripsi' => 'Membantu teman yang kesulitan',     'bobot' =>  5, 'sifat' => CharacterSifat::Positif],
                    ['kode' => 'SS-03', 'deskripsi' => 'Berkata tidak sopan / kasar',       'bobot' =>-10, 'sifat' => CharacterSifat::Negatif],
                    ['kode' => 'SS-04', 'deskripsi' => 'Mengganggu teman saat belajar',     'bobot' => -5, 'sifat' => CharacterSifat::Negatif],
                ],
            ],
            [
                'nama'     => 'Keaktifan & Prestasi',
                'deskripsi'=> 'Partisipasi aktif dalam pembelajaran dan pencapaian prestasi.',
                'subitems' => [
                    ['kode' => 'KP-01', 'deskripsi' => 'Aktif berdiskusi / bertanya',       'bobot' =>  5, 'sifat' => CharacterSifat::Positif],
                    ['kode' => 'KP-02', 'deskripsi' => 'Menjawab pertanyaan dengan benar',  'bobot' =>  5, 'sifat' => CharacterSifat::Positif],
                    ['kode' => 'KP-03', 'deskripsi' => 'Juara lomba tingkat sekolah',       'bobot' => 15, 'sifat' => CharacterSifat::Positif],
                    ['kode' => 'KP-04', 'deskripsi' => 'Juara lomba tingkat kota/provinsi', 'bobot' => 25, 'sifat' => CharacterSifat::Positif],
                    ['kode' => 'KP-05', 'deskripsi' => 'Tidak aktif / pasif dalam KBM',    'bobot' => -5, 'sifat' => CharacterSifat::Negatif],
                ],
            ],
            [
                'nama'     => 'Tanggung Jawab',
                'deskripsi'=> 'Penilaian tanggung jawab terhadap tugas dan lingkungan.',
                'subitems' => [
                    ['kode' => 'TJ-01', 'deskripsi' => 'Mengumpulkan tugas tepat waktu',    'bobot' =>  5, 'sifat' => CharacterSifat::Positif],
                    ['kode' => 'TJ-02', 'deskripsi' => 'Menjaga kebersihan kelas',          'bobot' =>  3, 'sifat' => CharacterSifat::Positif],
                    ['kode' => 'TJ-03', 'deskripsi' => 'Merusak fasilitas sekolah',         'bobot' =>-15, 'sifat' => CharacterSifat::Negatif],
                    ['kode' => 'TJ-04', 'deskripsi' => 'Tidak bertanggung jawab atas tugas','bobot' => -5, 'sifat' => CharacterSifat::Negatif],
                ],
            ],
        ];

        foreach ($data as $cat) {
            $category = CharacterCategory::create([
                'nama'     => $cat['nama'],
                'deskripsi'=> $cat['deskripsi'],
                'aktif'    => true,
            ]);
            foreach ($cat['subitems'] as $sub) {
                CharacterSubitem::create([
                    'category_id' => $category->id,
                    'kode'        => $sub['kode'],
                    'deskripsi'   => $sub['deskripsi'],
                    'bobot'       => $sub['bobot'],
                    'sifat'       => $sub['sifat'],
                    'aktif'       => true,
                ]);
            }
        }
    }
}
