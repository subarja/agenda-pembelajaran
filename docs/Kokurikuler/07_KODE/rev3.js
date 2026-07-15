// ASESMEN — format Panduan Kokurikuler 2025 (Dimensi | Aspek yang Dinilai | SB/B/C/K)
const L = require('./lib.js');
const { P, H2, H3, TBL, BOX, SPACER, PB, NAVY, GOLD, ROSE, LIGHT } = L;

// Rubrik: 3 dimensi (dipilih dari titik terlemah Rapor Pendidikan), tiap dimensi 2 sub-dimensi
const RUBRIK = [
  ['kreativitas',
   'Sub-dimensi:\n1. Merumuskan solusi bagi permasalahan di sekitarnya\n2. Menciptakan inovasi\n\nAspek yang dinilai:\nMerancang dan mewujudkan solusi atas masalah nyata sekolah dengan kompetensi keahliannya',
   'Solusi orisinal, memanfaatkan kompetensi keahlian secara maksimal, dan benar-benar berfungsi/terpasang di sekolah.',
   'Solusi relevan dan memakai kompetensi keahlian; purwarupa berfungsi meski sederhana.',
   'Solusi meniru contoh yang diberikan; kaitannya dengan kompetensi keahlian masih tipis.',
   'Tidak menghasilkan solusi/karya, atau karyanya tidak berhubungan dengan masalah yang dipilih.'],
  ['kolaborasi',
   'Sub-dimensi:\n1. Peduli dan berbagi\n2. Membangun kerja sama dengan berbagai kalangan di lingkungan sekitar\n\nAspek yang dinilai:\nMenjalankan peran dalam tim, dan membantu tim lain',
   'Menjalankan perannya secara konsisten tanpa diingatkan, menyelesaikan konflik dalam timnya sendiri, dan membantu tim lain (silih asih\u2013asah\u2013asuh).',
   'Menjalankan perannya dengan baik dan berkontribusi nyata pada hasil kerja tim.',
   'Menjalankan perannya bila diingatkan; kontribusinya belum merata.',
   'Tidak menjalankan perannya; pekerjaan tim ditanggung anggota lain.'],
  ['kesehatan',
   'Sub-dimensi:\n1. Hidup bersih dan sehat\n2. Berkontribusi secara positif terhadap lingkungan\n\nAspek yang dinilai:\nMenjalankan pembiasaan 7 KAIH dan berkontribusi pada kesehatan/kebersihan sekolah',
   'Menjalankan pembiasaan 7 KAIH selama lima hari (jurnal terisi penuh), skor Radar Kebiasaan berubah, dan karyanya berdampak nyata pada kesehatan/kebersihan sekolah.',
   'Menjalankan sebagian besar pembiasaan; jurnal terisi; karyanya berkaitan dengan kesehatan/kebersihan sekolah.',
   'Menjalankan pembiasaan bila diingatkan; jurnal terisi sebagian.',
   'Tidak menjalankan pembiasaan; jurnal kosong atau diisi asal-asalan.'],
];

// Dasar pemilihan dimensi \u2014 dari Rapor Pendidikan, bukan selera
const PILIH = [
  ['kreativitas', 'A.3.3 = 54,31 \u2014 TERENDAH dari enam sub-dimensi karakter.', 'DINILAI'],
  ['kolaborasi', 'A.3.2 Gotong Royong = 54,70 \u2014 SATU-SATUNYA yang TURUN (\u22123,09).', 'DINILAI'],
  ['kesehatan', 'D.19 = 6,57 \u2014 lima dari tujuh kebiasaan berstatus KURANG.', 'DINILAI'],
  ['penalaran kritis', 'A.3.4 = 56,75 \u2014 naik 0,23. Nyaris stagnan, tetapi bukan yang terburuk.', 'Tidak dinilai formal. Tetap dilatih intensif pada Hari 2.'],
  ['komunikasi', '\u2014', 'Tidak dinilai formal. Tersentuh lewat presentasi 60 detik dan wawancara narasumber.'],
  ['kemandirian', 'A.3.6 = 58,50 \u2014 naik 3,88 (sudah membaik).', 'Tidak dinilai formal. Tersentuh lewat Kontrak Kebiasaan.'],
  ['kewargaan', '\u2014', 'Tidak dinilai formal. Tersentuh lewat penyerahan resmi gambar kerja kepada Sarpras.'],
  ['keimanan dan ketakwaan', 'A.3.1 = 59,72 \u2014 TERTINGGI.', 'Tidak dinilai formal. Tersentuh lewat apel dan Jumat Berkah.'],
];

