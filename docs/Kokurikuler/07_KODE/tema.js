/* TEMA PAPARAN SAKOLA WALUYA
   Palet CERAH mengacu logo Provinsi Jawa Barat: hijau daun · kuning emas · biru langit · koral.
   Latar TERANG. Font isi 20–24pt. Logo Jabar + SMKN 2 Cimahi di setiap slide. */
const pptxgen = require('pptxgenjs');
const fs = require('fs');

// ---------- PALET CERAH (Jabar) ----------
const HIJAU  = '1FA971';   // hijau daun Jabar, dicerahkan
const HIJAU2 = 'D6F2E4';   // hijau muda
const KUNING = 'F0B429';   // kuning emas Jabar
const KUNING2= 'FFF3D6';
const BIRU   = '2E9BD6';   // biru langit
const BIRU2  = 'DCEFFA';
const KORAL  = 'F4756B';   // merah koral (dari merah Jabar, dilembutkan)
const KORAL2 = 'FDE6E4';
const ORANYE = 'F2903D';
const ORANYE2= 'FDEBDA';
const UNGU   = '9B7BD4';
const UNGU2  = 'EEE7FA';

const TEKS   = '2B4C4F';   // teal gelap-sedang — untuk judul (tetap terbaca, tidak "tua")
const TEKS2  = '4A6670';   // body
const PUTIH  = 'FFFFFF';
const BG     = 'F7FBF9';   // putih kehijauan sangat terang
const GARIS  = 'CFE3DA';

const F  = 'Calibri';
const FH = 'Cambria';

const LOGO_JB = __dirname + '/logo_jabar.png';
const LOGO_S2 = __dirname + '/logo_smkn2.png';


// ---------- AUTO-FIT: cari ukuran font terbesar (16–24) yang MUAT di kotak ----------
// wIn/hIn dalam inci. Estimasi lebar rata-rata Calibri ~0.50 x fontSize.
function fit(text, wIn, hIn, { max = 24, min = 16, bold = false } = {}) {
  const t = String(text || '');
  const factor = bold ? 0.575 : 0.535;
  for (let sz = max; sz >= min; sz--) {
    const cpl = Math.max(8, Math.floor((wIn * 72) / (factor * sz)));   // karakter per baris
    let lines = 0;
    t.split('\n').forEach(par => {
      lines += (par.length === 0) ? 1 : Math.ceil(par.length / cpl);
    });
    const need = (lines * sz * 1.45) / 72;   // tinggi yang dibutuhkan (inci)
    if (need <= hIn) return sz;
  }
  return min;
}
// tinggi yang dibutuhkan sebuah teks pada ukuran tertentu
function needH(text, wIn, sz, { bold = false } = {}) {
  const t = String(text || '');
  const factor = bold ? 0.575 : 0.535;
  const cpl = Math.max(8, Math.floor((wIn * 72) / (factor * sz)));
  let lines = 0;
  t.split('\n').forEach(par => { lines += (par.length === 0) ? 1 : Math.ceil(par.length / cpl); });
  return (lines * sz * 1.45) / 72;
}

// ---------- helper ----------
function newDeck() {
  const p = new pptxgen();
  p.layout = 'LAYOUT_WIDE';           // 13.3 x 7.5 in
  p.author = 'SMK Negeri 2 Cimahi';
  p.company = 'SAKOLA WALUYA';
  return p;
}

// logo strip — dipanggil di setiap slide
function logos(p, s, { dark = false } = {}) {
  if (fs.existsSync(LOGO_JB)) s.addImage({ path: LOGO_JB, x: 11.62, y: 0.16, w: 0.62, h: 0.74 });
  if (fs.existsSync(LOGO_S2)) s.addImage({ path: LOGO_S2, x: 12.38, y: 0.20, w: 0.68, h: 0.68 });
  return s;
}

function base(p, { bg = BG } = {}) {
  const s = p.addSlide();
  s.background = { color: bg };
  logos(p, s);
  return s;
}

// footer tipis
function foot(p, s, txt) {
  s.addText(txt || 'SAKOLA WALUYA  ·  SMK Negeri 2 Cimahi  ·  15–21 Juli 2026',
    { x: 0.55, y: 6.92, w: 10.5, h: 0.35, fontFace: F, fontSize: 12, color: '8FA9A2', margin: 0 });
}

