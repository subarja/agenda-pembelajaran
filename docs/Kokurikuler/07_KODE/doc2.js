const L = require('./lib.js');
const { P, H1, H2, H3, TITLE, TBL, BOX, SPACER, PB, save, AlignmentType, TextRun, CW, GOLD, LIGHT, ROSE, NAVY, BLUE } = L;

const R2 = require('./rev2.js');
const R3 = require('./rev3.js');

const c = [];
const push = (...x) => x.forEach(i => Array.isArray(i) ? c.push(...i) : c.push(i));

const GRN = 'E8F5E9', GRNA = '2E7D32';

// helper: session block
function SESI(judul, waktu, tujuan, langkah, bahan, macet) {
  push(TBL([9638], null, [[judul + '   |   ' + waktu]], { headFill: NAVY, zebra: false, size: 21 }));
  push(P([new TextRun({ text: 'Tujuan sesi: ', bold: true, size: 20 }), new TextRun({ text: tujuan, italics: true, size: 20 })], { spaceBefore: 60, spaceAfter: 60 }));
  push(P('YANG GURU LAKUKAN — langkah demi langkah:', { bold: true, size: 20, color: GRNA, spaceAfter: 50 }));
  langkah.forEach(([t, isi]) => {
    push(TBL([950, 8688], null, [[t, isi]], { headFill: BLUE, zebra: false, size: 19 }));
  });
  push(P([new TextRun({ text: '📦 BAHAN & DARI MANA: ', bold: true, size: 19, color: 'BF8F00' }), new TextRun({ text: bahan, size: 19 })], { spaceBefore: 70, spaceAfter: 40 }));
  push(P([new TextRun({ text: '🛟 KALAU MACET: ', bold: true, size: 19, color: 'AD1457' }), new TextRun({ text: macet, size: 19, italics: true })], { spaceAfter: 140 }));
}

// ============ COVER ============
push(P('SMK NEGERI 2 CIMAHI · DINAS PENDIDIKAN PROVINSI JAWA BARAT', { align: AlignmentType.CENTER, bold: true, size: 19, color: '595959', spaceAfter: 240 }));
push(TITLE('PANDUAN GURU FASILITATOR', 'SAKOLA WALUYA — Kokurikuler Kelas XI · 15–21 Juli 2026'));
push(P('Dokumen 2 dari 3', { align: AlignmentType.CENTER, italics: true, size: 19, color: '7F7F7F', spaceAfter: 200 }));

push(BOX('BACA INI DULU — 60 detik', [
  'Anda BUKAN pengajar minggu ini. Anda adalah FASILITATOR. Dan minggu ini, Anda SENDIRIAN.',
  '',
  'ADA 16 KELAS PARALEL. 576 murid. 96 tim. Karena itu kelas Anda punya SEKTOR EKSKLUSIF dan GELOMBANG sendiri — cek Kartu Sektor yang diberikan koordinator SEBELUM Hari 1. Kelas Anda TIDAK turun lapangan bersamaan dengan 15 kelas lain.',
  '',
  'Tidak ada guru pendamping. Tidak ada Kaprog atau toolman. Tidak ada Guru BK yang standby di kelas Anda. Panduan ini dirancang persis untuk kondisi itu — semua tugas “guru kedua” sudah dipindahkan ke MURID.',
  '',
  'Rapor Pendidikan SMKN 2 Cimahi menyebut D.1.3 “Metode Pembelajaran” (skor 56,79, turun 2,21) sebagai AKAR MASALAH dari empat indikator prioritas sekaligus. Artinya: cara mengajar kita masih terlalu satu arah. Lima hari ini adalah latihan kita bersama untuk berubah.',
  '',
  'ATURAN EMAS:',
  '1. Anda berbicara maksimal 25% waktu sesi. Kalau Anda menerangkan 30 menit nonstop, sesi itu gagal.',
  '2. Jangan beri jawaban. Beri pertanyaan. Tiga kalimat andalan: “Menurut kamu kenapa?” · “Apa buktinya?” · “Kalau begitu, apa yang bisa kita lakukan?”',
  '3. Setiap sesi harus ada momen murid BERDIRI / BERGERAK / BERPINDAH.',
  '4. Maksimal 1 halaman slide per sesi.',
  '5. Semua keputusan diambil murid. Bahkan penjagaan waktu pun bukan tugas Anda lagi — itu tugas TIM WAKTU. Tugas Anda tinggal satu: menjaga agar murid jujur, dan menjaga agar mereka selamat.',
], GRN, GRNA));

push(PB());

// ============ BAGIAN 0 ============
push(H1('BAGIAN 0 — PERSIAPAN SEBELUM HARI-H'));

push(H2('A. Siapa Mengerjakan Apa'));
push(BOX('ANDA SENDIRIAN DI KELAS — DAN ITU DISENGAJA', [
  'Selama lima hari, kelas Anda hanya didampingi oleh Anda. Karena itu, enam pekerjaan yang biasanya dipegang guru kedua sudah DIPINDAHKAN KE MURID. Ini bukan siasat darurat — ini justru yang menaikkan Gotong Royong (54,70, satu-satunya sub-dimensi karakter yang TURUN) dan Kemandirian.',
], ROSE, 'AD1457'));

push(SPACER());
push(H3('A.1 Struktur Peran MURID (wajib dibentuk Hari 1, Sesi 3)'));
push(P('Bagi kelas menjadi 6 TIM (@5\u20136 murid). Di luar keanggotaan tim, setiap murid memegang SATU peran kelas. ROTASIKAN setiap hari.', { spaceAfter: 60 }));
push(TBL([1900, 800, 6938], ['Peran Murid', 'Jml', 'Tugas \u2014 ini yang dulu Anda kerjakan sendiri'], [
  ['KAPTEN TIM', '6', 'Bertanggung jawab atas KEUTUHAN & KESELAMATAN anggota timnya saat turun lapangan. MENGAMBIL & MENGKEMBALIKAN KE PAPAN kartu timnya di Papan Kartu. Kapten TIDAK memerintah \u2014 dia yang BERTANGGUNG JAWAB.'],
  ['TIM WAKTU', '2', 'Memegang stopwatch. Mengumumkan sisa waktu tiap sesi (\u201c15 menit lagi\u201d \u2014 \u201c5 menit lagi\u201d \u2014 \u201cWAKTU HABIS\u201d). ANDA TIDAK LAGI MENGURUS WAKTU. Serahkan sungguh-sungguh.'],
  ['TIM PIKET DATA', '2', 'Menjaga PAPAN KARTU: memastikan tiap tim mengambil & mengkembalikan kartunya ke papan. Cek papan tiap 20 menit — ada slot kosong lewat waktu? Beri tahu Anda.'],
  ['TIM K3', '2', 'Memeriksa APD sebelum tim turun. Memeriksa alat tangan sebelum & sesudah dipakai. BERWENANG MENGHENTIKAN pekerjaan yang tidak aman \u2014 dan murid lain WAJIB PATUH. Anda yang memberi wewenang itu, di depan kelas, Hari 1.'],
  ['TIM DOKUMENTASI', '2', 'Foto & video seluruh proses. Penanggung jawab foto BEFORE\u2013AFTER Hari 5.'],
  ['TIM LOGISTIK', '2', 'Menyiapkan, membagikan, MEMBERESKAN alat & bahan. Kelas tidak bubar sebelum Tim Logistik menyatakan beres.'],
], { size: 19 }));
push(BOX('Ucapkan ini persis, Hari 1', [
  '\u201cMinggu ini saya sendirian. Tidak ada guru lain yang akan masuk ke kelas ini. Artinya: kalau kalian menunggu saya mengatur segalanya, kita tidak akan selesai. Mulai hari ini, sebagian tugas saya adalah tugas kalian. Saya tidak sedang malas \u2014 saya sedang mempercayai kalian.\u201d',
], GOLD, 'BF8F00'));

push(SPACER());
push(H3('A.2 Peran ORANG DEWASA \u2014 semuanya DI LUAR kelas Anda'));
push(TBL([2300, 7338], ['Siapa', 'Perannya (tidak ada yang masuk memfasilitasi kelas Anda)'], [
  ['ANDA \u2014 Wali Kelas', 'SATU-SATUNYA fasilitator. Memfasilitasi seluruh sesi; mengisi Catatan Anekdotal (target realistis 3/hari, bukan 5); membaca Jurnal Waluya murid tiap malam dan membalas SATU kalimat.'],
  ['Koordinator Kokurikuler', 'TIDAK masuk kelas. Menyiapkan semua perlengkapan sebelum kegiatan. Selama kegiatan: BERKELILING SEKOLAH sebagai pengawas umum \u2014 memastikan tidak ada tim yang tersesat atau melanggar aturan jelajah. Kalau Anda butuh bantuan mendesak, hubungi dia.'],
  ['Kepala Program Keahlian', 'TIDAK masuk kelas. TIDAK membuka bengkel. Perannya cuma dua: (a) menerima gambar kerja & purwarupa yang butuh fabrikasi mesin, untuk dikerjakan SETELAH kegiatan; (b) datang 60\u201390 menit sebagai penilai teknis tamu di Gelar Karya Hari 5.'],
  ['Guru BK', 'TIDAK berkeliling, TIDAK standby. Menerima REKAP Google Form \u201cSuara Waluya\u201d dan menindaklanjuti murid yang mencentang \u201csaya ingin bicara dengan Guru BK\u201d. Anda tidak perlu menangani apa pun sendirian \u2014 lihat Protokol Suara Waluya di Bagian 0.D.'],
  ['Wakasek Sarpras & Caraka', 'Menyediakan data sanitasi SEBELUM kegiatan. Menjadi NARASUMBER wawancara Hari 3 (di tempat kerjanya). Memberi IZIN TITIK AKSI Hari 5.'],
  ['Tim ICT', 'Membuat Google Form \u201cSuara Waluya\u201d SEKALI \u2014 1 tautan + 1 QR untuk seluruh kelas XI. Anda cukup menayangkan QR-nya.'],
], { size: 19 }));

push(PB());
push(H2('B. POS FASILITATOR & PAPAN KARTU \u2014 Cara Mengawasi 6 Tim Sendirian'));
push(BOX('JANGAN ikut berkeliling bersama satu tim.', [
  'Kalau Anda ikut Tim 1 ke toilet lantai 2, maka Tim 2\u20136 sedang tanpa pengawasan sama sekali. Itu tidak bisa diterima.',
  'Anda MENETAP di POS. Murid yang bergerak, bukan Anda.',
], ROSE, 'AD1457'));
push(SPACER());
push(TBL([2300, 7338], null, [
  ['Apa itu POS', 'Satu titik tetap: ruang kelas asal, atau meja & kursi yang Anda pindahkan ke tengah zona (mis. lorong depan toilet untuk Zona Z1). Anda di sini sepanjang sesi lapangan.'],
  ['Isi POS', '(1) PAPAN KARTU \u2014 6 slot + 6 kartu tim (warna berbeda). (2) Kotak P3K. (3) Nomor darurat: UKS, Satpam, Kepala Sekolah, Koordinator.'],
  ['PAPAN KARTU\n(pengganti kartu izin)', '6 SLOT + 6 KARTU TIM (warna berbeda) di dinding, satu per tim. Tim BERANGKAT \u2192 ambil kartunya. Tim PULANG \u2192 kembalikan ke papan. SLOT KOSONG = tim itu masih di luar.\n\nANDA TIDAK MENANDATANGANI APA PUN. Tidak menulis jam. Tidak memegang kertas. Cukup MELIHAT papan.\n\nKenapa kartu izin dihapus: tanda tangan Anda pada kartu memindahkan tanggung jawab hukum atas setiap perpindahan murid ke pundak Anda. Padahal izin menjelajah sudah melekat pada SEKTOR yang ditetapkan Koordinator/Kepala Sekolah. Anda tidak boleh dibebani itu.'],
  ['Lapor balik', 'Tim Piket Data mengecek papan tiap 20 menit. Ada slot yang masih kosong lewat waktu? Tim Piket memberi tahu Anda. Anda cukup kirim satu pesan ke grup WA kelas.'],
  ['Boleh berkeliling?', 'Boleh \u2014 tapi HANYA ke lokasi yang MASIH TERLIHAT dari Pos, maksimal 5 menit, dan hanya setelah Tim Piket Data menjaga Papan Kartu.'],
], { headFill: NAVY, zebra: true, size: 19 }));
push(SPACER());
push(H3('Lima Aturan Jelajah \u2014 bacakan & sepakati di Hari 1'));
push(TBL([700, 8938], null, [
  ['1', 'TIDAK ADA MURID SENDIRIAN. Minimal berdua, selalu.'],
  ['2', 'TIDAK BOLEH keluar gerbang sekolah. Titik.'],
  ['3', 'TIDAK BOLEH masuk ruangan yang sedang dipakai KBM, ruang guru, atau ruangan terkunci.'],
  ['4', 'TIDAK BOLEH pindah lokasi tanpa lapor balik ke Pos lebih dulu.'],
  ['5', 'TIM YANG TELAT KEMBALI: kartunya DITAHAN, tidak boleh turun lapangan lagi hari itu \u2014 datanya dilanjutkan dari dalam kelas. Ini bukan hukuman, ini konsekuensi yang disepakati.'],
], { headFill: 'AD1457', zebra: true, size: 19 }));

