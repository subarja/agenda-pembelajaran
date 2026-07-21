#!/usr/bin/env python3
"""Konversi Markdown → .docx tanpa dependensi (pandoc/python-docx tak perlu).

Dukungan: heading (#/##/###), paragraf, bold (**), inline code (`), bullet (-),
checklist (- [ ]), numbered (1.), blockquote (>), code fence (```), tabel (| |),
garis horizontal (---). Cukup untuk dokumen panduan proyek ini.

Pemakaian:
    python3 scripts/md-to-docx.py "docs/Langkah-Langkah Deploy.md"
    python3 scripts/md-to-docx.py input.md output.docx
"""
import sys, os, re, html, zipfile

def esc(s): return html.escape(s, quote=False)

def inline(text):
    """text -> list of (str, bold, code)."""
    runs = []
    for i, seg in enumerate(re.split(r'`([^`]*)`', text)):
        if i % 2 == 1:
            runs.append((seg, False, True))
        else:
            for j, b in enumerate(seg.split('**')):
                if b:
                    runs.append((b, j % 2 == 1, False))
    return runs or [(text, False, False)]

def runs_xml(text, extra_sz=None):
    out = ""
    for t, b, c in inline(text):
        rpr = "<w:rPr>"
        if b: rpr += "<w:b/>"
        if c: rpr += '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:shd w:val="clear" w:fill="EEEEEE"/>'
        if extra_sz: rpr += f'<w:sz w:val="{extra_sz}"/>'
        rpr += "</w:rPr>"
        out += f'<w:r>{rpr}<w:t xml:space="preserve">{esc(t)}</w:t></w:r>'
    return out

def p(text, style=None):
    ppr = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
    return f"<w:p>{ppr}{runs_xml(text)}</w:p>"

def heading(text, lvl):
    sz = {1: "40", 2: "30", 3: "26"}[lvl]
    col = {1: "1F3864", 2: "2E74B5", 3: "2E74B5"}[lvl]
    return (f'<w:p><w:pPr><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="{lvl-1}"/></w:pPr>'
            f'<w:r><w:rPr><w:b/><w:color w:val="{col}"/><w:sz w:val="{sz}"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(text)}</w:t></w:r></w:p>')

def bullet(text):
    return (f'<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>{runs_xml(text)}</w:p>')

def quote(text):
    return ('<w:p><w:pPr><w:ind w:left="340"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="BFBFBF"/></w:pBdr></w:pPr>'
            f'<w:r><w:rPr><w:i/><w:color w:val="595959"/></w:rPr><w:t xml:space="preserve">{esc(text)}</w:t></w:r></w:p>')

def code_block(lines):
    inner = ""
    for i, ln in enumerate(lines):
        if i: inner += "<w:br/>"
        inner += f'<w:t xml:space="preserve">{esc(ln)}</w:t>'
    return ('<w:p><w:pPr><w:spacing w:before="40" w:after="40"/><w:shd w:val="clear" w:fill="F2F2F2"/>'
            '<w:pBdr><w:left w:val="single" w:sz="18" w:space="6" w:color="2E74B5"/></w:pBdr></w:pPr>'
            f'<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="19"/></w:rPr>{inner}</w:r></w:p>')

def hr():
    return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="BFBFBF"/></w:pBdr></w:pPr></w:p>'

def cell(text, header):
    shd = '<w:shd w:val="clear" w:fill="1F3864"/>' if header else ""
    pre = '<w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t xml:space="preserve">' + esc(text) + '</w:t></w:r>' if header else runs_xml(text)
    return f'<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>{shd}</w:tcPr><w:p>{pre}</w:p></w:tc>'

def table(rows):
    hdr, body = rows[0], rows[1:]
    tr = "<w:tr>" + "".join(cell(c, True) for c in hdr) + "</w:tr>"
    for r in body:
        tr += "<w:tr>" + "".join(cell(c, False) for c in r) + "</w:tr>"
    return ('<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders>'
            + "".join(f'<w:{s} w:val="single" w:sz="4" w:color="BFBFBF"/>' for s in ["top","left","bottom","right","insideH","insideV"])
            + '</w:tblBorders></w:tblPr>' + tr + "</w:tbl>")

def split_row(line):
    line = line.strip().strip("|")
    return [c.strip() for c in line.split("|")]

def convert(md):
    body, i, lines = [], 0, md.split("\n")
    n = len(lines)
    while i < n:
        line = lines[i]
        s = line.strip()
        if s.startswith("```"):
            i += 1; buf = []
            while i < n and not lines[i].strip().startswith("```"):
                buf.append(lines[i]); i += 1
            body.append(code_block(buf)); i += 1; continue
        if s.startswith("|") and i + 1 < n and re.match(r'^\|[\s:|-]+\|?$', lines[i+1].strip()):
            rows = [split_row(line)]; i += 2
            while i < n and lines[i].strip().startswith("|"):
                rows.append(split_row(lines[i])); i += 1
            body.append(table(rows)); continue
        if s == "---":
            body.append(hr()); i += 1; continue
        if s.startswith("### "): body.append(heading(s[4:], 3))
        elif s.startswith("## "): body.append(heading(s[3:], 2))
        elif s.startswith("# "): body.append(heading(s[2:], 1))
        elif s.startswith("> "): body.append(quote(s[2:]))
        elif re.match(r'^- \[[ x]\]\s', s): body.append(bullet("☐ " + re.sub(r'^- \[[ x]\]\s', '', s)))
        elif s.startswith("- "): body.append(bullet(s[2:]))
        elif re.match(r'^\d+\.\s', s): body.append(bullet(re.sub(r'^\d+\.\s', '', s)))
        elif s == "": pass
        else: body.append(p(s))
        i += 1
    return "".join(body)

def build_docx(body_xml, out):
    sect = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720"/></w:sectPr>'
    document = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
        + body_xml + sect + '</w:body></w:document>')
    ct = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>')
    rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    drels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>')
    styles = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>'
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:style>'
        '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style></w:styles>')
    numbering = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/>'
        '<w:lvlText w:val="&#8226;"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="454" w:hanging="284"/></w:pPr></w:lvl></w:abstractNum>'
        '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>')
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", ct)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/document.xml", document)
        z.writestr("word/_rels/document.xml.rels", drels)
        z.writestr("word/styles.xml", styles)
        z.writestr("word/numbering.xml", numbering)

def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(src)[0] + ".docx"
    with open(src, encoding="utf-8") as f:
        md = f.read()
    build_docx(convert(md), out)
    print("Wrote", out)

if __name__ == "__main__":
    main()
