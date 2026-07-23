<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Awal periode rekap sebuah resume shift = waktu resume shift SEBELUMNYA dibuat (bukan jam
 * mulai shift), supaya rantai antar-shift sambung tanpa jeda kosong bila shift sebelumnya
 * membuat resume lebih awal dari jam selesai shiftnya. Diset sekali saat resume pertama
 * dibuat, lalu tetap (immutable) walau resume disunting ulang. Aditif.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('piket_resumes', function (Blueprint $table) {
            $table->dateTime('periode_mulai')->nullable()->after('piket_shift_id');
        });
    }

    public function down(): void
    {
        Schema::table('piket_resumes', function (Blueprint $table) {
            $table->dropColumn('periode_mulai');
        });
    }
};