push(PB());
push(H2('C. Produksi Karya TANPA Bengkel \u2014 Alat Tangan & Digital Saja'));
push(BOX('KEPUTUSAN KESELAMATAN \u2014 tidak bisa ditawar', [
  'Anda sendirian, dan Anda belum tentu guru produktif dari jurusan kelas ini. Karena itu SELURUH produksi karya dilakukan DI DALAM KELAS \u2014 tanpa bengkel, tanpa mesin, tanpa bahan kimia berbahaya.',
  '',
  'Ini bukan penurunan mutu. Purwarupa kardus yang BENAR-BENAR DIPASANG dan BENAR-BENAR DIPAKAI di sekolah jauh lebih bernilai daripada karya logam indah yang tidak pernah keluar dari bengkel.',
  '',
  'Untuk karya yang memang butuh mesin: murid membuat PURWARUPA SKALA 1:1 dari kardus/PVC + GAMBAR KERJA LENGKAP, lalu MENYERAHKANNYA RESMI kepada Wakasek Sarpras/Kaprog di Gelar Karya untuk difabrikasi kemudian. Penyerahan resmi itu sendiri adalah pembelajaran kewargaan \u2014 dan tetap dihitung sebagai AKSI NYATA.',
], ROSE, 'AD1457'));
push(SPACER());
push(TBL([4819, 4819], ['BOLEH (diawasi Tim K3)', 'DILARANG MUTLAK'], [
  ['Gunting \u00b7 cutter \u00b7 gergaji tangan kecil \u00b7 obeng \u00b7 tang \u00b7 palu kecil \u00b7 amplas \u00b7 meteran \u00b7 lem putih \u00b7 double tape busa \u00b7 cable ties \u00b7 stapler \u00b7 kardus tebal \u00b7 pipa PVC \u00b7 kayu ringan / triplek tipis \u00b7 botol & kemasan bekas \u00b7 laptop & HP',
   'Mesin bubut \u00b7 frais \u00b7 gerinda \u00b7 las (semua jenis) \u00b7 bor listrik \u00b7 kompresor \u00b7 gergaji mesin \u00b7 listrik 220V \u00b7 menyolder \u00b7 NaOH / asam kuat / bahan korosif \u00b7 bahan mudah terbakar \u00b7 api & pemanasan \u00b7 reaksi kimia eksotermik \u00b7 bekerja di ketinggian > 1 meter'],
], { size: 18, headFill: NAVY }));
push(P('Lem tembak HANYA boleh jika Tim K3 mendampingi dan alasnya tahan panas. Kalau ragu \u2014 jangan.', { italics: true, size: 19, spaceBefore: 50 }));
push(SPACER());
push(H3('Bentuk karya per jurusan (silakan tunjukkan ke murid Hari 4)'));
push(TBL([1900, 7738], ['Jurusan kelas Anda', 'Karya yang mungkin \u2014 semua bisa dikerjakan di kelas'], [
  ['Teknik Mekatronika', 'Dispenser sabun tekan/pedal dari botol bekas + tuas (mekanis, tanpa listrik) \u00b7 indikator tempat sampah penuh (mekanis / LED baterai) \u00b7 SIMULASI rangkaian sensor di Tinkercad Circuits atau Wokwi (gratis, daring, cukup HP/laptop) + gambar teknis. DILARANG menyolder & listrik 220V.'],
  ['Rekayasa Perangkat Lunak', 'Form lapor kerusakan sarpras (Google Form + Sheet + dasbor grafik) \u00b7 tracker kebiasaan 7 KAIH (web sederhana / Sheet berformula) \u00b7 sistem catat & rekap MBG \u00b7 kuis interaktif 7 KAIH \u00b7 papan data sanitasi.'],
  ['Desain Komunikasi Visual', 'Signage toilet & wastafel \u00b7 wayfinding \u00b7 infografis data \u00b7 poster kampanye \u00b7 ikon pemilahan sampah. Canva gratis. Dipasang dengan double tape / cable ties \u2014 TANPA bor.'],
  ['Animasi', 'PSA animasi 30\u201360 detik untuk IG & YouTube sekolah \u00b7 animasi 7 KAIH \u00b7 video anti-perundungan \u00b7 explainer data. Canva / CapCut / HP.'],
  ['Teknik Kimia Industri', 'Uji kualitas air dengan INDIKATOR ALAMI (air kubis ungu / kunyit) + kertas pH strip + uji kekeruhan & bau visual \u00b7 ECO-ENZYME dari sisa kulit buah & sayur MBG (fermentasi \u2014 aman, murah, langsung menjawab food waste) menjadi cairan pembersih \u00b7 audit & analisis food waste MBG 5 hari. DILARANG NaOH, asam kuat, api, pemanasan.'],
  ['Teknik Pemesinan', 'Purwarupa SKALA 1:1 dari kardus tebal / PVC / kayu ringan dengan alat tangan: tempat sampah pilah \u00b7 dudukan & rak wastafel \u00b7 rak sepatu \u00b7 penyangga papan informasi. DIPASANG & DIUJI FUNGSINYA Hari 5. GAMBAR KERJA (ukuran + bahan) diserahkan resmi ke Sarpras/Kaprog untuk difabrikasi kemudian.'],
], { size: 18 }));
push(SPACER());
push(BOX('Memasang karya tanpa bor listrik (Hari 5)', [
  'BOLEH: cable ties ke pagar/teralis/tiang \u00b7 double tape busa kuat \u00b7 gantungan tempel \u00b7 tali \u00b7 benda berdiri bebas \u00b7 memakai paku/kait YANG SUDAH ADA.',
  'KALAU HARUS MENGEBOR: JANGAN dikerjakan murid. Tim menulis SURAT PERMOHONAN PEMASANGAN (ditulis MURID) dan menyerahkannya langsung ke Wakasek Sarpras di Gelar Karya.',
], 'E8F5E9', GRNA));

push(PB());
push(H2('D. PROTOKOL \u201cSUARA WALUYA\u201d \u2014 Pengganti Sticky Note'));
push(BOX('Kenapa sticky note DIHAPUS', [
  'Sesi Hari 1 menggali rasa aman murid \u2014 dan bisa memunculkan pengakuan perundungan atau kekerasan. Dengan sticky note fisik, Anda sendirian akan memegang kertas berisi pengakuan serius, tanpa Guru BK di tempat. Itu beban yang tidak adil untuk Anda, dan tidak aman untuk murid.',
  '',
  'Diganti dengan GOOGLE FORM ANONIM \u2014 yang punya satu keunggulan yang tidak dimiliki sticky note: murid bisa MEMINTA BANTUAN SENDIRI, langsung ke Guru BK, tanpa lewat Anda.',
], ROSE, 'AD1457'));
push(SPACER());
push(TBL([1900, 7738], ['Tahap', 'Rincian \u2014 Anda tidak perlu mengatur apa pun'], [
  ['ALAT', 'GOOGLE FORM. Gratis. Anonim. Murid tidak perlu akun & tidak perlu aplikasi. Dibuat SEKALI oleh Tim ICT/Koordinator: SATU tautan + SATU QR untuk SELURUH kelas XI. ANDA CUKUP MENAYANGKAN QR-nya di layar (atau kirim tautannya ke grup kelas). Tidak ada setelan yang perlu Anda sentuh.'],
  ['ISI FORM', '1. Kelas (dropdown)\n2. Satu hal yang membuat saya BETAH di sekolah ini\n3. Satu hal yang membuat saya TIDAK NYAMAN\n4. Satu hal yang membuat saya merasa TIDAK AMAN (boleh dikosongkan)\n5. Seberapa aman kamu merasa di sekolah ini? (skala 1\u20135)\n6. \u2610 Saya ingin berbicara dengan Guru BK \u2192 jika dicentang, muncul isian NAMA (opsional)'],
  ['LANGKAH DI KELAS', '(1) Tayangkan QR \u2014 3 menit. (2) Murid mengisi lewat HP \u2014 10 menit. (3) ANDA BUKA GOOGLE SHEET-nya dan TAYANGKAN hasil kelas Anda di layar. Murid melihat jawaban teman-temannya muncul TANPA NAMA.'],
  ['TETAP ADA GERAK', 'Murid TIDAK duduk pasif. Setelah hasil tayang: murid MAJU ke papan tulis, MENGELOMPOKKAN jawaban yang mirip, memberi judul kategori, lalu MENGHITUNG jumlahnya (latihan numerasi). Ditutup \u201cvoting kaki\u201d: murid berdiri di depan kategori yang paling mendesak menurutnya.'],
  ['YANG ANDA LAKUKAN', 'Anda TIDAK mengomentari. TIDAK membela sekolah. TIDAK berjanji apa pun. Anda hanya bertanya: \u201cKategori mana paling banyak? Kenapa menurut kalian?\u201d'],
  ['YANG TIDAK ANDA LAKUKAN', 'Anda TIDAK menindaklanjuti isian sensitif. Butir 4 & 6 HANYA dibaca Guru BK \u2014 koordinator sudah memberi BK akses ke Sheet. BK menerima rekap di akhir Hari 1 dan menghubungi murid yang mencentang butir 6. Anda cukup memastikan murid TAHU bahwa jalur itu ada.'],
  ['JIKA INTERNET MATI', 'Cadangan: KERTAS LIPAT ANONIM. Murid menulis, MELIPAT, masukkan ke satu kotak tertutup. ANDA TIDAK MEMBACANYA DI DEPAN KELAS. Kotak diserahkan TERSEGEL ke Guru BK hari itu juga. Sesi pengelompokan diganti diskusi terbuka tanpa membacakan isi kertas.'],
], { size: 18 }));
push(BOX('KALIMAT BAKU \u2014 ucapkan persis seperti ini sebelum sesi', [
  '\u201cFormulir ini ANONIM. Saya tidak tahu siapa menulis apa, dan saya memang tidak ingin tahu.',
  'Ada satu kotak di bawah: \u2018Saya ingin berbicara dengan Guru BK.\u2019 Kalau kalian mencentangnya, hanya Guru BK yang melihatnya \u2014 bukan saya. Kalian boleh menulis nama, boleh juga tidak.',
  'Kalau ada sesuatu yang berat, kalian tidak sendirian. Guru BK ada, dan beliau akan menghubungi kalian.\u201d',
], GOLD, 'BF8F00'));

