<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tanggal projek DINYATAKAN selesai (penutupan sebenarnya), berbeda dari
 * `tanggal_selesai` terjadwal. Saat admin menutup projek lebih awal, pembebasan
 * tagihan agenda harus berhenti di hari penutupan itu — bukan menunggu tanggal
 * selesai terjadwal — supaya kelas langsung kembali ke mode mengajar reguler.
 * Null = belum pernah ditutup lebih awal (pakai perilaku lama: bebas se-periode).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kokurikuler_projects', function (Blueprint $table) {
            $table->date('selesai_pada')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('kokurikuler_projects', function (Blueprint $table) {
            $table->dropColumn('selesai_pada');
        });
    }
};
