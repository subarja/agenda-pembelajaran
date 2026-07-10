<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Saklar tunggal Mode PKL. Satu baris saja (singleton, seperti agenda_fill_settings).
 * OFF = sistem berjalan persis seperti sebelum fitur ini ada; ON = alur kelas XII
 * berubah jadi Praktik Kerja Lapangan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pkl_settings', function (Blueprint $table) {
            $table->id();
            $table->boolean('aktif')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pkl_settings');
    }
};
