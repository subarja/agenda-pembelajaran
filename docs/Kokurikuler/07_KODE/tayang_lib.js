/* PAPARAN TAYANG UNTUK MURID — SAKOLA WALUYA
   Bukan panduan guru. Ini yang DIPROYEKSIKAN ke murid.
   Huruf BESAR, teks sedikit, satu gagasan per slide. */
const T = require('./tema.js');
const {
  pptxgen, fs, fit, needH,
  HIJAU, HIJAU2, KUNING, KUNING2, BIRU, BIRU2, KORAL, KORAL2, ORANYE, ORANYE2, UNGU, UNGU2,
  TEKS, TEKS2, PUTIH, F, FH,
} = T;

const LOGO_JB = __dirname + '/logo_jabar.png';
const LOGO_S2 = __dirname + '/logo_smkn2.png';

function deck() {
  const p = new pptxgen();
  p.layout = 'LAYOUT_WIDE';
  p.author = 'SMK Negeri 2 Cimahi';
  p.company = 'SAKOLA WALUYA';
  return p;
}
function logo(p, s) {
  if (fs.existsSync(LOGO_JB)) s.addImage({ path: LOGO_JB, x: 11.75, y: 0.18, w: 0.55, h: 0.66 });
  if (fs.existsSync(LOGO_S2)) s.addImage({ path: LOGO_S2, x: 12.45, y: 0.21, w: 0.6, h: 0.6 });
}

// ===== SAMPUL HARI =====
function sampul(p, { hari, nilai, fokus, arti, A, TT }) {
  const s = p.addSlide();
  s.background = { color: TT };
  logo(p, s);
  s.addShape(p.ShapeType.ellipse, { x: -2.4, y: 3.4, w: 7.4, h: 7.4, fill: { color: A, transparency: 82 } });
  s.addShape(p.ShapeType.ellipse, { x: 10.2, y: -2.6, w: 6.4, h: 6.4, fill: { color: A, transparency: 86 } });
  s.addText(hari, { x: 0.9, y: 1.5, w: 11.5, h: 0.5, fontFace: F, fontSize: 24, color: A, bold: true, margin: 0 });
  s.addText(nilai, { x: 0.9, y: 2.15, w: 11.5, h: 1.5, fontFace: FH, fontSize: 84, color: TEKS, bold: true, margin: 0 });
  s.addText(fokus, { x: 0.9, y: 3.8, w: 11.5, h: 0.9, fontFace: FH, fontSize: 46, color: A, bold: true, margin: 0 });
  s.addText(arti, { x: 0.9, y: 4.95, w: 11.5, h: 1.2, fontFace: F, fontSize: 26, color: TEKS2, italic: true, margin: 0, lineSpacing: 36 });
  return s;
}

// ===== SLIDE JUDUL BESAR (satu gagasan) =====
function big(p, { kicker, judul, isi, A, TT, tanda }) {
  const s = p.addSlide();
  s.background = { color: PUTIH };
  logo(p, s);
  s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 0.28, h: 7.5, fill: { color: A } });
  if (kicker) s.addText(kicker, { x: 0.75, y: 0.55, w: 10.5, h: 0.45, fontFace: F, fontSize: 20, color: A, bold: true, charSpacing: 1.2, margin: 0 });
  const jz = fit(judul, 11.9, 1.55, { max: 50, min: 28, bold: true });
  s.addText(judul, { x: 0.75, y: 1.15, w: 12.0, h: 1.6, fontFace: FH, fontSize: jz, color: TEKS, bold: true, margin: 0, lineSpacing: Math.round(jz * 1.15) });
  if (isi) {
    const H = tanda ? 3.20 : 3.75;          // sisakan ruang untuk callout
    const iz = fit(isi, 11.7, H - 0.15, { max: 30, min: 18 });
    s.addText(isi, { x: 0.75, y: 2.95, w: 12.0, h: H, fontFace: F, fontSize: iz, color: TEKS2, margin: 0, lineSpacing: Math.round(iz * 1.45), valign: 'top' });
  }
  if (tanda) {
    s.addShape(p.ShapeType.roundRect, { x: 0.75, y: 6.35, w: 12.0, h: 0.8, fill: { color: TT }, line: { color: A, width: 1.4 }, rectRadius: 0.08 });
    s.addText(tanda, { x: 0.98, y: 6.35, w: 11.55, h: 0.8, fontFace: F, fontSize: fit(tanda, 11.4, 0.72, { max: 20, min: 15, bold: true }), color: A, bold: true, valign: 'middle', margin: 0 });
  }
  return s;
}

