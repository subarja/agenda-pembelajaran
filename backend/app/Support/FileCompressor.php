<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Process;

// Kompres gambar (resize + re-encode JPEG) atau PDF (Ghostscript preset /ebook) sebelum
// disimpan — foto dari kamera HP bisa 5-10MB, hasil kompresi biasanya <500KB tanpa beda
// signifikan di ukuran cetak/tampil dokumen penanganan siswa. Kalau gagal/tidak didukung
// (mis. Ghostscript tak terpasang di sebagian shared hosting), fallback diam-diam ke file
// asli — upload TIDAK BOLEH gagal gara-gara kompresi.
class FileCompressor
{
    private const MAX_DIMENSION = 1600;

    private const JPEG_QUALITY = 75;

    // Return path file yang siap disimpan (bisa file asli kalau kompresi tidak dilakukan/gagal).
    public static function compress(UploadedFile $file): string
    {
        $mime = $file->getMimeType();

        if (in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            return self::compressImage($file->getRealPath(), $mime) ?? $file->getRealPath();
        }

        if ($mime === 'application/pdf') {
            return self::compressPdf($file->getRealPath(), (int) $file->getSize()) ?? $file->getRealPath();
        }

        return $file->getRealPath();
    }

    private static function compressImage(string $path, string $mime): ?string
    {
        try {
            $src = match ($mime) {
                'image/jpeg' => imagecreatefromjpeg($path),
                'image/png' => imagecreatefrompng($path),
                'image/webp' => imagecreatefromwebp($path),
                default => null,
            };
            if (! $src) {
                return null;
            }

            // Perbaiki orientasi foto HP (EXIF) — tanpa ini banyak foto dokumen hasil
            // kamera HP tampil miring 90°/terbalik setelah upload.
            if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
                $exif = @exif_read_data($path);
                $orientation = $exif['Orientation'] ?? 1;
                $rotated = match ($orientation) {
                    3 => imagerotate($src, 180, 0),
                    6 => imagerotate($src, -90, 0),
                    8 => imagerotate($src, 90, 0),
                    default => null,
                };
                if ($rotated !== null) {
                    imagedestroy($src);
                    $src = $rotated;
                }
            }

            $width = imagesx($src);
            $height = imagesy($src);

            if ($width > self::MAX_DIMENSION || $height > self::MAX_DIMENSION) {
                $ratio = min(self::MAX_DIMENSION / $width, self::MAX_DIMENSION / $height);
                $newWidth = max(1, (int) round($width * $ratio));
                $newHeight = max(1, (int) round($height * $ratio));
                $resized = imagecreatetruecolor($newWidth, $newHeight);
                imagecopyresampled($resized, $src, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
                imagedestroy($src);
                $src = $resized;
            }

            $tmpPath = tempnam(sys_get_temp_dir(), 'compressed_').'.jpg';
            imagejpeg($src, $tmpPath, self::JPEG_QUALITY);
            imagedestroy($src);

            return $tmpPath;
        } catch (\Throwable) {
            return null;
        }
    }

    private static function compressPdf(string $path, int $originalSize): ?string
    {
        try {
            if (! Process::run(['which', 'gs'])->successful()) {
                return null; // Ghostscript tidak terpasang — umum di sebagian shared hosting
            }

            $tmpPath = tempnam(sys_get_temp_dir(), 'compressed_').'.pdf';
            $result = Process::timeout(30)->run([
                'gs', '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.4',
                '-dPDFSETTINGS=/ebook', '-dNOPAUSE', '-dBATCH', '-dQUIET',
                '-sOutputFile='.$tmpPath, $path,
            ]);

            if (! $result->successful() || ! file_exists($tmpPath) || filesize($tmpPath) === 0) {
                @unlink($tmpPath);

                return null;
            }

            // Ghostscript kadang menghasilkan file LEBIH BESAR utk PDF yang sudah rapat
            // (teks banyak, gambar sedikit) — pakai hasil kompresi cuma kalau memang lebih kecil.
            if (filesize($tmpPath) >= $originalSize) {
                @unlink($tmpPath);

                return null;
            }

            return $tmpPath;
        } catch (\Throwable) {
            return null;
        }
    }
}