push(PB());
push(SPACER());
push(H2('B. Ceklis Kesiapan H-3 (selesai paling lambat Minggu, 12 Juli 2026)'));
push(TBL([600, 6000, 3038], ['✓', 'Item', 'Penanggung Jawab'], [
  [' ', 'SK Tim Kokurikuler Sakola Waluya terbit', 'Kepala Sekolah'],
  [' ', 'Pembagian Zona Aksi per kelas ditetapkan (pastikan kelima zona terisi)', 'Koordinator'],
  [' ', 'LK “Jurnal Waluya” digandakan — 1 eksemplar per murid', 'Koordinator + TU'],
  [' ', 'Slide 1 halaman “Skor Rapor SMKN 2 Cimahi” dicetak/ditayangkan (angka ada di Bagian Lampiran panduan ini)', 'Koordinator'],
  [' ', 'Data sanitasi & sarpras dari Wakasek Sarpras dikumpulkan (jumlah toilet, wastafel, kondisi air)', 'Wakasek Sarpras'],
  [' ', 'Data MBG (menu, jumlah porsi, sisa makanan) diminta ke PJ MBG/SPPG', 'Koordinator'],
  [' ', 'GOOGLE FORM \u201cSUARA WALUYA\u201d dibuat (1 tautan + 1 QR untuk SELURUH kelas XI). Setelan: \u201ckumpulkan email\u201d MATI. Akses Sheet diberikan ke Guru BK.', 'Tim ICT + Koordinator'],
  [' ', 'PAPAN KARTU disiapkan: 6 SLOT + 6 KARTU TIM (warna berbeda) per kelas (kartu = pita/tali + kartu warna; boleh dari kardus). GURU TIDAK MENANDATANGANI APA PUN.', 'Koordinator'],
  [' ', 'KOTAK P3K per kelas + daftar nomor darurat (UKS, Satpam, Kepsek, Koordinator)', 'Koordinator + UKS'],
  [' ', 'ALAT TANGAN disiapkan per kelas: gunting, cutter, gergaji tangan kecil, obeng, tang, lem, double tape, cable ties, meteran, amplas. TIDAK ADA alat bermesin.', 'Koordinator + Tim Logistik'],
  [' ', 'Kaprog diberi tahu: TIDAK membuka bengkel; hanya (a) menerima gambar kerja setelah kegiatan, (b) datang 60\u201390 menit sebagai penilai teknis di Gelar Karya Hari 5.', 'Koordinator'],
  [' ', 'Guru BK diberi tahu: TIDAK berkeliling; menerima rekap Google Form di akhir Hari 1 dan menindaklanjuti murid yang mencentang \u201cingin bicara dengan BK\u201d.', 'Koordinator'],
  [' ', 'IZIN TITIK AKSI Hari 5 dari Wakasek Sarpras (lokasi mana boleh dipasangi/diperbaiki)', 'Koordinator'],
  [' ', 'Anggaran bahan disetujui (usulan Rp 200.000 \u2013 Rp 400.000 per kelas dari BOS, mata anggaran kokurikuler \u2014 lebih hemat karena tanpa bahan bengkel; utamakan barang bekas)', 'Kepala Sekolah + Bendahara'],
  
  [' ', 'Akun IG/YouTube sekolah siap menerima konten murid Hari 5', 'Tim ICT'],
  [' ', 'Briefing seluruh WALI KELAS (60 menit) \u2014 Aturan Emas, Struktur Peran Murid, Pos Fasilitator, Protokol Suara Waluya', 'Koordinator'],
  [' ', 'Perlengkapan: spidol besar, kertas plano/karton (3 lembar/kelas), lakban kertas, sarung tangan, masker, stopwatch, stiker titik warna, kardus bekas', 'Koordinator + TU'],
], { size: 19, headFill: NAVY }));

push(SPACER());
push(H2('C. Dari Mana Guru Mengambil Bahan'));
push(TBL([2900, 6738], ['Kebutuhan', 'Sumber'], [
  ['Angka Rapor Pendidikan SMKN 2 Cimahi', 'Sudah tersedia di sekolah: berkas “RAPOR-PBD-SMK-NEGERI-2-CIMAHI-20238571-DATA-2025.xlsx”. Ringkasan angka pentingnya juga sudah disalin ke LAMPIRAN A panduan ini — Anda tidak perlu membuka berkasnya. Sumber asli: raporpendidikan.kemdikbud.go.id (login akun belajar.id).'],
  ['Materi & media 7 Kebiasaan Anak Indonesia Hebat', 'cerdasberkarakter.kemendikdasmen.go.id/gerakan7kebiasaan/ — berisi poster, jingle, senam, dan panduan unduhan gratis. Gunakan untuk Apel Pagi & Pemantik.'],
  ['Panduan Kokurikuler 2025 (BSKAP)', 'Berkas ada di folder sekolah: “Panduan Ko Kurikuler 2025.pdf”.'],
  ['Panduan Implementasi Pancawaluya SMK', 'Berkas ada di folder sekolah: “PANDUAN IMPLEMENTASI PANCAWALUYA JENJANG SMK.pdf” + bahan tayang IHT 2026.'],
  ['Unggah bukti & Narasi Perubahan', 'SIPALAWA — sipalawa.jabarprov.go.id'],
  ['Data sanitasi, toilet, wastafel, air', 'Wakasek Sarpras & Petugas Kebersihan (Caraka). Minta langsung, jangan menebak.'],
  ['Data MBG (menu, porsi, sisa makanan)', 'Penanggung jawab MBG sekolah / SPPG mitra.'],
  ['Alat & bahan', 'BUKAN dari bengkel. Alat tangan disiapkan koordinator per kelas. Bahan: utamakan KARDUS & BARANG BEKAS (sejalan dengan SE Gubernur Jabar Langkah ke-3: kegiatan berbasis inovasi & pengelolaan sampah mandiri). Untuk Kimia Industri: kubis ungu/kunyit dari pasar, kertas pH strip, sisa kulit buah dari MBG.'],
  ['Simulasi rangkaian (Mekatronika)', 'Tinkercad Circuits (tinkercad.com) atau Wokwi (wokwi.com) \u2014 keduanya GRATIS, berbasis web, tidak perlu instal apa pun. Cukup HP atau laptop.'],
  ['Google Form \u201cSuara Waluya\u201d', 'Sudah dibuat Tim ICT. Anda cukup meminta QR + tautan Sheet-nya ke koordinator. Tidak ada yang perlu Anda atur.'],
], { size: 19 }));

push(PB());

// ============ RITUAL PAGI ============
push(R2.babParalel());

push(H1('BAGIAN 1 — RITUAL PAGI (06.30 – 07.30, SETIAP HARI)'));
push(P('Bagian ini sama setiap hari. Jangan diremehkan: inilah yang secara langsung menggarap 4 dari 7 kebiasaan yang skornya KURANG di rapor (Bangun Pagi, Beribadah, Makan Sehat, Bermasyarakat).'));

SESI('APEL PENGONDISIAN', '06.30 – 06.45 (15 menit) · Lapangan · Dipimpin bergilir',
  'Menyalakan hari. Menyatukan energi. Menanamkan kebiasaan Bangun Pagi & Beribadah.',
  [
    ["3'", 'Barisan & presensi cepat per kelas oleh wali kelas. TIDAK ada ceramah panjang dari panggung.'],
    ["2'", 'Doa bersama dipimpin murid (bergilir tiap hari, ditunjuk sehari sebelumnya).'],
    ["3'", 'MENYANYIKAN LAGU / SENAM 7 KEBIASAAN ANAK INDONESIA HEBAT (unduh dari cerdasberkarakter.kemendikdasmen.go.id/gerakan7kebiasaan/). Semua guru IKUT, tidak berdiri menonton di pinggir — inilah "Modeling" dalam model internalisasi nilai Pancawaluya.'],
    ["5'", '“SUARA WALUYA” — SATU murid (bergilir, ditunjuk sehari sebelumnya) berbicara maksimal 2 menit di depan tentang nilai hari itu. Bukan guru. Kalau murid gugup, biarkan. Itu bagian dari belajar. Guru cukup menutup dengan 1 kalimat.'],
    ["2'", 'Kepala Sekolah / Koordinator mengumumkan agenda hari itu dalam MAKSIMAL 60 DETIK, lalu membubarkan barisan.'],
  ],
  'Pengeras suara; berkas lagu/senam 7 KAIH (unduh dari situs Cerdas Berkarakter); daftar giliran petugas (dibuat koordinator, ditempel di papan pengumuman).',
  'Kalau hujan → apel dipindah ke aula/koridor, format tetap sama, durasi tetap 15 menit. Jangan dibatalkan; konsistensi adalah inti pembiasaan.');

SESI('MBG BERSAMA + “NGARIUNG”', '06.45 – 07.30 (45 menit) · Di kelas masing-masing',
  'Bukan sekadar makan. Ini adalah kebiasaan Makan Sehat & Bergizi (D.19.4 = 6,44 KURANG) + Bermasyarakat (D.19.6 = 6,41 KURANG) yang dilatih setiap hari.',
  [
    ["3'", 'Cuci tangan bersama sebelum makan (kalau wastafel bermasalah — CATAT ITU. Itu data untuk Zona Z1!). Doa makan dipimpin murid.'],
    ["25'", 'Makan bersama. GURU IKUT MAKAN BERSAMA MURID DI KELAS, duduk membaur, bukan di meja guru. Ini bukan pengawasan, ini kebersamaan.'],
    ["7'", 'Bereskan bersama. Sampah dipilah (organik / anorganik). Tim piket menimbang atau memperkirakan SISA MAKANAN kelas hari itu dan menuliskannya di papan tulis. Angka ini dicatat setiap hari — jadi data lima hari untuk Zona Z2.'],
    ["10'", 'NGARIUNG — obrolan melingkar 10 menit. Guru melempar SATU pertanyaan, lalu diam. Biarkan murid yang bicara. Pertanyaan berbeda tiap hari (lihat tabel di bawah).'],
  ],
  'Paket MBG dari SPPG; timbangan dapur sederhana (opsional, boleh perkiraan); tempat sampah terpilah; papan tulis untuk mencatat angka sisa makanan.',
  'Kalau murid diam saat Ngariung: guru menjawab pertanyaannya sendiri LEBIH DULU, dengan jujur dan personal. Kejujuran guru membuka kejujuran murid. Jangan menunjuk murid secara paksa.');

push(H3('Pertanyaan “Ngariung” — satu per hari'));
push(TBL([1600, 8038], ['Hari', 'Pertanyaan yang dilempar guru (lalu DIAM, biarkan murid bicara)'], [
  ['Hari 1 (Rabu)', '“Jam berapa kalian tidur semalam? Jujur saja. Dan jam berapa sebenarnya kalian INGIN tidur?”'],
  ['Hari 2 (Kamis)', '“Kalau kalian jadi kepala sekolah selama satu hari, satu hal apa yang PALING PERTAMA kalian perbaiki di sekolah ini?”'],
  ['Hari 3 (Jumat)', '“Siapa orang di sekolah ini yang kerjanya paling tidak kelihatan, tapi paling kita butuhkan?”'],
  ['Hari 4 (Senin)', '“Kapan terakhir kali kalian merasa BANGGA pada sesuatu yang kalian bikin sendiri?”'],
  ['Hari 5 (Selasa)', '“Kalau adik kelas kalian tahun depan datang ke sekolah ini, apa yang kalian ingin mereka temukan sudah berubah?”'],
], { size: 19 }));

push(PB());

// ============ HARI 1 ============
push(H1('HARI 1 — RABU, 15 JULI 2026'));
push(TBL([9638], null, [['CAGEUR · Waluya Raga · “KENALI DIRI”']], { headFill: '2E7D32', zebra: false, size: 24 }));
push(P('Hasil akhir hari ini: setiap murid punya potret jujur tentang 7 kebiasaannya sendiri, dan setiap kelas tahu di mana posisinya dibanding data rapor sekolah.', { italics: true, spaceBefore: 80, spaceAfter: 120 }));

SESI('PEMANTIK — “Berapa Skor Kamu?”', '07.30 – 07.45 (15 menit)',
  'Membuka hari dengan kejutan, bukan pengumuman.',
  [
    ["2'", 'Guru menulis SATU angka besar di papan tulis: 5,50 — lalu diam. Tidak menjelaskan apa-apa. Biarkan murid bertanya-tanya.'],
    ["5'", 'Guru bertanya: “Menurut kalian, ini angka apa?” Tampung semua tebakan. Jangan dikoreksi.'],
    ["5'", 'Guru buka: “Ini adalah skor GEMAR BELAJAR seluruh murid SMKN 2 Cimahi menurut Rapor Pendidikan 2025. Dari skala 10. Dan itu skor TERENDAH dari tujuh kebiasaan.” Lalu tampilkan slide 1 halaman berisi ketujuh skor (lihat LAMPIRAN A).'],
    ["3'", 'Guru bertanya, lalu diam: “Kalian setuju atau tidak dengan angka itu?” Cukup. Jangan dibahas. Biarkan menggantung.'],
  ],
  'Papan tulis + spidol; slide/cetakan 1 halaman berisi tabel skor D.19 (ada di LAMPIRAN A panduan ini).',
  'Kalau murid tidak bereaksi sama sekali: bertanya, “Berapa jam kalian belajar KEMARIN, di luar jam sekolah? Angkat tangan kalau lebih dari 1 jam.” Realitas biasanya langsung menampar.');