// ===== ANGKA RAKSASA =====
function angka(p, { kicker, num, cap, isi, A, TT }) {
  const s = p.addSlide();
  s.background = { color: TT };
  logo(p, s);
  s.addText(kicker, { x: 0.85, y: 0.7, w: 11.3, h: 0.5, fontFace: F, fontSize: 22, color: A, bold: true, charSpacing: 1.2, margin: 0 });
  s.addText(num, { x: 0.85, y: 1.4, w: 5.6, h: 3.4, fontFace: FH, fontSize: 170, color: A, bold: true, align: 'center', valign: 'middle', margin: 0 });
  s.addText(cap, { x: 0.85, y: 4.85, w: 5.6, h: 1.4, fontFace: F, fontSize: 26, color: TEKS, bold: true, align: 'center', margin: 0, lineSpacing: 34 });
  s.addShape(p.ShapeType.roundRect, { x: 6.9, y: 1.4, w: 5.85, h: 4.85, fill: { color: PUTIH }, line: { color: A, width: 2 }, rectRadius: 0.12 });
  const iz = fit(isi, 5.35, 4.4, { max: 28, min: 18 });
  s.addText(isi, { x: 7.15, y: 1.6, w: 5.35, h: 4.45, fontFace: F, fontSize: iz, color: TEKS2, margin: 0, lineSpacing: Math.round(iz * 1.5), valign: 'middle' });
  return s;
}

// ===== TUGAS: apa yang kalian kerjakan =====
function tugas(p, { menit, judul, langkah, dimana, A, TT }) {
  const s = p.addSlide();
  s.background = { color: PUTIH };
  logo(p, s);
  s.addShape(p.ShapeType.roundRect, { x: 0.6, y: 0.5, w: 2.0, h: 0.9, fill: { color: A }, rectRadius: 0.12 });
  s.addText(menit, { x: 0.6, y: 0.5, w: 2.0, h: 0.9, fontFace: F, fontSize: 26, color: PUTIH, bold: true, align: 'center', valign: 'middle', margin: 0 });
  const jz = fit(judul, 8.6, 0.95, { max: 40, min: 24, bold: true });
  s.addText(judul, { x: 2.85, y: 0.48, w: 8.7, h: 0.95, fontFace: FH, fontSize: jz, color: TEKS, bold: true, valign: 'middle', margin: 0 });

  const n = langkah.length;
  const top = 1.7, bot = dimana ? 6.15 : 6.85;
  const gap = 0.18;
  const avail = bot - top - gap * (n - 1);
  let sz = 28;
  for (; sz >= 18; sz--) {
    const tot = langkah.reduce((a, t) => a + Math.max(0.72, needH(t, 10.9, sz) + 0.3), 0);
    if (tot <= avail) break;
  }
  const hs = langkah.map(t => Math.max(0.72, needH(t, 10.9, sz) + 0.3));
  const bonus = Math.max(0, (avail - hs.reduce((a, b) => a + b, 0)) / n);

  let y = top;
  langkah.forEach((t, i) => {
    const h = hs[i] + bonus;
    s.addShape(p.ShapeType.roundRect, { x: 0.6, y, w: 12.15, h, fill: { color: TT }, line: { color: A, width: 1.2 }, rectRadius: 0.08 });
    s.addShape(p.ShapeType.ellipse, { x: 0.85, y: y + h / 2 - 0.24, w: 0.48, h: 0.48, fill: { color: A } });
    s.addText(String(i + 1), { x: 0.85, y: y + h / 2 - 0.24, w: 0.48, h: 0.48, fontFace: F, fontSize: 18, color: PUTIH, bold: true, align: 'center', valign: 'middle', margin: 0 });
    s.addText(t, { x: 1.55, y: y + 0.13, w: 11.0, h: h - 0.26, fontFace: F, fontSize: sz, color: TEKS, margin: 0, lineSpacing: Math.round(sz * 1.32), valign: 'middle' });
    y += h + gap;
  });

  if (dimana) {
    s.addShape(p.ShapeType.roundRect, { x: 0.6, y: 6.3, w: 12.15, h: 0.85, fill: { color: KUNING2 }, line: { color: KUNING, width: 1.5 }, rectRadius: 0.08 });
    s.addText([{ text: 'DITULIS DI:  ', options: { bold: true, color: 'A0700B' } }, { text: dimana, options: { color: '7A5A15' } }],
      { x: 0.9, y: 6.3, w: 11.6, h: 0.85, fontFace: F, fontSize: 21, valign: 'middle', margin: 0 });
  }
  return s;
}

