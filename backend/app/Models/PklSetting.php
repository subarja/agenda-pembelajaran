<?php

namespace App\Models;

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

    public static function instance(): self
    {
        return static::firstOrCreate([], ['aktif' => false]);
    }

    public static function isActive(): bool
    {
        return (bool) static::instance()->aktif;
    }
}