SESI('SESI 1 — “Barometer Kebiasaan” & Radar Diriku', '07.45 – 09.15 (90 menit / 2 JP)',
  'Murid membuat potret jujur 7 kebiasaannya sendiri, lalu melihat wajah kolektif kelasnya. (TP-1)',
  [
    ["5'", 'Bagikan LK. Kalimat pembuka guru — ucapkan persis seperti ini: “Hari ini tidak ada jawaban benar atau salah. Yang saya nilai cuma satu: kejujuran kalian. Kalau kalian bohong hari ini, lima hari ke depan jadi sia-sia.”'],
    ["25'", 'BAROMETER KEBIASAAN (murid BERDIRI & BERPINDAH). Guru bacakan 7 pernyataan satu per satu. Murid pindah posisi: sisi KIRI kelas = “Ini aku banget”, TENGAH = “Kadang-kadang”, KANAN = “Jauh dari aku”. Setelah tiap pernyataan, tunjuk 1–2 murid secara acak: “Kenapa kamu berdiri di situ?” — dengarkan, ucapkan “terima kasih”, JANGAN dikomentari, JANGAN dinasihati. (Daftar 7 pernyataan ada di LAMPIRAN B.)'],
    ["20'", 'Murid duduk, mengisi LK-1 Bagian A: memberi skor diri 1–10 untuk setiap kebiasaan, lalu MENGGAMBAR SENDIRI Radar Kebiasaan (jaring laba-laba 7 sumbu). Guru berkeliling, tidak bicara, hanya mengamati.'],
    ["25'", 'DATA KELAS (ini latihan NUMERASI). Tunjuk 7 murid sebagai “pencatat”, masing-masing memegang 1 kebiasaan. Seluruh kelas menyebut skornya. Pencatat menuliskan di papan, lalu MENGHITUNG RATA-RATA kelas. Tulis hasilnya di sebelah angka rapor sekolah. Guru bertanya: “Kelas kita di atas atau di bawah sekolah? Kenapa bisa begitu?”'],
    ["15'", 'DISKUSI 4–2–1. Berempat: bandingkan radar masing-masing → pilih 2 kebiasaan yang paling bermasalah di kelompok → sepakati 1 yang paling ingin diperbaiki bersama. Tulis di LK-1 Bagian B.'],
  ],
  'LK “Jurnal Waluya” (LK-1); spidol; papan tulis; kalkulator/HP untuk menghitung rata-rata; LAMPIRAN B (7 pernyataan barometer).',
  'Kalau kelas pasif saat Barometer: GURU YANG BERDIRI DULUAN, dan jujur tentang kebiasaannya sendiri (“Saya berdiri di kanan untuk Berolahraga, karena saya memang jarang olahraga.”) Keterbukaan guru adalah kunci pembuka.');

SESI('SESI 2 — “SUARA WALUYA”: Aman Nggak Sih Sekolah Ini?', '09.30 – 11.00 (90 menit / 2 JP)',
  'Menggali wellbeing & rasa aman murid secara anonim lewat Google Form. Menyasar D.4.1 (59,30) & D.4.10 (70%). Anda tidak menangani apa pun sendirian — ada jalur langsung ke Guru BK.',
  [
    ["5'", 'Ucapkan KALIMAT BAKU (lihat Bagian 0.D). Persis seperti tertulis. Jangan diimprovisasi — ini soal keselamatan psikologis murid.'],
    ["3'", 'Tayangkan QR CODE “SUARA WALUYA” di layar (minta ke koordinator; sudah jadi, Anda tidak perlu mengatur apa pun). Murid memindai dengan HP.'],
    ["12'", 'MURID MENGISI FORM lewat HP masing-masing. ANONIM. Anda duduk, tidak berkeliling melihat layar murid — itu merusak rasa aman. Kalau ada murid tanpa HP, pinjamkan HP Anda setelah semua selesai, atau sediakan kertas lipat anonim.'],
    ["25'", 'Anda BUKA GOOGLE SHEET dan TAYANGKAN hasil KELAS ANDA di layar (filter kolom “Kelas”). Murid melihat jawaban teman-temannya muncul tanpa nama. Beri waktu membaca dalam diam. Jangan berkomentar.'],
    ["30'", 'MENGELOMPOKKAN (murid BERGERAK ke papan tulis). Murid — bukan Anda — maju, menyalin kata kunci jawaban ke papan, mengelompokkan yang mirip, memberi judul kategori, lalu MENGHITUNG jumlah tiap kategori (ini latihan numerasi). Salin ke LK-1C.'],
    ["10'", 'VOTING KAKI. Murid berdiri di depan kategori yang menurutnya PALING MENDESAK. Anda hanya bertanya: “Kategori mana paling banyak? Kenapa menurut kalian?” JANGAN membela sekolah. JANGAN berjanji apa pun. Dengarkan.'],
    ["5'", 'Tutup: “Minggu ini kita tidak akan menyelesaikan semuanya. Tapi SATU dari ini akan benar-benar kita kerjakan.”'],
  ],
  'QR code “Suara Waluya” (dari koordinator) · proyektor/layar · akses Google Sheet · HP murid · papan tulis & spidol. CADANGAN jika internet mati: kertas kecil + kotak tertutup (lihat Bagian 0.D).',
  'ADA MURID YANG MENULIS SESUATU YANG BERAT DI KOLOM “TIDAK AMAN”? Anda TIDAK menindaklanjutinya, TIDAK mencari tahu siapa, TIDAK membahasnya di kelas. Butir itu sudah otomatis masuk ke Sheet yang dibaca Guru BK di akhir hari. Tugas Anda cukup: pastikan murid tahu kotak “ingin bicara dengan Guru BK” itu ada. Kalau Anda ragu atau khawatir, hubungi Guru BK atau Koordinator hari itu juga — jangan dipendam sendiri.');

SESI('SESI 3 — Pilih Zona, Bentuk PERAN MURID & Bangun Norma Tim', '11.00 – 11.45 (45 menit / 1 JP)',
  'Kelas menetapkan Zona Aksinya, MEMBENTUK STRUKTUR PERAN MURID (ini yang menggantikan guru kedua), dan menyepakati aturan main.',
  [
    ["8'", 'Tempel 5 poster Zona Waluya (cetak A3, ada di folder 04_Gambar). Murid BERJALAN, membaca, lalu berdiri di depan zona pilihannya — voting dengan kaki. Jika suara terpecah: perwakilan berargumen 60 detik, voting ulang. KEPUTUSAN MURID.'],
    ["12'", 'BENTUK 6 TIM (@5–6 murid) + 6 PERAN KELAS. Ucapkan kalimat “Minggu ini saya sendirian…” (lihat Bagian 0.A.1). Lalu bagi peran: KAPTEN TIM (6) · TIM WAKTU (2) · TIM PIKET DATA (2) · TIM K3 (2) · TIM DOKUMENTASI (2) · TIM LOGISTIK (2). Tulis di papan & di LK-1D. BERI WEWENANG TIM K3 DI DEPAN KELAS: “Kalau Tim K3 bilang berhenti, semua berhenti. Termasuk saya.”'],
    ["10'", 'BACAKAN 4 ATURAN JELAJAH (Bagian 0.B). Murid mengulanginya keras-keras. Lalu PASANG PAPAN KARTU di dinding. Tim Piket Data menjelaskan: ambil kartu = berangkat, kembalikan kartu = pulang, slot kosong = tim masih di luar.'],
    ["12'", 'NORMA TIM berdasarkan silih asih–silih asah–silih asuh. Kelas menuliskan 5 aturan main sendiri di kertas plano. Pancingan: “Tidak ada yang jadi penonton.” “Boleh salah, tidak boleh diam.” “Kritik idenya, jangan orangnya.” SEMUA murid MENANDATANGANI. Tempel di dinding sampai akhir semester.'],
    ["3'", 'Tim Logistik & Tim Waktu langsung bertugas: mereka yang membereskan kelas dan mengumumkan waktu habis. Mulai hari ini, bukan Anda.'],
  ],
  '5 poster Zona A3 (folder 05_GAMBAR) · PAPAN KARTU: 6 slot + 6 kartu tim (warna berbeda) (dari koordinator) · kertas plano · spidol besar · lakban kertas.',
  'Kelas memilih zona “gampang” demi cari aman? Tanya satu kalimat: “Kalau ini selesai, apa yang benar-benar BERUBAH di sekolah?” | Murid enggan jadi Tim K3 karena takut menegur teman? Katakan: “Justru itu gunanya. Saya yang memberi kalian wewenang, dan saya yang akan membela kalian kalau ada yang membantah.”');

push(P([new TextRun({ text: '11.45 – 12.00 · REFLEKSI & JURNAL WALUYA. ', bold: true, size: 20, color: NAVY }), new TextRun({ text: 'Murid mengisi Jurnal Waluya Hari 1 (di LK). Guru MEMBACA jurnal itu malam harinya dan menulis SATU kalimat balasan di setiap buku. Bukan nilai. Bukan koreksi. Satu kalimat manusiawi. Ini yang membuat murid merasa dilihat — dan ini menyasar langsung wellbeing (D.4.1 = 59,30).', size: 20 })], { spaceBefore: 100, spaceAfter: 120 }));

push(PB());

// ============ HARI 2 ============
push(H1('HARI 2 — KAMIS, 16 JULI 2026'));
push(TBL([9638], null, [['BENER · Waluya Budhi · “CARI FAKTA”']], { headFill: 'BF8F00', zebra: false, size: 24 }));
push(P('Hasil akhir hari ini: kelas punya DATA nyata (angka, foto, hitungan) tentang masalah di zonanya — bukan opini, bukan katanya.', { italics: true, spaceBefore: 80, spaceAfter: 120 }));

SESI('PEMANTIK — “Katanya vs Buktinya”', '07.30 – 07.45 (15 menit)',
  'Menanamkan nilai BENER: klaim tanpa bukti adalah omong kosong.',
  [
    ["5'", 'Guru menulis di papan: “Toilet sekolah kita kotor.” Lalu bertanya: “Ini FAKTA atau OPINI?” Biarkan murid berdebat.'],
    ["5'", 'Guru mendorong: “Bagaimana caranya ini jadi FAKTA?” Pancing sampai murid sendiri menyebut: dihitung, diukur, difoto, ditanya ke orangnya.'],
    ["5'", 'Guru menutup dengan aturan hari ini: “Hari ini, setiap kalimat yang kalian tulis di LK harus punya BUKTI. Kalau tidak ada buktinya, coret.”'],
  ],
  'Papan tulis.',
  'Kalau murid langsung setuju bahwa itu fakta: tanya, “Kotor menurut siapa? Seberapa kotor? Dibanding apa?” Ini melatih penalaran kritis (A.3.4 = 56,75, nyaris stagnan).');

SESI('SESI 1 — TURUN LAPANGAN: Berburu Data (SISTEM POS)', '07.45 – 09.15 (90 menit / 2 JP)',
  'Murid mengumpulkan data kuantitatif nyata. (TP-2) Latihan NUMERASI kontekstual — 4,44% murid kita kini “jauh di bawah kompetensi”.',
  [
    ["10'", 'SIAPKAN POS. Anda menetap di POS FASILITATOR sepanjang sesi ini (ruang kelas, atau meja yang Anda pindahkan ke tengah zona). Tim Piket Data memasang Papan Kartu. Tim K3 memeriksa APD tiap tim (sarung tangan & masker untuk area kotor).'],
    ["5'", 'TIM AMBIL KARTUNYA dari Papan Kartu. Tim Piket mencatat. ANDA TIDAK MENANDATANGANI APA PUN. Bacakan ulang Aturan Jelajah nomor 1 dan 5.'],
    ["55'", 'TIM TURUN LAPANGAN. ANDA TETAP DI POS — JANGAN ikut satu tim, karena 5 tim lain akan tanpa pengawasan. Kapten Tim melapor tiap 20 menit (datang ke Pos atau kirim WA grup kelas). Tim Piket Data menjaga PAPAN KARTU (slot kosong = tim masih di luar). Anda boleh berkeliling maksimal 5 menit, hanya ke lokasi yang MASIH TERLIHAT dari Pos.'],
    ["20'", 'Semua tim kembali (Tim Waktu membunyikan tanda). Setiap tim WAJIB membawa: (a) 10 baris data angka, (b) 5 foto, (c) 1 hal yang mengejutkan mereka. Tulis di LK-2A apa adanya — BELUM dianalisis. Panduan data per zona: LAMPIRAN D.'],
  ],
  'Template Digital Tim (Google Sheet) · PAPAN KARTU · HP · meteran · stopwatch · sarung tangan & masker · papan jalan · kotak P3K · nomor darurat. Data Sarpras & MBG sudah di tangan koordinator.',
  'Tim pulang tangan kosong (“Nggak ada apa-apa, Pak”)? Kirim balik dengan tugas SANGAT spesifik: “Hitung berapa detik air mengisi 1 gelas. Di 5 keran berbeda. Kembali dengan angka.” | ADA TIM YANG TELAT KEMBALI? Tahan kartunya. Tim itu tidak turun lapangan lagi hari ini — datanya dilanjutkan dari kelas. Jalankan konsekuensinya, atau sistem Pos akan runtuh besok.');

