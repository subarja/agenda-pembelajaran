<?php

namespace App\Traits;

use OpenSpout\Common\Entity\Style\Border;
use OpenSpout\Common\Entity\Style\BorderName;
use OpenSpout\Common\Entity\Style\BorderPart;
use OpenSpout\Common\Entity\Style\BorderStyle;
use OpenSpout\Common\Entity\Style\BorderWidth;
use OpenSpout\Common\Entity\Style\CellAlignment;
use OpenSpout\Common\Entity\Style\CellVerticalAlignment;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Writer;

/**
 * Gaya standar untuk semua export Excel (judul, header tabel, border, lebar kolom) —
 * dipakai bareng supaya semua laporan Excel serapi format "Analisis Minggu Efektif"
 * yang jadi acuan (header biru tua + teks putih, border tipis abu, kolom cukup lebar,
 * wrap text di kolom teks panjang). Sebelumnya sebagian besar export Excel cuma
 * Row::fromValues() polos tanpa style/lebar kolom sama sekali.
 *
 * ATURAN WAJIB untuk export Excel baru (jangan diulang kesalahan lama):
 * 1. Judul laporan: rata KIRI (default, JANGAN di-center) via xlsxTitleStyle().
 * 2. JANGAN bikin kop surat teks (nama dinas/alamat/telepon) di Excel — kop
 *    bergambar cuma ada di PDF (lihat HandlesPdfPreview + kop_surat.jpg). Excel
 *    langsung mulai dari judul laporan.
 * 3. Blok identitas (Nama Guru/NIP/Kelas/dst.) — 3 SEL per baris: kolom A kosong
 *    (indent), kolom B = label (bold, via xlsxLabelStyle()), kolom C = ": nilai"
 *    (titik-dua + 1 spasi + isi DIGABUNG dalam satu sel, bukan sel terpisah utk
 *    titik-dua). Pola: `new Row([new StringCell(''), new StringCell('NIP', $label),
 *    new StringCell(": {$nip}")])`. Nilai boleh panjang (mis. Kelas Diampu) —
 *    tidak ke-truncate selama kolom D dst. di baris yang sama kosong (Excel
 *    otomatis overflow visual ke kanan). JANGAN pisah titik-dua jadi sel sendiri
 *    (bikin jaraknya kejauhan dari label) dan JANGAN taruh label di kolom A kalau
 *    kolom A itu juga dipakai tabel data di bawahnya sebagai kolom "No" (sempit).
 * 4. Baris peran di TTD (mis. "Guru Mata Pelajaran") — teks GENERIK saja,
 *    JANGAN gabung dengan daftar mata pelajaran/kelas yang bisa panjang.
 */
trait BuildsXlsxReports
{
    protected function xlsxThinBorder(): Border
    {
        return new Border(
            new BorderPart(BorderName::TOP, 'D1D5DB', BorderWidth::THIN, BorderStyle::SOLID),
            new BorderPart(BorderName::BOTTOM, 'D1D5DB', BorderWidth::THIN, BorderStyle::SOLID),
            new BorderPart(BorderName::LEFT, 'D1D5DB', BorderWidth::THIN, BorderStyle::SOLID),
            new BorderPart(BorderName::RIGHT, 'D1D5DB', BorderWidth::THIN, BorderStyle::SOLID),
        );
    }

    protected function xlsxTitleStyle(): Style
    {
        return (new Style())->withFontBold(true)->withFontSize(12);
    }

    protected function xlsxLabelStyle(): Style
    {
        return (new Style())->withFontBold(true);
    }

    protected function xlsxHeaderStyle(): Style
    {
        return (new Style())->withFontBold(true)->withBackgroundColor('1F4E79')->withFontColor('FFFFFF')
            ->withBorder($this->xlsxThinBorder())->withCellAlignment(CellAlignment::CENTER);
    }

    protected function xlsxCellStyle(): Style
    {
        return (new Style())->withBorder($this->xlsxThinBorder())->withShouldWrapText(true)
            ->withCellVerticalAlignment(CellVerticalAlignment::TOP);
    }

    protected function xlsxCellCenterStyle(): Style
    {
        return (new Style())->withBorder($this->xlsxThinBorder())->withCellAlignment(CellAlignment::CENTER)
            ->withCellVerticalAlignment(CellVerticalAlignment::TOP);
    }

    protected function xlsxTotalStyle(): Style
    {
        return (new Style())->withFontBold(true)->withBackgroundColor('DCE6F1')
            ->withBorder($this->xlsxThinBorder())->withCellAlignment(CellAlignment::CENTER);
    }

    /**
     * @param  array<int,float>  $widths  index kolom (1-based) => lebar karakter
     */
    protected function xlsxSetColumnWidths(Writer $writer, array $widths): void
    {
        foreach ($widths as $col => $width) {
            $writer->getOptions()->setColumnWidth($width, $col);
        }
    }
}
