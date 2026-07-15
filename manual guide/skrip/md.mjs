// Pengurai Markdown seadanya — hanya subset yang benar-benar dipakai berkas panduan:
// heading, paragraf, daftar berpoin/bernomor, tabel pipa, gambar, blockquote, dan
// penekanan inline (**tebal**, `kode`). Sengaja tidak memakai pustaka penuh supaya
// keluaran Word bisa dikendalikan persis.
import fs from 'node:fs'
import path from 'node:path'

/** Pecah teks inline jadi token {text, bold, code}. */
export function inline(text) {
  const out = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
  let last = 0, m
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) })
    const t = m[0]
    if (t.startsWith('**')) out.push({ text: t.slice(2, -2), bold: true })
    else if (t.startsWith('`')) out.push({ text: t.slice(1, -1), code: true })
    else out.push({ text: t.slice(1, -1), italic: true })
    last = m.index + t.length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out.length ? out : [{ text: '' }]
}

const splitRow = (line) =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())

/**
 * Ubah satu berkas Markdown jadi larik blok.
 * Blok: {type:'heading',level,text} | {type:'para',text} | {type:'bullet',text}
 *      | {type:'ordered',text,num} | {type:'table',header,rows} | {type:'image',alt,src}
 *      | {type:'quote',text} | {type:'code',lines}
 */
export function parseMarkdown(filePath) {
  const dir = path.dirname(filePath)
  const lines = fs.readFileSync(filePath, 'utf8').split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const t = line.trim()

    if (!t) { i++; continue }

    // Blok kode berpagar
    if (t.startsWith('```')) {
      const body = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) body.push(lines[i++])
      i++
      blocks.push({ type: 'code', lines: body })
      continue
    }

    // Gambar berdiri sendiri
    const img = t.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (img) {
      blocks.push({ type: 'image', alt: img[1], src: path.resolve(dir, img[2]) })
      i++; continue
    }

    // Heading
    const h = t.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      blocks.push({ type: 'heading', level: h[1].length, text: h[2] })
      i++; continue
    }

    // Garis pemisah
    if (/^---+$/.test(t)) { i++; continue }

    // Tabel: baris pipa diikuti baris pemisah
    if (t.startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
      const header = splitRow(t)
      i += 2
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(splitRow(lines[i++]))
      blocks.push({ type: 'table', header, rows })
      continue
    }

    // Blockquote
    if (t.startsWith('> ')) {
      const buf = [t.slice(2)]
      i++
      while (i < lines.length && lines[i].trim().startsWith('> ')) buf.push(lines[i++].trim().slice(2))
      blocks.push({ type: 'quote', text: buf.join(' ') })
      continue
    }

    // Daftar berpoin
    if (/^[-*]\s+/.test(t)) {
      blocks.push({ type: 'bullet', text: t.replace(/^[-*]\s+/, '') })
      i++; continue
    }

    // Daftar bernomor
    const ol = t.match(/^(\d+)\.\s+(.*)$/)
    if (ol) {
      blocks.push({ type: 'ordered', num: Number(ol[1]), text: ol[2] })
      i++; continue
    }

    // Paragraf: gabung baris sampai baris kosong / awal blok lain
    const buf = [t]
    i++
    while (i < lines.length) {
      const n = lines[i].trim()
      if (!n || /^(#{1,4}\s|[-*]\s|\d+\.\s|\||>|```|!\[|---+$)/.test(n)) break
      buf.push(n); i++
    }
    blocks.push({ type: 'para', text: buf.join(' ') })
  }

  return blocks
}
