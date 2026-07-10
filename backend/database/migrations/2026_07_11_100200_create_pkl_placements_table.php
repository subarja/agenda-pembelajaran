<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Penempatan PKL satu siswa: di mana ia magang, kapan, dan siapa guru pembimbingnya.
 * Diimpor admin lewat Excel (cocok siswa via NISN, guru via nama). Satu penempatan
 * aktif per siswa per tahun ajaran.
 *
 * pembimbing_teacher_id inilah yang menentukan "siapa membimbing siapa" — independen
 * dari plot jadwal. Guru bisa jadi pembimbing tanpa punya jadwal mengajar di kelas itu.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pkl_placements', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->foreignId('pembimbing_teacher_id')->constrained('teachers')->restrictOnDelete();
            $table->string('tempat_pkl');
            $table->text('alamat_pkl')->nullable();
            $table->date('tanggal_mulai');
            $table->date('tanggal_selesai');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['student_id', 'academic_year_id']);
            $table->index(['pembimbing_teacher_id', 'academic_year_id']);
            $table->index(['class_id', 'academic_year_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pkl_placements');
    }
};
