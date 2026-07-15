const T = require('./tema.js');
const {
  newDeck, base, foot, sTitle, sHead, cards, sBig, sImage, sQuote,
  HIJAU, HIJAU2, KUNING, KUNING2, BIRU, BIRU2, KORAL, KORAL2, ORANYE, ORANYE2, UNGU, UNGU2,
  TEKS, TEKS2, PUTIH, F, FH, fs,
} = T;

const OUT = '/sessions/vibrant-inspiring-einstein/mnt/Ko Kurikuler/SAKOLA_WALUYA_XI_2026/04_PAPARAN_GURU';
const IMG = '/sessions/vibrant-inspiring-einstein/mnt/Ko Kurikuler/SAKOLA_WALUYA_XI_2026/05_GAMBAR';
fs.mkdirSync(OUT, { recursive: true });

const p = newDeck();

// ============ 1. JUDUL ============
sTitle(p, {
  kicker: 'BRIEFING WALI KELAS',
  title: 'SAKOLA WALUYA',
  sub: 'Ngamimitian ti Diri, Mere Mangpaat pikeun Sakola\nKokurikuler Kelas XI  ·  15–21 Juli 2026',
  accent: HIJAU, tint: HIJAU2,
}).addNotes('Durasi briefing 60 menit. Ini bukan sosialisasi — ini latihan. Di akhir, minta guru mempraktikkan satu teknik fasilitasi.');

// ============ 2. KENAPA ADA ============
let s = sHead(p, 'Kenapa kegiatan ini ada', 'DARI DATA, BUKAN DARI SELERA', KORAL);
cards(p, s, [
  { tag: '1', color: KORAL, tint: KORAL2, title: 'D.19 — Tujuh Kebiasaan Anak Indonesia Hebat = 6,57', body: 'Lima dari tujuh KURANG: Gemar Belajar 5,50 · Berolahraga 5,92 · Bermasyarakat 6,41 · Tidur Cepat 6,41 · Makan Sehat 6,44.' },
  { tag: '2', color: ORANYE, tint: ORANYE2, title: 'A.3 Karakter — Kreativitas 54,31 · Gotong Royong 54,70 (TURUN)', body: 'Kreativitas terendah dari 6 sub-dimensi. Gotong Royong satu-satunya yang TURUN tahun ini.' },
  { tag: '3', color: BIRU, tint: BIRU2, title: 'D.1.3 Metode Pembelajaran = 56,79 (TURUN 2,21)', body: 'Rapor menetapkannya sebagai AKAR MASALAH untuk EMPAT indikator prioritas: Kualitas Pembelajaran, Karakter, Literasi, Numerasi.' },
  { tag: '4', color: UNGU, tint: UNGU2, title: 'Sinyal bahaya lain', body: 'Sanitasi sekolah 30 (KURANG) · Wellbeing murid 59,30 · 30% murid terpapar rokok/miras · Perundungan naik.' },
], { y: 1.8 });
foot(p, s);
s.addNotes('Jangan permanis angkanya. Guru harus merasakan urgensinya sendiri.');

// ============ 3. VONIS RAPOR ============
sBig(p, {
  kicker: 'VONIS RAPOR YANG PALING PENTING',
  num: '56,79', cap: 'D.1.3\nMetode Pembelajaran',
  accent: KORAL, tint: KORAL2,
  note: 'Rapor sedang mengatakan:\ncara mengajar kita\nmasih terlalu satu arah.\n\nLima hari ini adalah\nlatihan kita untuk berubah.',
  img: `${IMG}/03_Grafik_Skor_7KAIH.png`,
}).addNotes('Ini slide paling penting dalam briefing. Beri jeda. Biarkan tidak nyaman.');