function asesmen() {
  const c = [];
  const push = (...x) => x.forEach(i => Array.isArray(i) ? c.push(...i) : c.push(i));

  push(H2('H. Asesmen'));
  push(BOX('Mengikuti Panduan Kokurikuler 2025', [
    'Panduan menetapkan dua hal: (1) yang dinilai adalah DIMENSI PROFIL LULUSAN, bukan capaian mata pelajaran; (2) rubrik disusun dalam format DIMENSI × ASPEK YANG DINILAI × SB/B/C/K.',
    '',
    'Contoh dalam panduan hanya memakai DUA dimensi. Kegiatan ini memakai TIGA — dan sengaja tidak lebih.',
    '',
    'Ketiganya dipilih dari TITIK TERLEMAH Rapor Pendidikan SMKN 2 Cimahi, bukan dari selera: kreativitas (skor terendah), kolaborasi (satu-satunya yang turun), dan kesehatan (lima dari tujuh kebiasaan berstatus KURANG).',
    '',
    'Lima dimensi lainnya TETAP DILATIH, tetapi TIDAK diasesmen formal — disimpan untuk projek kokurikuler berikutnya. Menilai delapan dimensi sekaligus hanya akan menghasilkan penilaian yang asal-asalan, apalagi ketika wali kelas bekerja seorang diri.',
  ], LIGHT, '2E74B5'));

  push(SPACER());
  push(H3('1. Dimensi yang Dinilai — dan Kenapa Hanya Tiga'));
  push(TBL([2100, 3600, 3938], ['Dimensi Profil Lulusan', 'Bukti di Rapor Pendidikan', 'Keputusan'], PILIH, { size: 18 }));
  push(P('Dasar: Panduan Kokurikuler 2025 tidak mewajibkan seluruh dimensi dinilai; contoh rubrik di panduan bahkan hanya memakai dua dimensi.', { italics: true, size: 18, spaceBefore: 60 }));

  push(SPACER());
  push(TBL([1900, 3300, 2200, 2238], ['Dimensi', 'Sub-dimensi yang Diamati', 'Nilai Pancawaluya', 'Kapan Diamati'], [
    ['kreativitas', '1. Merumuskan solusi bagi permasalahan di sekitarnya\n2. Menciptakan inovasi', 'SINGER (dengan PINTER)', 'Hari 4–5 — purwarupa, aksi nyata, Gelar Karya'],
    ['kolaborasi', '1. Peduli dan berbagi\n2. Membangun kerja sama dengan berbagai kalangan di lingkungan sekitar', 'BAGEUR', 'Hari 1–5 — peran kelas, Lembar Silih Asah'],
    ['kesehatan', '1. Hidup bersih dan sehat\n2. Berkontribusi secara positif terhadap lingkungan', 'CAGEUR', 'Setiap hari — jurnal, Radar Kebiasaan H1 vs H5, aksi nyata'],
  ], { size: 19 }));
  push(P('Sub-dimensi dikutip dari deskripsi dimensi pada Panduan Kokurikuler 2025 (hlm. 3–4). Panduan TIDAK memuat daftar sub-dimensi baku; bila redaksi di aplikasi rapor sekolah berbeda, pilih yang paling dekat maknanya.', { italics: true, size: 18, spaceBefore: 60 }));
  push(P('PENTING: sub-dimensi hanya PANDUAN MENGAMATI. Wali kelas memberi SATU nilai SB/B/C/K per DIMENSI — bukan per sub-dimensi. Jadi hanya ada TIGA kolom nilai per murid.', { bold: true, size: 19, spaceBefore: 60 }));

  push(SPACER());
  push(H3('2. Asesmen Formatif'));
  push(P('Panduan: “Asesmen formatif dilakukan selama proses kegiatan berlangsung” untuk memberi umpan balik, bukan untuk menghakimi.', { italics: true, size: 19, spaceAfter: 60 }));
  push(TBL([2200, 3000, 4438], ['Teknik', 'Instrumen', 'Kapan & Oleh Siapa'], [
    ['Observasi', 'Catatan Anekdotal', 'Sepanjang sesi, oleh WALI KELAS seorang diri. Target realistis: 3 catatan per hari. Fokuskan pada murid yang paling berubah dan murid yang paling pasif.'],
    ['Jurnal refleksi', 'Jurnal Waluya (tulis tangan di buku tulis murid)', 'Setiap hari 11.45–12.00. Dibaca wali kelas pada malam harinya, dibalas SATU kalimat — bukan nilai, bukan koreksi.'],
    ['Penilaian diri', 'Radar Kebiasaan (Google Sheet tim)', 'Hari 1 dan Hari 5. Perbandingannya menjadi bukti perubahan untuk dimensi Kesehatan.'],
    ['Umpan balik teman sebaya', 'Lembar Silih Asah (Google Sheet tim)', 'Hari 4, saat purwarupa v1 dipajang. Menjadi bukti untuk dimensi Kolaborasi.'],
    ['Ceklis proses', 'Papan Kartu', 'Dijaga Tim Piket Data (murid). Bukti kedisiplinan & tanggung jawab.'],
  ], { size: 19 }));

  push(PB());
  push(H3('3. Asesmen Sumatif — Penilaian Kinerja dengan Instrumen Rubrik'));
  push(P('Dilaksanakan pada GELAR KARYA, Hari 5. Format tabel di bawah mengikuti Panduan Kokurikuler 2025 (hlm. 65).', { italics: true, size: 19, spaceAfter: 60 }));

  RUBRIK.forEach(r => {
    push(TBL([1400, 2600, 1420, 1400, 1400, 1418],
      ['Dimensi\nProfil Lulusan', 'Sub-dimensi & Aspek yang Dinilai', 'Sangat Baik\n(SB)', 'Baik\n(B)', 'Cukup\n(C)', 'Kurang\n(K)'],
      [r], { size: 16 }));
    push(SPACER());
  });

  push(H3('4. Input dan Analisis Nilai'));
  push(P('Format mengikuti Lampiran Panduan Kokurikuler 2025.', { italics: true, size: 19, spaceAfter: 60 }));
  push(TBL([2000, 1500, 1500, 1500, 3138],
    ['Nama Murid', 'kreativitas\n(SB/B/C/K)', 'kolaborasi\n(SB/B/C/K)', 'kesehatan\n(SB/B/C/K)', 'Catatan Pendidik (opsional)'], [
    ['Contoh: Rizky', 'C', 'SB', 'B', 'Memimpin pengumpulan data sanitasi dan menyelesaikan perbedaan pendapat timnya secara santun. Masih perlu berlatih mengembangkan gagasan sendiri, tidak sekadar meniru contoh.'],
    [' ', ' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' ', ' '],
  ], { size: 18 }));
  push(P('Berkas siap pakai: 01_UNTUK_GURU/INSTRUMEN_ASESMEN.xlsx — kolom deskripsi rapor tersusun OTOMATIS begitu SB/B/C/K diisi.', { italics: true, size: 18, spaceBefore: 60 }));

  push(SPACER());
  push(H3('5. Deskripsi Rapor — kolom Kokurikuler'));
  push(P('Panduan (hlm. 55): “Pelaporan hasil kokurikuler dalam rapor murid dicantumkan pada kolom Kokurikuler.” Berupa DESKRIPSI, bukan angka, dan didasarkan pada asesmen formatif DAN sumatif. Cukup satu deskripsi per semester.', { size: 19, spaceAfter: 60 }));
  push(BOX('Inspirasi deskripsi rapor (pilih salah satu pola)', [
    'POLA 1 — lengkap dengan bukti:',
    '“Ananda Rizky sudah sangat baik dalam KOLABORASI dengan menjalankan perannya secara konsisten dan membantu tim lain, serta baik dalam KESEHATAN melalui pembiasaan tujuh kebiasaan yang terjaga selama kegiatan. Masih perlu berlatih dalam KREATIVITAS, khususnya mengembangkan gagasan sendiri, tidak sekadar meniru contoh.”',
    '',
    'POLA 2 — ringkas dengan konteks kegiatan:',
    '“Ananda Sinta sudah sangat baik dalam kreativitas saat merancang dispenser sabun mekanis yang kini terpasang di sekolah, serta baik dalam kolaborasi dan kesehatan.”',
    '',
    'POLA 3 — paling ringkas:',
    '“Ananda Rizky sudah sangat baik dalam kolaborasi dan masih perlu berlatih dalam kreativitas pada kegiatan Sakola Waluya.”',
  ], GOLD, 'BF8F00'));
  push(P('Catatan: gunakan bahasa yang RINGKAS, POSITIF, dan EDUKATIF. Sebut yang sudah baik lebih dulu, lalu yang masih perlu dilatih. Hindari kata “kurang” atau “gagal”.', { italics: true, size: 19, spaceBefore: 60 }));

  push(SPACER());
  push(H3('6. Bobot Pengolahan Nilai (kebijakan sekolah)'));
  push(P('Panduan tidak mengatur bobot. Berikut usulan yang dipakai kegiatan ini — silakan disesuaikan.', { italics: true, size: 19, spaceAfter: 60 }));
  push(TBL([4200, 1600, 3838], ['Komponen', 'Bobot', 'Bukti'], [
    ['Kinerja Tim — Gelar Karya & Aksi Nyata (rubrik 3 dimensi)', '40%', 'Karya, foto before–after, presentasi 60 detik'],
    ['Portofolio — Google Sheet tim + Jurnal Waluya (buku tulis)', '30%', 'Sheet tim (9 lembar) + buku tulis murid'],
    ['Kampanye Digital (konten terpublikasi)', '15%', 'Tautan/berkas konten di kanal sekolah'],
    ['Kontrak Kebiasaan Waluya (tertanda murid–orang tua–wali kelas)', '15%', 'Buku tulis murid'],
  ], { size: 19 }));

  push(PB());
  return c;
}
module.exports = { asesmen, RUBRIK };
