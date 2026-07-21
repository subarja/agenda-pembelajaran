<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Izinkan penempatan PKL "placeholder": siswa yang BELUM dapat tempat PKL tetap
 * terpetakan ke pembimbingnya (dari kolom guru di Excel impor) — tempat & tanggal NULL,
 * diisi menyusul saat tempat sudah pasti. Muncul di daftar bimbingan sebagai "belum diplot".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pkl_placements', function (Blueprint $table) {
            $table->string('tempat_pkl')->nullable()->change();
            $table->date('tanggal_mulai')->nullable()->change();
            $table->date('tanggal_selesai')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('pkl_placements', function (Blueprint $table) {
            $table->string('tempat_pkl')->nullable(false)->change();
            $table->date('tanggal_mulai')->nullable(false)->change();
            $table->date('tanggal_selesai')->nullable(false)->change();
        });
    }
};