// ============ 4. ATURAN EMAS ============
s = sHead(p, 'ATURAN EMAS FASILITASI', 'WAJIB DIPATUHI SEMUA WALI KELAS', HIJAU);
cards(p, s, [
  { tag: '01', color: HIJAU, tint: HIJAU2, title: 'Anda bicara maksimal 25% waktu sesi', body: 'Kalau Anda menerangkan 30 menit nonstop, sesi itu gagal.' },
  { tag: '02', color: HIJAU, tint: HIJAU2, title: 'Jangan beri jawaban — beri pertanyaan', body: '"Menurut kamu kenapa?" · "Apa buktinya?" · "Kalau begitu, apa yang bisa kita lakukan?"' },
  { tag: '03', color: HIJAU, tint: HIJAU2, title: 'Tiap sesi harus ada murid BERDIRI / BERGERAK', body: 'Kalau murid duduk 90 menit tanpa bergerak, rancangan sesi tidak dijalankan.' },
  { tag: '04', color: HIJAU, tint: HIJAU2, title: 'Keputusan diambil MURID — bukan Anda', body: 'Bahkan waktu pun bukan tugas Anda. Itu tugas TIM WAKTU.' },
  { tag: '05', color: HIJAU, tint: HIJAU2, title: 'Tugas Anda tinggal dua', body: 'Jaga agar murid JUJUR. Jaga agar mereka SELAMAT. Itu saja.' },
], { y: 1.75 });
foot(p, s);

// ============ 5. ANDA SENDIRIAN ============
s = p.addSlide();
s.background = { color: KORAL2 };
T.logos(p, s);
s.addShape(p.ShapeType.ellipse, { x: 9.6, y: -2.0, w: 6.2, h: 6.2, fill: { color: KORAL, transparency: 84 } });
s.addText('BATASAN YANG MENENTUKAN SEGALANYA', { x: 0.75, y: 0.9, w: 10, h: 0.4, fontFace: F, fontSize: 16, color: 'C4453B', bold: true, charSpacing: 1.2, margin: 0 });
s.addText('Anda sendirian.', { x: 0.75, y: 1.35, w: 10, h: 1.1, fontFace: FH, fontSize: 52, color: TEKS, bold: true, margin: 0 });
s.addText('Tidak ada guru pendamping. Tidak ada Kaprog atau toolman.\nTidak ada Guru BK yang standby di kelas Anda.',
  { x: 0.75, y: 2.55, w: 11.5, h: 0.95, fontFace: F, fontSize: 22, color: TEKS2, lineSpacing: 32, margin: 0 });
s.addShape(p.ShapeType.roundRect, { x: 0.75, y: 3.7, w: 11.85, h: 2.75, fill: { color: PUTIH }, line: { color: KORAL, width: 2 }, rectRadius: 0.1 });
s.addText('Rancangan ini TIDAK menyiasati keterbatasan itu — rancangan ini MEMANFAATKANNYA.',
  { x: 1.1, y: 3.95, w: 11.2, h: 0.45, fontFace: F, fontSize: 22, color: TEKS, bold: true, margin: 0 });
s.addText('Enam pekerjaan yang biasanya dipegang "guru kedua" — menjaga waktu, mengecek keselamatan, mencatat kehadiran, mengurus logistik — DISERAHKAN KEPADA MURID.\n\nDan itu justru yang menaikkan Gotong Royong (54,70 — satu-satunya sub-dimensi karakter yang TURUN) dan Kemandirian.',
  { x: 1.1, y: 4.5, w: 11.2, h: 1.8, fontFace: F, fontSize: 20, color: TEKS2, lineSpacing: 27, margin: 0 });
foot(p, s);
s.addNotes('Beri jeda. Guru harus menerima ini sebagai DESAIN, bukan sebagai kekurangan.');

// ============ 6. ENAM PERAN MURID ============
s = sHead(p, 'Enam Peran MURID — pengganti "guru kedua"', 'DIBENTUK HARI 1 · DIROTASI TIAP HARI', HIJAU);
cards(p, s, [
  { tag: '6×', color: HIJAU, tint: HIJAU2, title: 'KAPTEN TIM', body: 'Keselamatan & keutuhan timnya di lapangan. Ambil & kembalikan ke papan kartu tim di Papan Kartu.' },
  { tag: '2×', color: BIRU, tint: BIRU2, title: 'TIM WAKTU', body: 'Pegang stopwatch. Umumkan sisa waktu. ANDA TIDAK LAGI MENGURUS WAKTU — serahkan sungguh-sungguh.' },
  { tag: '2×', color: UNGU, tint: UNGU2, title: 'TIM PIKET DATA', body: 'Jaga PAPAN KARTU. Cek tiap 20 menit — ada slot yang masih kosong lewat waktu? Beri tahu Anda.' },
  { tag: '2×', color: KORAL, tint: KORAL2, title: 'TIM K3', body: 'Cek APD & alat. BERWENANG MENGHENTIKAN kerja yang tidak aman — semua wajib patuh, TERMASUK ANDA.' },
  { tag: '2×', color: ORANYE, tint: ORANYE2, title: 'TIM DOKUMENTASI', body: 'Foto & video. Penanggung jawab foto BEFORE–AFTER Hari 5.' },
  { tag: '2×', color: KUNING, tint: KUNING2, title: 'TIM LOGISTIK', body: 'Siapkan & bereskan alat. Kelas tidak bubar sebelum mereka menyatakan beres.' },
], { y: 1.72 });
foot(p, s);

