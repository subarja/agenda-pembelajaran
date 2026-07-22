<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Siklus hidup penempatan PKL: siswa bisa MENGUNDURKAN DIRI, PINDAH tempat, atau
 * SELESAI (sesuai jadwal maupun lebih awal). Ditandai di level penempatan (bukan
 * hapus data — riwayat absen/rekap harus tetap ada).
 *
 * - status                 : berlangsung (default) | selesai | mengundurkan_diri | dipindahkan
 * - tanggal_berakhir_aktual: tanggal berhenti NYATA bila lebih awal; NULL = selesai
 *                            sesuai tanggal_selesai. "Tanggal efektif berakhir" =
 *                            COALESCE(tanggal_berakhir_aktual, tanggal_selesai).
 * - alasan_berakhir        : catatan alasan (mundur/pindah/selesai awal).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pkl_placements', function (Blueprint $table) {
            $table->enum('status', ['berlangsung', 'selesai', 'mengundurkan_diri', 'dipindahkan'])
                ->default('berlangsung')->after('tanggal_selesai');
            $table->date('tanggal_berakhir_aktual')->nullable()->after('status');
            $table->string('alasan_berakhir', 300)->nullable()->after('tanggal_berakhir_aktual');
            $table->index(['academic_year_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('pkl_placements', function (Blueprint $table) {
            $table->dropIndex(['academic_year_id', 'status']);
            $table->dropColumn(['status', 'tanggal_berakhir_aktual', 'alasan_berakhir']);
        });
    }
};
