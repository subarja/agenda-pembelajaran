<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Resume piket kini PER SHIFT (sesi petugas), bukan gabungan per tanggal.
 *  - piket_shift_id: shift pembuat resume (scope TA lewat shift). unique jadi (tanggal, shift).
 *  - rekap: snapshot JSON rekap kehadiran/agenda/presensi "sampai waktu resume dibuat".
 *
 * Aditif; modul belum live. Jangan destruktif.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('piket_resumes', function (Blueprint $table) {
            $table->foreignId('piket_shift_id')->nullable()->after('tanggal')
                ->constrained('piket_shifts')->nullOnDelete();
            $table->json('rekap')->nullable()->after('kejadian_penting');
        });

        Schema::table('piket_resumes', function (Blueprint $table) {
            $table->dropUnique('piket_resumes_tanggal_unique');
            $table->unique(['tanggal', 'piket_shift_id']);
        });
    }

    public function down(): void
    {
        Schema::table('piket_resumes', function (Blueprint $table) {
            $table->dropUnique(['tanggal', 'piket_shift_id']);
            $table->dropConstrainedForeignId('piket_shift_id');
            $table->dropColumn('rekap');
            $table->unique('tanggal');
        });
    }
};
