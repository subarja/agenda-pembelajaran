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
