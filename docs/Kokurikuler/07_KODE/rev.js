// Konten revisi: rancangan untuk SATU fasilitator (wali kelas seorang diri)
const L = require('./lib.js');
const { P, H1, H2, H3, TBL, BOX, SPACER, PB, AlignmentType, TextRun, GOLD, ROSE, NAVY, BLUE } = L;

const COVER_ROWS = [
  ['Bentuk Kokurikuler', 'Cara Lainnya — Pendidikan Karakter Pancawaluya (Panduan Kokurikuler 2025; Panduan Implementasi Pancawaluya SMK, hlm. 55)'],
  ['Model', 'Hybrid: Blok Pembiasaan 7 KAIH (pagi) + Projek Aksi Nyata berbasis kompetensi keahlian (siang)'],
  ['Pengelompokan', 'Homogen per kelas / program keahlian.'],
  ['FASILITATOR', 'WALI KELAS — SATU-SATUNYA orang dewasa yang mendampingi kelas. Tidak ada guru pendamping. Tidak ada Kaprog/toolman yang ikut memfasilitasi. Tidak ada Guru BK yang standby di kelas.'],
  ['Konsekuensi Rancangan', 'Peran "guru kedua" DIPINDAHKAN KE MURID (Kapten Tim, Tim Waktu, Tim K3, Tim Piket Data, Tim Dokumentasi, Tim Logistik). Produksi karya dilakukan TANPA bengkel, TANPA mesin, TANPA bahan kimia berbahaya — hanya alat tangan & perangkat digital, di dalam kelas.'],
  ['Alokasi Waktu', '28 JP terjadwal (@45 menit) + 5 sesi Pembiasaan Pagi (Apel + MBG, 5 x 60 menit). Dari kuota 144 JP kokurikuler kelas XI SMK.'],
  ['Dimensi yang Dinilai', 'TIGA saja: kreativitas · kolaborasi · kesehatan. Dipilih dari titik terlemah Rapor Pendidikan. Dimensi lain (penalaran kritis, komunikasi, kemandirian, kewargaan, keimanan) tetap dilatih tetapi TIDAK diasesmen formal — disimpan untuk projek kokurikuler berikutnya.'],
  ['Nilai Pancawaluya', 'Cageur · Bener · Bageur · Pinter · Singer (satu nilai per hari)'],
  ['Produk Akhir', '(1) Aksi Nyata di sekolah · (2) Purwarupa/Karya · (3) Kampanye Digital · (4) Kontrak Kebiasaan Waluya + Jurnal'],
];

