<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Penanda agar notifikasi "siswa belum kembali (terlambat)" hanya dikirim SEKALI per izin,
 * bukan berulang tiap kali scheduler jalan. Aditif.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('izin_keluars', function (Blueprint $table) {
            $table->boolean('terlambat_dinotifikasi')->default(false)->after('catatan_piket');
        });
    }

    public function down(): void
    {
        Schema::table('izin_keluars', function (Blueprint $table) {
            $table->dropColumn('terlambat_dinotifikasi');
        });
    }
};
