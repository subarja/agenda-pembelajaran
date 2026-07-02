<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PrintSetting;
use App\Models\SchoolClass;
use App\Models\WeeklyReflection;
use App\Traits\BuildsXlsxReports;
use App\Traits\HandlesPdfPreview;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenSpout\Common\Entity\Cell\NumericCell;
use OpenSpout\Common\Entity\Cell\StringCell;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer;

/**
 * Refleksi Mingguan — catatan reflektif bebas-teks wali kelas per minggu tentang kelas
 * yang ia walikan (Isu GK5). Mirip pola "isi kegiatan" di Agenda (satu entri per periode,
 * bisa diedit), dan laporan unduhannya mengikuti pola persis "Rekap Agenda Saya"
 * (ReportController::agenda()) — HandlesPdfPreview + BuildsXlsxReports, satu TTD Wali Kelas.
 */
class WeeklyReflectionController extends Controller
{
    use HandlesPdfPreview;
    use BuildsXlsxReports;

    private function myKelas(Request $request): SchoolClass
    {
        $kelas = SchoolClass::where('wali_kelas_id', $request->user()->id)
            ->whereHas('academicYear', fn ($q) => $q->where('aktif', true))
            ->first();

        abort_unless($kelas, 403, 'Anda bukan wali kelas aktif — fitur ini hanya untuk wali kelas.');

        return $kelas;
    }

    // GET /weekly-reflections
    public function index(Request $request): JsonResponse
    {
        $kelas   = $this->myKelas($request);
        $teacher = $request->user()->teacher;

        $reflections = WeeklyReflection::where('teacher_id', $teacher->id)
            ->where('class_id', $kelas->id)
            ->orderByDesc('minggu_mulai')
            ->get();

        return response()->json(['data' => $reflections->map(fn ($r) => $this->format($r))]);
    }

    // POST /weekly-reflections
    public function store(Request $request): JsonResponse
    {
        $kelas   = $this->myKelas($request);
        $teacher = $request->user()->teacher;

        $data = $request->validate([
            'minggu_mulai' => ['required', 'date'],
            'catatan'      => ['required', 'string', 'max:5000'],
        ]);

        $reflection = WeeklyReflection::updateOrCreate(
            ['teacher_id' => $teacher->id, 'class_id' => $kelas->id, 'minggu_mulai' => $data['minggu_mulai']],
            ['catatan' => $data['catatan']],
        );

        return response()->json([
            'message' => 'Refleksi mingguan disimpan.',
            'data'    => $this->format($reflection),
        ], 201);
    }

    // PUT /weekly-reflections/{uuid}
    public function update(Request $request, string $uuid): JsonResponse
    {
        $kelas      = $this->myKelas($request);
        $teacher    = $request->user()->teacher;
        $reflection = WeeklyReflection::where('uuid', $uuid)
            ->where('teacher_id', $teacher->id)->where('class_id', $kelas->id)
            ->firstOrFail();

        $data = $request->validate(['catatan' => ['required', 'string', 'max:5000']]);
        $reflection->update($data);

        return response()->json(['message' => 'Refleksi mingguan diperbarui.', 'data' => $this->format($reflection)]);
    }

    // DELETE /weekly-reflections/{uuid}
    public function destroy(Request $request, string $uuid): JsonResponse
    {
        $kelas      = $this->myKelas($request);
        $teacher    = $request->user()->teacher;
        $reflection = WeeklyReflection::where('uuid', $uuid)
            ->where('teacher_id', $teacher->id)->where('class_id', $kelas->id)
            ->firstOrFail();

        $reflection->delete();

        return response()->json(['message' => 'Refleksi mingguan dihapus.']);
    }

