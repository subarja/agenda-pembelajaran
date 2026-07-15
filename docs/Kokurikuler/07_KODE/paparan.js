/* Paparan Guru — SAKOLA WALUYA, SMKN 2 Cimahi
   6 dek: Briefing Guru + Hari 1..5
   Prinsip: paparan ini untuk GURU (bukan untuk diceramahkan ke murid).
   Slide yang boleh ditayangkan ke murid ditandai [TAYANG]. */
const pptxgen = require('pptxgenjs');
const fs = require('fs');

const OUT = '/sessions/vibrant-inspiring-einstein/mnt/Ko Kurikuler/SAKOLA_WALUYA_XI_2026/04_PAPARAN_GURU';
const IMG = '/sessions/vibrant-inspiring-einstein/mnt/Ko Kurikuler/SAKOLA_WALUYA_XI_2026/05_GAMBAR';
fs.mkdirSync(OUT, { recursive: true });

const NAVY = '1F3864', BLUE = '2E74B5', WHITE = 'FFFFFF', GREY = '5A6B7B';
const LIGHT = 'F2F6FB', LINE = 'C9D3DD', RED = 'C62828';

const F = 'Calibri', FH = 'Cambria';

function deck(theme) {
  const p = new pptxgen();
  p.layout = 'LAYOUT_WIDE';           // 13.3 x 7.5
  p.author = 'SMK Negeri 2 Cimahi';
  p.company = 'SAKOLA WALUYA';
  return p;
}

// ---------- slide builders ----------
function sTitle(p, { kicker, title, sub, accent, foot }) {
  const s = p.addSlide();
  s.background = { color: NAVY };
  s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 13.3, h: 7.5, fill: { color: NAVY } });
  s.addShape(p.ShapeType.ellipse, { x: 9.6, y: -1.6, w: 5.6, h: 5.6, fill: { color: accent, transparency: 72 } });
  s.addShape(p.ShapeType.ellipse, { x: 11.2, y: 4.4, w: 3.6, h: 3.6, fill: { color: accent, transparency: 82 } });
  s.addText(kicker, { x: 0.9, y: 1.35, w: 9, h: 0.4, fontFace: F, fontSize: 14, color: accent, bold: true, charSpacing: 2 });
  s.addText(title, { x: 0.9, y: 1.85, w: 9.3, h: 1.9, fontFace: FH, fontSize: 46, color: WHITE, bold: true, lineSpacing: 48 });
  s.addText(sub, { x: 0.9, y: 3.95, w: 9.3, h: 1.0, fontFace: F, fontSize: 19, color: 'CADCFC', italic: true, lineSpacing: 26 });
  s.addText(foot || 'SMK Negeri 2 Cimahi  ·  Kokurikuler Kelas XI  ·  15–21 Juli 2026',
    { x: 0.9, y: 6.5, w: 11, h: 0.4, fontFace: F, fontSize: 12, color: '8FA6C4' });
  return s;
}

function sHead(p, title, kicker, accent) {
  const s = p.addSlide();
  s.addText(kicker, { x: 0.7, y: 0.42, w: 11.9, h: 0.3, fontFace: F, fontSize: 12, color: accent || BLUE, bold: true, charSpacing: 1.5 });
  s.addText(title, { x: 0.7, y: 0.72, w: 11.9, h: 0.75, fontFace: FH, fontSize: 32, color: NAVY, bold: true });
  return s;
}

function cards(p, s, items, { y = 1.85, h = 1.35, gap = 0.22, accent = BLUE } = {}) {
  items.forEach((it, i) => {
    const yy = y + i * (h + gap);
    s.addShape(p.ShapeType.roundRect, { x: 0.7, y: yy, w: 11.9, h, fill: { color: LIGHT }, line: { color: LINE, width: 1 }, rectRadius: 0.08 });
    s.addShape(p.ShapeType.ellipse, { x: 0.95, y: yy + h / 2 - 0.28, w: 0.56, h: 0.56, fill: { color: it.color || accent } });
    s.addText(it.tag, { x: 0.95, y: yy + h / 2 - 0.28, w: 0.56, h: 0.56, fontFace: F, fontSize: 13, color: WHITE, bold: true, align: 'center', valign: 'middle', margin: 0 });
    s.addText(it.title, { x: 1.72, y: yy + 0.14, w: 10.6, h: 0.4, fontFace: F, fontSize: 16, color: NAVY, bold: true, margin: 0 });
    s.addText(it.body, { x: 1.72, y: yy + 0.53, w: 10.6, h: h - 0.62, fontFace: F, fontSize: 13, color: GREY, margin: 0, lineSpacing: 17 });
  });
}

function sBig(p, { kicker, num, cap, note, accent, img }) {
  const s = p.addSlide();
  s.addText(kicker, { x: 0.7, y: 0.55, w: 11.9, h: 0.35, fontFace: F, fontSize: 13, color: accent, bold: true, charSpacing: 1.5 });
  s.addText(num, { x: 0.55, y: 1.15, w: 5.4, h: 2.6, fontFace: FH, fontSize: 120, color: accent, bold: true, align: 'center', valign: 'middle', margin: 0 });
  s.addText(cap, { x: 0.7, y: 3.85, w: 5.1, h: 0.9, fontFace: F, fontSize: 19, color: NAVY, bold: true, align: 'center', lineSpacing: 24 });
  s.addText(note, { x: 0.7, y: 4.85, w: 5.1, h: 1.8, fontFace: F, fontSize: 13.5, color: GREY, align: 'center', lineSpacing: 19 });
  if (img && fs.existsSync(img)) s.addImage({ path: img, x: 6.2, y: 1.0, w: 6.6, h: 5.6, sizing: { type: 'contain', w: 6.6, h: 5.6 } });
  return s;
}

function sImage(p, { kicker, title, img, note }) {
  const s = sHead(p, title, kicker, BLUE);
  if (fs.existsSync(img)) s.addImage({ path: img, x: 0.8, y: 1.6, w: 11.7, h: 5.0, sizing: { type: 'contain', w: 11.7, h: 5.0 } });
  if (note) s.addText(note, { x: 0.7, y: 6.75, w: 11.9, h: 0.4, fontFace: F, fontSize: 12, color: GREY, italic: true });
  return s;
}

// Sesi timeline slide (khusus guru)
function sSesi(p, { jam, judul, tujuan, langkah, bahan, macet, accent }) {
  const s = p.addSlide();
  s.addShape(p.ShapeType.roundRect, { x: 0.7, y: 0.4, w: 2.55, h: 0.55, fill: { color: accent }, rectRadius: 0.1 });
  s.addText(jam, { x: 0.7, y: 0.4, w: 2.55, h: 0.55, fontFace: F, fontSize: 14, color: WHITE, bold: true, align: 'center', valign: 'middle', margin: 0 });
  s.addText(judul, { x: 3.45, y: 0.38, w: 9.2, h: 0.6, fontFace: FH, fontSize: 26, color: NAVY, bold: true, valign: 'middle', margin: 0 });
  s.addText([{ text: 'Tujuan sesi: ', options: { bold: true } }, { text: tujuan }],
    { x: 0.7, y: 1.08, w: 11.9, h: 0.42, fontFace: F, fontSize: 13, color: BLUE, italic: true, margin: 0 });

  let y = 1.62;
  langkah.forEach(([t, isi]) => {
    const h = isi.length > 155 ? 1.02 : (isi.length > 85 ? 0.78 : 0.56);
    s.addShape(p.ShapeType.roundRect, { x: 0.7, y, w: 0.85, h: 0.42, fill: { color: LIGHT }, line: { color: accent, width: 1 }, rectRadius: 0.06 });
    s.addText(t, { x: 0.7, y, w: 0.85, h: 0.42, fontFace: F, fontSize: 12, color: accent, bold: true, align: 'center', valign: 'middle', margin: 0 });
    s.addText(isi, { x: 1.72, y: y - 0.02, w: 10.9, h: h, fontFace: F, fontSize: 12.5, color: '2B3A47', margin: 0, lineSpacing: 16 });
    y += h + 0.12;
  });

  s.addShape(p.ShapeType.roundRect, { x: 0.7, y: 6.28, w: 5.9, h: 0.85, fill: { color: 'FFF6E0' }, line: { color: 'BF8F00', width: 1 }, rectRadius: 0.06 });
  s.addText([{ text: 'BAHAN  ', options: { bold: true, color: '8A6400' } }, { text: bahan, options: { color: '6B5200' } }],
    { x: 0.9, y: 6.34, w: 5.6, h: 0.75, fontFace: F, fontSize: 10.5, margin: 0, lineSpacing: 13, valign: 'middle' });
  s.addShape(p.ShapeType.roundRect, { x: 6.75, y: 6.28, w: 5.85, h: 0.85, fill: { color: 'FDE8EF' }, line: { color: 'AD1457', width: 1 }, rectRadius: 0.06 });
  s.addText([{ text: 'KALAU MACET  ', options: { bold: true, color: '8C1046' } }, { text: macet, options: { color: '7A2244', italic: true } }],
    { x: 6.95, y: 6.34, w: 5.55, h: 0.75, fontFace: F, fontSize: 10.5, margin: 0, lineSpacing: 13, valign: 'middle' });
  return s;
}

function sQuote(p, { text, sub, accent }) {
  const s = p.addSlide();
  s.background = { color: NAVY };
  s.addShape(p.ShapeType.ellipse, { x: -2.0, y: 3.8, w: 6.4, h: 6.4, fill: { color: accent, transparency: 80 } });
  s.addText('"', { x: 0.7, y: 0.9, w: 2, h: 1.6, fontFace: FH, fontSize: 110, color: accent, bold: true, margin: 0 });
  s.addText(text, { x: 1.4, y: 2.3, w: 10.6, h: 2.6, fontFace: FH, fontSize: 30, color: WHITE, bold: true, lineSpacing: 40 });
  s.addText(sub, { x: 1.4, y: 5.2, w: 10.6, h: 1.0, fontFace: F, fontSize: 15, color: 'CADCFC', italic: true, lineSpacing: 22 });
  return s;
}

