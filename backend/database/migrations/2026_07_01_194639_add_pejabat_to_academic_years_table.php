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
        Schema::table('academic_years', function (Blueprint $table) {
            $table->string('wk_kurikulum_gelar_depan', 50)->nullable()->after('tanggal_selesai');
            $table->string('wk_kurikulum_nama', 100)->nullable()->after('wk_kurikulum_gelar_depan');
            $table->string('wk_kurikulum_gelar_belakang', 100)->nullable()->after('wk_kurikulum_nama');
            $table->string('wk_kurikulum_nip', 30)->nullable()->after('wk_kurikulum_gelar_belakang');

            $table->string('kepala_sekolah_gelar_depan', 50)->nullable()->after('wk_kurikulum_nip');
            $table->string('kepala_sekolah_nama', 100)->nullable()->after('kepala_sekolah_gelar_depan');
            $table->string('kepala_sekolah_gelar_belakang', 100)->nullable()->after('kepala_sekolah_nama');
            $table->string('kepala_sekolah_nip', 30)->nullable()->after('kepala_sekolah_gelar_belakang');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('academic_years', function (Blueprint $table) {
            $table->dropColumn([
                'wk_kurikulum_gelar_depan', 'wk_kurikulum_nama', 'wk_kurikulum_gelar_belakang', 'wk_kurikulum_nip',
                'kepala_sekolah_gelar_depan', 'kepala_sekolah_nama', 'kepala_sekolah_gelar_belakang', 'kepala_sekolah_nip',
            ]);
        });
    }
};
