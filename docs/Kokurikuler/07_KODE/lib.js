const d = require('docx');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  PageBreak, LevelFormat, convertInchesToTwip, TableLayoutType, VerticalAlign
} = d;

const NAVY = '1F3864';
const BLUE = '2E74B5';
const GREEN = '2E7D32';
const GREY = 'F2F2F2';
const LIGHT = 'E8F0FA';
const GOLD = 'FFF2CC';
const ROSE = 'FCE4EC';

// content width for A4 with 1" margins = 12240? A4 = 11906 x 16838 twips. margins 1134 (2cm) each side -> 9638
const CW = 9638;

function P(text, opts = {}) {
  const {
    bold = false, italics = false, size = 21, color = '000000',
    align = AlignmentType.JUSTIFIED, spaceBefore = 0, spaceAfter = 80,
    bullet = null, numbering = null, indent = null, shading = null,
    border = null, font = 'Calibri'
  } = opts;
  const cfg = {
    children: Array.isArray(text)
      ? text
      : [new TextRun({ text: String(text), bold, italics, size, color, font })],
    alignment: align,
    spacing: { before: spaceBefore, after: spaceAfter, line: 264 },
  };
  if (bullet !== null) cfg.bullet = { level: bullet };
  if (numbering) cfg.numbering = numbering;
  if (indent) cfg.indent = indent;
  if (shading) cfg.shading = { type: ShadingType.CLEAR, fill: shading, color: 'auto' };
  if (border) cfg.border = border;
  return new Paragraph(cfg);
}

function H1(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 32, color: NAVY, font: 'Calibri' })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 4 } },
  });
}
function H2(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, color: BLUE, font: 'Calibri' })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 110 },
  });
}
function H3(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 23, color: NAVY, font: 'Calibri' })],
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
  });
}
function TITLE(text, sub) {
  const arr = [new Paragraph({
    children: [new TextRun({ text, bold: true, size: 44, color: NAVY, font: 'Calibri' })],
    alignment: AlignmentType.CENTER, spacing: { before: 200, after: 60 },
  })];
  if (sub) arr.push(new Paragraph({
    children: [new TextRun({ text: sub, italics: true, size: 24, color: BLUE, font: 'Calibri' })],
    alignment: AlignmentType.CENTER, spacing: { after: 240 },
    border: { bottom: { style: BorderStyle.DOUBLE, size: 6, color: NAVY, space: 6 } },
  }));
  return arr;
}

function cell(content, { w, bold = false, fill = null, size = 20, align = AlignmentType.LEFT, italics = false, color = '000000', span = 1, vAlign = VerticalAlign.CENTER } = {}) {
  const items = Array.isArray(content) ? content : [content];
  const paras = [];
  items.forEach(t => {
    if (t instanceof Paragraph) { paras.push(t); return; }
    // split literal \n into separate paragraphs (docx-js has no line breaks in text)
    String(t).split('\n').forEach(line => {
      paras.push(new Paragraph({
        children: [new TextRun({ text: line, bold, size, italics, color, font: 'Calibri' })],
        alignment: align,
        spacing: { before: 30, after: 30, line: 252 },
      }));
    });
  });
  const c = { children: paras, width: { size: w, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 90, right: 90 }, verticalAlign: vAlign };
  if (fill) c.shading = { type: ShadingType.CLEAR, fill, color: 'auto' };
  if (span > 1) c.columnSpan = span;
  return new TableCell(c);
}

