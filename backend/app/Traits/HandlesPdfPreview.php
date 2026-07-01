<?php

namespace App\Traits;

use Illuminate\Http\Request;

trait HandlesPdfPreview
{
    /**
     * Semua export PDF di aplikasi ini pakai alur "preview dulu, baru simpan": frontend
     * buka PDF di modal/iframe, baru men-download beneran saat user klik "Simpan PDF"
     * (request TANPA `?preview=1`, Content-Disposition attachment — ini SATU-SATUNYA
     * request yang boleh mengembalikan `Content-Type: application/pdf` mentah).
     *
     * Request preview (`?preview=1`) SENGAJA dibalas sebagai JSON berisi base64, BUKAN
     * `$pdf->stream()` langsung — walau stream() sudah pakai Content-Disposition inline
     * dan diambil lewat XHR (bukan navigasi/klik <a>), download manager dengan "advanced
     * browser integration" (mis. IDM) tetap bisa mengendus response HTTP mentah ber-
     * Content-Type application/pdf di level jaringan lalu memaksa prompt "download ini?"
     * walau tidak ada aksi download nyata — preview pun gagal tampil. Membungkusnya jadi
     * JSON (Content-Type: application/json) membuat response itu tak terlihat seperti file
     * yang bisa "digrab" oleh ekstensi semacam itu; frontend baru merakit ulang jadi Blob
     * PDF di JS (lihat `usePdfPreview.tsx`), sepenuhnya di luar jangkauan network sniffer.
     *
     * Render PDF DomPDF itu LAZY — baru benar-benar jalan (bangun seluruh dokumen di RAM)
     * begitu stream()/download()/output() dipanggil, jadi menaikkan memory_limit/execution
     * time DI SINI (satu titik, dipakai semua controller PDF via trait ini) tetap keburu
     * sebelum render berat berjalan. Default PHP 128M/30s gampang habis utk laporan dengan
     * banyak baris/siswa (lihat [[minggu_efektif_v2_cetak]] utk insiden OOM yang memicu ini,
     * awalnya cuma ditambal di Minggu Efektif, sekarang berlaku otomatis ke SEMUA export
     * PDF karena lewat trait yang sama).
     */
    private function pdfResponse(\Barryvdh\DomPDF\PDF $pdf, string $filename, Request $request)
    {
        ini_set('memory_limit', '512M');
        set_time_limit(300);

        if ($request->boolean('preview')) {
            return response()->json([
                'filename' => $filename,
                'base64'   => base64_encode($pdf->output()),
            ]);
        }

        return $pdf->download($filename);
    }
}