// ===== ATURAN / DAFTAR (huruf besar) =====
function aturan(p, { judul, kicker, items, A, TT, warnaKotak }) {
  const s = p.addSlide();
  s.background = { color: PUTIH };
  logo(p, s);
  s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 0.28, h: 7.5, fill: { color: A } });
  if (kicker) s.addText(kicker, { x: 0.75, y: 0.5, w: 10.5, h: 0.42, fontFace: F, fontSize: 19, color: A, bold: true, charSpacing: 1.2, margin: 0 });
  s.addText(judul, { x: 0.75, y: 0.92, w: 11.9, h: 0.85, fontFace: FH, fontSize: fit(judul, 11.7, 0.8, { max: 40, min: 24, bold: true }), color: TEKS, bold: true, margin: 0, valign: 'middle' });

  const n = items.length;
  const top = 2.0, bot = 6.9, gap = 0.16;
  const avail = bot - top - gap * (n - 1);
  let sz = 28;
  for (; sz >= 19; sz--) {
    const tot = items.reduce((a, t) => a + Math.max(0.62, needH(t, 11.2, sz) + 0.26), 0);
    if (tot <= avail) break;
  }
  const hs = items.map(t => Math.max(0.62, needH(t, 11.2, sz) + 0.26));
  const bonus = Math.max(0, (avail - hs.reduce((a, b) => a + b, 0)) / n);
  let y = top;
  items.forEach((t, i) => {
    const h = hs[i] + bonus;
    s.addShape(p.ShapeType.roundRect, { x: 0.6, y, w: 12.15, h, fill: { color: warnaKotak || TT }, line: { color: A, width: 1.1 }, rectRadius: 0.07 });
    s.addShape(p.ShapeType.roundRect, { x: 0.82, y: y + h / 2 - 0.22, w: 0.5, h: 0.44, fill: { color: A }, rectRadius: 0.07 });
    s.addText(String(i + 1), { x: 0.82, y: y + h / 2 - 0.22, w: 0.5, h: 0.44, fontFace: F, fontSize: 17, color: PUTIH, bold: true, align: 'center', valign: 'middle', margin: 0 });
    s.addText(t, { x: 1.55, y: y + 0.11, w: 11.0, h: h - 0.22, fontFace: F, fontSize: sz, color: TEKS, margin: 0, lineSpacing: Math.round(sz * 1.3), valign: 'middle' });
    y += h + gap;
  });
  return s;
}

// ===== DUA KOLOM (boleh vs dilarang) =====
function dua(p, { judul, kiriJudul, kiri, kananJudul, kanan, A }) {
  const s = p.addSlide();
  s.background = { color: PUTIH };
  logo(p, s);
  s.addText(judul, { x: 0.6, y: 0.55, w: 11.9, h: 0.95, fontFace: FH, fontSize: fit(judul, 11.7, 0.9, { max: 42, min: 26, bold: true }), color: TEKS, bold: true, margin: 0, valign: 'middle' });
  s.addShape(p.ShapeType.roundRect, { x: 0.6, y: 1.7, w: 6.0, h: 5.2, fill: { color: HIJAU2 }, line: { color: HIJAU, width: 2 }, rectRadius: 0.1 });
  s.addText(kiriJudul, { x: 0.9, y: 1.9, w: 5.4, h: 0.6, fontFace: F, fontSize: 28, color: '15794F', bold: true, margin: 0 });
  s.addText(kiri, { x: 0.9, y: 2.6, w: 5.4, h: 4.1, fontFace: F, fontSize: fit(kiri, 5.3, 4.0, { max: 26, min: 17 }), color: TEKS, margin: 0, lineSpacing: Math.round(fit(kiri, 5.3, 4.0, { max: 26, min: 17 }) * 1.45) });
  s.addShape(p.ShapeType.roundRect, { x: 6.85, y: 1.7, w: 6.0, h: 5.2, fill: { color: KORAL2 }, line: { color: KORAL, width: 2 }, rectRadius: 0.1 });
  s.addText(kananJudul, { x: 7.15, y: 1.9, w: 5.4, h: 0.6, fontFace: F, fontSize: 28, color: 'C4453B', bold: true, margin: 0 });
  s.addText(kanan, { x: 7.15, y: 2.6, w: 5.4, h: 4.1, fontFace: F, fontSize: fit(kanan, 5.3, 4.0, { max: 26, min: 17 }), color: TEKS, margin: 0, lineSpacing: Math.round(fit(kanan, 5.3, 4.0, { max: 26, min: 17 }) * 1.45) });
  return s;
}

// ===== GAMBAR PENUH =====
function gambar(p, { judul, img, catatan, A }) {
  const s = p.addSlide();
  s.background = { color: PUTIH };
  logo(p, s);
  s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 0.28, h: 7.5, fill: { color: A } });
  s.addText(judul, { x: 0.75, y: 0.42, w: 10.8, h: 0.85, fontFace: FH, fontSize: fit(judul, 10.7, 0.8, { max: 38, min: 24, bold: true }), color: TEKS, bold: true, margin: 0, valign: 'middle' });
  if (fs.existsSync(img)) s.addImage({ path: img, x: 0.8, y: 1.45, w: 11.9, h: 5.1, sizing: { type: 'contain', w: 11.9, h: 5.1 } });
  if (catatan) s.addText(catatan, { x: 0.75, y: 6.65, w: 12.0, h: 0.55, fontFace: F, fontSize: 19, color: A, bold: true, margin: 0 });
  return s;
}

