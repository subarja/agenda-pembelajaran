<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Label "libur nasional" pada hari non-efektif. Hari non-efektif internal sekolah
 * (acara sekolah, dll) memengaruhi MINGGU EFEKTIF sekolah, tapi TIDAK memengaruhi PKL
 * karena industri di luar tetap beroperasi. Hanya hari berlabel `libur_nasional` yang
 * mengurangi hari kerja PKL (dipakai menghitung % hadir siswa PKL).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('non_effective_days', function (Blueprint $table) {
            $table->boolean('libur_nasional')->default(false)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('non_effective_days', function (Blueprint $table) {
            $table->dropColumn('libur_nasional');
        });
    }
};
