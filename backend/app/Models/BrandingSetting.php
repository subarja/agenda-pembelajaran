<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/**
 * Logo aplikasi (singleton, pola sama dengan PklSetting).
 * logo_path = path di disk 'public' (lokal atau R2, mengikuti pengaturan Penyimpanan).
 */
class BrandingSetting extends Model
{
    protected $fillable = ['logo_path'];

    public static function instance(): self
    {
        return static::firstOrCreate([], ['logo_path' => null]);
    }

    public function logoUrl(): ?string
    {
        return $this->logo_path ? Storage::disk('public')->url($this->logo_path) : null;
    }
}