    // GET /weekly-reflections/export?tanggal_mulai=&tanggal_akhir=&format=pdf|excel
    public function export(Request $request)
    {
        $request->validate([
            'tanggal_mulai' => ['required', 'date'],
            'tanggal_akhir' => ['required', 'date', 'after_or_equal:tanggal_mulai'],
            'format'        => ['required', 'in:pdf,excel'],
        ]);

        $kelas   = $this->myKelas($request);
        $teacher = $request->user()->teacher;

        $rows = WeeklyReflection::where('teacher_id', $teacher->id)
            ->where('class_id', $kelas->id)
            ->whereBetween('minggu_mulai', [$request->tanggal_mulai, $request->tanggal_akhir])
            ->orderBy('minggu_mulai')
            ->get();

        $tglMulai = \Carbon\Carbon::parse($request->tanggal_mulai)->locale('id');
        $tglAkhir = \Carbon\Carbon::parse($request->tanggal_akhir)->locale('id');
        $periode  = $tglMulai->isoFormat('D MMMM') . ' - ' . $tglAkhir->isoFormat('D MMMM YYYY');

        $guru       = $teacher->nama_lengkap;
        $nip        = $teacher->nip ?? '—';
        $kelasLabel = "{$kelas->tingkat->value} {$kelas->jurusan} - {$kelas->rombel}";
        $filename   = 'Refleksi_Mingguan_' . str_replace(' ', '_', $guru);

        if ($request->format === 'pdf') {
            $kopSuratPath  = 'file://' . public_path('images/kop_surat.jpg');
            $printSettings = PrintSetting::instance($request->user()->id);
            $fotoGuruPath  = $teacher->user->foto ? \Illuminate\Support\Facades\Storage::disk('public')->path($teacher->user->foto) : public_path('images/default_avatar.jpg');
            $pdf = Pdf::loadView('reports.refleksi_mingguan', [
                'rows'          => $rows,
                'guru'          => $guru,
                'nip'           => $nip,
                'kelas'         => $kelasLabel,
                'periode'       => $periode,
                'tanggal_ttd'   => $tglAkhir->isoFormat('D MMMM YYYY'),
                'kopSuratPath'  => $kopSuratPath,
                'printSettings' => $printSettings,
                'fotoGuruPath'  => $fotoGuruPath,
            ])->setPaper($printSettings->paperDimensionsPt(), 'portrait');
            return $this->pdfResponse($pdf, "{$filename}.pdf", $request);
        }

        return $this->streamXlsx("{$filename}.xlsx", function (Writer $w) use ($rows, $guru, $nip, $kelasLabel, $periode) {
            $this->xlsxSetColumnWidths($w, [1 => 5, 2 => 18, 3 => 70]);
            $label = $this->xlsxLabelStyle();

            $w->addRow(Row::fromValuesWithStyle(['REFLEKSI MINGGUAN WALI KELAS'], $this->xlsxTitleStyle()));
            $w->addRow(Row::fromValues(['']));
            $w->addRow(new Row([new StringCell(''), new StringCell('Wali Kelas', $label), new StringCell(": {$guru}")]));
            $w->addRow(new Row([new StringCell(''), new StringCell('NIP', $label), new StringCell(": {$nip}")]));
            $w->addRow(new Row([new StringCell(''), new StringCell('Kelas', $label), new StringCell(": {$kelasLabel}")]));
            $w->addRow(new Row([new StringCell(''), new StringCell('Periode Laporan', $label), new StringCell(": {$periode}")]));
            $w->addRow(Row::fromValues(['']));

            $w->addRow(Row::fromValuesWithStyle(['No', 'Minggu Mulai', 'Catatan Refleksi'], $this->xlsxHeaderStyle()));

            $cellCenter = $this->xlsxCellCenterStyle();
            $cellText   = $this->xlsxCellStyle();
            foreach ($rows->values() as $i => $r) {
                $w->addRow(new Row([
                    new NumericCell($i + 1, $cellCenter),
                    new StringCell($r->minggu_mulai->isoFormat('D MMMM YYYY'), $cellCenter),
                    new StringCell($r->catatan, $cellText),
                ]));
            }
        });
    }

    private function format(WeeklyReflection $r): array
    {
        return [
            'id'           => $r->uuid,
            'minggu_mulai' => $r->minggu_mulai->format('Y-m-d'),
            'catatan'      => $r->catatan,
            'updated_at'   => $r->updated_at->format('Y-m-d H:i'),
        ];
    }
}