// ===== JEDA GERAK =====
function jeda(p) {
  const s = p.addSlide();
  s.background = { color: ORANYE2 };
  logo(p, s);
  s.addShape(p.ShapeType.ellipse, { x: -2.0, y: 3.8, w: 7.0, h: 7.0, fill: { color: ORANYE, transparency: 84 } });
  s.addShape(p.ShapeType.ellipse, { x: 10.4, y: -2.4, w: 6.0, h: 6.0, fill: { color: ORANYE, transparency: 88 } });
  s.addText('15 MENIT', { x: 0.9, y: 1.5, w: 11.5, h: 0.7, fontFace: F, fontSize: 26, color: ORANYE, bold: true, margin: 0 });
  s.addText('JEDA GERAK', { x: 0.9, y: 2.2, w: 11.5, h: 1.5, fontFace: FH, fontSize: 76, color: TEKS, bold: true, margin: 0 });
  s.addText('BERDIRI. Jangan duduk.\nJalan keluar kelas. Regangkan badan. Minum.\n\nIni bukan istirahat — ini BEROLAHRAGA.\nSkor Berolahraga kita: 5,92 dari 10.',
    { x: 0.9, y: 3.9, w: 11.5, h: 2.5, fontFace: F, fontSize: 27, color: TEKS2, margin: 0, lineSpacing: 40 });
  return s;
}

// ===== REFLEKSI / JURNAL =====
function jurnal(p, { pertanyaan, A, TT }) {
  const s = p.addSlide();
  s.background = { color: TT };
  logo(p, s);
  s.addText('15 MENIT  ·  DI BUKU TULISMU', { x: 0.85, y: 0.85, w: 11.5, h: 0.5, fontFace: F, fontSize: 22, color: A, bold: true, charSpacing: 1.2, margin: 0 });
  s.addText('JURNAL WALUYA', { x: 0.85, y: 1.4, w: 11.5, h: 1.15, fontFace: FH, fontSize: 60, color: TEKS, bold: true, margin: 0 });
  const n = pertanyaan.length;
  const top = 2.9, gap = 0.2, avail = 6.85 - top - gap * (n - 1);
  let sz = 30;
  for (; sz >= 19; sz--) {
    const tot = pertanyaan.reduce((a, t) => a + Math.max(0.8, needH(t, 10.9, sz) + 0.34), 0);
    if (tot <= avail) break;
  }
  const hs = pertanyaan.map(t => Math.max(0.8, needH(t, 10.9, sz) + 0.34));
  const bonus = Math.max(0, (avail - hs.reduce((a, b) => a + b, 0)) / n);
  let y = top;
  pertanyaan.forEach((t, i) => {
    const h = hs[i] + bonus;
    s.addShape(p.ShapeType.roundRect, { x: 0.6, y, w: 12.15, h, fill: { color: PUTIH }, line: { color: A, width: 1.4 }, rectRadius: 0.08 });
    s.addShape(p.ShapeType.ellipse, { x: 0.9, y: y + h / 2 - 0.26, w: 0.52, h: 0.52, fill: { color: A } });
    s.addText(String(i + 1), { x: 0.9, y: y + h / 2 - 0.26, w: 0.52, h: 0.52, fontFace: F, fontSize: 19, color: PUTIH, bold: true, align: 'center', valign: 'middle', margin: 0 });
    s.addText(t, { x: 1.65, y: y + 0.14, w: 10.9, h: h - 0.28, fontFace: F, fontSize: sz, color: TEKS, margin: 0, lineSpacing: Math.round(sz * 1.32), valign: 'middle' });
    y += h + gap;
  });
  return s;
}

// ===== PENUTUP =====
function tutup(p, { teks, sub, A, TT }) {
  const s = p.addSlide();
  s.background = { color: TT };
  logo(p, s);
  s.addShape(p.ShapeType.ellipse, { x: -2.6, y: 3.2, w: 8.0, h: 8.0, fill: { color: A, transparency: 84 } });
  const tz = fit(teks, 11.5, 2.6, { max: 50, min: 28, bold: true });
  s.addText(teks, { x: 0.9, y: 1.9, w: 11.6, h: 2.7, fontFace: FH, fontSize: tz, color: TEKS, bold: true, margin: 0, lineSpacing: Math.round(tz * 1.25) });
  if (sub) s.addText(sub, { x: 0.9, y: 4.85, w: 11.6, h: 1.5, fontFace: F, fontSize: 26, color: TEKS2, margin: 0, lineSpacing: 38 });
  return s;
}

module.exports = { deck, logo, sampul, big, angka, tugas, aturan, dua, gambar, jeda, jurnal, tutup, T };