sImage(p, { kicker: 'STRUKTUR', title: 'Enam Peran Murid', img: `${IMG}/11_Struktur_Peran_Murid.png`, accent: HIJAU,
  note: 'Ucapkan di Hari 1: "Minggu ini saya sendirian. Saya tidak sedang malas — saya sedang mempercayai kalian."' });

// ============ 7. POS + PAPAN KARTU ============
s = sHead(p, 'POS FASILITATOR & PAPAN KARTU', 'CARA MENGAWASI 6 TIM SENDIRIAN', UNGU);
s.addShape(p.ShapeType.roundRect, { x: 0.55, y: 1.7, w: 12.25, h: 0.95, fill: { color: KORAL2 }, line: { color: KORAL, width: 1.5 }, rectRadius: 0.07 });
s.addText([{ text: 'JANGAN ikut berkeliling bersama satu tim. ', options: { bold: true, color: 'C4453B' } },
  { text: 'Kalau Anda ikut Tim 1 ke toilet lantai 2, maka Tim 2–6 tanpa pengawasan. Anda MENETAP di POS.', options: { color: '9E4A45' } }],
  { x: 0.9, y: 1.75, w: 11.6, h: 0.85, fontFace: F, fontSize: 20, margin: 0, valign: 'middle', lineSpacing: 26 });
cards(p, s, [
  { tag: 'POS', color: UNGU, tint: UNGU2, title: 'Satu titik tetap', body: 'Ruang kelas, atau meja yang Anda pindahkan ke tengah zona. Isi: Papan Kartu · kotak P3K · nomor darurat.' },
  { tag: 'KLG', color: HIJAU, tint: HIJAU2, title: 'PAPAN KARTU — bukan kartu izin', body: '6 slot + 6 kartu tim (warna berbeda). Ambil kartu = berangkat. Kembalikan = pulang. Slot kosong = tim masih di luar.' },
  { tag: 'TTD', color: KORAL, tint: KORAL2, title: 'ANDA TIDAK MENANDATANGANI APA PUN', body: 'Kartu izin bertanda tangan guru memindahkan tanggung jawab hukum ke pundak Anda. Izin sudah melekat pada SEKTOR yang ditetapkan Koordinator.' },
], { y: 2.85 });
foot(p, s);

sImage(p, { kicker: 'PENGGANTI KARTU IZIN', title: 'PAPAN KARTU', img: `${IMG}/16_Papan_Kartu.png`, accent: HIJAU,
  note: 'Guru cukup MELIHAT papan. Tidak ada kertas, tidak ada tanda tangan, tidak ada jam yang perlu ditulis.' });

// ============ 8. TANPA BENGKEL ============
s = sHead(p, 'Produksi Karya TANPA Bengkel', 'KEPUTUSAN KESELAMATAN — TIDAK BISA DITAWAR', KORAL);
s.addShape(p.ShapeType.roundRect, { x: 0.55, y: 1.7, w: 12.25, h: 1.05, fill: { color: KORAL2 }, line: { color: KORAL, width: 1.5 }, rectRadius: 0.07 });
s.addText('Anda sendirian, dan belum tentu guru produktif dari jurusan kelas ini. SELURUH produksi dilakukan DI DALAM KELAS — tanpa bengkel, tanpa mesin, tanpa bahan kimia berbahaya.',
  { x: 0.9, y: 1.75, w: 11.6, h: 0.95, fontFace: F, fontSize: 20, color: '9E4A45', margin: 0, valign: 'middle', lineSpacing: 26 });