// ============================================================
// DEK 0 — BRIEFING GURU
// ============================================================
{
  const p = deck();
  const A = 'FFC000';
  sTitle(p, {
    kicker: 'BRIEFING GURU FASILITATOR',
    title: 'SAKOLA WALUYA',
    sub: 'Ngamimitian ti Diri, Mere Mangpaat pikeun Sakola\nKokurikuler Kelas XI · 15–21 Juli 2026',
    accent: A,
  }).addNotes('Durasi briefing: 60 menit. Ini bukan sosialisasi — ini latihan. Minta guru mempraktikkan satu teknik fasilitasi di akhir sesi.');

  let s = sHead(p, 'Kenapa kegiatan ini ada', 'DARI DATA, BUKAN DARI SELERA', RED);
  cards(p, s, [
    { tag: '1', color: RED, title: 'D.19 — Tujuh Kebiasaan Anak Indonesia Hebat = 6,57 (SEDANG)', body: 'Lima dari tujuh KURANG: Gemar Belajar 5,50 · Berolahraga 5,92 · Bermasyarakat 6,41 · Tidur Cepat 6,41 · Makan Sehat 6,44.' },
    { tag: '2', color: 'EF6C00', title: 'A.3 Karakter — Kreativitas 54,31 (terendah), Gotong Royong 54,70 (TURUN 3,09)', body: 'Gotong Royong adalah satu-satunya sub-dimensi karakter yang TURUN tahun ini.' },
    { tag: '3', color: NAVY, title: 'D.1.3 Metode Pembelajaran = 56,79 (TURUN 2,21)', body: 'Rapor menetapkannya sebagai AKAR MASALAH untuk EMPAT indikator prioritas: Kualitas Pembelajaran, Karakter, Literasi, dan Numerasi.' },
    { tag: '4', color: '6A1B9A', title: 'Sinyal bahaya lain', body: 'Sanitasi sekolah 30 (KURANG) · Wellbeing murid 59,30 (menengah bawah) · 30% murid terpapar rokok/miras · Perundungan naik.' },
  ], { h: 1.12, gap: 0.18 });
  s.addNotes('Jangan permanis angkanya. Guru harus merasakan urgensinya sendiri.');

  sBig(p, {
    kicker: 'VONIS RAPOR YANG PALING PENTING',
    num: '56,79', cap: 'D.1.3\nMetode Pembelajaran', accent: RED,
    note: 'Rapor sedang mengatakan:\ncara mengajar kita masih\nterlalu satu arah.\n\nLima hari ini adalah\nlatihan kita untuk berubah.',
    img: `${IMG}/03_Grafik_Skor_7KAIH.png`,
  }).addNotes('Ini slide paling penting dalam briefing. Beri jeda. Biarkan tidak nyaman.');

  s = sHead(p, 'ATURAN EMAS FASILITASI', 'WAJIB DIPATUHI SEMUA WALI KELAS', '2E7D32');
  cards(p, s, [
    { tag: '01', color: '2E7D32', title: 'Anda bicara maksimal 25% waktu sesi', body: 'Kalau Anda menerangkan 30 menit nonstop, sesi itu gagal. Karena Anda sendirian, tidak ada observasi silang — gantinya SWA-CEK GURU tiap akhir hari (Lampiran I).' },
    { tag: '02', color: '2E7D32', title: 'Jangan beri jawaban — beri pertanyaan', body: 'Tiga kalimat andalan: "Menurut kamu kenapa?" · "Apa buktinya?" · "Kalau begitu, apa yang bisa kita lakukan?"' },
    { tag: '03', color: '2E7D32', title: 'Setiap sesi harus ada murid BERDIRI / BERGERAK / BERPINDAH', body: 'Kalau murid duduk 90 menit tanpa bergerak, rancangan sesi tidak dijalankan.' },
    { tag: '04', color: '2E7D32', title: 'Maksimal 1 halaman slide per sesi', body: 'Paparan ini untuk ANDA, bukan untuk ditayangkan seluruhnya ke murid. Slide bertanda [TAYANG] saja yang boleh dilihat murid.' },
    { tag: '05', color: '2E7D32', title: 'Semua keputusan diambil murid', body: 'Bahkan waktu pun bukan tugas Anda lagi — itu tugas TIM WAKTU. Tugas Anda tinggal dua: jaga agar murid jujur, dan jaga agar mereka selamat.' },
  ], { h: 0.98, gap: 0.14, y: 1.7 });

  sImage(p, { kicker: 'KERANGKA', title: 'Pancawaluya × 7 KAIH × 8 Dimensi Profil Lulusan', img: `${IMG}/08_Pemetaan_Pancawaluya.png`, note: 'Setiap hari mengangkat satu nilai. Tidak ada nilai yang mengambang tanpa ikatan pada data rapor.' });
  sImage(p, { kicker: 'ALUR', title: 'Lima Hari, Lima Nilai', img: `${IMG}/07_Alur_5_Hari.png`, note: 'Pengalaman belajar mendalam: MEMAHAMI (H1–H2) → MENGAPLIKASI (H3–H4) → MEREFLEKSI (H5 + jurnal harian).' });
  sImage(p, { kicker: 'JADWAL', title: 'Struktur Harian', img: `${IMG}/09_Jadwal_Harian.png`, note: 'Hari 3 (Jumat 17 Juli) berakhir pukul 11.00 — Sesi 3 ditiadakan, diganti Jumat Berkah.' });

  // --- BATASAN: SATU GURU ---
  s = p.addSlide();
  s.background = { color: NAVY };
  s.addShape(p.ShapeType.ellipse, { x: 9.4, y: -1.4, w: 5.6, h: 5.6, fill: { color: 'FF6B6B', transparency: 78 } });
  s.addText('BATASAN YANG MENENTUKAN SEGALANYA', { x: 0.8, y: 0.9, w: 9, h: 0.4, fontFace: F, fontSize: 13, color: 'FF9B9B', bold: true, charSpacing: 1.5 });
  s.addText('Anda sendirian.', { x: 0.8, y: 1.4, w: 9, h: 1.0, fontFace: FH, fontSize: 44, color: WHITE, bold: true });
  s.addText('Tidak ada guru pendamping. Tidak ada Kaprog atau toolman. Tidak ada Guru BK yang standby di kelas Anda.', { x: 0.8, y: 2.55, w: 8.6, h: 0.9, fontFace: F, fontSize: 17, color: 'CADCFC', lineSpacing: 26 });
  s.addShape(p.ShapeType.roundRect, { x: 0.8, y: 3.7, w: 11.7, h: 2.9, fill: { color: 'FFFFFF', transparency: 90 }, line: { color: 'FF9B9B', width: 1 }, rectRadius: 0.06 });
  s.addText('Rancangan ini TIDAK menyiasati keterbatasan itu — rancangan ini MEMANFAATKANNYA.', { x: 1.1, y: 3.95, w: 11.1, h: 0.45, fontFace: F, fontSize: 17, color: WHITE, bold: true, margin: 0 });
  s.addText('Enam pekerjaan yang biasanya dipegang “guru kedua” — menjaga waktu, mengecek keselamatan, mencatat kehadiran, mengurus logistik — DISERAHKAN KEPADA MURID.\n\nDan itu justru yang menaikkan Gotong Royong (54,70 — satu-satunya sub-dimensi karakter yang TURUN) dan Kemandirian. Sekaligus memaksa guru benar-benar berhenti menjadi pusat kelas — yang persis merupakan akar masalah D.1.3.', { x: 1.1, y: 4.5, w: 11.1, h: 1.9, fontFace: F, fontSize: 14, color: 'CADCFC', margin: 0, lineSpacing: 21 });
  s.addNotes('Beri jeda di slide ini. Guru harus menerima batasan ini sebagai desain, bukan sebagai kekurangan.');

  // --- PERAN MURID ---
  s = sHead(p, 'Enam Peran MURID — Pengganti “Guru Kedua”', 'DIBENTUK HARI 1, SESI 3 · DIROTASI TIAP HARI', '2E7D32');
  cards(p, s, [
    { tag: '6x', color: '2E7D32', title: 'KAPTEN TIM (1 per tim)', body: 'Bertanggung jawab atas KEUTUHAN & KESELAMATAN anggota timnya di lapangan. Memegang Kartu Izin Jelajah. Lapor ke Pos tiap 20 menit.' },
    { tag: '2x', color: '2E7D32', title: 'TIM WAKTU', body: 'Memegang stopwatch. Mengumumkan sisa waktu. ANDA TIDAK LAGI MENGURUS WAKTU — serahkan sungguh-sungguh.' },
    { tag: '2x', color: '2E7D32', title: 'TIM PIKET DATA', body: 'Menjaga PAPAN KALUNG: pastikan tiap tim ambil & gantung kembali kalungnya. Cek tiap 20 menit — kait masih kosong lewat waktu? Beri tahu Anda.' },
    { tag: '2x', color: 'C62828', title: 'TIM K3', body: 'Memeriksa APD & alat tangan. BERWENANG MENGHENTIKAN pekerjaan yang tidak aman — murid lain WAJIB PATUH. Anda yang memberi wewenang itu, di depan kelas.' },
    { tag: '2x', color: '2E7D32', title: 'TIM DOKUMENTASI', body: 'Foto & video. Penanggung jawab foto BEFORE–AFTER Hari 5.' },
    { tag: '2x', color: '2E7D32', title: 'TIM LOGISTIK', body: 'Menyiapkan & MEMBERESKAN alat/bahan. Kelas tidak bubar sebelum mereka menyatakan beres.' },
  ], { h: 0.82, gap: 0.1, y: 1.65 });

  // --- POS FASILITATOR ---
  s = sHead(p, 'POS FASILITATOR', 'CARA MENGAWASI 6 TIM SENDIRIAN (HARI 2 & 3)', 'AD1457');
  s.addShape(p.ShapeType.roundRect, { x: 0.7, y: 1.65, w: 11.9, h: 0.95, fill: { color: 'FDE8EF' }, line: { color: 'AD1457', width: 1.5 }, rectRadius: 0.06 });
  s.addText([{ text: 'JANGAN ikut berkeliling bersama satu tim. ', options: { bold: true, color: '8C1046' } }, { text: 'Kalau Anda ikut Tim 1 ke toilet lantai 2, maka Tim 2–6 sedang tanpa pengawasan sama sekali. Anda MENETAP di POS. Murid yang bergerak, bukan Anda.', options: { color: '7A2244' } }],
    { x: 1.0, y: 1.7, w: 11.3, h: 0.85, fontFace: F, fontSize: 14, margin: 0, valign: 'middle', lineSpacing: 19 });
  cards(p, s, [
    { tag: 'POS', color: 'AD1457', title: 'Satu titik tetap', body: 'Ruang kelas, atau meja yang Anda pindahkan ke tengah zona. Isi: PAPAN POS · kotak Kartu Izin Jelajah · kotak P3K · nomor darurat (UKS, Satpam, Kepsek, Koordinator).' },
    { tag: '🪝', color: 'AD1457', title: 'PAPAN KALUNG — bukan kartu izin', body: '6 KAIT + 6 KALUNG WARNA di dinding. Tim BERANGKAT → ambil kalungnya. Tim PULANG → gantung kembali. KAIT KOSONG = tim masih di luar. ANDA TIDAK MENANDATANGANI APA PUN — kartu izin bertanda tangan guru memindahkan tanggung jawab hukum ke pundak Anda. Izin sudah melekat pada SEKTOR yang ditetapkan Koordinator.' },
    { tag: '20′', color: 'AD1457', title: 'Tim Piket cek papan tiap 20 menit', body: 'Ada kait kosong lewat waktu? Tim Piket memberi tahu Anda. Anda cukup kirim satu pesan ke grup WA kelas.' },
    { tag: '⚠️', color: 'C62828', title: 'Telat kembali = kalung ditahan', body: 'Tim itu tidak turun lapangan lagi hari itu — datanya dilanjutkan dari kelas. Jalankan konsekuensinya, atau sistem Pos runtuh besok.' },
  ], { h: 0.95, gap: 0.13, y: 2.75 });

  // --- TANPA BENGKEL ---
  s = sHead(p, 'Produksi Karya TANPA Bengkel', 'KEPUTUSAN KESELAMATAN — TIDAK BISA DITAWAR', 'C62828');
  s.addShape(p.ShapeType.roundRect, { x: 0.7, y: 1.6, w: 11.9, h: 1.15, fill: { color: 'FDE8EF' }, line: { color: 'C62828', width: 1.5 }, rectRadius: 0.06 });
  s.addText('Anda sendirian, dan belum tentu guru produktif dari jurusan kelas ini. Karena itu SELURUH produksi karya dilakukan DI DALAM KELAS — tanpa bengkel, tanpa mesin, tanpa bahan kimia berbahaya.\nIni bukan penurunan mutu. Purwarupa kardus yang BENAR-BENAR DIPASANG dan DIPAKAI jauh lebih bernilai daripada karya logam yang tak pernah keluar dari bengkel.',
    { x: 1.0, y: 1.68, w: 11.3, h: 1.0, fontFace: F, fontSize: 13.5, color: '7A2244', margin: 0, valign: 'middle', lineSpacing: 19 });
  s.addShape(p.ShapeType.roundRect, { x: 0.7, y: 2.95, w: 5.85, h: 3.6, fill: { color: 'E8F5E9' }, line: { color: '2E7D32', width: 1.5 }, rectRadius: 0.06 });
  s.addText('✅  BOLEH (diawasi Tim K3)', { x: 0.95, y: 3.1, w: 5.4, h: 0.35, fontFace: F, fontSize: 15, color: '1B5E20', bold: true, margin: 0 });
  s.addText('Gunting · cutter · gergaji tangan kecil · obeng · tang · palu kecil · amplas · meteran · lem putih · double tape busa · cable ties · stapler\n\nKardus tebal · pipa PVC · kayu ringan / triplek tipis · botol & kemasan bekas\n\nLaptop & HP (Canva, CapCut, Tinkercad, Wokwi — semua gratis)',
    { x: 0.95, y: 3.5, w: 5.4, h: 2.9, fontFace: F, fontSize: 12.5, color: '2B3A47', margin: 0, lineSpacing: 18 });
  s.addShape(p.ShapeType.roundRect, { x: 6.75, y: 2.95, w: 5.85, h: 3.6, fill: { color: 'FDE8EF' }, line: { color: 'C62828', width: 1.5 }, rectRadius: 0.06 });
  s.addText('⛔  DILARANG MUTLAK', { x: 7.0, y: 3.1, w: 5.4, h: 0.35, fontFace: F, fontSize: 15, color: 'B71C1C', bold: true, margin: 0 });
  s.addText('Mesin bubut · frais · gerinda · las (semua jenis) · bor listrik · kompresor · gergaji mesin\n\nListrik 220V · menyolder\n\nNaOH · asam kuat · bahan korosif · bahan mudah terbakar · api & pemanasan · reaksi eksotermik\n\nBekerja di ketinggian lebih dari 1 meter',
    { x: 7.0, y: 3.5, w: 5.4, h: 2.9, fontFace: F, fontSize: 12.5, color: '2B3A47', margin: 0, lineSpacing: 18 });
  s.addText('Butuh mesin? → Purwarupa 1:1 dari kardus/PVC + GAMBAR KERJA, diserahkan RESMI ke Wakasek Sarpras di Gelar Karya untuk difabrikasi kemudian. Itu TETAP dihitung sebagai Aksi Nyata.',
    { x: 0.7, y: 6.7, w: 11.9, h: 0.5, fontFace: F, fontSize: 12.5, color: NAVY, italic: true, bold: true, margin: 0 });

  // --- SUARA WALUYA ---
  s = sHead(p, '“SUARA WALUYA” — Pengganti Sticky Note', 'HARI 1, SESI 2 · GOOGLE FORM ANONIM', '6A1B9A');
  s.addShape(p.ShapeType.roundRect, { x: 0.7, y: 1.6, w: 11.9, h: 1.0, fill: { color: 'F3E5F5' }, line: { color: '6A1B9A', width: 1.5 }, rectRadius: 0.06 });
  s.addText('Sticky note fisik DIHAPUS. Sesi ini bisa memunculkan pengakuan perundungan/kekerasan — dan Anda sendirian, tanpa Guru BK di tempat. Google Form punya satu keunggulan yang tidak dimiliki sticky note: MURID BISA MEMINTA BANTUAN SENDIRI, LANGSUNG KE GURU BK, TANPA LEWAT ANDA.',
    { x: 1.0, y: 1.68, w: 11.3, h: 0.85, fontFace: F, fontSize: 13.5, color: '4A148C', margin: 0, valign: 'middle', lineSpacing: 19 });
  cards(p, s, [
    { tag: '1', color: '6A1B9A', title: 'Anda tidak mengatur apa pun', body: 'Tim ICT membuat Form SEKALI: 1 tautan + 1 QR untuk SELURUH kelas XI. Anda cukup menayangkan QR-nya. Gratis, anonim, murid tak perlu akun.' },
    { tag: '2', color: '6A1B9A', title: 'Isi Form (6 butir)', body: 'Kelas · yang membuatku BETAH · yang membuatku TIDAK NYAMAN · yang membuatku TIDAK AMAN (boleh kosong) · skala rasa aman 1–5 · ☐ Saya ingin bicara dengan Guru BK → isian nama (opsional).' },
    { tag: '3', color: '6A1B9A', title: 'Tetap ada GERAK', body: 'Hasil ditayangkan dari Sheet. Lalu murid MAJU ke papan, mengelompokkan jawaban, memberi judul, MENGHITUNG (numerasi). Ditutup “voting kaki”.' },
    { tag: '4', color: 'C62828', title: 'Yang TIDAK Anda lakukan', body: 'Anda TIDAK menindaklanjuti isian sensitif, TIDAK mencari tahu siapa, TIDAK membahasnya di kelas. Butir sensitif hanya dibaca Guru BK — dia menerima rekap di akhir Hari 1.' },
  ], { h: 0.95, gap: 0.13, y: 2.75 });

  // ===== SKALA 16 KELAS =====
  s = p.addSlide();
  s.background = { color: NAVY };
  s.addShape(p.ShapeType.ellipse, { x: 9.6, y: -1.5, w: 5.6, h: 5.6, fill: { color: 'FF6B6B', transparency: 78 } });
  s.addText('SKALA YANG SEBENARNYA', { x: 0.8, y: 0.9, w: 9, h: 0.4, fontFace: F, fontSize: 13, color: 'FF9B9B', bold: true, charSpacing: 1.5 });
  s.addText('16 kelas. 576 murid. 96 tim.', { x: 0.8, y: 1.4, w: 9.5, h: 1.0, fontFace: FH, fontSize: 40, color: WHITE, bold: true });
  s.addShape(p.ShapeType.roundRect, { x: 0.8, y: 2.7, w: 11.7, h: 1.5, fill: { color: 'FFFFFF', transparency: 90 }, line: { color: 'FF9B9B', width: 1 }, rectRadius: 0.06 });
  s.addText('Tanpa pengaturan, 96 tim akan turun lapangan serentak — berebut mengukur toilet & wastafel yang jumlahnya tetap, dan menyerbu Pak Caraka yang hanya beberapa orang.\n\nDi hari kedua, mitra sekolah akan menolak dilibatkan. Dan kita kehilangan jantung kegiatan ini.',
    { x: 1.1, y: 2.85, w: 11.1, h: 1.2, fontFace: F, fontSize: 14, color: 'CADCFC', margin: 0, lineSpacing: 21 });
  s.addText('DUA LAPIS PENGAMAN', { x: 0.8, y: 4.5, w: 9, h: 0.4, fontFace: F, fontSize: 13, color: 'FFC000', bold: true, charSpacing: 1.5 });
  s.addShape(p.ShapeType.roundRect, { x: 0.8, y: 5.0, w: 5.75, h: 1.6, fill: { color: '2E74B5' }, rectRadius: 0.06 });
  s.addText('LAPIS 1 — SEKTOR EKSKLUSIF', { x: 1.05, y: 5.15, w: 5.3, h: 0.35, fontFace: F, fontSize: 13, color: WHITE, bold: true, margin: 0 });
  s.addText('Tiap kelas punya objek data SENDIRI. Dilarang mengukur objek di sektor kelas lain. Butuh datanya? MINTA ke kelas itu.', { x: 1.05, y: 5.55, w: 5.3, h: 0.95, fontFace: F, fontSize: 12, color: 'DEEBF7', margin: 0, lineSpacing: 17 });
  s.addShape(p.ShapeType.roundRect, { x: 6.75, y: 5.0, w: 5.75, h: 1.6, fill: { color: 'C55A11' }, rectRadius: 0.06 });
  s.addText('LAPIS 2 — SISTEM GELOMBANG', { x: 7.0, y: 5.15, w: 5.3, h: 0.35, fontFace: F, fontSize: 13, color: WHITE, bold: true, margin: 0 });
  s.addText('8 kelas BIRU turun lapangan dulu, 8 kelas JINGGA di kelas — lalu bertukar. Maksimal 48 tim di lapangan, bukan 96.', { x: 7.0, y: 5.55, w: 5.3, h: 0.95, fontFace: F, fontSize: 12, color: 'FCE4D6', margin: 0, lineSpacing: 17 });
  s.addNotes('Bagikan Kartu Sektor & jadwal gelombang ke tiap wali kelas di akhir briefing.');

  sImage(p, { kicker: 'PENGATURAN LAPANGAN', title: 'Sektor Eksklusif + Sistem Gelombang', img: `${IMG}/14_Sektor_dan_Gelombang_16_Kelas.png`, note: 'Rincian lengkap 16 kelas: berkas 04_MATRIKS_OPERASIONAL_16_KELAS.xlsx (7 lembar kerja).' });

  sImage(p, { kicker: 'HARI 3 — NARASUMBER', title: 'NGAJUGJUG — Murid yang Menghampiri', img: `${IMG}/15_Ngajugjug_Narasumber.png`, note: 'Narasumber TIDAK dikumpulkan. Mereka tetap bekerja di tempatnya. Murid yang datang — 3 orang, 10 menit, sesuai slot.' });

  // ===== MARSHAL & ZONA MERAH =====
  s = sHead(p, 'Pengawasan Lapangan — MARSHAL WALUYA', 'TANPA GURU TAMBAHAN', 'AD1457');
  s.addShape(p.ShapeType.roundRect, { x: 0.7, y: 1.6, w: 11.9, h: 0.85, fill: { color: 'FDE8EF' }, line: { color: 'AD1457', width: 1.5 }, rectRadius: 0.06 });
  s.addText('Koordinator seorang diri tidak mungkin mengawasi 48 tim yang tersebar. Titik simpul dijaga MURID OSIS/MPK ber-rompi.',
    { x: 1.0, y: 1.68, w: 11.3, h: 0.7, fontFace: F, fontSize: 14, color: '7A2244', margin: 0, valign: 'middle', bold: true });
  cards(p, s, [
    { tag: '4–6', color: 'AD1457', title: 'Tangga utama tiap lantai — Marshal Waluya (OSIS)', body: 'Mengarahkan arus. Memastikan tidak ada murid sendirian. Mencatat tim yang keluar dari sektornya.' },
    { tag: '2–4', color: 'AD1457', title: 'Koridor antargedung — Marshal Waluya', body: 'Titik lapor cepat. Memegang daftar sektor 16 kelas.' },
    { tag: '2', color: 'C62828', title: 'Depan area MPLS kelas X — ZONA MERAH', body: 'MENAHAN tim XI yang mencoba masuk. Hanya boleh pada slot wawancara adik kelas X yang sudah dikoordinasikan dengan panitia MPLS.' },
    { tag: '2–3', color: 'C62828', title: 'Gerbang & parkir — SATPAM SEKOLAH', body: 'TIDAK ADA MURID KELUAR GERBANG. Ini garis merah mutlak.' },
    { tag: '2', color: 'AD1457', title: 'Koordinator + Wakasek Kesiswaan', body: 'Pengawas umum. Menerima laporan marshal. Tempat bertanya wali kelas yang kewalahan.' },
  ], { h: 0.9, gap: 0.12, y: 2.6 });

  s = sHead(p, 'Lima Zona Aksi Waluya', 'SETIAP KELAS MEMILIH SATU', '6A1B9A');
  cards(p, s, [
    { tag: 'Z1', color: '0277BD', title: 'CAI & KABERSIHAN — Air & Sanitasi', body: 'Dasar: Indeks Sanitasi sekolah = 30 (KURANG). Zona dengan justifikasi terkuat.' },
    { tag: 'Z2', color: 'EF6C00', title: 'DAHAR SEHAT — MBG, Gizi, Sampah Makanan', body: 'Dasar: Makan Sehat & Bergizi = 6,44 (KURANG). Terhubung langsung dengan MBG harian.' },
    { tag: 'Z3', color: '6A1B9A', title: 'BETAH DIAJAR — Gemar Belajar & Tidur Cepat', body: 'Dasar: Gemar Belajar = 5,50 (TERENDAH) · Tidur Cepat = 6,41 (KURANG).' },
    { tag: 'Z4', color: '2E7D32', title: 'AWAK BUGAR — Bergerak & Bugar', body: 'Dasar: Berolahraga = 5,92 (KURANG).' },
    { tag: 'Z5', color: 'AD1457', title: 'SAKOLA AMAN & SOMEAH — Aman, Ramah, Setara', body: 'Dasar: perundungan naik · 30% terpapar rokok/miras · wellbeing 59,30. BATASAN: data hanya lewat Form ANONIM. DILARANG mewawancarai korban. Karya diarahkan ke SISTEM (kanal lapor, papan info), bukan ke kasus.' },
  ], { h: 0.98, gap: 0.14, y: 1.7 });

  s = sHead(p, 'Bentuk Karya per Program Keahlian', 'TANPA BENGKEL — ALAT TANGAN & DIGITAL SAJA, DI KELAS', 'C55A11');
  cards(p, s, [
    { tag: 'MK', color: 'C55A11', title: 'Teknik Mekatronika', body: 'Dispenser sabun tekan/pedal dari botol bekas + tuas (MEKANIS, tanpa listrik) · indikator sampah penuh (mekanis/LED baterai) · SIMULASI rangkaian di Tinkercad/Wokwi (gratis, daring) + gambar teknis. Tanpa solder, tanpa 220V.' },
    { tag: 'RP', color: 'C55A11', title: 'Rekayasa Perangkat Lunak', body: 'Form lapor kerusakan sarpras (Form + Sheet + dasbor) · tracker 7 KAIH · sistem catat & rekap MBG · kuis 7 KAIH. Cukup laptop/HP.' },
    { tag: 'DK', color: 'C55A11', title: 'Desain Komunikasi Visual', body: 'Signage · wayfinding · infografis data · poster · ikon pemilahan sampah. Canva gratis. Dipasang dengan double tape / cable ties — TANPA bor.' },
    { tag: 'AN', color: 'C55A11', title: 'Animasi', body: 'PSA animasi 30–60 detik untuk IG/YouTube sekolah · explainer data · video anti-perundungan. Canva/CapCut/HP.' },
    { tag: 'KI', color: 'C55A11', title: 'Teknik Kimia Industri', body: 'Uji air dengan INDIKATOR ALAMI (kubis ungu/kunyit) + pH strip · ECO-ENZYME dari sisa kulit buah MBG jadi cairan pembersih · audit food waste 5 hari. Tanpa NaOH, tanpa api.' },
    { tag: 'PM', color: 'C55A11', title: 'Teknik Pemesinan', body: 'Purwarupa SKALA 1:1 dari kardus/PVC/kayu ringan (alat tangan) — DIPASANG & DIUJI Hari 5. GAMBAR KERJA diserahkan resmi ke Sarpras/Kaprog untuk difabrikasi kemudian.' },
  ], { h: 0.82, gap: 0.1, y: 1.65 });
  s.addNotes('Utamakan kardus & barang bekas — sejalan dengan SE Gubernur Jabar Langkah ke-3.');

  s = sHead(p, 'Asesmen', 'FORMATIF SETIAP HARI · SUMATIF DI HARI 5', BLUE);
  cards(p, s, [
    { tag: '30', title: 'Portofolio LK "Jurnal Waluya" — 30%', body: 'LK-1 s.d. LK-5 lengkap & jujur. Wali kelas membaca jurnal setiap malam dan membalas SATU kalimat.' },
    { tag: '40', title: 'Kinerja Tim: Gelar Karya & Aksi Nyata — 40%', body: 'Rubrik 3 dimensi (Penalaran Kritis · Kreativitas · Kolaborasi · Kesehatan), skala SB/B/C/K. Penilai: WALI KELAS (utama) + Kaprog (penilai teknis TAMU, hadir 60–90 menit) + OSIS.' },
    { tag: '15', title: 'Kampanye Digital — 15%', body: 'Konten terpublikasi di kanal resmi sekolah + SIPALAWA.' },
    { tag: '15', title: 'Kontrak Kebiasaan Waluya — 15%', body: 'Ditandatangani murid–orang tua–wali kelas. Dikembalikan paling lambat Jumat 24 Juli 2026.' },
  ], { h: 1.12, gap: 0.18 });

  sQuote(p, {
    text: 'Kalau hari Selasa 21 Juli tidak ada satu pun hal yang berubah secara nyata di SMKN 2 Cimahi, lima hari ini gagal.',
    sub: 'Bukan pameran. BERUBAH.\nSINGER: "tidak hanya berpikir dan berbicara, tetapi juga berani melakukan tindakan yang membawa manfaat."',
    accent: A,
  });

  p.writeFile({ fileName: `${OUT}/00_BRIEFING_GURU.pptx` }).then(() => console.log('OK 00_BRIEFING_GURU'));
}

