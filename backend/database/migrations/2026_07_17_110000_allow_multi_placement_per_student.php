<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Satu siswa boleh punya BEBERAPA tempat PKL asalkan periodenya tidak
     * bertumpuk (divalidasi di aplikasi). Unique lama (student, TA) melarangnya —
     * diganti unique (student, TA, tempat) supaya import ulang tetap idempotent
     * per perusahaan.
     */
    public function up(): void
    {
        Schema::table('pkl_placements', function (Blueprint $table) {
            // Index baru dulu — FK student_id butuh index berawalan student_id.
            $table->unique(['student_id', 'academic_year_id', 'tempat_pkl'], 'pkl_placements_student_ay_tempat_unique');
            $table->dropUnique(['student_id', 'academic_year_id']);
        });
    }

    public function down(): void
    {
        Schema::table('pkl_placements', function (Blueprint $table) {
            $table->unique(['student_id', 'academic_year_id']);
            $table->dropUnique('pkl_placements_student_ay_tempat_unique');
        });
    }
};
