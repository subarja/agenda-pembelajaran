const d = require('docx');
const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, TableLayoutType, VerticalAlign, PageBreak } = d;
const fs = require('fs');

const CW = 9638;
const F = 'Calibri';

function T(t, o = {}) {
  const { b=false, i=false, s=20, c='000000', al=AlignmentType.LEFT, sa=40, sb=0, ls=250 } = o;
  return new Paragraph({
    children: [new TextRun({ text: t, bold: b, italics: i, size: s, color: c, font: F })],
    alignment: al, spacing: { before: sb, after: sa, line: ls },
  });
}
function cell(txt, { w, b=false, fill=null, s=19, c='000000', al=AlignmentType.LEFT, i=false, va=VerticalAlign.CENTER }={}) {
  const ps = String(txt).split('\n').map(line => new Paragraph({
    children: [new TextRun({ text: line, bold: b, size: s, color: c, italics: i, font: F })],
    alignment: al, spacing: { before: 14, after: 14, line: 232 },
  }));
  const o = { children: ps, width: { size: w, type: WidthType.DXA }, margins: { top: 40, bottom: 40, left: 90, right: 90 }, verticalAlign: va };
  if (fill) o.shading = { type: ShadingType.CLEAR, fill, color: 'auto' };
  return new TableCell(o);
}
function TBL(cols, rows, { border='C9D3DD' } = {}) {
  return new Table({
    columnWidths: cols,
    width: { size: cols.reduce((a,b)=>a+b,0), type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    rows: rows,
    borders: {
      top:{style:BorderStyle.SINGLE,size:4,color:border}, bottom:{style:BorderStyle.SINGLE,size:4,color:border},
      left:{style:BorderStyle.SINGLE,size:4,color:border}, right:{style:BorderStyle.SINGLE,size:4,color:border},
      insideHorizontal:{style:BorderStyle.SINGLE,size:3,color:border}, insideVertical:{style:BorderStyle.SINGLE,size:3,color:border},
    },
  });
}
// Header hari
function HARI(no, hari, nilai, fokus, warna) {
  return TBL([1500, 8138], [
    new TableRow({ children: [
      cell(`HARI\n${no}`, { w:1500, b:true, s:32, c:'FFFFFF', fill:warna, al:AlignmentType.CENTER }),
      cell(`${nilai}  —  ${fokus}\n${hari}`, { w:8138, b:true, s:26, c:warna, fill:'F5F7FA' }),
    ]}),
  ], { border: warna });
}
// Baris sesi besar
function SESI(jam, judul, langkah, warna) {
  const rows = [
    new TableRow({ children: [
      cell(jam, { w:1700, b:true, s:18, c:'FFFFFF', fill:warna, al:AlignmentType.CENTER }),
      cell(judul, { w:7938, b:true, s:20, c:warna, fill:'F5F7FA' }),
    ]}),
  ];
  langkah.forEach(([t, x]) => rows.push(new TableRow({ children: [
    cell(t, { w:1700, b:true, s:17, c:warna, al:AlignmentType.CENTER, fill:'FFFFFF' }),
    cell(x, { w:7938, s:17 }),
  ]})));
  return TBL([1700, 7938], rows, { border: warna });
}
function BOX(judul, lines, fill, accent) {
  const kids = [new Paragraph({ children:[new TextRun({ text:judul, bold:true, size:21, color:accent, font:F })], spacing:{after:50} })];
  lines.forEach(l => kids.push(new Paragraph({
    children:[new TextRun({ text:l, size:17, font:F })], spacing:{after:30, line:240},
  })));
  return new Table({
    columnWidths:[CW], width:{size:CW,type:WidthType.DXA}, layout:TableLayoutType.FIXED,
    rows:[new TableRow({ children:[new TableCell({ children:kids, width:{size:CW,type:WidthType.DXA},
      shading:{type:ShadingType.CLEAR,fill,color:'auto'}, margins:{top:80,bottom:80,left:130,right:130} })] })],
    borders:{ top:{style:BorderStyle.SINGLE,size:2,color:accent}, bottom:{style:BorderStyle.SINGLE,size:2,color:accent},
      left:{style:BorderStyle.SINGLE,size:24,color:accent}, right:{style:BorderStyle.SINGLE,size:2,color:accent},
      insideHorizontal:{style:BorderStyle.NONE}, insideVertical:{style:BorderStyle.NONE} },
  });
}
const SP = () => T(' ', { s: 6, sa: 36 });
const PB = () => new Paragraph({ children: [new PageBreak()] });

module.exports = { d, T, cell, TBL, HARI, SESI, BOX, SP, PB, CW, F,
  Document, Packer, Paragraph, TextRun, AlignmentType, TableRow, TableCell, WidthType, ShadingType, BorderStyle };
