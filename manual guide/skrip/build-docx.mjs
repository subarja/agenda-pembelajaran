// Membangun dokumen Word final dari berkas-berkas Markdown panduan.
//   node build-docx.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow,
  TableCell, WidthType, AlignmentType, PageBreak, TableOfContents, BorderStyle,
  ShadingType, Footer, PageNumber, convertMillimetersToTwip,
} from 'docx'
import { parseMarkdown, inline } from './md.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const OUT_DIR = path.join(ROOT, 'keluaran')

// Urutan bab dokumen final.
const CHAPTERS = [
  '00-pendahuluan.md',
  '01-memulai.md',
  '02-dashboard.md',
  '03-modul-guru/01-tujuan-pembelajaran.md',
  '03-modul-guru/02-agenda-pembelajaran.md',
  '03-modul-guru/03-presensi-sesi.md',
  '03-modul-guru/04-penilaian-karakter.md',
  '03-modul-guru/05-nilai-tambah.md',
  '03-modul-guru/06-guru-inval.md',
  '03-modul-guru/07-jadwal-kalender-minggu-efektif.md',
  '03-modul-guru/08-laporan.md',
  '03-modul-guru/09-pkl.md',
  '03-modul-guru/10-kokurikuler.md',
  '04-modul-wali-kelas/01-presensi-harian.md',
  '04-modul-wali-kelas/02-ews-siswa.md',
  '04-modul-wali-kelas/03-data-siswa.md',
  '04-modul-wali-kelas/04-penanganan-siswa.md',
  '05-modul-bk/01-ews-murid-bk.md',
  '05-modul-bk/02-konseling.md',
  '05-modul-bk/03-riwayat-dokumen.md',
  '06-modul-admin/01-data-master.md',
  '06-modul-admin/02-import-data.md',
  '06-modul-admin/03-karakter-dan-ambang.md',
  '06-modul-admin/04-tahun-ajaran-dan-backup.md',
  '06-modul-admin/05-kalender-dan-minggu-efektif.md',
  '06-modul-admin/06-ews-guru.md',
  '06-modul-admin/07-integrasi-penyimpanan-dan-notifikasi.md',
  '06-modul-admin/08-deploy-dan-maintenance.md',
  '06-modul-admin/09-jam-dan-bel.md',
  '07-modul-siswa-orang-tua.md',
  '08-lampiran.md',
]

const NAVY = '1E3A5F'
const GREY = '5B6B7B'
const MAX_IMG_W = 600 // piksel pada 96 dpi ≈ 15,9 cm — pas untuk A4 bermargin 2 cm

/** Baca lebar & tinggi PNG dari header IHDR-nya. */
function pngSize(file) {
  const b = fs.readFileSync(file)
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
}

const runs = (text, opts = {}) =>
  inline(text).map((tk) =>
    new TextRun({
      text: tk.text,
      bold: tk.bold || opts.bold,
      italics: tk.italic || opts.italics,
      font: tk.code ? 'Consolas' : undefined,
      color: opts.color,
      size: opts.size,
    }),
  )

function imageBlock(src, alt) {
  if (!fs.existsSync(src)) {
    return [new Paragraph({ children: [new TextRun({ text: `[gambar hilang: ${src}]`, color: 'CC0000' })] })]
  }
  const { w, h } = pngSize(src)
  const width = Math.min(MAX_IMG_W, w)
  const height = Math.round((h / w) * width)
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 60 },
      children: [new ImageRun({ type: 'png', data: fs.readFileSync(src), transformation: { width, height } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: alt, italics: true, size: 17, color: GREY })],
    }),
  ]
}

function tableBlock(header, rows) {
  const cell = (text, isHead) =>
    new TableCell({
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      shading: isHead ? { type: ShadingType.CLEAR, fill: 'EEF2F7' } : undefined,
      children: [new Paragraph({ children: runs(text, { bold: isHead, size: 18 }) })],
    })

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: ['top', 'bottom', 'left', 'right', 'insideHorizontal', 'insideVertical'].reduce((acc, k) => {
      acc[k] = { style: BorderStyle.SINGLE, size: 2, color: 'C7D0DA' }
      return acc
    }, {}),
    rows: [
      new TableRow({ tableHeader: true, children: header.map((c) => cell(c, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((c) => cell(c, false)) })),
    ],
  })
}