// ---------- SLIDE JUDUL ----------
function sTitle(p, { kicker, title, sub, accent, tint }) {
  const s = p.addSlide();
  s.background = { color: PUTIH };
  // pita warna lembut di kiri
  s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 13.34, h: 7.5, fill: { color: tint || HIJAU2 } });
  s.addShape(p.ShapeType.ellipse, { x: 9.3, y: -2.2, w: 6.6, h: 6.6, fill: { color: accent, transparency: 78 } });
  s.addShape(p.ShapeType.ellipse, { x: 11.0, y: 4.2, w: 4.4, h: 4.4, fill: { color: accent, transparency: 86 } });
  s.addShape(p.ShapeType.roundRect, { x: 0.55, y: 1.1, w: 9.6, h: 5.3, fill: { color: PUTIH }, line: { color: accent, width: 2 }, rectRadius: 0.12 });

  logos(p, s);
  s.addText('PEMERINTAH DAERAH PROVINSI JAWA BARAT  ·  DINAS PENDIDIKAN',
    { x: 0.55, y: 0.28, w: 10.6, h: 0.3, fontFace: F, fontSize: 13, color: TEKS2, bold: true, margin: 0 });
  s.addText('SMK NEGERI 2 CIMAHI',
    { x: 0.55, y: 0.6, w: 10.6, h: 0.32, fontFace: F, fontSize: 15, color: accent, bold: true, margin: 0 });

  s.addShape(p.ShapeType.roundRect, { x: 0.95, y: 1.5, w: 5.4, h: 0.5, fill: { color: accent }, rectRadius: 0.1 });
  s.addText(kicker, { x: 0.95, y: 1.5, w: 5.4, h: 0.5, fontFace: F, fontSize: 15, color: PUTIH, bold: true, align: 'center', valign: 'middle', margin: 0 });

  s.addText(title, { x: 0.95, y: 2.25, w: 8.8, h: 1.8, fontFace: FH, fontSize: 54, color: TEKS, bold: true, lineSpacing: 58, margin: 0 });
  const sz2 = fit(sub, 8.6, 1.65, { max: 22, min: 15 });
  s.addText(sub, { x: 0.95, y: 4.3, w: 8.8, h: 1.7, fontFace: F, fontSize: sz2, color: TEKS2, lineSpacing: Math.round(sz2 * 1.45), margin: 0 });
  return s;
}

// ---------- SLIDE HEADER ----------
function sHead(p, title, kicker, accent) {
  const s = base(p);
  s.addShape(p.ShapeType.roundRect, { x: 0.55, y: 0.42, w: 0.16, h: 1.05, fill: { color: accent }, rectRadius: 0.05 });
  s.addText(kicker, { x: 0.85, y: 0.42, w: 10.4, h: 0.36, fontFace: F, fontSize: 15, color: accent, bold: true, charSpacing: 1.2, margin: 0 });
  s.addText(title, { x: 0.85, y: 0.76, w: 10.4, h: 0.76, fontFace: FH, fontSize: fit(title, 10.3, 0.72, { max: 33, min: 20, bold: true }), color: TEKS, bold: true, margin: 0, valign: 'middle' });
  return s;
}

// ---------- KARTU (icon + judul + isi) ----------
function cards(p, s, items, { y = 1.8, gap = 0.13, accent = HIJAU, bottom = 6.72, maxBody = 20, minBody = 14 } = {}) {
  const W = 12.25, TXTW = 10.4;
  const n = items.length;
  const avail = bottom - y - gap * (n - 1);
  const PADT = 0.13, PADB = 0.17;   // padding atas/bawah dalam kartu

  // cari ukuran font GLOBAL terbesar yang membuat SEMUA kartu muat
  let bsz = maxBody, hs = null;
  for (let sz = maxBody; sz >= minBody; sz--) {
    const tmp = items.map(it => {
      const tsz = Math.min(22, Math.max(15, sz + 1));
      const tH = needH(it.title, TXTW, tsz, { bold: true });
      const bH = needH(it.body, TXTW, sz);
      return Math.max(0.72, PADT + tH + 0.04 + bH + PADB);
    });
    if (tmp.reduce((x, z) => x + z, 0) <= avail) { bsz = sz; hs = tmp; break; }
    if (sz === minBody) { bsz = minBody; hs = tmp; }
  }
  const tsz = Math.min(22, Math.max(15, bsz + 1));

  // sisa ruang dibagi rata sebagai tambahan tinggi kartu (biar tidak berongga)
  const total = hs.reduce((x, z) => x + z, 0);
  const bonus = Math.max(0, (avail - total) / n);

  let yy = y;
  items.forEach((it, i) => {
    const h = hs[i] + bonus;
    const col = it.color || accent;
    const tint = it.tint || HIJAU2;
    const tH = needH(it.title, TXTW, tsz, { bold: true });
    const bH = h - PADT - tH - 0.04 - PADB;

    s.addShape(p.ShapeType.roundRect, { x: 0.55, y: yy, w: W, h, fill: { color: tint }, line: { color: col, width: 1.2 }, rectRadius: 0.08 });
    s.addShape(p.ShapeType.roundRect, { x: 0.75, y: yy + 0.13, w: 1.02, h: h - 0.26, fill: { color: col }, rectRadius: 0.07 });
    s.addText(it.tag, { x: 0.75, y: yy + 0.13, w: 1.02, h: h - 0.26, fontFace: F, fontSize: 16, color: PUTIH, bold: true, align: 'center', valign: 'middle', margin: 0 });
    s.addText(it.title, { x: 2.0, y: yy + PADT, w: TXTW, h: tH, fontFace: F, fontSize: tsz, color: TEKS, bold: true, margin: 0, valign: 'top' });
    s.addText(it.body, { x: 2.0, y: yy + PADT + tH + 0.02, w: TXTW, h: bH, fontFace: F, fontSize: bsz, color: TEKS2, margin: 0, lineSpacing: Math.round(bsz * 1.28), valign: 'top' });
    yy += h + gap;
  });
}

