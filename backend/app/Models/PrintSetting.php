<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PrintSetting extends Model
{
    protected $fillable = [
        'user_id',
        'paper_size',
        'margin_top', 'margin_bottom', 'margin_left', 'margin_right',
        'kop_width_percent', 'kop_position',
    ];

    protected function casts(): array
    {
        return [
            'margin_top'    => 'float',
            'margin_bottom' => 'float',
            'margin_left'   => 'float',
            'margin_right'  => 'float',
            'kop_width_percent' => 'integer',
        ];
    }

    // GK30: pengaturan kertas per-akun — tiap user (guru/wali kelas/BK/admin) punya
    // barisnya sendiri, terisolasi penuh dari user lain (yang lain tetap default sampai
    // dia ubah sendiri). $userId null (jarang dipakai, cuma fallback) = baris global lama.
    public static function instance(?int $userId = null): self
    {
        return static::firstOrCreate(['user_id' => $userId], [
            'paper_size' => 'A4',
            'margin_top' => 1.5, 'margin_bottom' => 1.5,
            'margin_left' => 2.0, 'margin_right' => 2.0,
            'kop_width_percent' => 100, 'kop_position' => 'center',
        ]);
    }

    /** DomPDF butuh dimensi kertas dalam poin (1mm = 2.83465pt) — F4 (210x330mm) bukan
     * ukuran bawaan DomPDF ("folio" bawaan itu 8.5x13in Amerika, beda dari F4 ISO). */
    public function paperDimensionsPt(): array
    {
        if ($this->paper_size === 'F4') {
            return [0.0, 0.0, 210 * 2.83465, 330 * 2.83465];
        }

        return [0.0, 0.0, 210 * 2.83465, 297 * 2.83465]; // A4
    }
}
