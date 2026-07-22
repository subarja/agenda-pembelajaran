<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 1 modul Bel: menandai periode bel yang tidak boleh bergeser oleh mode.
 *
 * - is_istirahat     : periode ini adalah waktu istirahat (bukan jam pelajaran).
 * - terkunci_offset  : jam dinding periode TETAP walau mode menggeser awal hari
 *                      (mis. Tanpa Apel −60). Dipakai untuk istirahat 15 menit
 *                      setelah jam ke-4 dan istirahat siang 12.00–13.00 agar tidak
 *                      ikut maju ketika sekolah masuk lebih pagi.
 *
 * Aditif & aman: kolom baru default false → perilaku lama tidak berubah.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bell_periods', function (Blueprint $table) {
            $table->boolean('is_istirahat')->default(false)->after('jam_selesai');
            $table->boolean('terkunci_offset')->default(false)->after('is_istirahat');
        });
    }

    public function down(): void
    {
        Schema::table('bell_periods', function (Blueprint $table) {
            $table->dropColumn(['is_istirahat', 'terkunci_offset']);
        });
    }
};
