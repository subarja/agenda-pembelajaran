<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Unique lama (class_id, hari, jam_mulai) melarang dua guru memegang slot yang
     * sama — padahal team teaching (beberapa guru pada satu jam, lazim di mapel
     * kejuruan) dan kelas terbelah dua kelompok itu sah. Akibat nyatanya: import
     * aSc hanya menyimpan satu guru per slot, beban mengajar guru lain hilang.
     * Ganti dengan unique yang menyertakan teacher_id.
     */
    public function up(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            // Index baru dulu — FK class_id butuh index yang diawali class_id,
            // jadi index lama tidak boleh dilepas sebelum ada penggantinya.
            $table->unique(['class_id', 'hari', 'jam_mulai', 'teacher_id'], 'schedules_class_hari_jam_guru_unique');
            $table->dropUnique('schedules_class_hari_jam_unique');
        });
    }

    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->unique(['class_id', 'hari', 'jam_mulai'], 'schedules_class_hari_jam_unique');
            $table->dropUnique('schedules_class_hari_jam_guru_unique');
        });
    }
};