SESI('SESI 2 — Data Jadi Cerita', '09.30 – 11.00 (90 menit / 2 JP)',
  'Mengubah angka mentah menjadi grafik dan makna. Ini menggarap Numerasi + Literasi L3 (mengevaluasi & merefleksi — turun 5,62).',
  [
    ["25'", 'Setiap tim mengolah datanya: hitung total, rata-rata, dan persentase. Lalu MENGGAMBAR SATU GRAFIK di kertas plano (batang / lingkaran / garis — tim yang pilih). Digambar tangan, bukan dicetak. Guru berkeliling dan HANYA bertanya: “Angka ini artinya apa?”'],
    ["20'", 'GALERI DATA (murid BERJALAN). Semua plano ditempel di dinding. Murid berkeliling melihat plano tim lain, menempelkan kertas tempel (sticky note) berisi 1 pertanyaan atau 1 temuan yang mengejutkan mereka. (Catatan: ini kertas tempel BIASA untuk komentar antartim \u2014 bukan sesi anonim sensitif. Sesi sensitif Hari 1 tetap memakai Google Form.)'],
    ["30'", 'POHON AKAR MASALAH. Setiap tim menggambar pohon di LK-2 Bagian B: BUAH = akibat yang terlihat · BATANG = masalahnya · AKAR = penyebab sebenarnya. Guru menantang dengan teknik “5x KENAPA”: “Toiletnya bau.” → Kenapa? → “Airnya nggak jalan.” → Kenapa? → “Kerannya rusak.” → Kenapa? → “Nggak ada yang lapor.” → Kenapa? → “Nggak tahu lapor ke mana.” → NAH ITU AKARNYA. Dan itu bisa dikerjakan RPL.'],
    ["15'", 'Setiap tim menuliskan SATU kalimat rumusan masalah di LK: “Masalah sebenarnya adalah ______, karena ______, dibuktikan dengan data ______.”'],
  ],
  'Kertas plano (1 per tim); spidol warna; sticky note; kalkulator/HP; LK-2.',
  'Kalau tim berhenti di akar yang dangkal (“karena murid malas”): tolak dengan halus — “Itu menyalahkan orang, bukan menemukan akar. Kalau muridnya malas, KENAPA malas? Sistem apa yang bikin dia malas?” Akar yang baik selalu bisa dikerjakan, bukan sekadar disalahkan.');

SESI('SESI 3 — Konsolidasi Temuan Kelas', '11.00 – 11.45 (45 menit / 1 JP)',
  'Menggabungkan temuan semua tim menjadi satu potret kelas.',
  [
    ["20'", 'Setiap tim presentasi KILAT: 2 menit, wajib menyebut 1 angka & 1 akar masalah. Tim lain memberi 1 pertanyaan.'],
    ["15'", 'Kelas menyusun DAFTAR MASALAH: semua akar masalah dari semua tim ditulis di papan (biasanya 5–8 masalah).'],
    ["10'", 'Guru menutup: “Besok kita tidak menambah data. Besok kita akan MENDENGARKAN orang. Karena data belum tentu tahu rasanya.”'],
  ],
  'Papan tulis; hasil plano tim.',
  'Kalau waktu habis: presentasi kilat boleh dipangkas jadi 1 menit per tim. Yang penting DAFTAR MASALAH kelas jadi hari ini — itu bahan wajib untuk Hari 3.');

push(PB());

// ============ HARI 3 ============
push(H1('HARI 3 — JUMAT, 17 JULI 2026 (SELESAI 11.00)'));
push(TBL([9638], null, [['BAGEUR · Waluya Rasa · “RASAKAN & PILIH”']], { headFill: 'AD1457', zebra: false, size: 24 }));
push(P('Hasil akhir hari ini: kelas memilih SATU masalah prioritas — bukan berdasarkan angka saja, tapi berdasarkan siapa yang paling terdampak.', { italics: true, spaceBefore: 80, spaceAfter: 120 }));
push(BOX('Perhatikan waktu', ['Hari ini hanya 4 JP. Sesi 3 ditiadakan. Kegiatan berakhir 11.00, dilanjutkan Shalat Jumat. Jangan memaksakan menyelesaikan produksi hari ini — itu jatah Hari 4.'], ROSE, 'AD1457'));

SESI('PEMANTIK — “Siapa yang Paling Merasakan?”', '07.30 – 07.45 (15 menit)',
  'Memindahkan fokus dari MASALAH ke MANUSIA. Ini inti nilai BAGEUR.',
  [
    ["5'", 'Guru bertanya, lalu diam lama: “Dari semua masalah yang kalian temukan kemarin — SIAPA yang paling menderita karenanya? Sebut orangnya, bukan kelompoknya.”'],
    ["7'", 'Tampung jawaban. Dorong sampai murid menyebut orang konkret: adik kelas X yang baru masuk, murid perempuan yang butuh toilet bersih, Pak Caraka yang membersihkan tiap hari, ibu kantin, satpam, murid yang punya penyakit tertentu.'],
    ["3'", 'Guru menutup: “Hari ini kita tidak mengukur apa-apa. Hari ini kita MENDENGARKAN mereka.”'],
  ],
  'Papan tulis; daftar masalah kelas dari Hari 2.',
  'Kalau murid menjawab “semua orang”: tolak. “Semua orang artinya tidak ada orang. Sebut SATU nama atau SATU peran.”');

SESI('SESI 1 — TURUN LAPANGAN: Wawancara Empati', '07.45 – 09.15 (90 menit / 2 JP)',
  'Murid mewawancarai warga sekolah nyata. (TP-3) Menyasar Gotong Royong (54,70 — TURUN) & Bermasyarakat (6,41 — KURANG).',
  [
    ["15'", 'Latihan bertanya. Guru mendemonstrasikan pertanyaan BURUK vs BAIK: BURUK = “Toiletnya kotor ya, Pak?” (menggiring jawaban). BAIK = “Bapak, boleh cerita, bagian mana dari pekerjaan Bapak yang paling melelahkan?” (membuka cerita). Murid berlatih berpasangan 5 menit. Aturan wawancara: TANYA – DENGAR – JANGAN MEMOTONG – TANYA LAGI “kenapa”.'],
    ["55'", 'SISTEM POS BERLAKU LAGI. Anda MENETAP di Pos. Tim ambil kartunya seperti biasa. Tim mewawancarai minimal 3 orang: Petugas Kebersihan (Caraka) · Satpam · Ibu/Bapak Kantin · murid kelas X · petugas MBG · OSIS. Setiap tim WAJIB pulang membawa 3 KUTIPAN LANGSUNG (kalimat PERSIS, dalam tanda kutip) + nama & peran narasumber. Lapor balik tiap 20 menit.'],
    ["5'", 'KHUSUS KELAS ZONA Z5 (Sakola Aman): murid TIDAK BOLEH mewawancarai korban perundungan atau menanyakan pengalaman pribadi yang menyakitkan. Yang boleh ditanya hanya PENGETAHUAN tentang sistem: “Kalau ada yang dirundung, dia harus lapor ke mana?” “Apakah kamu tahu kanal pelaporannya?” Karya kelas ini diarahkan ke SISTEM (kanal lapor, papan informasi, kampanye) — bukan ke kasus.'],
    ["15'", 'Kembali ke kelas. Tulis kutipan di LK-3 Bagian A.'],
  ],
  'LK-3; alat tulis; HP (rekam suara — WAJIB minta izin dulu). Koordinator sudah memberi tahu Caraka, Satpam, dan pihak kantin sehari sebelumnya bahwa mereka akan diwawancarai — jangan sampai mereka kaget dan merasa diintervensi.',
  'Kalau narasumber menolak atau sibuk: jangan dipaksa. Ganti narasumber. Ajarkan murid mengucapkan terima kasih meski ditolak — itu juga BAGEUR.');

SESI('SESI 2 — Peta Empati & Voting Masalah Prioritas', '09.30 – 10.30 (60 menit / 1,5 JP)',
  'Menggabungkan data (Hari 2) dan suara manusia (hari ini) menjadi SATU keputusan.',
  [
    ["20'", 'PETA EMPATI (LK-3 Bagian B). Setiap tim menggambar 4 kuadran untuk narasumber utamanya: APA YANG DIA KATAKAN · APA YANG DIA LAKUKAN · APA YANG DIA PIKIRKAN · APA YANG DIA RASAKAN. Isi berdasarkan kutipan & pengamatan nyata, bukan tebakan.'],
    ["20'", 'MATRIKS PRIORITAS (LK-3 Bagian C). Semua masalah kelas dipetakan pada 2 sumbu: DAMPAK (seberapa banyak orang terbantu bila selesai) × BISA KAMI KERJAKAN (dengan keahlian & waktu yang kami punya, dalam 2 hari). Yang masuk kuadran kanan-atas = kandidat.'],
    ["15'", 'VOTING TERBUKA (murid BERDIRI). Setiap murid mendapat 3 titik/stiker, menempelkannya pada masalah pilihannya (boleh menumpuk). Yang terbanyak MENANG. Keputusan MURID.'],
    ["5'", 'Tulis di kertas plano besar, tempel di dinding kelas: “MASALAH KAMI: ______. ORANG YANG KAMI BANTU: ______. TARGET KAMI SELESAI SELASA 21 JULI: ______.”'],
  ],
  'LK-3; stiker/titik warna (3 per murid, boleh pakai spidol); kertas plano; daftar masalah dari Hari 2.',
  'Kalau kelas memilih masalah yang MUSTAHIL dikerjakan dalam 2 hari (mis. “renovasi seluruh toilet”): jangan larang. Tanya: “Bagian MANA dari itu yang bisa benar-benar selesai hari Selasa?” Persempit sampai realistis. Lebih baik satu wastafel benar-benar berfungsi daripada sepuluh gambar rencana.');

push(P([new TextRun({ text: '10.30 – 11.00 · JUMAT BERKAH + REFLEKSI & JURNAL. ', bold: true, size: 20, color: NAVY }), new TextRun({ text: 'Kegiatan keagamaan singkat (dipisah putra/putri sesuai kebijakan sekolah): tausiyah 10 menit oleh guru PAI/murid tentang “menolong yang tidak terlihat”, dilanjutkan aksi berbagi sederhana — misalnya murid menyerahkan hasil temuan dan ucapan terima kasih tertulis kepada Caraka/Satpam/Ibu Kantin yang mereka wawancarai. Ini memenuhi ketentuan Panduan Kokurikuler 2025 bahwa mitra harus mendapatkan umpan balik/manfaat. Lalu murid mengisi Jurnal Waluya Hari 3. Murid dilepas pukul 11.00 untuk Shalat Jumat.', size: 20 })], { spaceBefore: 100, spaceAfter: 120 }));

push(PB());

// ============ HARI 4 ============
push(H1('HARI 4 — SENIN, 20 JULI 2026'));
push(TBL([9638], null, [['PINTER · Waluya Hirup · “RANCANG & BUAT”']], { headFill: '1F3864', zebra: false, size: 24 }));
push(P('Hasil akhir hari ini: purwarupa versi 1 sudah ada wujudnya (walau jelek), dan draf kampanye digital sudah jadi. HARI TERSIBUK.', { italics: true, spaceBefore: 80, spaceAfter: 120 }));
push(BOX('Prinsip Hari 4: “JELEK DULUAN, BAGUS BELAKANGAN.”', [
  'Jangan biarkan murid menghabiskan 3 jam merancang di kertas. Target: dalam 90 menit pertama sudah ada BENDA/LAYAR/GAMBAR yang bisa disentuh, walaupun jelek. Purwarupa jelek yang bisa diuji jauh lebih berharga daripada rancangan indah yang tidak pernah dibuat.',
  'Inilah cara paling langsung menaikkan Kreativitas (A.3.3 = 54,31, TERENDAH).',
], GRN, GRNA));

SESI('PEMANTIK — “Bikin dalam 5 Menit”', '07.30 – 07.45 (15 menit)',
  'Mematahkan rasa takut memulai.',
  [
    ["3'", 'Guru membagikan kertas HVS, gunting, lakban ke setiap tim. Perintah: “Kalian punya 5 menit. Buat SESUATU yang bisa menyelesaikan masalah kalian. Boleh jelek. Boleh konyol. Yang penting ADA WUJUDNYA.”'],
    ["5'", 'Tim bekerja. Guru menghitung mundur dengan keras. Tekanan waktu adalah bagian dari latihan (Pancawaluya menyebutnya melatih ketahanan menghadapi “deadline industri”).'],
    ["7'", 'Setiap tim mengangkat karyanya 30 detik. Tidak ada penilaian. Guru menutup: “Nah. Kalian baru saja membuat sesuatu dalam 5 menit. Bayangkan kalau punya 3 jam.”'],
  ],
  'Kertas HVS bekas, gunting, lakban kertas, spidol.',
  'Kalau tim membeku dan tidak membuat apa-apa: itu bukan masalah. Katakan, “Berarti pertanyaannya belum jelas. Ayo kita perjelas dulu.” Lalu bantu mereka menajamkan rumusan masalah.');