// ---------- ANGKA BESAR + GAMBAR ----------
function sBig(p, { kicker, num, cap, note, accent, tint, img }) {
  const s = base(p);
  s.addText(kicker, { x: 0.55, y: 0.5, w: 11.0, h: 0.36, fontFace: F, fontSize: 15, color: accent, bold: true, charSpacing: 1.2, margin: 0 });
  s.addShape(p.ShapeType.roundRect, { x: 0.55, y: 1.0, w: 5.3, h: 5.7, fill: { color: tint || KORAL2 }, line: { color: accent, width: 1.5 }, rectRadius: 0.1 });
  s.addText(num, { x: 0.6, y: 1.3, w: 5.2, h: 2.0, fontFace: FH, fontSize: 96, color: accent, bold: true, align: 'center', valign: 'middle', margin: 0 });
  s.addText(cap, { x: 0.7, y: 3.4, w: 5.0, h: 0.9, fontFace: F, fontSize: 24, color: TEKS, bold: true, align: 'center', lineSpacing: 30, margin: 0 });
  const nz = fit(note, 4.85, 2.05, { max: 22, min: 15 });
  s.addText(note, { x: 0.7, y: 4.4, w: 5.0, h: 2.1, fontFace: F, fontSize: nz, color: TEKS2, align: 'center', lineSpacing: Math.round(nz * 1.42), margin: 0 });
  if (img && fs.existsSync(img)) s.addImage({ path: img, x: 6.2, y: 1.0, w: 6.6, h: 5.7, sizing: { type: 'contain', w: 6.6, h: 5.7 } });
  return s;
}

// ---------- GAMBAR PENUH ----------
function sImage(p, { kicker, title, img, note, accent = BIRU }) {
  const s = sHead(p, title, kicker, accent);
  if (fs.existsSync(img)) s.addImage({ path: img, x: 0.7, y: 1.62, w: 11.9, h: 4.85, sizing: { type: 'contain', w: 11.9, h: 4.85 } });
  if (note) { const nz2 = fit(note, 12.1, 0.48, { max: 17, min: 13 });
    s.addText(note, { x: 0.55, y: 6.6, w: 12.2, h: 0.55, fontFace: F, fontSize: nz2, color: TEKS2, italic: true, margin: 0, lineSpacing: Math.round(nz2 * 1.28) }); }
  return s;
}

