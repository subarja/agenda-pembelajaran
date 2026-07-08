<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

// DomPDF butuh path lokal (file://) atau data URI utk embed gambar — Storage::path()
// cuma jalan di disk lokal dan throw di driver s3 (R2 dkk). Helper ini kompatibel
// dengan kedua driver: baca bytes lewat Storage::get() (portable), bungkus base64
// data URI, jadi src <img> siap pakai langsung tanpa tahu disk-nya lokal atau S3.
class ImageDataUri
{
    public static function forPublicDisk(?string $path, string $fallbackAbsolutePath): string
    {
        if ($path && Storage::disk('public')->exists($path)) {
            $mime = Storage::disk('public')->mimeType($path) ?: 'image/jpeg';

            return 'data:'.$mime.';base64,'.base64_encode(Storage::disk('public')->get($path));
        }

        return 'file://'.$fallbackAbsolutePath;
    }
}