s.addShape(p.ShapeType.roundRect, { x: 0.55, y: 2.95, w: 6.0, h: 3.6, fill: { color: HIJAU2 }, line: { color: HIJAU, width: 1.8 }, rectRadius: 0.08 });
s.addText('BOLEH  (diawasi Tim K3)', { x: 0.85, y: 3.1, w: 5.4, h: 0.4, fontFace: F, fontSize: 22, color: '15794F', bold: true, margin: 0 });
s.addText('Gunting · cutter · gergaji tangan kecil · obeng · tang · palu kecil · amplas · lem · double tape · cable ties\n\nKardus tebal · pipa PVC · kayu ringan · botol bekas\n\nLaptop & HP (Canva · CapCut · Tinkercad · Wokwi)',
  { x: 0.85, y: 3.55, w: 5.4, h: 2.85, fontFace: F, fontSize: 19, color: TEKS2, margin: 0, lineSpacing: 25 });

s.addShape(p.ShapeType.roundRect, { x: 6.8, y: 2.95, w: 6.0, h: 3.6, fill: { color: KORAL2 }, line: { color: KORAL, width: 1.8 }, rectRadius: 0.08 });
s.addText('DILARANG MUTLAK', { x: 7.1, y: 3.1, w: 5.4, h: 0.4, fontFace: F, fontSize: 22, color: 'C4453B', bold: true, margin: 0 });
s.addText('Mesin bubut · frais · gerinda · las · bor listrik · kompresor · menyolder · listrik 220V\n\nNaOH · asam kuat · bahan mudah terbakar · api & pemanasan\n\nBekerja di ketinggian lebih dari 1 meter',
  { x: 7.1, y: 3.55, w: 5.4, h: 2.85, fontFace: F, fontSize: 19, color: TEKS2, margin: 0, lineSpacing: 25 });
s.addText('Butuh mesin? → Purwarupa 1:1 kardus/PVC + GAMBAR KERJA, diserahkan RESMI ke Wakasek Sarpras di Gelar Karya. Itu TETAP dihitung sebagai Aksi Nyata.',
  { x: 0.55, y: 6.7, w: 12.25, h: 0.5, fontFace: F, fontSize: 17, color: TEKS, italic: true, bold: true, margin: 0 });

// ============ 9. SUARA WALUYA ============
s = sHead(p, '"SUARA WALUYA" — pengganti sticky note', 'HARI 1, SESI 2 · GOOGLE FORM ANONIM', UNGU);
s.addShape(p.ShapeType.roundRect, { x: 0.55, y: 1.7, w: 12.25, h: 1.0, fill: { color: UNGU2 }, line: { color: UNGU, width: 1.5 }, rectRadius: 0.07 });
s.addText('Sticky note fisik DIHAPUS. Sesi ini bisa memunculkan pengakuan perundungan — dan Anda sendirian, tanpa BK di tempat. Google Form punya keunggulan yang tidak dimiliki sticky note: MURID BISA MEMINTA BANTUAN SENDIRI, LANGSUNG KE GURU BK, TANPA LEWAT ANDA.',
  { x: 0.9, y: 1.75, w: 11.6, h: 0.9, fontFace: F, fontSize: 19, color: '5B4090', margin: 0, valign: 'middle', lineSpacing: 25 });
cards(p, s, [
  { tag: '1', color: UNGU, tint: UNGU2, title: 'Anda tidak mengatur apa pun', body: 'Tim ICT membuat Form SEKALI: 1 tautan + 1 QR untuk SELURUH kelas XI. Anda cukup menayangkan QR-nya.' },
  { tag: '2', color: UNGU, tint: UNGU2, title: 'Isi Form (6 butir)', body: 'Kelas · yang membuatku BETAH · TIDAK NYAMAN · TIDAK AMAN (boleh kosong) · skala rasa aman 1–5 · [  ] Saya ingin bicara dengan Guru BK.' },
  { tag: '3', color: HIJAU, tint: HIJAU2, title: 'Tetap ada GERAK', body: 'Hasil ditayangkan dari Sheet. Murid MAJU ke papan, mengelompokkan, menghitung (numerasi). Ditutup "voting kaki".' },
  { tag: '4', color: KORAL, tint: KORAL2, title: 'Yang TIDAK Anda lakukan', body: 'Tidak menindaklanjuti isian sensitif. Tidak mencari tahu siapa. Butir sensitif hanya dibaca Guru BK — dia menerima rekap di akhir Hari 1.' },
], { y: 2.9 });
foot(p, s);