// rows: array of {cells:[...], fill, bold}
function TBL(colWidths, headers, rows, opts = {}) {
  const { headFill = NAVY, headColor = 'FFFFFF', size = 20, zebra = true } = opts;
  const trs = [];
  if (headers) {
    trs.push(new TableRow({
      tableHeader: true,
      children: headers.map((h, i) => cell(h, { w: colWidths[i], bold: true, fill: headFill, color: headColor, size, align: AlignmentType.CENTER })),
    }));
  }
  rows.forEach((r, ri) => {
    const data = Array.isArray(r) ? r : r.cells;
    const fill = (Array.isArray(r) ? null : r.fill) || (zebra && ri % 2 === 1 ? GREY : null);
    const bold = Array.isArray(r) ? false : !!r.bold;
    trs.push(new TableRow({
      children: data.map((c, i) => {
        if (c && c.__cell) return c.build(colWidths[i], fill);
        return cell(c, { w: colWidths[i], fill, size, bold });
      }),
    }));
  });
  return new Table({
    columnWidths: colWidths,
    width: { size: colWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    rows: trs,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'AAB7C4' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'AAB7C4' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'AAB7C4' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'AAB7C4' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 3, color: 'C9D3DD' },
      insideVertical: { style: BorderStyle.SINGLE, size: 3, color: 'C9D3DD' },
    },
  });
}

// Callout box
function BOX(title, lines, fill = GOLD, accent = 'BF8F00') {
  const kids = [new Paragraph({
    children: [new TextRun({ text: title, bold: true, size: 21, color: accent, font: 'Calibri' })],
    spacing: { before: 40, after: 50 },
  })];
  lines.forEach(l => kids.push(new Paragraph({
    children: [new TextRun({ text: l, size: 20, font: 'Calibri' })],
    spacing: { after: 40, line: 252 }, alignment: AlignmentType.JUSTIFIED,
  })));
  return new Table({
    columnWidths: [CW],
    width: { size: CW, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({
      children: [new TableCell({
        children: kids,
        width: { size: CW, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill, color: 'auto' },
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
      })],
    })],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: accent },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: accent },
      left: { style: BorderStyle.SINGLE, size: 18, color: accent },
      right: { style: BorderStyle.SINGLE, size: 2, color: accent },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
  });
}

// Blank writing lines for LK
function LINES(n, opts = {}) {
  const { label = null, width = CW } = opts;
  const out = [];
  if (label) out.push(P(label, { bold: true, size: 20, spaceBefore: 60, spaceAfter: 40, align: AlignmentType.LEFT }));
  for (let i = 0; i < n; i++) {
    out.push(new Paragraph({
      children: [new TextRun({ text: ' ', size: 20 })],
      spacing: { before: 0, after: 140 },
      border: { bottom: { style: BorderStyle.DOTTED, size: 6, color: '7F7F7F', space: 2 } },
    }));
  }
  return out;
}

function BLANKTBL(colWidths, headers, nRows, opts = {}) {
  const rows = [];
  for (let i = 0; i < nRows; i++) {
    rows.push(colWidths.map((_, j) => (opts.firstCol && j === 0) ? String(i + 1) : ' '));
  }
  return TBL(colWidths, headers, rows, { headFill: opts.headFill || BLUE, zebra: false, ...opts });
}

const SPACER = () => P(' ', { size: 10, spaceAfter: 60 });
const PB = () => new Paragraph({ children: [new PageBreak()] });

const numbering = {
  config: [
    { reference: 'bul', levels: [
      { level: 0, format: LevelFormat.BULLET, text: '●', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 200 } }, run: { size: 16, color: BLUE } } },
      { level: 1, format: LevelFormat.BULLET, text: '○', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 200 } }, run: { size: 16 } } },
    ]},
    { reference: 'num', levels: [
      { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 260 } }, run: { bold: true, color: NAVY } } },
    ]},
  ],
};

function makeDoc(children) {
  return new Document({
    numbering,
    styles: { default: { document: { run: { font: 'Calibri', size: 21 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
        },
      },
      children,
    }],
  });
}

async function save(children, path) {
  const doc = makeDoc(children);
  const buf = await Packer.toBuffer(doc);
  require('fs').writeFileSync(path, buf);
  console.log('WROTE', path);
}

module.exports = { d, P, H1, H2, H3, TITLE, TBL, BOX, LINES, BLANKTBL, SPACER, PB, save, cell,
  NAVY, BLUE, GREEN, GREY, LIGHT, GOLD, ROSE, CW,
  AlignmentType, TextRun, Paragraph, BorderStyle, WidthType, ShadingType, HeadingLevel };
