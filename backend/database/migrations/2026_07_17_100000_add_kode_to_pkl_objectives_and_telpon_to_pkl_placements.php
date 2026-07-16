<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pkl_objectives', function (Blueprint $table) {
            // Kode TP (mis. "PKL-01") — penanda visual supaya TP yang sama/umum vs
            // khusus jurusan mudah dikenali di daftar admin & form agenda guru.
            $table->string('kode', 30)->nullable()->after('uuid');
        });

        Schema::table('pkl_placements', function (Blueprint $table) {
            // Nomor HP siswa dari import penempatan — dinormalisasi ke format 62…,
            // ditampilkan ke pembimbing/pengampu mapel PKL dengan tautan WhatsApp.
            $table->string('telpon_siswa', 20)->nullable()->after('alamat_pkl');
        });
    }

    public function down(): void
    {
        Schema::table('pkl_objectives', function (Blueprint $table) {
            $table->dropColumn('kode');
        });
        Schema::table('pkl_placements', function (Blueprint $table) {
            $table->dropColumn('telpon_siswa');
        });
    }
};
