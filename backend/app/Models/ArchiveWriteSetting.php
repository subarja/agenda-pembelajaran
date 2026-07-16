<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Saklar global "izinkan tulis di tahun ajaran non-aktif" (Panel Admin >
 * Pengaturan). Default MATI: TA arsip baca-saja penuh; admin membukanya
 * sementara bila ada koreksi data susulan, lalu menutupnya kembali.
 */
class ArchiveWriteSetting extends Model
{
    protected $fillable = ['izinkan_tulis'];

    protected function casts(): array
    {
        return ['izinkan_tulis' => 'boolean'];
    }

    public static function instance(): self
    {
        return self::firstOrCreate([], ['izinkan_tulis' => false]);
    }
}