SESI('SESI 1 — Ideasi & Rancangan Teknis', '07.45 – 09.15 (90 menit / 2 JP)',
  'Melahirkan banyak ide, lalu memilih satu yang BISA dikerjakan dengan alat tangan & perangkat digital. (TP-4)',
  [
    ["20'", 'BADAI IDE 6-3-5 (SENYAP, CEPAT). 6 orang per meja. Tiap orang menulis 3 IDE dalam 5 MENIT di LK-4A, lalu MENGGESER lembarnya ke kanan. Penerima MENGEMBANGKAN ide yang ada — bukan mengkritik. 3 putaran. Hasil: puluhan ide dalam 15 menit, tanpa ada yang mendominasi bicara.'],
    ["8'", 'TAYANGKAN BATASAN ALAT (Bagian 0.C). Jelaskan sejujurnya: “Kita tidak masuk bengkel minggu ini. Tidak ada mesin, tidak ada las, tidak ada bahan kimia berbahaya. Semua dikerjakan di kelas ini, dengan tangan kalian dan HP/laptop kalian.” Lalu tantang: “Justru itu tantangannya — bisa tidak kalian bikin sesuatu yang BENAR-BENAR DIPAKAI, hanya dengan kardus dan otak kalian?”'],
    ["12'", 'Tim memilih 1 ide dengan 4 SYARAT: (a) MEMAKAI kompetensi keahlian kelas kami · (b) BISA dikerjakan TANPA mesin & TANPA bahan berbahaya · (c) SELESAI dalam 2 hari · (d) benar-benar MENOLONG orang yang kami wawancarai kemarin. Tidak lolos keempatnya? BUANG.'],
    ["30'", 'RANCANGAN TEKNIS (LK-4B) sesuai jurusan. Mekatronika: diagram blok + daftar komponen + tautan simulasi Tinkercad/Wokwi. RPL: user flow + sketsa 3 layar. DKV: sketsa layout + palet + ukuran cetak + titik pasang. Animasi: storyboard 6 panel + naskah 30 detik. Kimia Industri: prosedur uji / resep eco-enzyme + LEMBAR K3. Pemesinan: GAMBAR KERJA + UKURAN + daftar bahan (kardus/PVC/kayu ringan) + titik pasang.'],
    ["20'", 'DAFTAR BAHAN. Tim menuliskan kebutuhannya, lalu MENGAMBILNYA SENDIRI dari kotak bahan kelas (disiapkan Tim Logistik). Utamakan KARDUS & BARANG BEKAS. Kalau ada bahan yang belum ada, MURID sendiri yang menulis permintaan ke koordinator — bukan Anda.'],
  ],
  'LK-4 · kotak alat tangan & bahan bekas per kelas (dari koordinator) · HP/laptop · akses tinkercad.com atau wokwi.com (gratis, tanpa instal).',
  'Semua tim mengusulkan ide yang sama? BAGUS. Minta tiap tim mengerjakan BAGIAN yang berbeda dari solusi yang sama — hasilnya satu karya kelas yang lebih besar dan utuh. | Ada murid protes “kok nggak boleh ke bengkel?” Jawab jujur: “Karena saya sendirian, dan saya tidak mau ada yang celaka di tangan saya. Gambar kerja kalian tetap akan dibuat — Kaprog akan memfabrikasinya setelah kegiatan ini. Yang kalian buat minggu ini adalah purwarupanya, dan purwarupa itu yang akan DIPASANG dan DIUJI.”');

SESI('SESI 2 — PRODUKSI PURWARUPA v1 (DI KELAS, bukan di bengkel)', '09.30 – 11.00 (90 menit / 2 JP)',
  'Mewujudkan. Dengan tangan, kardus, dan layar. “Jelek duluan, bagus belakangan.”',
  [
    ["8'", 'BRIEFING K3 — oleh TIM K3 (murid), bukan oleh Anda. Mereka membacakan Daftar Alat Boleh/Dilarang, membagikan APD, dan mengecek kondisi alat tangan. Anda hanya menegaskan: “Kalau Tim K3 bilang berhenti, semua berhenti. Termasuk saya.”'],
    ["70'", 'TIM BEKERJA DI DALAM KELAS. Meja digeser. Anda BERJALAN, tidak duduk. Tugas Anda hanya TIGA: (1) mengawasi cutter & gergaji tangan bersama Tim K3, (2) bertanya “apa kendalanya?” — bukan “kenapa belum selesai?”, (3) mengisi Catatan Anekdotal (3 catatan cukup). JANGAN MENGERJAKAN KARYA MURID. Sekali Anda memegang gunting “supaya cepat”, kepemilikan murid atas karyanya hilang — dan mereka tidak akan merawatnya.'],
    ["12'", 'Tim Logistik memimpin pembersihan. Alat dikembalikan & dihitung ulang oleh Tim K3 (pastikan tidak ada cutter yang hilang). Kelas tidak bubar sebelum Tim Logistik menyatakan beres.'],
  ],
  'RUANG KELAS (meja digeser). Alat tangan: gunting, cutter, gergaji tangan kecil, obeng, lem, double tape, cable ties, amplas. Bahan: kardus tebal, PVC, kayu ringan, botol bekas. Laptop/HP untuk RPL, DKV, Animasi, dan simulasi Mekatronika. APD: sarung tangan & masker.',
  'Bahan kurang? JANGAN batalkan — UBAH SKALA. Purwarupa boleh dari kardus, styrofoam, atau seluruhnya digital. Yang dinilai IDE & PROSES, bukan kemewahan bahan. | Ada murid main-main dengan cutter? Tim K3 yang menegur lebih dulu. Kalau tidak digubris, baru Anda turun tangan — dan tarik alatnya. Sekali. Tanpa negosiasi.');

SESI('SESI 3 — “Silih Asah”: Uji Silang Antartim', '11.00 – 11.45 (45 menit / 1 JP)',
  'Umpan balik teman sebaya. Ini praktik langsung falsafah silih asah.',
  [
    ["10'", 'Semua purwarupa v1 dipajang di meja. Kelas dibagi dua: separuh MENJAGA karyanya, separuh BERKELILING sebagai penguji.'],
    ["20'", 'Penguji mengisi Lembar Silih Asah (LK-4 Bagian C) untuk 3 tim lain, dengan format wajib: “Yang SUDAH JALAN: ___” · “Yang BELUM JALAN: ___” · “Satu SARAN saya: ___”. ATURAN: dilarang menulis “bagus” tanpa alasan, dan dilarang menyerang orangnya. Setelah 20 menit, bertukar peran.'],
    ["15'", 'Setiap tim membaca semua masukan yang diterima, lalu menuliskan SATU perbaikan yang akan dikerjakan besok pagi. Tulis di LK.'],
  ],
  'LK-4 Bagian C (Lembar Silih Asah); meja pajang.',
  'Kalau umpan balik hanya berisi pujian kosong: kembalikan lembarnya. “Ini belum menolong temanmu. Tulis satu hal yang BELUM jalan.” Kritik yang jujur adalah bentuk kasih sayang — itulah silih asih.');

push(P([new TextRun({ text: '11.45 – 12.00 · REFLEKSI & JURNAL WALUYA. ', bold: true, size: 20, color: NAVY }), new TextRun({ text: 'Pertanyaan jurnal hari ini: “Apa yang paling sulit hari ini, dan siapa yang menolongmu melewatinya?”', size: 20 })], { spaceBefore: 100, spaceAfter: 120 }));

push(PB());

// ============ HARI 5 ============
push(H1('HARI 5 — SELASA, 21 JULI 2026'));
push(TBL([9638], null, [['SINGER · Waluya Karsa · “BERTINDAK & BERBAGI”']], { headFill: 'C55A11', zebra: false, size: 24 }));
push(P('Hasil akhir hari ini: karya TERPASANG di sekolah (bukan cuma dipamerkan), kampanye digital TERBIT, dan setiap murid menandatangani Kontrak Kebiasaan Waluya.', { italics: true, spaceBefore: 80, spaceAfter: 120 }));
push(BOX('Pembeda hari ini', [
  'Banyak projek sekolah berhenti di pameran. SAKOLA WALUYA tidak. Hari ini karya benar-benar DIPASANG, DIJALANKAN, atau DIGUNAKAN di sekolah. Kalau sesuatu tidak berubah secara fisik/nyata di SMKN 2 Cimahi hari ini, kegiatan lima hari ini belum berhasil.',
  'Nilai SINGER dalam Pancawaluya berbunyi: “tidak hanya berpikir dan berbicara, tetapi juga BERANI MELAKUKAN TINDAKAN yang membawa manfaat.”',
], 'FFF2CC', 'BF8F00'));

SESI('PEMANTIK — Perbaikan Kilat', '07.30 – 07.45 (15 menit)',
  'Menutup masukan Hari 4 sebelum aksi.',
  [
    ["15'", 'Tim langsung mengerjakan SATU perbaikan yang mereka tulis kemarin sore. Guru tidak bicara sama sekali, hanya menghitung waktu. Jam 07.45 semua alat turun.'],
  ],
  'Purwarupa v1; alat seadanya.',
  'Kalau ada tim yang purwarupanya gagal total: itu DATA, bukan aib. Minta mereka mempresentasikan kegagalannya di Gelar Karya dengan judul “Apa yang kami pelajari dari kegagalan ini.” Ini justru salah satu presentasi paling kuat, dan sejalan dengan nilai CAGEUR: ketahanan mental.');

SESI('SESI 1 — AKSI NYATA (di titik sasaran, sistem POS)', '07.45 – 09.15 (90 menit / 2 JP)',
  'Memasang, menjalankan, memperbaiki. INI PUNCAKNYA. (TP-4)',
  [
    ["10'", 'Tim ambil kartu. Tim K3 memeriksa alat & APD. Tim Dokumentasi mengambil FOTO “BEFORE” di titik sasaran — WAJIB, dari sudut yang akan diulang nanti. Tanpa foto before, tidak ada bukti perubahan.'],
    ["60'", 'TIM BEKERJA DI TITIK SASARAN. Anda MENETAP DI POS yang dipindahkan ke dekat titik aksi (bukan di kelas). Yang dikerjakan: memasang tempat sampah pilah kardus · menempel signage & infografis · memasang dispenser sabun mekanis · menguji & mencatat kualitas air · meluncurkan aplikasi ke pengguna nyata (uji langsung ke murid lain) · menggelar sesi jeda gerak percontohan · menyerahkan botol eco-enzyme ke petugas kebersihan.'],
    ["5'", 'PEMASANGAN TANPA BOR: cable ties ke pagar/teralis/tiang · double tape busa · gantungan tempel · tali · benda berdiri bebas · memakai paku/kait YANG SUDAH ADA. KALAU HARUS MENGEBOR — JANGAN. Tim menulis SURAT PERMOHONAN PEMASANGAN (ditulis MURID) untuk diserahkan ke Wakasek Sarpras di Gelar Karya nanti.'],
    ["10'", 'FOTO “AFTER” dari SUDUT YANG SAMA. Tempel/tulis di LK-5A.'],
    ["5'", 'Tiap tim MENEMUI MITRA yang mereka wawancarai Hari 3 (Caraka/Satpam/Ibu Kantin) dan MENUNJUKKAN hasilnya. Minta 1 kalimat tanggapan. Catat di LK.'],
  ],
  'Karya jadi · alat tangan (obeng, gunting, lakban, cable ties, double tape) · IZIN TITIK AKSI dari Wakasek Sarpras (SUDAH HARUS ADA sejak H-3) · HP untuk foto · KARTU TIM (6) · PAPAN KARTU.',
  'Izin pemasangan belum turun pagi itu? JANGAN memasang diam-diam. Ubah jadi “pemasangan simulasi”: pasang, foto, lepas kembali. Lalu serahkan karyanya secara RESMI ke Wakasek Sarpras di Gelar Karya, disertai surat permohonan yang ditulis MURID. Itu pelajaran kewargaan yang bagus — dan tetap dihitung sebagai AKSI NYATA.');

