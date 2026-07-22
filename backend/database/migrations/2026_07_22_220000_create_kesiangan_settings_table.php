<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Perbaikan defect S8: sub-karakter mana yang dipakai poin kesiangan otomatis tidak boleh
 * di-hardcode 'KD-04' (kode berbeda tiap sekolah). Singleton: admin memilih sub-karakter.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kesiangan_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subitem_id')->nullable()->constrained('character_subitems')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kesiangan_settings');
    }
};
