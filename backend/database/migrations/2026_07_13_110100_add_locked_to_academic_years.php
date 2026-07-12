<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kunci semester: TA yang sudah ditutup bisa dibekukan (read-only) supaya arsipnya
 * tidak terkorup oleh tulisan tak sengaja dari semester berjalan. TA aktif tidak
 * boleh dikunci, dan TA terkunci tidak boleh diaktifkan tanpa dibuka dulu.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('academic_years', function (Blueprint $table) {
            $table->boolean('locked')->default(false)->after('aktif');
        });
    }

    public function down(): void
    {
        Schema::table('academic_years', function (Blueprint $table) {
            $table->dropColumn('locked');
        });
    }
};