// ---------- SESI (auto-split, font besar) ----------
function sSesi(p, { jam, judul, tujuan, langkah, bahan, macet, accent, tint }) {
  // pembagian RATA: maksimal 3 langkah per slide, tapi jangan ada slide sisa 1
  const n = langkah.length;
  const nGroup = Math.ceil(n / 3);
  const base_ = Math.floor(n / nGroup);
  const extra = n % nGroup;
  const groups = [];
  let idx = 0;
  for (let g = 0; g < nGroup; g++) {
    const take = base_ + (g < extra ? 1 : 0);
    groups.push(langkah.slice(idx, idx + take));
    idx += take;
  }

  groups.forEach((g, gi) => {
    const s = base(p);
    // header sesi
    s.addShape(p.ShapeType.roundRect, { x: 0.55, y: 0.4, w: 2.75, h: 0.72, fill: { color: accent }, rectRadius: 0.1 });
    s.addText(jam, { x: 0.55, y: 0.4, w: 2.75, h: 0.72, fontFace: F, fontSize: 18, color: PUTIH, bold: true, align: 'center', valign: 'middle', margin: 0 });
    const jt = judul + (gi > 0 ? '   (lanjutan)' : '');
    s.addText(jt, { x: 3.5, y: 0.34, w: 7.85, h: 0.84, fontFace: FH, fontSize: fit(jt, 7.8, 0.8, { max: 27, min: 17, bold: true }), color: TEKS, bold: true, valign: 'middle', margin: 0 });
    if (gi === 0 && tujuan) {
      s.addShape(p.ShapeType.roundRect, { x: 0.55, y: 1.22, w: 12.25, h: 0.72, fill: { color: tint }, line: { color: accent, width: 1 }, rectRadius: 0.06 });
      const tz = fit('Tujuan: ' + tujuan, 11.5, 0.66, { max: 20, min: 15 });
      s.addText([{ text: 'Tujuan: ', options: { bold: true } }, { text: tujuan }],
        { x: 0.85, y: 1.24, w: 11.7, h: 0.68, fontFace: F, fontSize: tz, color: TEKS2, italic: true, margin: 0, valign: 'middle', lineSpacing: Math.round(tz * 1.3) });
    }

    let y = (gi === 0 && tujuan) ? 2.12 : 1.38;
    const avail = 6.6 - y;
    const cap = avail / g.length;                 // jatah maksimum per langkah
    // tinggi ALAMI tiap langkah (biar tidak ada rongga besar kalau langkahnya sedikit)
    const hs = g.map(([, isi]) => {
      const sz0 = fit(isi, 10.5, cap - 0.16, { max: 22, min: 16 });
      return Math.min(cap, Math.max(0.72, needH(isi, 10.5, sz0) + 0.26));
    });
    const total = hs.reduce((a, b) => a + b, 0);
    const slack = Math.max(0, avail - total);
    const pad = g.length > 1 ? Math.min(0.32, slack / (g.length - 1)) : 0;

    g.forEach(([t, isi], k) => {
      const per = hs[k] + (k < g.length - 1 ? pad : 0);
      const boxH = hs[k] - 0.06;
      const sz = fit(isi, 10.5, boxH, { max: 22, min: 16 });
      s.addShape(p.ShapeType.roundRect, { x: 0.55, y: y + 0.04, w: 1.35, h: 0.6, fill: { color: tint }, line: { color: accent, width: 1.3 }, rectRadius: 0.07 });
      s.addText(String(t).replace(/\n/g, ' '), { x: 0.55, y: y + 0.04, w: 1.35, h: 0.6, fontFace: F, fontSize: 15, color: accent, bold: true, align: 'center', valign: 'middle', margin: 0 });
      s.addText(isi, { x: 2.1, y: y, w: 10.6, h: boxH, fontFace: F, fontSize: sz, color: TEKS2, margin: 0, lineSpacing: Math.round(sz * 1.3), valign: 'top' });
      y += per;
    });
    foot(p, s);
  });

  // slide BAHAN + KALAU MACET
  const s2 = base(p);
  s2.addShape(p.ShapeType.roundRect, { x: 0.55, y: 0.4, w: 2.75, h: 0.72, fill: { color: accent }, rectRadius: 0.1 });
  s2.addText(jam, { x: 0.55, y: 0.4, w: 2.75, h: 0.72, fontFace: F, fontSize: 18, color: PUTIH, bold: true, align: 'center', valign: 'middle', margin: 0 });
  s2.addText(judul, { x: 3.5, y: 0.38, w: 7.9, h: 0.76, fontFace: FH, fontSize: 26, color: TEKS, bold: true, valign: 'middle', margin: 0 });

  s2.addShape(p.ShapeType.roundRect, { x: 0.55, y: 1.35, w: 12.25, h: 2.15, fill: { color: KUNING2 }, line: { color: KUNING, width: 1.5 }, rectRadius: 0.08 });
  s2.addText('BAHAN & DARI MANA', { x: 0.85, y: 1.5, w: 11.7, h: 0.38, fontFace: F, fontSize: 20, color: 'A0700B', bold: true, margin: 0 });
  const bz = fit(bahan, 11.6, 1.45, { max: 22, min: 16 });
  s2.addText(bahan, { x: 0.85, y: 1.92, w: 11.7, h: 1.45, fontFace: F, fontSize: bz, color: '7A5A15', margin: 0, lineSpacing: Math.round(bz * 1.32) });

  s2.addShape(p.ShapeType.roundRect, { x: 0.55, y: 3.7, w: 12.25, h: 2.95, fill: { color: KORAL2 }, line: { color: KORAL, width: 1.5 }, rectRadius: 0.08 });
  s2.addText('KALAU MACET', { x: 0.85, y: 3.85, w: 11.7, h: 0.38, fontFace: F, fontSize: 20, color: 'C4453B', bold: true, margin: 0 });
  const mz = fit(macet, 11.6, 2.25, { max: 22, min: 16 });
  s2.addText(macet, { x: 0.85, y: 4.27, w: 11.7, h: 2.25, fontFace: F, fontSize: mz, color: '9E4A45', margin: 0, lineSpacing: Math.round(mz * 1.32) });
  foot(p, s2);
}