SESI('SESI 2 — GELAR KARYA WALUYA', '09.30 – 11.00 (90 menit / 2 JP)',
  'Mengomunikasikan. (TP-5) Sekaligus asesmen sumatif dengan rubrik.',
  [
    ["15'", 'Tim Logistik & Tim Dokumentasi menata stan kelas (1 kelas 1 stan). WAJIB memajang: purwarupa/karya · plano data & grafik · foto BEFORE–AFTER · kutipan narasumber · Peta Empati. Kelas Pemesinan juga memajang GAMBAR KERJA yang akan diserahkan.'],
    ["50'", 'PAMERAN TERBUKA. Pengunjung: seluruh murid kelas XI (saling berkunjung) · Kepala Sekolah · Kaprog (datang sebagai PENILAI TEKNIS TAMU, bukan fasilitator) · OSIS · Komite · dan MITRA YANG DIWAWANCARAI (Caraka, Satpam, Ibu Kantin — UNDANG MEREKA, ini penting). MURID yang bicara, bukan Anda. Formula 60 detik: “Kami menemukan [ANGKA]. Kami mendengar [KUTIPAN]. Kami membuat [KARYA]. Sekarang [PERUBAHAN].”'],
    ["10'", 'PENYERAHAN RESMI. Tim yang karyanya butuh fabrikasi mesin menyerahkan GAMBAR KERJA + SURAT PERMOHONAN kepada Wakasek Sarpras / Kaprog, di depan pengunjung. Ini momen kewargaan — jangan dilewatkan, dan pastikan Tim Dokumentasi memotretnya.'],
    ["10'", 'PENILAIAN. ANDA (penilai utama) + Kaprog (penilai teknis tamu) + perwakilan OSIS mengisi Rubrik Kinerja (3 dimensi: kreativitas, kolaborasi, kesehatan; skala SB/B/C/K — LAMPIRAN E).'],
    ["5'", 'APRESIASI (bukan juara): “Data Paling Jujur” · “Karya Paling Berguna” · “Tim Paling Silih Asuh” · “Kegagalan Paling Berharga”.'],
  ],
  'Aula/lapangan/lorong · meja per kelas · lembar rubrik cetak · kamera. Kaprog diundang 60–90 menit saja.',
  'Aula tidak tersedia? Gelar karya di lorong/koridor per lantai (“Gelar Karya Lorong”). Justru lebih banyak yang lewat dan melihat. Tidak perlu panggung.');

SESI('SESI 3 — Kampanye Digital & KONTRAK KEBIASAAN WALUYA', '11.00 – 11.45 (45 menit / 1 JP)',
  'Menutup lingkaran: dari sekolah ke publik, dan dari projek kembali ke DIRI. (TP-5 & TP-6)',
  [
    ["15'", 'PUBLIKASI. Kelas DKV & Animasi menyerahkan konten final ke Tim ICT untuk diunggah ke Instagram & YouTube SMKN 2 Cimahi. Kelas lain menyerahkan 1 foto + 1 kalimat caption. Konten juga diunggah ke SIPALAWA (sipalawa.jabarprov.go.id) sebagai bukti pelaksanaan.'],
    ["10'", 'RADAR KEBIASAAN ULANG. Setiap murid mengisi ulang Radar Kebiasaan (LK-5 Bagian B) dan MEMBANDINGKANNYA dengan Radar Hari 1. Guru bertanya: “Apa yang berubah dalam 5 hari? Apa yang tidak berubah? Kenapa?”'],
    ["15'", 'KONTRAK KEBIASAAN WALUYA (LK-5 Bagian C). Setiap murid memilih SATU kebiasaan (dari 7 KAIH) yang akan dijalankannya sampai akhir semester, menuliskan: kebiasaan apa · kapan tepatnya (jam berapa) · bagaimana cara mengukurnya · siapa yang akan mengingatkan. Ditandatangani MURID. Dibawa pulang untuk ditandatangani ORANG TUA, dikembalikan ke wali kelas paling lambat Jumat 24 Juli 2026. Wali kelas ikut menandatangani.'],
    ["5'", 'PENUTUP. Lingkaran kelas. Setiap murid mengucapkan satu kalimat: “Minggu depan saya akan ______.” Cukup satu kalimat. Tidak ada pidato guru.'],
  ],
  'LK-5; berkas konten digital; akses akun sekolah (Tim ICT); pena untuk tanda tangan.',
  'Kalau murid membuat kontrak yang terlalu muluk (“Saya akan tidur jam 9 setiap hari mulai besok”): tantang dengan lembut — “Realistis nggak? Kalau gagal hari ketiga, kamu akan menyerah. Mulai dari yang kecil: tidur 30 menit lebih awal dari biasanya. Kalau berhasil, baru naikkan.” Kontrak yang kecil dan berhasil jauh lebih baik daripada kontrak besar yang gagal.');

push(P([new TextRun({ text: '11.45 – 12.00 · REFLEKSI PENUTUP & JURNAL WALUYA. ', bold: true, size: 20, color: NAVY }), new TextRun({ text: 'Pertanyaan terakhir: “Kalau kamu punya satu hal untuk dikatakan pada dirimu di hari Rabu lalu, apa yang akan kamu katakan?” Kumpulkan seluruh LK. Ini adalah portofolio asesmen (bobot 30%).', size: 20 })], { spaceBefore: 100, spaceAfter: 120 }));

push(PB());

// ============ SETELAH ============
push(H1('BAGIAN 2 — SETELAH 21 JULI (JANGAN LEWATKAN BAGIAN INI)'));
push(P('Panduan Kokurikuler 2025 menegaskan bahwa pembiasaan 7 KAIH “tetap perlu dilakukan secara rutin” walaupun tema sudah berganti. SAKOLA WALUYA bukan acara lima hari — ia adalah PEMBUKA.'));
push(TBL([2400, 3400, 3838], ['Kapan', 'Apa', 'Siapa'], [
  ['Rabu 22 – Jumat 24 Juli', 'Mengumpulkan Kontrak Kebiasaan yang sudah ditandatangani orang tua', 'Wali kelas'],
  ['Setiap Senin, 5 menit di jam perwalian', 'CEK KONTRAK: “Angkat tangan yang minggu ini berhasil menjalankan kontraknya.” Tidak ada hukuman bagi yang gagal — hanya pertanyaan: “Apa yang menghalangi?”', 'Wali kelas — sampai akhir semester'],
  ['Minggu pertama Agustus', 'Menyusun NARASI PERUBAHAN (Outcome Harvesting): siapa berubah, apa yang berubah, di mana, kapan, dan apa kontribusi program. Unggah ke SIPALAWA.', 'Guru Koordinator Gapura Pancawaluya'],
  ['Sepanjang semester', 'MERAWAT KARYA + MENAGIH FABRIKASI. Kelas pembuat merawat karyanya (tempat sampah pilah, signage, dispenser, aplikasi). Kelas yang menyerahkan GAMBAR KERJA berhak menagih realisasinya kepada Kaprog/Sarpras — dan itu bagian dari pembelajaran kewargaan. Inilah tahap “Kulturalisasi” dalam model internalisasi nilai Pancawaluya.', 'Kelas pembuat + Wakasek Sarpras + Kaprog'],
  ['Akhir semester', 'Membandingkan Radar Kebiasaan H1 vs pemantauan akhir semester. Data ini menjadi bukti perbaikan D.19 untuk Rapor Pendidikan berikutnya.', 'Koordinator'],
  ['Sisa 116 JP kokurikuler kelas XI', 'Melanjutkan dimensi yang belum tercapai. Panduan: “Apabila terdapat dimensi yang belum tercapai maka dimensi tersebut dilanjutkan kembali pada kegiatan kokurikuler berikutnya.”', 'Tim Kokurikuler'],
], { size: 19 }));

push(PB());

// ============ LAMPIRAN ============
push(H1('LAMPIRAN'));

push(H2('LAMPIRAN A — Angka Rapor untuk Ditayangkan ke Murid (Hari 1)'));
push(P('Cetak/tayangkan tabel ini apa adanya. Jangan diperhalus. Kejujuran data adalah nilai BENER.', { italics: true, spaceAfter: 60 }));
push(TBL([3600, 1600, 1800, 2638], ['7 Kebiasaan Anak Indonesia Hebat', 'Skor SMKN 2 Cimahi', 'Status', 'Skala'], [
  ['Gemar Belajar', '5,50', 'KURANG', '0 – 10'],
  ['Berolahraga', '5,92', 'KURANG', '0 – 10'],
  ['Bermasyarakat', '6,41', 'KURANG', '0 – 10'],
  ['Tidur Cepat', '6,41', 'KURANG', '0 – 10'],
  ['Makan Sehat & Bergizi', '6,44', 'KURANG', '0 – 10'],
  ['Beribadah', '7,34', 'Sedang', '0 – 10'],
  ['Bangun Pagi', '7,93', 'Sedang', '0 – 10'],
  ['RATA-RATA (D.19)', '6,57', 'SEDANG', '0 – 10'],
], { size: 20 }));
push(P('Angka pendukung lain yang boleh ditunjukkan bila perlu: Kreativitas 54,31 (terendah dari 6 sub-dimensi karakter) · Gotong Royong 54,70 (turun 3,09, satu-satunya yang turun) · Indeks Sanitasi Sekolah 30 (KURANG) · Kesejahteraan psikologis murid 59,30. Sumber: Rapor Pendidikan SMKN 2 Cimahi 2025 (NPSN 20238571).', { size: 19, spaceBefore: 60 }));

push(SPACER());
push(H2('LAMPIRAN B — Tujuh Pernyataan “Barometer Kebiasaan” (Hari 1, Sesi 1)'));
push(P('Bacakan satu per satu. Setelah setiap pernyataan, beri waktu murid berpindah posisi, lalu tanya 1–2 murid: “Kenapa kamu berdiri di situ?”', { italics: true, spaceAfter: 60 }));
push(TBL([700, 8938], null, [
  ['1', '“Saya bangun sendiri tanpa dibangunkan, dan tidak menunda alarm.” (Bangun Pagi)'],
  ['2', '“Saya menjalankan ibadah saya dengan sadar, bukan karena disuruh.” (Beribadah)'],
  ['3', '“Dalam seminggu terakhir, saya berolahraga atau bergerak aktif minimal 30 menit, minimal 3 kali.” (Berolahraga)'],
  ['4', '“Saya sarapan sebelum berangkat sekolah, dan saya tahu apa yang saya makan itu bergizi.” (Makan Sehat & Bergizi)'],
  ['5', '“Kemarin, saya belajar sesuatu di luar jam sekolah — karena saya INGIN, bukan karena ada tugas.” (Gemar Belajar)'],
  ['6', '“Dalam sebulan terakhir, saya menolong orang yang tidak saya kenal, tanpa diminta.” (Bermasyarakat)'],
  ['7', '“Saya tidur sebelum jam 10 malam, dan HP saya tidak ada di tangan saat mau tidur.” (Tidur Cepat)'],
], { headFill: NAVY, zebra: true, size: 20 }));

push(SPACER());
push(H2('LAMPIRAN C — Poster 5 Zona Aksi Waluya (dicetak koordinator, A3)'));
push(TBL([1900, 3400, 4338], ['Zona', 'Judul', 'Kalimat pada poster'], [
  ['Z1', 'CAI & KABERSIHAN', '“Indeks Sanitasi sekolah kita: 30 dari 100. KURANG. Air, toilet, wastafel, sabun. Bisakah kita perbaiki?”'],
  ['Z2', 'DAHAR SEHAT', '“Skor Makan Sehat kita: 6,44. KURANG. Setiap hari kita makan MBG bersama — tapi berapa yang terbuang? Apa yang sebenarnya kita makan?”'],
  ['Z3', 'BETAH DIAJAR', '“Skor Gemar Belajar kita: 5,50 — TERENDAH. Skor Tidur Cepat: 6,41. Kenapa belajar terasa berat? Kenapa kita selalu mengantuk?”'],
  ['Z4', 'AWAK BUGAR', '“Skor Berolahraga kita: 5,92. KURANG. Kita duduk 7 jam sehari. Badan kita protes. Apa yang bisa kita ubah?”'],
  ['Z5', 'SAKOLA AMAN & SOMEAH', '“30% murid pernah terpapar rokok/miras. Perundungan naik. Kesejahteraan kita 59,30. Bagaimana caranya sekolah ini jadi tempat yang aman untuk semua?”'],
], { size: 19 }));