// ============================================================
// DEK HARIAN
// ============================================================
const HARI = [
  {
    n: 1, hari: 'RABU, 15 JULI 2026', nilai: 'CAGEUR', aspek: 'Waluya Raga',
    fokus: 'KENALI DIRI', accent: '2E7D32',
    hasil: 'Setiap murid punya potret jujur 7 kebiasaannya, dan setiap kelas tahu posisinya dibanding data rapor sekolah.',
    tayang: {
      judul: 'Berapa Skor Kamu?',
      isi: 'Tulis angka 5,50 di papan tulis. DIAM. Jangan jelaskan apa-apa.',
      img: `${IMG}/03_Grafik_Skor_7KAIH.png`,
    },
    sesi: [
      { jam: '07.30–07.45', judul: 'PEMANTIK — "Berapa Skor Kamu?"',
        tujuan: 'Membuka hari dengan kejutan, bukan pengumuman.',
        langkah: [
          ["2'", 'Tulis SATU angka besar di papan: 5,50 — lalu DIAM. Jangan jelaskan apa pun. Biarkan murid bertanya-tanya.'],
          ["5'", 'Tanya: "Menurut kalian ini angka apa?" Tampung semua tebakan. Jangan dikoreksi.'],
          ["5'", 'Buka: "Ini skor GEMAR BELAJAR seluruh murid SMKN 2 Cimahi menurut Rapor Pendidikan 2025. Dari skala 10. Dan itu TERENDAH dari tujuh kebiasaan." Tayangkan slide berikutnya.'],
          ["3'", 'Tanya, lalu DIAM: "Kalian setuju atau tidak dengan angka itu?" Cukup. Jangan dibahas. Biarkan menggantung.'],
        ],
        bahan: 'Papan tulis + spidol; slide grafik 7 KAIH (slide berikutnya).',
        macet: 'Kalau murid tak bereaksi: "Berapa jam kalian belajar KEMARIN di luar jam sekolah? Angkat tangan kalau lebih dari 1 jam."',
      },
      { jam: '07.45–09.15', judul: 'SESI 1 — Barometer Kebiasaan & Radar Diriku',
        tujuan: 'Murid membuat potret jujur 7 kebiasaannya, lalu melihat wajah kolektif kelasnya. (TP-1)',
        langkah: [
          ["5'", 'Bagikan LK. Ucapkan persis: "Hari ini tidak ada jawaban benar atau salah. Yang saya nilai cuma satu: kejujuran kalian. Kalau kalian bohong hari ini, lima hari ke depan jadi sia-sia."'],
          ["25'", 'BAROMETER (murid BERDIRI & BERPINDAH). Bacakan 7 pernyataan. Murid pindah: KIRI = "Ini aku banget" · TENGAH = "Kadang-kadang" · KANAN = "Jauh dari aku". Tunjuk 1–2 murid acak: "Kenapa kamu berdiri di situ?" Dengarkan, ucapkan terima kasih. JANGAN dikomentari, JANGAN dinasihati.'],
          ["20'", 'Murid mengisi LK-1A: skor diri 1–10 tiap kebiasaan, lalu MENGGAMBAR SENDIRI Radar Kebiasaan. Guru berkeliling, tidak bicara.'],
          ["25'", 'DATA KELAS (latihan NUMERASI). 7 murid jadi "pencatat", masing-masing 1 kebiasaan. Rekap skor seluruh kelas di papan, HITUNG RATA-RATA. Bandingkan dengan skor rapor sekolah. Tanya: "Kelas kita di atas atau di bawah? Kenapa?"'],
          ["15'", 'DISKUSI 4–2–1. Berempat: bandingkan radar → pilih 2 kebiasaan paling bermasalah → sepakati 1 yang paling ingin diperbaiki. Tulis di LK-1B.'],
        ],
        bahan: 'LK-1; spidol; papan tulis; kalkulator/HP; Lampiran B Panduan Guru (7 pernyataan barometer).',
        macet: 'Kalau kelas pasif: GURU BERDIRI DULUAN dan jujur soal kebiasaan sendiri. Keterbukaan guru membuka murid.',
      },
      { jam: '09.30–11.00', judul: 'SESI 2 — “SUARA WALUYA”: Aman Nggak Sih Sekolah Ini?',
        tujuan: 'Menggali wellbeing & rasa aman lewat Google Form ANONIM. Menyasar D.4.1 (59,30) & D.4.10 (70%). Anda tidak menangani apa pun sendirian.',
        langkah: [
          ["5'", 'Ucapkan KALIMAT BAKU (Bagian 0.D Panduan Guru). PERSIS seperti tertulis, jangan diimprovisasi — ini soal keselamatan psikologis murid.'],
          ["3'", 'Tayangkan QR CODE “SUARA WALUYA” (minta ke koordinator — sudah jadi, Anda tidak perlu mengatur apa pun). Murid memindai dengan HP.'],
          ["12'", 'MURID MENGISI FORM. ANONIM. Anda DUDUK — jangan berkeliling melihat layar murid, itu merusak rasa aman. Murid tanpa HP: pinjamkan HP Anda setelah semua selesai, atau sediakan kertas lipat anonim.'],
          ["25'", 'Anda BUKA GOOGLE SHEET dan TAYANGKAN hasil KELAS ANDA (filter kolom “Kelas”). Murid melihat jawaban teman-temannya muncul TANPA NAMA. Beri waktu membaca dalam diam. Jangan berkomentar.'],
          ["30'", 'MENGELOMPOKKAN (murid BERGERAK ke papan). MURID — bukan Anda — maju, menyalin kata kunci, mengelompokkan yang mirip, memberi judul kategori, lalu MENGHITUNG jumlahnya (latihan numerasi). Salin ke LK-1C.'],
          ["10'", 'VOTING KAKI. Murid berdiri di depan kategori yang PALING MENDESAK menurutnya. Anda hanya bertanya: “Kategori mana paling banyak? Kenapa menurut kalian?” JANGAN membela sekolah. JANGAN berjanji apa pun.'],
          ["5'", 'Tutup: “Minggu ini kita tidak akan menyelesaikan semuanya. Tapi SATU dari ini akan benar-benar kita kerjakan.”'],
        ],
        bahan: 'QR “Suara Waluya” (dari koordinator) · proyektor · akses Google Sheet · HP murid · papan tulis. CADANGAN internet mati: kertas kecil + kotak tertutup.',
        macet: 'Ada isian berat di kolom “tidak aman”? Anda TIDAK menindaklanjuti, TIDAK mencari tahu siapa, TIDAK membahas di kelas. Itu sudah otomatis masuk ke Sheet yang dibaca Guru BK di akhir hari. Kalau Anda khawatir — hubungi BK/Koordinator hari itu juga. Jangan dipendam sendiri.',
      },
      { jam: '11.00–11.45', judul: 'SESI 3 — Zona, PERAN MURID & Norma Tim',
        tujuan: 'Menetapkan Zona Aksi, MEMBENTUK STRUKTUR PERAN MURID (inilah yang menggantikan guru kedua), dan menyepakati aturan main.',
        langkah: [
          ["8'", 'Tempel 5 poster Zona (cetak A3, folder 04_Gambar). Murid BERJALAN, membaca, berdiri di depan zona pilihannya — voting dengan kaki. Suara terpecah? Perwakilan berargumen 60 detik, voting ulang. KEPUTUSAN MURID.'],
          ["12'", 'BENTUK 6 TIM + 6 PERAN KELAS. Ucapkan: “Minggu ini saya sendirian…” Lalu bagi: KAPTEN TIM (6) · TIM WAKTU (2) · TIM PIKET DATA (2) · TIM K3 (2) · TIM DOKUMENTASI (2) · TIM LOGISTIK (2). BERI WEWENANG TIM K3 DI DEPAN KELAS: “Kalau Tim K3 bilang berhenti, semua berhenti. Termasuk saya.”'],
          ["10'", 'BACAKAN 5 ATURAN JELAJAH. Murid mengulanginya keras-keras. Pasang PAPAN KALUNG di dinding. Tim Piket Data menjelaskan: ambil kalung = berangkat, gantung = pulang. Kait kosong = tim masih di luar.'],
          ["12'", 'NORMA TIM (silih asih–silih asah–silih asuh). Kelas menulis 5 aturan main SENDIRI di plano. SEMUA murid MENANDATANGANI. Tempel sampai akhir semester.'],
          ["3'", 'Tim Logistik & Tim Waktu LANGSUNG bertugas: mereka yang membereskan kelas dan mengumumkan waktu habis. Mulai hari ini — bukan Anda.'],
        ],
        bahan: '5 poster Zona A3 · Papan Kalung (6 kait + 6 kalung) · kertas plano · spidol besar · lakban kertas.',
        macet: 'Kelas pilih zona “gampang”? Tanya: “Kalau ini selesai, apa yang benar-benar BERUBAH di sekolah?” | Murid enggan jadi Tim K3 karena takut menegur teman? Katakan: “Justru itu gunanya. Saya yang memberi kalian wewenang, dan saya yang akan membela kalian kalau ada yang membantah.”',
      },
    ],
    penutup: { text: 'Bacalah jurnal murid malam ini. Balas SATU kalimat di setiap buku.', sub: 'Bukan nilai. Bukan koreksi. Satu kalimat manusiawi.\nInilah yang membuat murid merasa dilihat — dan ini menyasar langsung wellbeing (D.4.1 = 59,30).' },
  },

  {
    n: 2, hari: 'KAMIS, 16 JULI 2026', nilai: 'BENER', aspek: 'Waluya Budhi',
    fokus: 'CARI FAKTA', accent: 'BF8F00',
    hasil: 'Kelas punya DATA nyata — angka, foto, hitungan — tentang masalah di zonanya. Bukan opini, bukan "katanya".',
    tayang: {
      judul: 'Aturan Hari Ini',
      isi: 'Setiap kalimat yang kamu tulis hari ini HARUS punya bukti: angka, foto, atau kutipan.\nKalau tidak ada buktinya — CORET.\n\nItulah arti BENER.',
      img: `${IMG}/04_Pohon_Akar_Masalah.png`,
    },
    sesi: [
      { jam: '07.30–07.45', judul: 'PEMANTIK — "Katanya vs Buktinya"',
        tujuan: 'Menanamkan nilai BENER: klaim tanpa bukti adalah omong kosong.',
        langkah: [
          ["5'", 'Tulis di papan: "Toilet sekolah kita kotor." Tanya: "Ini FAKTA atau OPINI?" Biarkan murid berdebat.'],
          ["5'", 'Dorong: "Bagaimana caranya ini jadi FAKTA?" Pancing sampai MURID SENDIRI menyebut: dihitung, diukur, difoto, ditanya ke orangnya.'],
          ["5'", 'Tutup dengan aturan hari ini: "Setiap kalimat yang kalian tulis di LK harus punya BUKTI. Kalau tidak ada buktinya, coret."'],
        ],
        bahan: 'Papan tulis.',
        macet: 'Murid langsung setuju itu fakta? Tanya: "Kotor menurut siapa? Seberapa kotor? Dibanding apa?"',
      },
      { jam: '07.45–09.15', judul: 'SESI 1 — TURUN LAPANGAN (SISTEM POS)',
        tujuan: 'Mengumpulkan data kuantitatif nyata. (TP-2) Latihan NUMERASI kontekstual — 4,44% murid kita kini “jauh di bawah kompetensi”.',
        langkah: [
          ["10'", 'SIAPKAN POS. Anda MENETAP di Pos sepanjang sesi. Tim Piket Data memasang Papan Kalung. Tim K3 memeriksa APD tiap tim (sarung tangan & masker untuk area kotor).'],
          ["5'", 'TIM AMBIL KALUNGNYA dari Papan Kalung. Tim Piket mencatat. ANDA TIDAK MENANDATANGANI APA PUN. Bacakan ulang Aturan Jelajah no. 1 & 5.'],
          ["55'", 'TIM TURUN LAPANGAN. ANDA TETAP DI POS — JANGAN ikut satu tim, karena 5 tim lain akan tanpa pengawasan. Kapten melapor tiap 20 menit. Tim Piket Data mencentang. Anda boleh berkeliling maks 5 menit, HANYA ke lokasi yang masih TERLIHAT dari Pos.'],
          ["20'", 'Tim Waktu membunyikan tanda kembali. Tiap tim WAJIB membawa: (a) 10 baris data angka, (b) 5 foto, (c) 1 hal yang mengejutkan. Tulis di LK-2A apa adanya — BELUM dianalisis. Panduan data per zona: Lampiran D.'],
        ],
        bahan: 'LK-2 · Papan Kalung (6 kait + 6 kalung) · HP · meteran · stopwatch · sarung tangan & masker · KOTAK P3K · nomor darurat.',
        macet: 'Tim pulang tangan kosong? Kirim balik dengan tugas SANGAT spesifik: “Hitung berapa detik air mengisi 1 gelas. Di 5 keran berbeda. Kembali dengan angka.” | TIM TELAT KEMBALI? Tahan kartunya. Tim itu tidak turun lapangan lagi hari ini. Jalankan konsekuensinya, atau sistem Pos runtuh besok.',
      },
      { jam: '09.30–11.00', judul: 'SESI 2 — Data Jadi Cerita',
        tujuan: 'Mengubah angka mentah jadi grafik dan makna. Menggarap Numerasi + Literasi L3 (turun 5,62).',
        langkah: [
          ["25'", 'Tim mengolah data: total, rata-rata, persentase. Lalu MENGGAMBAR TANGAN satu grafik di kertas plano (batang/lingkaran/garis — tim yang pilih). Guru berkeliling, HANYA bertanya: "Angka ini artinya apa?"'],
          ["20'", 'GALERI DATA (murid BERJALAN). Semua plano ditempel. Murid berkeliling melihat plano tim lain, menempel sticky note berisi 1 pertanyaan atau 1 temuan yang mengejutkan.'],
          ["30'", 'POHON AKAR MASALAH (LK-2B). BUAH = akibat terlihat · BATANG = masalahnya · AKAR = penyebab sebenarnya. Tantang dengan 5x KENAPA. Contoh: "Toilet bau" → kenapa? → "air tak jalan" → kenapa? → "keran rusak" → kenapa? → "tak ada yang lapor" → kenapa? → "tak tahu lapor ke mana". NAH ITU AKARNYA — dan itu bisa dikerjakan RPL.'],
          ["15'", 'Tulis SATU kalimat rumusan: "Masalah sebenarnya adalah ___, karena ___, dibuktikan dengan data ___."'],
        ],
        bahan: 'Kertas plano (1/tim); spidol warna; sticky note; kalkulator/HP; LK-2. Template Pohon Akar Masalah: folder 04_Gambar.',
        macet: 'Tim berhenti di akar dangkal ("karena murid malas")? Tolak halus: "Itu menyalahkan orang, bukan menemukan akar. Kalau muridnya malas, KENAPA malas? Sistem apa yang bikin dia malas?"',
      },
      { jam: '11.00–11.45', judul: 'SESI 3 — Konsolidasi Temuan Kelas',
        tujuan: 'Menggabungkan temuan semua tim jadi satu potret kelas.',
        langkah: [
          ["20'", 'Presentasi KILAT tiap tim: 2 menit, WAJIB menyebut 1 angka & 1 akar masalah. Tim lain memberi 1 pertanyaan.'],
          ["15'", 'Kelas menyusun DAFTAR MASALAH di papan (biasanya 5–8 masalah). Ini bahan wajib untuk Hari 3.'],
          ["10'", 'Tutup: "Besok kita tidak menambah data. Besok kita akan MENDENGARKAN orang. Karena data belum tentu tahu rasanya."'],
        ],
        bahan: 'Papan tulis; hasil plano tim.',
        macet: 'Waktu habis? Pangkas presentasi jadi 1 menit/tim. Yang penting DAFTAR MASALAH kelas JADI hari ini.',
      },
    ],
    penutup: { text: 'Data belum tentu tahu rasanya.', sub: 'Besok kita berhenti mengukur. Besok kita mendengarkan manusia.' },
  },

  {
    n: 3, hari: 'JUMAT, 17 JULI 2026 — SELESAI 11.00', nilai: 'BAGEUR', aspek: 'Waluya Rasa',
    fokus: 'RASAKAN & PILIH', accent: 'AD1457',
    hasil: 'Kelas memilih SATU masalah prioritas — bukan berdasarkan angka saja, tapi berdasarkan siapa yang paling terdampak.',
    tayang: {
      judul: 'Aturan Wawancara',
      isi: 'TANYA → DENGAR → JANGAN MEMOTONG → TANYA LAGI "KENAPA"\n\nJangan: "Toiletnya kotor ya, Pak?"  (menggiring)\nTapi: "Bapak, boleh cerita, bagian mana dari pekerjaan Bapak yang paling melelahkan?"  (membuka)',
      img: `${IMG}/06_Template_Peta_Empati.png`,
    },
    catatan: 'HARI INI HANYA 4 JP. Sesi 3 DITIADAKAN. Berakhir 11.00, lanjut Shalat Jumat. Jangan memaksakan produksi hari ini — itu jatah Hari 4.',
    sesi: [
      { jam: '07.30–07.45', judul: 'PEMANTIK — "Siapa yang Paling Merasakan?"',
        tujuan: 'Memindahkan fokus dari MASALAH ke MANUSIA. Ini inti nilai BAGEUR.',
        langkah: [
          ["5'", 'Tanya, lalu DIAM LAMA: "Dari semua masalah yang kalian temukan kemarin — SIAPA yang paling menderita karenanya? Sebut orangnya, bukan kelompoknya."'],
          ["7'", 'Dorong sampai murid menyebut orang konkret: adik kelas X yang baru masuk · murid perempuan yang butuh toilet bersih · Pak Caraka yang membersihkan tiap hari · Ibu kantin · satpam · murid dengan penyakit tertentu.'],
          ["3'", 'Tutup: "Hari ini kita tidak mengukur apa-apa. Hari ini kita MENDENGARKAN mereka."'],
        ],
        bahan: 'Papan tulis; daftar masalah kelas dari Hari 2.',
        macet: 'Murid jawab "semua orang"? TOLAK. "Semua orang artinya tidak ada orang. Sebut SATU nama atau SATU peran."',
      },
      { jam: '07.45–09.15', judul: 'SESI 1 — TURUN LAPANGAN: Wawancara Empati',
        tujuan: 'Mewawancarai warga sekolah nyata. (TP-3) Menyasar Gotong Royong 54,70 (TURUN) & Bermasyarakat 6,41 (KURANG).',
        langkah: [
          ["15'", 'LATIHAN BERTANYA. Demonstrasikan pertanyaan BURUK vs BAIK (lihat slide [TAYANG]). Murid berlatih berpasangan 5 menit.'],
          ["55'", 'SISTEM POS BERLAKU LAGI. Anda MENETAP di Pos. Tim ambil kalung dari papan ulang (tujuan berbeda). Tim mewawancarai min. 3 orang: Caraka · Satpam · Ibu/Bapak Kantin · murid kelas X · petugas MBG · OSIS. WAJIB membawa 3 KUTIPAN LANGSUNG (kalimat PERSIS, dalam tanda kutip) + nama & peran. Lapor balik tiap 20 menit.'],
          ["5'", 'KHUSUS KELAS ZONA Z5: murid TIDAK BOLEH mewawancarai korban perundungan atau menanyakan pengalaman pribadi yang menyakitkan. Yang boleh ditanya hanya PENGETAHUAN tentang sistem: “Kalau ada yang dirundung, dia lapor ke mana?” Karya diarahkan ke SISTEM, bukan ke kasus.'],
          ["15'", 'Kembali ke kelas. Tulis kutipan di LK-3A.'],
        ],
        bahan: 'LK-3; alat tulis; HP untuk merekam (WAJIB minta izin dulu). Koordinator sudah memberi tahu Caraka, Satpam & kantin SEHARI SEBELUMNYA — jangan sampai mereka kaget dan merasa diintervensi.',
        macet: 'Narasumber menolak atau sibuk? Jangan dipaksa. Ganti narasumber. Ajarkan murid mengucapkan terima kasih meski ditolak — itu juga BAGEUR.',
      },
      { jam: '09.30–10.30', judul: 'SESI 2 — Peta Empati & Voting Masalah Prioritas',
        tujuan: 'Menggabungkan data (Hari 2) + suara manusia (hari ini) menjadi SATU keputusan.',
        langkah: [
          ["20'", 'PETA EMPATI (LK-3B). Pilih SATU narasumber utama. Isi 4 kuadran: APA YANG DIA KATAKAN · DIA LAKUKAN · DIA PIKIRKAN · DIA RASAKAN. Berdasarkan kutipan & pengamatan NYATA, bukan tebakan.'],
          ["20'", 'MATRIKS PRIORITAS (LK-3C). Petakan semua masalah pada 2 sumbu: DAMPAK × BISA KAMI KERJAKAN (dalam 2 hari, dengan keahlian kami). Kuadran kanan-atas = kandidat.'],
          ["15'", 'VOTING TERBUKA (murid BERDIRI). Setiap murid dapat 3 titik/stiker, tempel pada masalah pilihannya (boleh menumpuk). Terbanyak MENANG. KEPUTUSAN MURID.'],
          ["5'", 'Tulis di plano besar, tempel di dinding: "MASALAH KAMI: ___. ORANG YANG KAMI BANTU: ___. TARGET SELESAI SELASA 21 JULI: ___."'],
        ],
        bahan: 'LK-3; stiker/titik warna (3/murid); kertas plano; daftar masalah Hari 2. Template Peta Empati & Matriks Prioritas: folder 04_Gambar.',
        macet: 'Kelas memilih masalah MUSTAHIL (mis. "renovasi seluruh toilet")? Jangan larang. Tanya: "Bagian MANA dari itu yang bisa benar-benar selesai hari Selasa?" Lebih baik satu wastafel benar-benar berfungsi daripada sepuluh gambar rencana.',
      },
    ],
    penutup: { text: '10.30–11.00 · JUMAT BERKAH + REFLEKSI', sub: 'Tausiyah singkat "menolong yang tidak terlihat", lalu murid MENYERAHKAN hasil temuan + ucapan terima kasih tertulis kepada Caraka / Satpam / Ibu Kantin yang mereka wawancarai.\nPanduan Kokurikuler 2025: "mitra harus mendapatkan umpan balik atau manfaat." Murid dilepas 11.00 untuk Shalat Jumat.' },
  },

  {
    n: 4, hari: 'SENIN, 20 JULI 2026', nilai: 'PINTER', aspek: 'Waluya Hirup',
    fokus: 'RANCANG & BUAT', accent: '1F3864',
    hasil: 'Purwarupa versi 1 sudah ada wujudnya (walau jelek) dan draf kampanye digital sudah jadi. HARI TERSIBUK.',
    tayang: {
      judul: 'JELEK DULUAN, BAGUS BELAKANGAN',
      isi: 'Jangan habiskan 3 jam menggambar rancangan yang indah.\n\nDalam 90 menit pertama harus sudah ada BENDA / LAYAR / GAMBAR yang bisa disentuh — walaupun jelek.\n\nPurwarupa jelek yang bisa diuji jauh lebih berharga daripada rancangan cantik yang tidak pernah jadi.',
      img: `${IMG}/05_Template_Matriks_Prioritas.png`,
    },
    sesi: [
      { jam: '07.30–07.45', judul: 'PEMANTIK — "Bikin dalam 5 Menit"',
        tujuan: 'Mematahkan rasa takut memulai.',
        langkah: [
          ["3'", 'Bagikan kertas HVS, gunting, lakban. Perintah: "Kalian punya 5 menit. Buat SESUATU yang bisa menyelesaikan masalah kalian. Boleh jelek. Boleh konyol. Yang penting ADA WUJUDNYA."'],
          ["5'", 'Tim bekerja. HITUNG MUNDUR DENGAN KERAS. Tekanan waktu adalah bagian dari latihan — Pancawaluya menyebutnya melatih ketahanan menghadapi "deadline industri".'],
          ["7'", 'Tiap tim mengangkat karyanya 30 detik. Tidak ada penilaian. Tutup: "Nah. Kalian baru saja membuat sesuatu dalam 5 menit. Bayangkan kalau punya 3 jam."'],
        ],
        bahan: 'Kertas HVS bekas, gunting, lakban kertas, spidol.',
        macet: 'Tim membeku dan tidak membuat apa-apa? Itu bukan masalah. "Berarti pertanyaannya belum jelas. Ayo kita perjelas dulu." Bantu menajamkan rumusan masalah.',
      },
      { jam: '07.45–09.15', judul: 'SESI 1 — Ideasi & Rancangan Teknis',
        tujuan: 'Melahirkan banyak ide, lalu memilih satu yang BISA dikerjakan dengan alat tangan & perangkat digital. (TP-4)',
        langkah: [
          ["20'", 'BADAI IDE 6-3-5 (SENYAP, CEPAT). 6 orang/meja. Tiap orang menulis 3 IDE dalam 5 MENIT, lalu MENGGESER lembarnya ke kanan. Penerima MENGEMBANGKAN, bukan mengkritik. 3 putaran → puluhan ide dalam 15 menit, tanpa ada yang mendominasi bicara.'],
          ["8'", 'TAYANGKAN BATASAN ALAT. Jujur saja: “Kita tidak masuk bengkel minggu ini. Tidak ada mesin, tidak ada las, tidak ada bahan kimia berbahaya. Semua dikerjakan di kelas ini, dengan tangan kalian dan HP/laptop kalian.” Lalu tantang: “Justru itu tantangannya — bisa tidak kalian bikin sesuatu yang BENAR-BENAR DIPAKAI, hanya dengan kardus dan otak kalian?”'],
          ["12'", 'Pilih 1 ide dengan 4 SYARAT: (a) MEMAKAI kompetensi keahlian kelas kami · (b) BISA tanpa mesin & tanpa bahan berbahaya · (c) SELESAI dalam 2 hari · (d) benar-benar MENOLONG orang yang kami wawancarai kemarin. Tidak lolos keempatnya? BUANG.'],
          ["30'", 'RANCANGAN TEKNIS (LK-4B). Mekatronika: diagram blok + tautan simulasi Tinkercad/Wokwi. RPL: user flow + 3 sketsa layar. DKV: layout + palet + titik pasang. Animasi: storyboard 6 panel + naskah 30 detik. Kimia: prosedur uji / resep eco-enzyme + LEMBAR K3. Pemesinan: GAMBAR KERJA + UKURAN + bahan kardus/PVC.'],
          ["20'", 'DAFTAR BAHAN. Tim mengambil SENDIRI dari kotak bahan kelas (disiapkan Tim Logistik). Utamakan KARDUS & BARANG BEKAS. Bahan yang belum ada? MURID sendiri yang menulis permintaan ke koordinator — bukan Anda.'],
        ],
        bahan: 'LK-4 · kotak alat tangan & bahan bekas per kelas · HP/laptop · tinkercad.com atau wokwi.com (gratis, tanpa instal).',
        macet: 'Semua tim usul ide sama? BAGUS — minta tiap tim mengerjakan BAGIAN berbeda dari solusi yang sama. | Murid protes “kok nggak boleh ke bengkel?” Jawab jujur: “Karena saya sendirian, dan saya tidak mau ada yang celaka di tangan saya. Gambar kerja kalian tetap akan dibuat — Kaprog memfabrikasinya setelah kegiatan ini. Yang kalian buat minggu ini adalah purwarupanya, dan purwarupa itu yang akan DIPASANG dan DIUJI.”',
      },
      { jam: '09.30–11.00', judul: 'SESI 2 — PRODUKSI PURWARUPA v1 (DI KELAS)',
        tujuan: 'Mewujudkan. Dengan tangan, kardus, dan layar. “Jelek duluan, bagus belakangan.”',
        langkah: [
          ["8'", 'BRIEFING K3 — oleh TIM K3 (MURID), bukan oleh Anda. Mereka membacakan Daftar Alat Boleh/Dilarang, membagikan APD, mengecek alat tangan. Anda hanya menegaskan: “Kalau Tim K3 bilang berhenti, semua berhenti. Termasuk saya.”'],
          ["70'", 'TIM BEKERJA DI DALAM KELAS. Meja digeser. Anda BERJALAN, tidak duduk. Tugas Anda hanya TIGA: (1) mengawasi cutter & gergaji tangan bersama Tim K3, (2) bertanya “apa kendalanya?” — bukan “kenapa belum selesai?”, (3) mengisi Catatan Anekdotal (3 catatan cukup). JANGAN MENGERJAKAN KARYA MURID. Sekali Anda memegang gunting “supaya cepat”, kepemilikan murid atas karyanya hilang — dan mereka tidak akan merawatnya.'],
          ["12'", 'Tim Logistik memimpin pembersihan. Alat dikembalikan & DIHITUNG ULANG oleh Tim K3 (pastikan tidak ada cutter yang hilang). Kelas tidak bubar sebelum Tim Logistik menyatakan beres.'],
        ],
        bahan: 'RUANG KELAS (meja digeser). Alat tangan: gunting, cutter, gergaji tangan kecil, obeng, lem, double tape, cable ties, amplas. Bahan: kardus tebal, PVC, kayu ringan, botol bekas. Laptop/HP. APD: sarung tangan & masker.',
        macet: 'Bahan kurang? JANGAN batalkan — UBAH SKALA. Purwarupa boleh dari kardus, styrofoam, atau seluruhnya digital. Yang dinilai IDE & PROSES, bukan kemewahan bahan. | Ada murid main-main dengan cutter? TIM K3 yang menegur lebih dulu. Kalau tak digubris, baru Anda turun tangan — dan tarik alatnya. Sekali. Tanpa negosiasi.',
      },
      { jam: '11.00–11.45', judul: 'SESI 3 — "Silih Asah": Uji Silang Antartim',
        tujuan: 'Umpan balik teman sebaya. Praktik langsung falsafah silih asah.',
        langkah: [
          ["10'", 'Semua purwarupa v1 dipajang. Kelas dibagi dua: separuh MENJAGA karyanya, separuh BERKELILING sebagai penguji.'],
          ["20'", 'Penguji mengisi Lembar Silih Asah (LK-4C) untuk 3 tim lain. Format WAJIB: "Yang SUDAH JALAN: ___" · "Yang BELUM JALAN: ___" · "Satu SARAN saya: ___". DILARANG menulis "bagus" tanpa alasan. DILARANG menyerang orangnya. Lalu bertukar peran.'],
          ["15'", 'Tiap tim membaca semua masukan, lalu menuliskan SATU perbaikan yang akan dikerjakan besok pagi.'],
        ],
        bahan: 'LK-4C; meja pajang.',
        macet: 'Umpan balik cuma pujian kosong? KEMBALIKAN lembarnya. "Ini belum menolong temanmu. Tulis satu hal yang BELUM jalan." Kritik yang jujur adalah bentuk kasih sayang — itulah silih asih.',
      },
    ],
    penutup: { text: 'Jangan pernah memegang alat murid "supaya cepat selesai".', sub: 'Sekali Anda mengerjakannya, karya itu bukan milik mereka lagi.\nDan kalau bukan milik mereka, mereka tidak akan merawatnya.' },
  },

  {
    n: 5, hari: 'SELASA, 21 JULI 2026', nilai: 'SINGER', aspek: 'Waluya Karsa',
    fokus: 'BERTINDAK & BERBAGI', accent: 'C55A11',
    hasil: 'Karya TERPASANG di sekolah (bukan cuma dipamerkan), kampanye digital TERBIT, dan setiap murid menandatangani Kontrak Kebiasaan Waluya.',
    tayang: {
      judul: 'PRESENTASI 60 DETIK',
      isi: 'Hafalkan formula ini untuk Gelar Karya:\n\nKami MENEMUKAN  →  (sebut 1 ANGKA)\nKami MENDENGAR  →  (sebut 1 KUTIPAN narasumber)\nKami MEMBUAT     →  (sebut KARYA-nya)\nSekarang               →  (sebut PERUBAHAN-nya)',
      img: `${IMG}/01_Radar_Kebiasaan_KOSONG.png`,
    },
    sesi: [
      { jam: '07.30–07.45', judul: 'PEMANTIK — Perbaikan Kilat',
        tujuan: 'Menutup masukan Hari 4 sebelum aksi.',
        langkah: [
          ["15'", 'Tim langsung mengerjakan SATU perbaikan yang mereka tulis kemarin sore. Guru TIDAK BICARA sama sekali, hanya menghitung waktu. Pukul 07.45 semua alat turun.'],
        ],
        bahan: 'Purwarupa v1; alat seadanya.',
        macet: 'Ada tim yang purwarupanya GAGAL TOTAL? Itu DATA, bukan aib. Minta mereka mempresentasikan kegagalannya di Gelar Karya dengan judul "Apa yang kami pelajari dari kegagalan ini." Ini justru salah satu presentasi paling kuat — dan sejalan dengan CAGEUR: ketahanan mental.',
      },
      { jam: '07.45–09.15', judul: 'SESI 1 — AKSI NYATA (sistem POS)',
        tujuan: 'Memasang, menjalankan, memperbaiki. INI PUNCAKNYA. (TP-4)',
        langkah: [
          ["10'", 'Tim ambil kalung. Tim K3 memeriksa alat & APD. Tim Dokumentasi mengambil FOTO “BEFORE” — WAJIB, dari sudut yang akan diulang. Tanpa foto before, tidak ada bukti perubahan.'],
          ["60'", 'TIM BEKERJA DI TITIK SASARAN. Anda MENETAP DI POS yang dipindahkan ke dekat titik aksi. Yang dikerjakan: memasang tempat sampah pilah kardus · menempel signage & infografis · memasang dispenser sabun mekanis · menguji & mencatat kualitas air · meluncurkan aplikasi ke pengguna nyata · menggelar jeda gerak percontohan · menyerahkan eco-enzyme ke petugas kebersihan.'],
          ["5'", 'PEMASANGAN TANPA BOR: cable ties · double tape busa · gantungan tempel · tali · benda berdiri bebas · memakai paku/kait YANG SUDAH ADA. HARUS MENGEBOR? JANGAN. Tim menulis SURAT PERMOHONAN PEMASANGAN (ditulis MURID) untuk diserahkan ke Wakasek Sarpras di Gelar Karya.'],
          ["10'", 'FOTO “AFTER” dari SUDUT YANG SAMA. Tempel di LK-5A.'],
          ["5'", 'Tiap tim MENEMUI MITRA yang diwawancarai Hari 3 dan MENUNJUKKAN hasilnya. Minta 1 kalimat tanggapan. Catat di LK.'],
        ],
        bahan: 'Karya jadi · alat tangan (obeng, gunting, lakban, cable ties, double tape) · IZIN TITIK AKSI dari Wakasek Sarpras (SUDAH ADA sejak H-3) · HP · Papan Kalung.',
        macet: 'Izin pemasangan belum turun? JANGAN memasang diam-diam. Ubah jadi “pemasangan simulasi”: pasang, foto, lepas kembali. Lalu serahkan karyanya RESMI ke Wakasek Sarpras di Gelar Karya, disertai surat permohonan yang ditulis MURID. Itu pelajaran kewargaan yang bagus — dan TETAP dihitung sebagai Aksi Nyata.',
      },
      { jam: '09.30–11.00', judul: 'SESI 2 — GELAR KARYA WALUYA',
        tujuan: 'Mengomunikasikan. (TP-5) Sekaligus asesmen sumatif dengan rubrik.',
        langkah: [
          ["15'", 'Tim Logistik & Tim Dokumentasi menata stan (1 kelas 1 stan). WAJIB memajang: karya · plano data & grafik · foto BEFORE–AFTER · kutipan narasumber · Peta Empati. Kelas Pemesinan juga memajang GAMBAR KERJA yang akan diserahkan.'],
          ["50'", 'PAMERAN TERBUKA. Pengunjung: murid kelas XI · Kepala Sekolah · Kaprog (sebagai PENILAI TEKNIS TAMU, bukan fasilitator) · OSIS · Komite · dan MITRA YANG DIWAWANCARAI (Caraka, Satpam, Ibu Kantin — UNDANG MEREKA). MURID yang bicara, bukan Anda. Formula 60 detik: “Kami menemukan [ANGKA]. Kami mendengar [KUTIPAN]. Kami membuat [KARYA]. Sekarang [PERUBAHAN].”'],
          ["10'", 'PENYERAHAN RESMI. Tim yang karyanya butuh fabrikasi mesin menyerahkan GAMBAR KERJA + SURAT PERMOHONAN kepada Wakasek Sarpras/Kaprog, DI DEPAN PENGUNJUNG. Ini momen kewargaan — jangan dilewatkan. Pastikan Tim Dokumentasi memotretnya.'],
          ["10'", 'PENILAIAN. ANDA (penilai utama) + Kaprog (penilai teknis tamu) + perwakilan OSIS mengisi Rubrik Kinerja (3 dimensi: kreativitas/kolaborasi/kesehatan, SB/B/C/K — Lampiran E).'],
          ["5'", 'APRESIASI (bukan juara): “Data Paling Jujur” · “Karya Paling Berguna” · “Tim Paling Silih Asuh” · “Kegagalan Paling Berharga”.'],
        ],
        bahan: 'Aula/lapangan/lorong · meja per kelas · lembar rubrik · kamera. Kaprog diundang 60–90 menit saja.',
        macet: 'Aula tidak tersedia? Gelar karya di lorong/koridor per lantai (“Gelar Karya Lorong”). Justru lebih banyak yang lewat dan melihat. Tidak perlu panggung.',
      },
      { jam: '11.00–11.45', judul: 'SESI 3 — Kampanye Digital & KONTRAK KEBIASAAN WALUYA',
        tujuan: 'Menutup lingkaran: dari sekolah ke publik, dan dari projek kembali ke DIRI. (TP-5 & TP-6)',
        langkah: [
          ["15'", 'PUBLIKASI. DKV & Animasi menyerahkan konten final ke Tim ICT untuk diunggah ke IG & YouTube SMKN 2 Cimahi. Kelas lain menyerahkan 1 foto + 1 kalimat caption. Unggah juga ke SIPALAWA (sipalawa.jabarprov.go.id) sebagai bukti pelaksanaan.'],
          ["10'", 'RADAR KEBIASAAN ULANG (LK-5B). Murid mengisi ulang dan MEMBANDINGKAN dengan Radar Hari 1. Tanya: "Apa yang berubah dalam 5 hari? Apa yang TIDAK berubah? Kenapa?"'],
          ["15'", 'KONTRAK KEBIASAAN WALUYA (LK-5C). Tiap murid memilih SATU kebiasaan 7 KAIH sampai akhir semester. Tulis: apa · kapan tepatnya (jam berapa) · bagaimana mengukurnya · siapa yang mengingatkan. Ditandatangani MURID, dibawa pulang untuk tanda tangan ORANG TUA, dikembalikan paling lambat Jumat 24 Juli 2026.'],
          ["5'", 'PENUTUP. Lingkaran kelas. Tiap murid mengucapkan satu kalimat: "Minggu depan saya akan ___." Cukup satu kalimat. TIDAK ADA PIDATO GURU.'],
        ],
        bahan: 'LK-5; berkas konten digital; akses akun sekolah (Tim ICT); pena untuk tanda tangan.',
        macet: 'Kontrak terlalu muluk ("Saya akan tidur jam 9 setiap hari mulai besok")? Tantang lembut: "Realistis nggak? Kalau gagal hari ketiga kamu akan menyerah. Mulai dari yang kecil: tidur 30 menit lebih awal. Kalau berhasil, baru naikkan." Kontrak kecil yang berhasil jauh lebih baik daripada kontrak besar yang gagal.',
      },
    ],
    penutup: { text: 'Ini bukan akhir. Ini pembuka.', sub: 'Setiap Senin, 5 menit di jam perwalian: "Angkat tangan yang minggu ini berhasil menjalankan kontraknya."\nTidak ada hukuman bagi yang gagal — hanya satu pertanyaan: "Apa yang menghalangi?"\nKarya yang terpasang dirawat oleh kelas pembuatnya. Itulah KULTURALISASI.' },
  },
];