// ============ BAB III-A ============
function babSatuGuru() {
  const c = [];
  const push = (...x) => x.forEach(i => Array.isArray(i) ? c.push(...i) : c.push(i));

  push(H1('BAB III-A — RANCANGAN UNTUK SATU FASILITATOR'));
  push(BOX('BATASAN YANG MENENTUKAN SEGALANYA', [
    'Selama lima hari, setiap kelas hanya didampingi WALI KELASNYA — seorang diri. Tidak ada guru pendamping. Tidak ada Kaprog atau toolman yang ikut memfasilitasi. Tidak ada Guru BK yang standby di ruang kelas.',
    '',
    'Rancangan ini TIDAK menyiasati keterbatasan itu — rancangan ini MEMANFAATKANNYA. Pekerjaan yang biasanya dipegang "guru kedua" (menjaga waktu, mengecek keselamatan, mencatat kehadiran, mengurus logistik) DISERAHKAN KEPADA MURID.',
    '',
    'Hasilnya justru lebih selaras dengan tujuan kegiatan: menaikkan Gotong Royong (54,70 — TURUN) dan Kemandirian, sekaligus memaksa guru benar-benar berhenti menjadi pusat kelas — yang persis merupakan akar masalah D.1.3 (Metode Pembelajaran, 56,79).',
  ], ROSE, 'AD1457'));

  push(SPACER());
  push(H2('A. Struktur Peran Murid — Pengganti "Guru Kedua"'));
  push(P('Satu kelas (±36 murid) dibagi menjadi 6 TIM (@5–6 murid). Di luar keanggotaan tim, setiap murid juga memegang SATU peran kelas. Peran dirotasi setiap hari agar semua murid merasakannya.', { spaceAfter: 60 }));
  push(TBL([2000, 900, 6738], ['Peran', 'Jumlah', 'Tugas Konkret (menggantikan tugas guru kedua)'], [
    ['KAPTEN TIM', '6\n(1/tim)', 'Bertanggung jawab atas KEUTUHAN & KESELAMATAN anggota timnya saat turun lapangan. MENGAMBIL & MENGKEMBALIKAN KE PAPAN kartu timnya di Papan Kartu. Memastikan tidak ada anggota yang terpisah. Kapten TIDAK memerintah — dia yang BERTANGGUNG JAWAB.'],
    ['TIM WAKTU', '2', 'Memegang stopwatch/HP. Mengumumkan sisa waktu setiap sesi ("15 menit lagi", "5 menit lagi", "WAKTU HABIS"). Membunyikan tanda kembali ke Pos. GURU TIDAK LAGI MENGURUS WAKTU.'],
    ['TIM PIKET DATA', '2', 'Menjaga PAPAN KARTU: memastikan tiap tim mengambil & mengkembalikan kartunya ke papan. Mengecek papan tiap 20 menit — ada slot yang masih kosong lewat waktu? Beri tahu guru.'],
    ['TIM K3', '2', 'Memeriksa APD (sarung tangan, masker) sebelum tim turun lapangan. Memeriksa alat tangan sebelum & sesudah dipakai. Berwenang MENGHENTIKAN pekerjaan yang tidak aman — dan murid lain WAJIB PATUH. Memegang Daftar Alat Boleh/Dilarang.'],
    ['TIM DOKUMENTASI', '2', 'Foto & video seluruh proses. Bertanggung jawab atas foto BEFORE–AFTER Hari 5. Menyimpan berkas dalam satu folder kelas.'],
    ['TIM LOGISTIK', '2', 'Menyiapkan, membagikan, dan MEMBERESKAN alat & bahan. Kelas tidak boleh bubar sebelum Tim Logistik menyatakan beres.'],
  ], { size: 19 }));
  push(BOX('Kalimat yang HARUS diucapkan guru di Hari 1', [
    '"Minggu ini saya sendirian. Tidak ada guru lain yang akan masuk ke kelas ini. Artinya: kalau kalian menunggu saya mengatur segalanya, kita tidak akan selesai. Mulai hari ini, sebagian tugas saya adalah tugas kalian. Saya tidak sedang malas — saya sedang mempercayai kalian."',
  ], GOLD, 'BF8F00'));

  push(SPACER());
  push(H2('B. POS FASILITATOR & PAPAN KARTU'));
  push(P('Saat murid turun lapangan (Hari 2 & Hari 3), guru TIDAK ikut berkeliling bersama satu tim — karena tim lain akan tanpa pengawasan. Guru MENETAP di POS FASILITATOR.', { spaceAfter: 60 }));
  push(TBL([2300, 7338], null, [
    ['Apa itu POS', 'Satu titik tetap: ruang kelas asal, atau meja/kursi di tengah zona (mis. lorong depan toilet untuk Zona Z1). Guru berada di sini sepanjang sesi lapangan.'],
    ['Isi POS', '(1) PAPAN KARTU — 6 slot + 6 kartu tim (warna berbeda), satu per tim. (2) Kotak P3K. (3) Daftar nomor darurat: UKS, Satpam, Kepala Sekolah, Koordinator.'],
    ['PAPAN KARTU\n(pengganti kartu izin)', '6 SLOT + 6 KARTU TIM (warna berbeda) di dinding kelas, satu per tim. Tim BERANGKAT \u2192 ambil kartunya, pakai. Tim PULANG \u2192 kembalikan ke papan. SLOT KOSONG = tim itu masih di luar.\n\nGURU TIDAK MENANDATANGANI APA PUN. Tidak menulis jam. Tidak memegang kertas. Cukup MELIHAT papan.\n\nAlasannya: kartu izin bertanda tangan guru memindahkan tanggung jawab hukum ke wali kelas atas setiap perpindahan murid. Padahal izin menjelajah sudah melekat pada SEKTOR yang ditetapkan Koordinator/Kepala Sekolah. Wali kelas tidak boleh dibebani itu.'],
    ['Lapor balik', 'Tim Piket Data mengecek papan setiap 20 menit. Kalau ada slot yang masih kosong melewati waktu, Tim Piket memberi tahu guru. Guru cukup mengirim satu pesan ke grup WhatsApp kelas.'],
    ['Guru boleh berkeliling?', 'Boleh — tapi HANYA ke lokasi yang masih TERLIHAT dari Pos, maksimal 5 menit, dan setelah memastikan Tim Piket Data menjaga Papan Kartu.'],
    ['Pengawas umum', 'Koordinator Kokurikuler berkeliling seluruh sekolah sebagai pengawas umum (BUKAN fasilitator kelas) — memastikan tidak ada tim yang tersesat atau melanggar aturan jelajah.'],
  ], { headFill: NAVY, zebra: true, size: 19 }));

  push(SPACER());
  push(H3('Lima Aturan Jelajah (dibacakan & disepakati Hari 1)'));
  push(TBL([700, 8938], null, [
    ['1', 'TIDAK ADA MURID SENDIRIAN. Minimal berdua, selalu.'],
    ['2', 'TIDAK BOLEH keluar gerbang sekolah. Titik.'],
    ['3', 'TIDAK BOLEH masuk ruangan yang sedang dipakai KBM, ruang guru, atau ruangan terkunci.'],
    ['4', 'TIDAK BOLEH pindah lokasi tanpa lapor balik ke Pos lebih dulu.'],
    ['5', 'TIM YANG TELAT KEMBALI: KARTUNYA DITAHAN guru. Tim itu tidak boleh turun lapangan lagi hari itu — datanya dilanjutkan dari dalam kelas. Ini bukan hukuman, ini konsekuensi yang disepakati bersama.'],
  ], { headFill: 'AD1457', zebra: true, size: 19 }));

  push(PB());
  push(H2('C. Produksi Karya TANPA Bengkel'));
  push(BOX('KEPUTUSAN KESELAMATAN', [
    'Karena wali kelas seorang diri — dan belum tentu guru produktif dari jurusan kelas tersebut — SELURUH produksi karya dilakukan TANPA bengkel, TANPA mesin, dan TANPA bahan kimia berbahaya. Seluruhnya dikerjakan DI DALAM KELAS.',
    '',
    'Ini bukan penurunan mutu. Purwarupa berbahan sederhana yang BENAR-BENAR DIPASANG dan BENAR-BENAR DIPAKAI di sekolah jauh lebih bernilai daripada karya logam indah yang tidak pernah keluar dari bengkel.',
    '',
    'Untuk karya yang memang menuntut fabrikasi mesin (mis. tempat sampah plat besi), murid membuat PURWARUPA SKALA 1:1 dari kardus/PVC + GAMBAR KERJA LENGKAP, lalu MENYERAHKANNYA SECARA RESMI kepada Wakasek Sarpras / Kaprog untuk difabrikasi SETELAH kegiatan. Penyerahan resmi itu sendiri adalah pembelajaran kewargaan.',
  ], ROSE, 'AD1457'));

  push(SPACER());
  push(H3('Daftar Alat: BOLEH vs DILARANG'));
  push(TBL([4819, 4819], ['BOLEH (dengan pengawasan Tim K3)', 'DILARANG MUTLAK'], [
    ['Gunting · cutter · gergaji tangan kecil · obeng · tang · palu kecil · amplas · meteran · penggaris · lem putih & lem kertas · double tape busa · cable ties · stapler · kardus tebal · pipa PVC · kayu ringan / triplek tipis · botol & kemasan bekas · kertas & karton · laptop & HP',
     'Mesin bubut · mesin frais · gerinda · mesin las (semua jenis) · bor listrik · kompresor · gergaji mesin · listrik jaringan 220V · penyolderan · NaOH / asam kuat / bahan korosif · bahan mudah terbakar · pemanasan dengan api · reaksi kimia eksotermik · bekerja di ketinggian lebih dari 1 meter'],
  ], { size: 18, headFill: NAVY }));
  push(P('Lem tembak (glue gun) HANYA boleh dipakai jika Tim K3 mendampingi dan alasnya tahan panas. Jika ragu — jangan.', { italics: true, size: 19, spaceBefore: 50 }));

  push(SPACER());
  push(H2('D. Protokol "SUARA WALUYA" — Pengganti Sticky Note'));
  push(P('Sesi Hari 1 yang menggali rasa aman murid TIDAK LAGI memakai sticky note fisik. Alasannya: guru sendirian tidak mungkin mengelola kertas anonim yang berpotensi memuat pengakuan serius, sementara Guru BK tidak berada di tempat.', { spaceAfter: 60 }));
  push(TBL([1700, 7938], ['Tahap', 'Rincian'], [
    ['ALAT', 'GOOGLE FORM — gratis, anonim, tanpa aplikasi tambahan, tanpa akun bagi murid. Dibuat SEKALI oleh Tim ICT / Koordinator. SATU tautan + SATU QR code untuk SELURUH kelas XI. Guru tidak perlu mengatur apa pun: cukup menayangkan QR di layar atau membagikan tautan di grup kelas.'],
    ['SETELAN WAJIB', '"Kumpulkan alamat email" = MATI (agar benar-benar anonim). "Batasi 1 tanggapan" = MATI. Hasil otomatis masuk ke Google Sheet.'],
    ['ISI FORM (6 butir)', '1. Kelas (dropdown)\n2. Satu hal yang membuat saya BETAH di sekolah ini (isian singkat)\n3. Satu hal yang membuat saya TIDAK NYAMAN (isian singkat)\n4. Satu hal yang membuat saya merasa TIDAK AMAN (isian singkat — BOLEH dikosongkan)\n5. Seberapa aman kamu merasa di sekolah ini? (skala 1–5)\n6. Saya ingin berbicara dengan Guru BK (kotak centang) → jika dicentang, muncul isian NAMA (opsional)'],
    ['DI KELAS', 'Guru menayangkan QR (3 menit) → murid mengisi lewat HP masing-masing (10 menit) → guru membuka Google Sheet dan MENAYANGKAN hasil kelasnya langsung di layar. Murid melihat jawaban teman-temannya muncul TANPA NAMA.'],
    ['TETAP ADA GERAK', 'Murid TIDAK duduk pasif. Setelah hasil tayang: murid maju ke papan tulis, MENGELOMPOKKAN jawaban yang mirip, memberi judul kategori, lalu MENGHITUNG jumlahnya (latihan numerasi). Ditutup dengan "voting kaki": murid berdiri di depan kategori yang paling mendesak menurutnya.'],
    ['PERAN GURU', 'Guru TIDAK mengomentari, TIDAK membela sekolah, TIDAK berjanji apa pun. Guru hanya bertanya: "Kategori mana yang paling banyak? Kenapa menurut kalian?"'],
    ['PROTOKOL BK', 'Guru TIDAK menindaklanjuti sendiri isian sensitif. Butir 4 & 6 dalam Sheet HANYA BOLEH DIBACA Guru BK. Koordinator memberi BK akses ke Sheet. BK menerima REKAP di akhir Hari 1 dan menindaklanjuti murid yang mencentang butir 6. Guru kelas cukup memastikan murid tahu jalur ini ada.'],
    ['JIKA INTERNET MATI', 'Cadangan: KERTAS LIPAT ANONIM. Murid menulis, MELIPAT, memasukkan ke satu kotak tertutup. Guru TIDAK MEMBACANYA DI DEPAN KELAS. Kotak diserahkan TERSEGEL ke Guru BK hari itu juga. Sesi pengelompokan diganti diskusi terbuka tanpa membacakan isi kertas.'],
  ], { size: 18 }));
  push(BOX('KALIMAT BAKU yang HARUS diucapkan guru sebelum sesi ini', [
    '"Formulir ini ANONIM. Saya tidak tahu siapa menulis apa, dan saya memang tidak ingin tahu.',
    'Ada satu kotak di bawah: ‘Saya ingin berbicara dengan Guru BK.’ Kalau kalian mencentangnya, hanya Guru BK yang melihatnya — bukan saya. Kalian boleh menulis nama, boleh juga tidak.',
    'Kalau ada sesuatu yang berat, kalian tidak sendirian. Guru BK ada, dan beliau akan menghubungi kalian."',
  ], GOLD, 'BF8F00'));

  push(PB());
  return c;
}