push(SPACER());
push(H2('LAMPIRAN D — Panduan Data Lapangan per Zona (Hari 2, Sesi 1)'));
push(P('Berikan ini pada tim sebelum turun lapangan. Bukan untuk membatasi, tapi supaya mereka tidak pulang dengan tangan kosong.', { italics: true, spaceAfter: 60 }));
push(TBL([1600, 8038], ['Zona', 'Data minimal yang WAJIB dibawa pulang'], [
  ['Z1 Cai & Kabersihan', 'Jumlah toilet & wastafel (putra/putri) · berapa yang berfungsi, berapa rusak · berapa yang ada sabunnya · debit air: berapa detik untuk mengisi 1 gelas, diuji di 5 titik · rasio jumlah murid : jumlah toilet · skor kebersihan 1–5 per toilet (buat kriteria sendiri) · 5 foto.'],
  ['Z2 Dahar Sehat', 'Berat/volume sisa makanan MBG per kelas selama 5 hari (data dari papan tulis harian) · berapa % murid menghabiskan porsinya (hitung langsung) · daftar 10 jajanan terlaris di kantin + harganya + kandungan gulanya · berapa murid yang sarapan pagi ini (survei cepat) · 5 foto.'],
  ['Z3 Betah Diajar', 'Survei: jam tidur & jam bangun 30 murid (Google Form) · berapa jam pemakaian HP sebelum tidur (screen time — minta murid cek sendiri di pengaturan HP) · hitung berapa murid yang mengantuk di jam ke-1 dan ke-7 (observasi langsung) · adakah tempat/pojok yang nyaman untuk belajar di sekolah? hitung & ukur · 5 foto.'],
  ['Z4 Awak Bugar', 'Berapa menit murid benar-benar bergerak dalam 1 hari sekolah (ukur dengan langkah HP/stopwatch, sampel 10 murid) · berapa lama murid duduk tanpa berdiri sama sekali · fasilitas olahraga yang ada vs yang dipakai · berapa murid ikut ekskul olahraga (data dari kesiswaan) · 5 foto.'],
  ['Z5 Sakola Aman', 'SELURUH data digali lewat GOOGLE FORM ANONIM \u2014 bukan wawancara tatap muka tentang pengalaman pribadi. Data yang dikumpulkan: peta titik-titik di sekolah yang terasa tidak aman \u00b7 apakah murid TAHU ke mana harus melapor? (persentase) \u00b7 adakah papan informasi kanal pengaduan? (hitung & foto) \u00b7 5 foto LOKASI (BUKAN orang). DILARANG: mewawancarai korban perundungan atau menanyakan pengalaman disakiti. Yang boleh diwawancarai hanya OSIS, satpam, guru piket, dan murid kelas X \u2014 tentang PENGETAHUAN mereka soal sistem pelaporan. Karya diarahkan ke SISTEM (kanal lapor, papan informasi, kampanye), BUKAN ke kasus.'],
], { size: 18 }));

push(SPACER());
push(H2('LAMPIRAN E — RUBRIK PENILAIAN KINERJA (Gelar Karya, Hari 5)'));
push(P('Format mengikuti Panduan Kokurikuler 2025 (hlm. 65): Dimensi Profil Lulusan \u00d7 Aspek yang Dinilai \u00d7 SB/B/C/K.', { italics: true, size: 19, spaceAfter: 40 }));
push(P('Diisi oleh: WALI KELAS (penilai utama) + Kaprog (penilai teknis TAMU, hadir 60\u201390 menit) + perwakilan OSIS. Lingkari satu level per DIMENSI \u2014 bukan per sub-dimensi. Hanya TIGA dimensi yang dinilai.', { italics: true, size: 19, spaceAfter: 60 }));

R3.RUBRIK.forEach(r => {
  push(TBL([1400, 2600, 1420, 1400, 1400, 1418],
    ['Dimensi\nProfil Lulusan', 'Sub-dimensi & Aspek yang Dinilai', 'Sangat Baik (SB)', 'Baik (B)', 'Cukup (C)', 'Kurang (K)'],
    [r], { size: 16 }));
  push(SPACER());
});

push(H3('Lembar Rekap Nilai Kelas (format Panduan Kokurikuler 2025)'));
push(TBL([600, 2200, 1400, 1400, 1400, 2638],
  ['No', 'Nama Murid', 'kreativitas', 'kolaborasi', 'kesehatan', 'Catatan Pendidik'],
  Array.from({ length: 10 }, (_, i) => [String(i + 1), ' ', ' ', ' ', ' ', ' ']),
  { size: 18 }));
push(P('Isi dengan SB / B / C / K. Lembar siap-isi untuk 36 murid tersedia di berkas INSTRUMEN_ASESMEN.xlsx (folder 01_UNTUK_GURU) \u2014 sudah berumus otomatis, termasuk draf deskripsi rapor.', { italics: true, size: 19, spaceBefore: 60 }));

push(SPACER());
push(BOX('Deskripsi rapor \u2014 kolom Kokurikuler', [
  'Panduan: berupa DESKRIPSI (bukan angka), ringkas, positif, edukatif. Sebut yang sudah baik lebih dulu, lalu yang masih perlu dilatih.',
  '',
  '\u201cAnanda Rizky sudah sangat baik dalam KOLABORASI dengan menjalankan perannya secara konsisten dan membantu tim lain, serta baik dalam KESEHATAN melalui pembiasaan tujuh kebiasaan yang terjaga selama kegiatan. Masih perlu berlatih dalam KREATIVITAS, khususnya mengembangkan gagasan sendiri, tidak sekadar meniru contoh.\u201d',
], GOLD, 'BF8F00'));

push(SPACER());
push(H2('LAMPIRAN F — Format Catatan Anekdotal (diisi guru, harian)'));
push(TBL([1200, 1900, 3300, 3238], ['Tanggal', 'Nama Murid', 'Perilaku yang Teramati (fakta, bukan penilaian)', 'Dimensi / Nilai Waluya'], [
  ['16/7', 'Contoh: Rizky', 'Saat timnya kekurangan data, ia meminjamkan meteran ke tim lain lebih dulu sebelum timnya selesai mengukur.', 'kolaborasi / BAGEUR — silih asuh'],
  [' ', ' ', ' ', ' '],
  [' ', ' ', ' ', ' '],
  [' ', ' ', ' ', ' '],
  [' ', ' ', ' ', ' '],
  [' ', ' ', ' ', ' '],
], { size: 19 }));
push(P('Target: minimal 5 catatan per hari per kelas. Catat FAKTA yang terlihat/terdengar, bukan tafsir. Salah: “Rizky malas.” Benar: “Rizky tidak mengambil peran dalam timnya selama 30 menit dan menghabiskan waktu menatap HP.”', { size: 19, italics: true, spaceBefore: 60 }));


push(PB());
push(H2('LAMPIRAN G — PAPAN KARTU (pengganti Kartu Izin Jelajah)'));
push(BOX('KENAPA KARTU IZIN DIHAPUS', [
  'Kartu izin bertanda tangan wali kelas terlihat rapi di atas kertas, tapi berbahaya di lapangan: tanda tangan Anda memindahkan TANGGUNG JAWAB HUKUM atas setiap perpindahan murid ke pundak Anda pribadi.',
  '',
  'Padahal izin menjelajah sudah melekat pada SEKTOR yang ditetapkan Koordinator dan Kepala Sekolah. Wali kelas tidak boleh dibebani itu.',
  '',
  'Selain itu: 6 kartu × 16 kelas × 3 hari = ratusan tanda tangan. Satu lupa saja, kegiatan macet.',
], ROSE, 'AD1457'));
push(SPACER());
push(H3('Cara membuatnya (murah, dipakai berulang)'));
push(TBL([2400, 7238], null, [
  ['Bahan', 'Satu PAPAN KARTU (karton/sterofoam/papan tulis kecil) berisi 6 SLOT berlabel TIM 1–6, plus 6 KARTU TIM warna berbeda. Cetak lembar “17_Lembar_Cetak_Kartu_Tim.png” (folder 05_GAMBAR), gunting, laminating atau tempel di karton. Satu set per kelas, dipakai lima hari.'],
  ['Dipasang di mana', 'Dinding kelas, dekat pintu. Terlihat dari tempat guru berdiri.'],
  ['Cara kerja', 'TIM BERANGKAT \u2192 ambil kartu timnya, PAKAI. TIM PULANG \u2192 KEMBALIKAN kartu ke SLOT timnya.'],
  ['Yang guru lakukan', 'MELIHAT. Itu saja. Slot kosong = tim itu masih di luar. Tidak ada tanda tangan, tidak ada jam yang ditulis, tidak ada kertas.'],
  ['Yang murid lakukan', 'TIM PIKET DATA mengecek papan tiap 20 menit. Ada slot kosong lewat waktu? Beri tahu guru.'],
  ['Kalau tim telat', 'Kartu ditahan guru. Tim itu tidak turun lapangan lagi hari itu \u2014 datanya dilanjutkan dari kelas.'],
], { headFill: NAVY, zebra: true, size: 19 }));
push(SPACER());
push(BOX('EMPAT ATURAN JELAJAH \u2014 tempel di sebelah Papan Kartu', [
  '1.  Tidak ada murid sendirian. Minimal berdua.',
  '2.  Tidak boleh keluar gerbang sekolah.',
  '3.  Hanya di SEKTOR kelas kita. Dilarang masuk ruang KBM, ruang guru, bengkel, dan area MPLS kelas X.',
  '4.  Pulang tepat waktu. Kembalikan kartunya ke papan.',
], ROSE, 'AD1457'));

push(SPACER());
push(H2('LAMPIRAN I — SWA-CEK GURU (isi sendiri, 2 menit, setiap akhir hari)'));
push(P('Karena Anda sendirian di kelas, observasi silang antarguru tidak mungkin dilakukan. Ini penggantinya. Jujur saja — tidak ada yang menilai Anda selain Anda sendiri.', { italics: true, size: 19, spaceAfter: 60 }));
push(TBL([5200, 1100, 1100, 1100, 1138], ['Pertanyaan', 'H1', 'H2', 'H3', 'H4/H5'], [
  ['Kira-kira berapa MENIT hari ini saya bicara di depan kelas? (target: < 25% dari 270 menit ≈ di bawah 65 menit)', ' ', ' ', ' ', ' '],
  ['Berapa kali murid BERDIRI / BERGERAK / BERPINDAH hari ini? (target: minimal 1x per sesi)', ' ', ' ', ' ', ' '],
  ['Berapa keputusan yang SAYA ambil hari ini, yang sebenarnya bisa diambil murid? (target: 0)', ' ', ' ', ' ', ' '],
  ['Apakah Tim Waktu benar-benar yang mengurus waktu, atau saya mengambil alih lagi?', ' ', ' ', ' ', ' '],
  ['Apakah saya sempat memegang alat/karya murid “supaya cepat”? (jawab jujur)', ' ', ' ', ' ', ' '],
], { size: 18 }));
push(P('Satu hal yang akan saya ubah besok:', { bold: true, size: 20, spaceBefore: 70, spaceAfter: 40 }));
push(L.LINES(2));

push(SPACER());
push(H2('LAMPIRAN J — PROTOKOL RUJUKAN CEPAT (simpan di Pos)'));
push(TBL([3200, 6438], ['Situasi', 'Yang Anda lakukan'], [
  ['Murid menulis sesuatu yang berat di Google Form (kolom “tidak aman”)', 'JANGAN dibahas di kelas. JANGAN mencari tahu siapa. Data itu sudah otomatis masuk ke Sheet yang dibaca Guru BK di akhir hari. Anda tidak perlu berbuat apa-apa. Kalau Anda khawatir — hubungi Guru BK atau Koordinator hari itu juga.'],
  ['Murid mencentang “ingin bicara dengan Guru BK”', 'Guru BK yang akan menghubunginya, BUKAN Anda. Tugas Anda cukup memastikan murid tahu jalur itu ada.'],
  ['Murid bercerita langsung kepada Anda tentang hal berat', 'DENGARKAN. Jangan menghakimi, jangan menjanjikan kerahasiaan mutlak. Katakan: “Terima kasih sudah cerita. Ini terlalu penting untuk saya tangani sendiri. Boleh saya temani kamu bicara dengan Guru BK?” Lalu antarkan HARI ITU JUGA.'],
  ['Ada murid cedera saat memakai alat tangan', 'Hentikan seluruh kegiatan tim itu. Kotak P3K ada di Pos. Bawa/panggil UKS. Hubungi Koordinator. Catat kejadiannya. Jangan lanjutkan pekerjaan dengan alat yang sama hari itu.'],
  ['Tim tidak kembali sampai lewat jam wajib', 'Hubungi Kapten Tim (WA grup kelas). Jika 5 menit tidak ada jawaban, hubungi KOORDINATOR yang sedang berkeliling sekolah — dia yang mencari, bukan Anda. Anda TETAP DI POS bersama tim lain.'],
  ['Anda merasa kewalahan sendirian', 'Hubungi Koordinator. Itu memang gunanya dia berkeliling. Tidak ada nilai heroik dalam memaksakan diri.'],
], { size: 18 }));

save(c, '/sessions/vibrant-inspiring-einstein/mnt/Ko Kurikuler/SAKOLA_WALUYA_XI_2026/01_UNTUK_GURU/PANDUAN_LENGKAP_GURU_rujukan.docx');