// ---------- KUTIPAN ----------
function sQuote(p, { text, sub, accent, tint }) {
  const s = p.addSlide();
  s.background = { color: tint || HIJAU2 };
  s.addShape(p.ShapeType.ellipse, { x: -2.2, y: 3.6, w: 7.0, h: 7.0, fill: { color: accent, transparency: 82 } });
  s.addShape(p.ShapeType.roundRect, { x: 0.75, y: 1.3, w: 11.85, h: 4.9, fill: { color: PUTIH }, line: { color: accent, width: 2 }, rectRadius: 0.12 });
  logos(p, s);
  s.addText('"', { x: 1.1, y: 1.35, w: 2, h: 1.5, fontFace: FH, fontSize: 100, color: accent, bold: true, margin: 0 });
  const qz = fit(text, 10.0, 1.95, { max: 32, min: 20, bold: true });
  const qs = fit(sub, 10.0, 1.45, { max: 20, min: 14 });
  s.addText(text, { x: 1.9, y: 2.35, w: 10.2, h: 2.0, fontFace: FH, fontSize: qz, color: TEKS, bold: true, lineSpacing: Math.round(qz * 1.35), margin: 0 });
  s.addText(sub, { x: 1.9, y: 4.5, w: 10.2, h: 1.5, fontFace: F, fontSize: qs, color: TEKS2, lineSpacing: Math.round(qs * 1.42), margin: 0 });
  return s;
}

// ---------- SLIDE [TAYANG] untuk murid ----------
function sTayang(p, { judul, isi, img, accent, tint }) {
  const s = p.addSlide();
  s.background = { color: PUTIH };
  s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 13.34, h: 7.5, fill: { color: tint } });
  logos(p, s);
  s.addShape(p.ShapeType.roundRect, { x: 0.55, y: 0.35, w: 2.2, h: 0.55, fill: { color: accent }, rectRadius: 0.1 });
  s.addText('[ TAYANG ]', { x: 0.55, y: 0.35, w: 2.2, h: 0.55, fontFace: F, fontSize: 15, color: PUTIH, bold: true, align: 'center', valign: 'middle', margin: 0 });
  s.addText('Slide ini BOLEH ditayangkan ke murid', { x: 2.95, y: 0.35, w: 6.5, h: 0.55, fontFace: F, fontSize: 15, color: TEKS2, valign: 'middle', italic: true, margin: 0 });

  const hasImg = img && fs.existsSync(img);
  const w = hasImg ? 6.9 : 12.25;
  s.addShape(p.ShapeType.roundRect, { x: 0.55, y: 1.1, w, h: 5.6, fill: { color: PUTIH }, line: { color: accent, width: 2 }, rectRadius: 0.12 });
  const jz = fit(judul, w - 0.9, 1.05, { max: 36, min: 22, bold: true });
  const iz = fit(isi, w - 0.9, 3.75, { max: 24, min: 16 });
  s.addText(judul, { x: 0.9, y: 1.4, w: w - 0.7, h: 1.1, fontFace: FH, fontSize: jz, color: TEKS, bold: true, lineSpacing: Math.round(jz * 1.18), margin: 0 });
  s.addText(isi, { x: 0.9, y: 2.65, w: w - 0.7, h: 3.8, fontFace: F, fontSize: iz, color: TEKS2, lineSpacing: Math.round(iz * 1.42), margin: 0 });
  if (hasImg) s.addImage({ path: img, x: 7.7, y: 1.25, w: 5.1, h: 5.3, sizing: { type: 'contain', w: 5.1, h: 5.3 } });
  return s;
}

module.exports = {
  fit, needH, pptxgen, fs, newDeck, base, logos, foot, sTitle, sHead, cards, sBig, sImage, sSesi, sQuote, sTayang,
  HIJAU, HIJAU2, KUNING, KUNING2, BIRU, BIRU2, KORAL, KORAL2, ORANYE, ORANYE2, UNGU, UNGU2,
  TEKS, TEKS2, PUTIH, BG, GARIS, F, FH,
};
