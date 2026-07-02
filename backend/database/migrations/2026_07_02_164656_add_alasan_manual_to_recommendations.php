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
        // GK6: kasus yang dibuat manual (threshold_id NULL) butuh deskripsi/alasan
        // sendiri — kasus otomatis pakai `threshold->rekomendasi`, kasus manual pakai ini.
        Schema::table('recommendations', function (Blueprint $table) {
            $table->string('alasan_manual', 500)->nullable()->after('threshold_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('recommendations', function (Blueprint $table) {
            $table->dropColumn('alasan_manual');
        });
    }
};