// ============ 10-12. SKALA 16 KELAS ============
s = p.addSlide();
s.background = { color: BIRU2 };
T.logos(p, s);
s.addShape(p.ShapeType.ellipse, { x: 9.8, y: -2.0, w: 6.0, h: 6.0, fill: { color: BIRU, transparency: 84 } });
s.addText('SKALA YANG SEBENARNYA', { x: 0.75, y: 0.9, w: 10, h: 0.4, fontFace: F, fontSize: 16, color: '1C6E9B', bold: true, charSpacing: 1.2, margin: 0 });
s.addText('16 kelas. 576 murid. 96 tim.', { x: 0.75, y: 1.35, w: 11, h: 1.05, fontFace: FH, fontSize: 46, color: TEKS, bold: true, margin: 0 });
s.addShape(p.ShapeType.roundRect, { x: 0.75, y: 2.6, w: 11.85, h: 1.5, fill: { color: PUTIH }, line: { color: KORAL, width: 1.8 }, rectRadius: 0.1 });
s.addText('Tanpa pengaturan, 96 tim turun lapangan serentak — berebut mengukur toilet & wastafel yang jumlahnya tetap, dan menyerbu Pak Caraka yang hanya beberapa orang.\n\nDi hari kedua mitra sekolah akan menolak. Dan kita kehilangan jantung kegiatan ini.',
  { x: 1.1, y: 2.75, w: 11.2, h: 1.25, fontFace: F, fontSize: 19, color: TEKS2, margin: 0, lineSpacing: 25 });
s.addShape(p.ShapeType.roundRect, { x: 0.75, y: 4.35, w: 5.8, h: 2.1, fill: { color: HIJAU }, rectRadius: 0.1 });
s.addText('LAPIS 1 — SEKTOR EKSKLUSIF', { x: 1.05, y: 4.5, w: 5.2, h: 0.4, fontFace: F, fontSize: 20, color: PUTIH, bold: true, margin: 0 });
s.addText('Tiap kelas punya objek data SENDIRI. Butuh data sektor lain? MINTA ke kelas itu — itulah gotong royong yang sebenarnya.',
  { x: 1.05, y: 4.95, w: 5.2, h: 1.35, fontFace: F, fontSize: 18, color: 'E6F7EF', margin: 0, lineSpacing: 24 });
s.addShape(p.ShapeType.roundRect, { x: 6.8, y: 4.35, w: 5.8, h: 2.1, fill: { color: ORANYE }, rectRadius: 0.1 });
s.addText('LAPIS 2 — SISTEM GELOMBANG', { x: 7.1, y: 4.5, w: 5.2, h: 0.4, fontFace: F, fontSize: 20, color: PUTIH, bold: true, margin: 0 });
s.addText('8 kelas BIRU turun lapangan dulu, 8 kelas JINGGA di kelas — lalu bertukar. Maksimal 48 tim di lapangan, bukan 96.',
  { x: 7.1, y: 4.95, w: 5.2, h: 1.35, fontFace: F, fontSize: 18, color: 'FDF0E4', margin: 0, lineSpacing: 24 });
s.addNotes('Bagikan Kartu Sektor & jadwal gelombang ke tiap wali kelas di akhir briefing.');

sImage(p, { kicker: 'PENGATURAN LAPANGAN', title: 'Sektor Eksklusif + Sistem Gelombang', img: `${IMG}/14_Sektor_dan_Gelombang_16_Kelas.png`, accent: BIRU,
  note: 'Rincian lengkap 16 kelas: berkas MATRIKS_OPERASIONAL_16_KELAS.xlsx (7 lembar kerja).' });