function renderBlocks(blocks) {
  const out = []
  for (const b of blocks) {
    switch (b.type) {
      case 'heading':
        out.push(
          new Paragraph({
            heading: { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 }[b.level] ?? HeadingLevel.HEADING_4,
            spacing: { before: b.level === 1 ? 0 : 260, after: 120 },
            children: runs(b.text, { color: NAVY }),
          }),
        )
        break
      case 'para':
        out.push(new Paragraph({ spacing: { after: 120, line: 300 }, children: runs(b.text) }))
        break
      case 'bullet':
        out.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: runs(b.text) }))
        break
      case 'ordered':
        out.push(new Paragraph({ numbering: { reference: 'nomor', level: 0 }, spacing: { after: 60 }, children: runs(b.text) }))
        break
      case 'quote':
        out.push(
          new Paragraph({
            indent: { left: 360 },
            spacing: { before: 120, after: 160 },
            border: { left: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 12 } },
            children: runs(b.text, { italics: true, color: GREY }),
          }),
        )
        break
      case 'code':
        for (const l of b.lines) {
          out.push(new Paragraph({
            shading: { type: ShadingType.CLEAR, fill: 'F4F6F8' },
            spacing: { after: 0 },
            children: [new TextRun({ text: l || ' ', font: 'Consolas', size: 17 })],
          }))
        }
        out.push(new Paragraph({ spacing: { after: 140 }, children: [] }))
        break
      case 'table':
        out.push(tableBlock(b.header, b.rows))
        out.push(new Paragraph({ spacing: { after: 180 }, children: [] }))
        break
      case 'image':
        out.push(...imageBlock(b.src, b.alt))
        break
    }
  }
  return out
}

function coverPage() {
  const line = (text, opts) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: opts.after ?? 120 }, children: [new TextRun({ text, ...opts })] })
  return [
    new Paragraph({ spacing: { before: 2400 }, children: [] }),
    line('PANDUAN PENGGUNA', { bold: true, size: 28, color: GREY, after: 200 }),
    line('Aplikasi Agenda Pembelajaran Kelas', { bold: true, size: 52, color: NAVY, after: 160 }),
    line('Terintegrasi dengan Penilaian Karakter Berbasis Poin', { size: 24, color: GREY, after: 40 }),
    line('dan Sistem Peringatan Dini Performa Siswa', { size: 24, color: GREY, after: 900 }),
    line('SMK NEGERI 2 CIMAHI', { bold: true, size: 30, color: NAVY, after: 200 }),
    line('Untuk Guru · Wali Kelas · Guru BK · Admin · Siswa & Orang Tua', { size: 20, color: GREY, after: 1600 }),
    line(`Dokumen versi 1.0 — ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, { size: 18, color: GREY }),
    new Paragraph({ children: [new PageBreak()] }),
  ]
}

function tocPage() {
  return [
    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 200 }, children: [new TextRun({ text: 'Daftar Isi', color: NAVY })] }),
    new TableOfContents('Daftar Isi', { hyperlinks: true, headingStyleRange: '1-2' }),
    new Paragraph({ children: [new PageBreak()] }),
  ]
}

// ── Rakit dokumen ────────────────────────────────────────────────────────────
const body = []
CHAPTERS.forEach((rel, idx) => {
  const file = path.join(ROOT, rel)
  if (!fs.existsSync(file)) { console.warn(`  ! lewati (tidak ada): ${rel}`); return }
  if (idx > 0) body.push(new Paragraph({ children: [new PageBreak()] }))
  body.push(...renderBlocks(parseMarkdown(file)))
  console.log(`  + ${rel}`)
})

const doc = new Document({
  creator: 'SMK Negeri 2 Cimahi',
  title: 'Panduan Pengguna — Aplikasi Agenda Pembelajaran',
  description: 'Panduan pengguna untuk semua peran',
  numbering: {
    config: [{
      reference: 'nomor',
      levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 460, hanging: 260 } } } }],
    }],
  },
  styles: {
    default: { document: { run: { font: 'Calibri', size: 21 } } },
  },
  sections: [{
    properties: {
      page: {
        margin: {
          top: convertMillimetersToTwip(20), bottom: convertMillimetersToTwip(20),
          left: convertMillimetersToTwip(20), right: convertMillimetersToTwip(20),
        },
      },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'Panduan Pengguna Agenda Pembelajaran — SMKN 2 Cimahi   |   ', size: 16, color: GREY }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY }),
          ],
        })],
      }),
    },
    children: [...coverPage(), ...tocPage(), ...body],
  }],
})

fs.mkdirSync(OUT_DIR, { recursive: true })
const target = path.join(OUT_DIR, 'Panduan-Pengguna-Agenda-Pembelajaran.docx')
const buf = await Packer.toBuffer(doc)
fs.writeFileSync(target, buf)
console.log(`\nSelesai → ${target} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`)
console.log('Catatan: buka di Word lalu tekan F9 pada Daftar Isi untuk memutakhirkan nomor halaman.')