// ============ TABEL KARYA TANPA BENGKEL ============
const KARYA_ROWS = [
  ['Teknik Mekatronika', 'Purwarupa fungsional sederhana (tenaga baterai/USB) DAN/ATAU simulasi rangkaian daring.',
   'Dispenser sabun tekan/pedal dari botol bekas + tuas (tanpa listrik) · indikator tempat sampah penuh (mekanis atau LED baterai) · SIMULASI rangkaian sensor di Tinkercad Circuits atau Wokwi (gratis, daring) + gambar teknis lengkap. DILARANG: menyolder, listrik 220V.'],
  ['Rekayasa Perangkat Lunak (RPL)', 'Aplikasi / web / sistem sederhana — cukup laptop atau HP.',
   'Form lapor kerusakan sarpras (Google Form + Sheet + dasbor grafik) · tracker kebiasaan 7 KAIH (web sederhana atau Google Sheet berformula) · sistem catat & rekap MBG · kuis interaktif 7 KAIH · papan data sanitasi.'],
  ['Desain Komunikasi Visual (DKV)', 'Sistem informasi visual & kampanye cetak (Canva/Adobe, dicetak sekolah).',
   'Signage toilet & wastafel · wayfinding sekolah · infografis data temuan · poster kampanye · ikon pemilahan sampah. Dipasang dengan double tape / cable ties / lem — TANPA bor.'],
  ['Animasi', 'Motion graphic / video pendek (Canva, CapCut, atau HP).',
   'PSA animasi 30–60 detik untuk IG & YouTube sekolah · animasi 7 KAIH · video anti-perundungan · explainer data temuan.'],
  ['Teknik Kimia Industri', 'Uji sederhana & produk AMAN — tanpa bahan berbahaya, tanpa pemanasan, tanpa api.',
   'Uji kualitas air toilet/wastafel dengan INDIKATOR ALAMI (air kubis ungu / kunyit) + kertas pH strip + uji kekeruhan & bau secara visual · ECO-ENZYME dari sisa kulit buah & sayur MBG (fermentasi — aman, murah, langsung menjawab food waste) menjadi cairan pembersih · audit & analisis food waste MBG selama 5 hari. DILARANG: NaOH, asam kuat, api, pemanasan.'],
  ['Teknik Pemesinan', 'Purwarupa SKALA 1:1 dari kardus tebal / PVC / kayu ringan (alat tangan) + GAMBAR KERJA lengkap untuk difabrikasi kemudian.',
   'Tempat sampah pilah · dudukan & rak wastafel · rak sepatu · penyangga papan informasi · rak & pot taman. Purwarupa DIPASANG & DIUJI FUNGSINYA di titik sasaran Hari 5. Gambar kerja (lengkap dengan ukuran & bahan) DISERAHKAN RESMI kepada Wakasek Sarpras/Kaprog untuk difabrikasi setelah kegiatan. DILARANG: mesin, las, gerinda, bor listrik.'],
];

function boxPasang() {
  return BOX('Bagaimana memasang karya tanpa bor listrik? (Hari 5)', [
    'BOLEH: cable ties ke pagar/teralis/tiang · double tape busa kuat · gantungan tempel (adhesive hook) · tali · benda berdiri bebas (freestanding) · memanfaatkan paku atau kait YANG SUDAH ADA.',
    '',
    'JIKA HARUS MENGEBOR: JANGAN dikerjakan murid. Tim menulis SURAT PERMOHONAN PEMASANGAN (ditulis MURID, bukan guru), diserahkan langsung kepada Wakasek Sarpras pada Gelar Karya, disertai gambar kerja & titik pemasangan. Penyerahan resmi itu TETAP dihitung sebagai AKSI NYATA.',
  ], 'E8F5E9', '2E7D32');
}

module.exports = { COVER_ROWS, babSatuGuru, KARYA_ROWS, boxPasang };