sImage(p, { kicker: 'HARI 3 — NARASUMBER', title: 'NGAJUGJUG — murid yang menghampiri', img: `${IMG}/15_Ngajugjug_Narasumber.png`, accent: KORAL,
  note: 'Narasumber TIDAK dikumpulkan. Mereka tetap bekerja di tempatnya. Murid yang datang — 3 orang, 10 menit, sesuai slot.' });

// ============ 13. MARSHAL ============
s = sHead(p, 'Pengawasan Lapangan — MARSHAL WALUYA', 'TANPA GURU TAMBAHAN', ORANYE);
s.addShape(p.ShapeType.roundRect, { x: 0.55, y: 1.7, w: 12.25, h: 0.85, fill: { color: ORANYE2 }, line: { color: ORANYE, width: 1.5 }, rectRadius: 0.07 });
s.addText('Koordinator seorang diri tidak mungkin mengawasi 48 tim yang tersebar. Titik simpul dijaga MURID OSIS/MPK ber-rompi.',
  { x: 0.9, y: 1.75, w: 11.6, h: 0.75, fontFace: F, fontSize: 20, color: 'A85E1C', bold: true, margin: 0, valign: 'middle' });
cards(p, s, [
  { tag: '4–6', color: ORANYE, tint: ORANYE2, title: 'Tangga utama tiap lantai — Marshal Waluya (OSIS)', body: 'Mengarahkan arus. Memastikan tidak ada murid sendirian. Mencatat tim yang keluar sektornya.' },
  { tag: '2–4', color: ORANYE, tint: ORANYE2, title: 'Koridor antargedung — Marshal Waluya', body: 'Titik lapor cepat. Memegang daftar sektor 16 kelas.' },
  { tag: '2', color: KORAL, tint: KORAL2, title: 'Depan area MPLS kelas X — ZONA MERAH', body: 'MENAHAN tim XI yang mencoba masuk. Hanya boleh pada slot wawancara yang sudah dikoordinasikan dengan panitia MPLS.' },
  { tag: '2–3', color: KORAL, tint: KORAL2, title: 'Gerbang & parkir — SATPAM SEKOLAH', body: 'TIDAK ADA MURID KELUAR GERBANG. Ini garis merah mutlak.' },
], { y: 2.7 });
foot(p, s);

// ============ 14. KERANGKA ============
sImage(p, { kicker: 'KERANGKA', title: 'Pancawaluya × 7 KAIH × 8 Dimensi Profil Lulusan', img: `${IMG}/08_Pemetaan_Pancawaluya.png`, accent: HIJAU,
  note: 'Setiap hari mengangkat satu nilai. Tidak ada nilai yang mengambang tanpa ikatan pada data rapor.' });
sImage(p, { kicker: 'ALUR', title: 'Lima Hari, Lima Nilai', img: `${IMG}/07_Alur_5_Hari.png`, accent: BIRU,
  note: 'MEMAHAMI (H1–H2) → MENGAPLIKASI (H3–H4) → MEREFLEKSI (H5 + jurnal harian).' });

// ============ 15. ZONA ============
s = sHead(p, 'Lima Zona Aksi Waluya', 'SETIAP KELAS SUDAH DITETAPKAN SEKTORNYA', UNGU);
cards(p, s, [
  { tag: 'Z1', color: BIRU, tint: BIRU2, title: 'CAI & KABERSIHAN — Air & Sanitasi', body: 'Dasar: Indeks Sanitasi sekolah = 30 (KURANG). Justifikasi terkuat.' },
  { tag: 'Z2', color: ORANYE, tint: ORANYE2, title: 'DAHAR SEHAT — MBG, Gizi, Sampah Makanan', body: 'Dasar: Makan Sehat & Bergizi = 6,44 (KURANG).' },
  { tag: 'Z3', color: UNGU, tint: UNGU2, title: 'BETAH DIAJAR — Gemar Belajar & Tidur Cepat', body: 'Dasar: Gemar Belajar = 5,50 (TERENDAH) · Tidur Cepat = 6,41.' },
  { tag: 'Z4', color: HIJAU, tint: HIJAU2, title: 'AWAK BUGAR — Bergerak & Bugar', body: 'Dasar: Berolahraga = 5,92 (KURANG).' },
  { tag: 'Z5', color: KORAL, tint: KORAL2, title: 'SAKOLA AMAN & SOMEAH', body: 'Data HANYA lewat Form anonim. DILARANG mewawancarai korban perundungan. Karya diarahkan ke SISTEM, bukan ke kasus.' },
], { y: 1.75 });
foot(p, s);

