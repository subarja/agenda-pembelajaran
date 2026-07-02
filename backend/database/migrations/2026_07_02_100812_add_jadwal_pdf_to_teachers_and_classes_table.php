<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Jadwal berupa dokumen PDF resmi (diupload admin, biasanya dari software
        // penjadwalan seperti aSc) — BEDA dari tabel `schedules` (data terstruktur
        // hari/jam/mapel yang dipakai buat isi agenda & hitung EWS). Ini murni file
        // untuk ditampilkan/diunduh guru & siswa di halaman "Jadwal Saya".
        Schema::table('teachers', function (Blueprint $table) {
            $table->string('jadwal_pdf')->nullable()->after('nip');
        });

        Schema::table('classes', function (Blueprint $table) {
            $table->string('jadwal_pdf')->nullable()->after('rombel');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('teachers', function (Blueprint $table) {
            $table->dropColumn('jadwal_pdf');
        });

        Schema::table('classes', function (Blueprint $table) {
            $table->dropColumn('jadwal_pdf');
        });
    }
};
