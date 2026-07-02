<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class AgendaFillSetting extends Model
{
    protected $fillable = [
        'batas_hari', 'batas_jam',
    ];

    protected function casts(): array
    {
        return [
            'batas_hari' => 'integer',
            'batas_jam'  => 'integer',
        ];
    }

    public static function instance(): self
    {
        return static::firstOrCreate([], ['batas_hari' => 3, 'batas_jam' => 0]);
    }

    /**
     * Batas waktu terakhir agenda boleh diisi, dihitung dari tanggal+jam selesai jadwal
     * (BUKAN dari waktu sekarang) — mis. jadwal selesai Senin 09:00, batas 1 hari 0 jam
     * → guru masih boleh isi sampai Selasa 09:00.
     */
    public function batasWaktu(Carbon $jadwalSelesai): Carbon
    {
        return $jadwalSelesai->copy()->addDays($this->batas_hari)->addHours($this->batas_jam);
    }
}