HARI.forEach(H => {
  const p = deck();
  const A = H.accent;

  sTitle(p, {
    kicker: `PAPARAN GURU  ·  HARI ${H.n}  ·  ${H.hari}`,
    title: H.nilai,
    sub: `${H.aspek}  ·  "${H.fokus}"\n\n${H.hasil}`,
    accent: A,
  }).addNotes('Slide ini untuk guru. Jangan ditayangkan sebagai pengantar ceramah ke murid.');

  // slide ringkas hari
  let s = sHead(p, `Hari ${H.n} — ${H.fokus}`, `${H.nilai}  ·  ${H.aspek}`, A);
  s.addShape(p.ShapeType.roundRect, { x: 0.7, y: 1.7, w: 11.9, h: 1.0, fill: { color: 'E8F5E9' }, line: { color: '2E7D32', width: 1 }, rectRadius: 0.06 });
  s.addText([{ text: 'HASIL AKHIR HARI INI:  ', options: { bold: true, color: '1B5E20' } }, { text: H.hasil, options: { color: '2B3A47' } }],
    { x: 1.0, y: 1.75, w: 11.3, h: 0.9, fontFace: F, fontSize: 14, margin: 0, valign: 'middle', lineSpacing: 19 });
  s.addShape(p.ShapeType.roundRect, { x: 0.7, y: 2.85, w: 11.9, h: 0.7, fill: { color: 'FFF6E0' }, line: { color: 'BF8F00', width: 1 }, rectRadius: 0.06 });
  s.addText([{ text: '16 KELAS PARALEL:  ', options: { bold: true, color: '8A6400' } }, { text: 'Cek Kartu Sektor & GELOMBANG kelas Anda sebelum sesi lapangan. Kelas Anda TIDAK turun bersamaan dengan 15 kelas lain. Rincian: 04_MATRIKS_OPERASIONAL_16_KELAS.xlsx', options: { color: '6B5200' } }],
    { x: 1.0, y: 2.9, w: 11.3, h: 0.6, fontFace: F, fontSize: 12, margin: 0, valign: 'middle', lineSpacing: 16 });
  if (H.catatan) {
    s.addShape(p.ShapeType.roundRect, { x: 0.7, y: 3.65, w: 11.9, h: 0.85, fill: { color: 'FDE8EF' }, line: { color: 'AD1457', width: 1 }, rectRadius: 0.06 });
    s.addText([{ text: 'PERHATIKAN WAKTU:  ', options: { bold: true, color: '8C1046' } }, { text: H.catatan, options: { color: '7A2244' } }],
      { x: 1.0, y: 3.7, w: 11.3, h: 0.75, fontFace: F, fontSize: 13, margin: 0, valign: 'middle', lineSpacing: 17 });
  }
  const ty = H.catatan ? 4.65 : 3.75;
  s.addText('SUSUNAN SESI HARI INI', { x: 0.7, y: ty, w: 11.9, h: 0.35, fontFace: F, fontSize: 13, color: A, bold: true, charSpacing: 1.5 });
  H.sesi.forEach((se, i) => {
    const yy = ty + 0.45 + i * 0.66;
    s.addShape(p.ShapeType.roundRect, { x: 0.7, y: yy, w: 2.4, h: 0.5, fill: { color: LIGHT }, line: { color: A, width: 1 }, rectRadius: 0.06 });
    s.addText(se.jam, { x: 0.7, y: yy, w: 2.4, h: 0.5, fontFace: F, fontSize: 12, color: A, bold: true, align: 'center', valign: 'middle', margin: 0 });
    s.addText(se.judul, { x: 3.3, y: yy, w: 9.3, h: 0.5, fontFace: F, fontSize: 14, color: NAVY, valign: 'middle', margin: 0 });
  });

  // [TAYANG] slide untuk murid
  const t = p.addSlide();
  t.background = { color: NAVY };
  t.addShape(p.ShapeType.roundRect, { x: 0.6, y: 0.45, w: 1.75, h: 0.42, fill: { color: A }, rectRadius: 0.1 });
  t.addText('[ TAYANG ]', { x: 0.6, y: 0.45, w: 1.75, h: 0.42, fontFace: F, fontSize: 11, color: NAVY, bold: true, align: 'center', valign: 'middle', margin: 0 });
  t.addText('Slide ini BOLEH ditayangkan ke murid', { x: 2.55, y: 0.45, w: 6, h: 0.42, fontFace: F, fontSize: 11, color: '8FA6C4', valign: 'middle', italic: true, margin: 0 });
  t.addText(H.tayang.judul, { x: 0.6, y: 1.15, w: 7.0, h: 1.0, fontFace: FH, fontSize: 34, color: WHITE, bold: true, lineSpacing: 38 });
  t.addText(H.tayang.isi, { x: 0.6, y: 2.35, w: 7.0, h: 4.2, fontFace: F, fontSize: 17, color: 'CADCFC', lineSpacing: 30 });
  if (fs.existsSync(H.tayang.img)) t.addImage({ path: H.tayang.img, x: 8.0, y: 1.3, w: 4.8, h: 5.0, sizing: { type: 'contain', w: 4.8, h: 5.0 } });

  // sesi detail
  H.sesi.forEach(se => sSesi(p, { ...se, accent: A }));

  sQuote(p, { text: H.penutup.text, sub: H.penutup.sub, accent: A });

  const nm = `HARI_${H.n}_${H.nilai}.pptx`;
  p.writeFile({ fileName: `${OUT}/${nm}` }).then(() => console.log('OK', nm));
});
