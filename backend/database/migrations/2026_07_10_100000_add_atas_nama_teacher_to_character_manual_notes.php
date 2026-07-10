<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Memisahkan dua peran yang selama ini menyatu di `teacher_id`.
 *
 *   teacher_id           = siapa yang MEMBERI nilai (tetap, tidak berubah maknanya)
 *   atas_nama_teacher_id = guru PENGAMPU kelas, yang rekapnya memuat entri ini
 *
 * Untuk guru biasa keduanya sama. Bedanya baru muncul saat guru inval memberi nilai
 * tambah di kelas yang ia gantikan: pemberinya guru inval, tapi entri itu tetap harus
 * muncul di rekap guru pengampu asli — kelas itu tanggung jawab pembinaannya, bukan
 * tanggung jawab guru pengganti yang cuma mampir satu sesi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('character_manual_notes', function (Blueprint $table) {
            $table->foreignId('atas_nama_teacher_id')
                ->nullable()
                ->after('teacher_id')
                ->constrained('teachers')
                ->restrictOnDelete();

            $table->index('atas_nama_teacher_id');
        });

        // Baris lama semuanya lahir sebelum inval bisa memberi nilai tambah, jadi
        // pemberi = pengampu. Diisi eksplisit supaya pembaca laporan tidak perlu
        // menebak arti NULL.
        DB::table('character_manual_notes')
            ->whereNull('atas_nama_teacher_id')
            ->update(['atas_nama_teacher_id' => DB::raw('teacher_id')]);
    }

    public function down(): void
    {
        Schema::table('character_manual_notes', function (Blueprint $table) {
            $table->dropForeign(['atas_nama_teacher_id']);
            $table->dropIndex(['atas_nama_teacher_id']);
            $table->dropColumn('atas_nama_teacher_id');
        });
    }
};