// ============ 16. KARYA PER JURUSAN ============
s = sHead(p, 'Bentuk Karya per Program Keahlian', 'TANPA BENGKEL — ALAT TANGAN & DIGITAL, DI KELAS', ORANYE);
cards(p, s, [
  { tag: 'MK', color: BIRU, tint: BIRU2, title: 'Teknik Mekatronika', body: 'Dispenser sabun tekan/pedal dari botol bekas (mekanis) · simulasi rangkaian di Tinkercad/Wokwi (gratis) + gambar teknis.' },
  { tag: 'RP', color: HIJAU, tint: HIJAU2, title: 'Rekayasa Perangkat Lunak', body: 'Form lapor kerusakan sarpras + dasbor · tracker 7 KAIH · sistem rekap MBG. Cukup laptop/HP.' },
  { tag: 'DK', color: UNGU, tint: UNGU2, title: 'Desain Komunikasi Visual', body: 'Signage · wayfinding · infografis · poster (Canva). Dipasang dengan double tape / cable ties — TANPA bor.' },
  { tag: 'AN', color: ORANYE, tint: ORANYE2, title: 'Animasi', body: 'PSA animasi 30–60 detik untuk IG/YouTube sekolah · explainer data · video anti-perundungan.' },
  { tag: 'KI', color: KUNING, tint: KUNING2, title: 'Teknik Kimia Industri', body: 'Uji air dengan indikator alami (kubis ungu/kunyit) + pH strip · ECO-ENZYME dari sisa kulit buah MBG · audit food waste.' },
  { tag: 'PM', color: KORAL, tint: KORAL2, title: 'Teknik Pemesinan', body: 'Purwarupa 1:1 kardus/PVC (alat tangan) — dipasang & diuji Hari 5. GAMBAR KERJA diserahkan resmi untuk difabrikasi.' },
], { y: 1.72 });
foot(p, s);

// ============ 17. ASESMEN ============
s = sHead(p, 'Asesmen', 'FORMATIF SETIAP HARI · SUMATIF DI HARI 5', HIJAU);
cards(p, s, [
  { tag: '30%', color: HIJAU, tint: HIJAU2, title: 'Portofolio — Jurnal (buku tulis) + Google Sheet tim', body: 'Wali kelas membaca jurnal setiap malam dan membalas SATU kalimat.' },
  { tag: '40%', color: BIRU, tint: BIRU2, title: 'Kinerja Tim — Gelar Karya & Aksi Nyata', body: 'Rubrik 3 dimensi: kreativitas · kolaborasi · kesehatan. Skala SB/B/C/K. Penilai: wali kelas + Kaprog (tamu) + OSIS.' },
  { tag: '15%', color: ORANYE, tint: ORANYE2, title: 'Kampanye Digital', body: 'Konten terpublikasi di kanal resmi sekolah + SIPALAWA.' },
  { tag: '15%', color: KORAL, tint: KORAL2, title: 'Kontrak Kebiasaan Waluya', body: 'Ditulis tangan di buku, ditandatangani murid–orang tua–wali kelas. Kembali paling lambat Jumat 24 Juli 2026.' },
], { y: 1.8 });
foot(p, s);

// ============ 18. PENUTUP ============
sQuote(p, {
  text: 'Kalau hari Selasa 21 Juli tidak ada satu pun hal yang berubah nyata di SMKN 2 Cimahi, lima hari ini gagal.',
  sub: 'Bukan pameran. BERUBAH.\n\nSINGER: "tidak hanya berpikir dan berbicara, tetapi juga berani melakukan tindakan yang membawa manfaat."',
  accent: ORANYE, tint: ORANYE2,
});

p.writeFile({ fileName: `${OUT}/00_BRIEFING_GURU.pptx` }).then(() => console.log('OK 00_BRIEFING_GURU'));
