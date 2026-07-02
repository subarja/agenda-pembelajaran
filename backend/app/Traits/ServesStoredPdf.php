<?php

namespace App\Traits;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

trait ServesStoredPdf
{
    /**
     * Sama seperti HandlesPdfPreview::pdfResponse(), tapi untuk file PDF yang SUDAH ADA
     * di storage (mis. jadwal hasil upload admin), bukan hasil render DomPDF di tempat.
     * Kontrak respons IDENTIK (JSON base64 saat `?preview=1`, raw bytes selain itu) supaya
     * bisa dipakai lewat hook frontend yang sama (`usePdfPreview`) — lihat trait itu untuk
     * alasan lengkap kenapa preview dibungkus JSON (anti download-manager sniffing).
     */
    private function storedPdfResponse(string $diskPath, string $downloadFilename, Request $request)
    {
        if (! Storage::disk('public')->exists($diskPath)) {
            abort(404, 'File jadwal tidak ditemukan.');
        }

        $bytes = Storage::disk('public')->get($diskPath);

        if ($request->boolean('preview')) {
            return response()->json([
                'filename' => $downloadFilename,
                'base64'   => base64_encode($bytes),
            ]);
        }

        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$downloadFilename.'"',
        ]);
    }
}
