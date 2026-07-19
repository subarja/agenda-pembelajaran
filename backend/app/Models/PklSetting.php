<?php

namespace App\Models;

use App\Support\PklMode;
use Illuminate\Database\Eloquent\Model;

/**
 * Saklar Mode PKL (singleton, pola sama dengan AgendaFillSetting).
 */
class PklSetting extends Model
{
    protected $fillable = ['aktif'];

    protected function casts(): array
    {
        return ['aktif' => 'boolean'];
    }

    /**
     * Nilainya di-memoize di PklMode (lihat PklMode::isActive), jadi setiap penulisan
     * WAJIB membatalkan cache itu. Dipasang di model, bukan di controller: dengan begini
     * semua jalur tulis — controller, seeder, tinker, test — otomatis konsisten dan
     * tidak ada yang bisa lupa memanggil flush().
     */
    protected static function booted(): void
    {
        static::saved(fn () => PklMode::flush());
    }

    public static function instance(): self
    {
        return static::firstOrCreate([], ['aktif' => false]);
    }

    public static function isActive(): bool
    {
        return (bool) static::instance()->aktif;
    }
}
