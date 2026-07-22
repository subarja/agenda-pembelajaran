<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 6 modul Bel: Resume Piket harian. Satu resume GABUNGAN per tanggal (keputusan user):
 * semua petugas piket hari itu menyunting bersama. teacher_id = penyunting terakhir.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('piket_resumes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->date('tanggal');
            $table->foreignId('teacher_id')->nullable()->constrained('teachers')->nullOnDelete();
            $table->text('ringkasan');
            $table->text('kejadian_penting')->nullable();
            $table->timestamps();

            $table->unique('tanggal');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('piket_resumes');
    }
};
