<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PrintSetting;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PrintSettingController extends Controller
{
    // ── GET /admin/print-settings ──────────────────────────────────────────────
    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->format(PrintSetting::instance())]);
    }

    // ── PUT /admin/print-settings ───────────────────────────────────────────────
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'paper_size'        => ['required', 'in:A4,F4'],
            'margin_top'        => ['required', 'numeric', 'min:0', 'max:5'],
            'margin_bottom'     => ['required', 'numeric', 'min:0', 'max:5'],
            'margin_left'       => ['required', 'numeric', 'min:0', 'max:5'],
            'margin_right'      => ['required', 'numeric', 'min:0', 'max:5'],
            'kop_width_percent' => ['required', 'integer', 'min:20', 'max:100'],
            'kop_position'      => ['required', 'in:left,center,right'],
        ]);

        $setting = PrintSetting::instance();
        $setting->update($data);

        return response()->json(['message' => 'Pengaturan cetak disimpan.', 'data' => $this->format($setting)]);
    }

    // ── GET /admin/print-settings/preview ─────────────────────────────────────
    // Preview PDF pakai data contoh (bukan data asli) + pengaturan DRAFT dari query
    // string (belum disimpan) — supaya admin bisa lihat hasil sebelum klik Simpan.
    public function preview(Request $request): \Illuminate\Http\Response
    {
        $data = $request->validate([
            'paper_size'        => ['required', 'in:A4,F4'],
            'margin_top'        => ['required', 'numeric', 'min:0', 'max:5'],
            'margin_bottom'     => ['required', 'numeric', 'min:0', 'max:5'],
            'margin_left'       => ['required', 'numeric', 'min:0', 'max:5'],
            'margin_right'      => ['required', 'numeric', 'min:0', 'max:5'],
            'kop_width_percent' => ['required', 'integer', 'min:20', 'max:100'],
            'kop_position'      => ['required', 'in:left,center,right'],
        ]);

        $draft = new PrintSetting($data);

        $sheets = [[
            'nama_guru'    => 'Contoh Nama Guru, S.Pd.',
            'nip_guru'     => '198001012006041001',
            'class_label'  => 'X Contoh Jurusan - A',
            'mapel'        => 'Contoh Mata Pelajaran',
            'hari_jadwal'  => ['senin', 'rabu'],
            'bulan'        => [
                ['no' => 1, 'bulan' => 'Juli', 'jumlah_minggu' => 3, 'efektif' => 2, 'tidak_efektif' => 1, 'keterangan' => "I-15/07/2026: Contoh Kegiatan"],
                ['no' => 2, 'bulan' => 'Agustus', 'jumlah_minggu' => 4, 'efektif' => 4, 'tidak_efektif' => 0, 'keterangan' => '-'],
                ['no' => 3, 'bulan' => 'September', 'jumlah_minggu' => 5, 'efektif' => 5, 'tidak_efektif' => 0, 'keterangan' => '-'],
            ],
            'total_minggu' => 12, 'total_efektif' => 11, 'total_tidak_efektif' => 1,
        ]];

        $pdf = Pdf::loadView('reports.minggu_efektif', [
            'sheets'       => $sheets,
            'tanggalCetak' => now()->locale('id')->isoFormat('D MMMM YYYY'),
            'ayLabel'      => '2026/2027 — Semester Ganjil (Contoh)',
            'printSettings'=> $draft,
        ])->setPaper($draft->paperDimensionsPt(), 'landscape');

        return $pdf->stream('preview.pdf');
    }

    private function format(PrintSetting $s): array
    {
        return [
            'paper_size'        => $s->paper_size,
            'margin_top'        => $s->margin_top,
            'margin_bottom'     => $s->margin_bottom,
            'margin_left'       => $s->margin_left,
            'margin_right'      => $s->margin_right,
            'kop_width_percent' => $s->kop_width_percent,
            'kop_position'      => $s->kop_position,
        ];
    }
}
