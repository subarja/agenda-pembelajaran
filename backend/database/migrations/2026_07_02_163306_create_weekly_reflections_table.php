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
        // Refleksi Mingguan wali kelas — mirip "isi kegiatan" di Agenda tapi mingguan &
        // bebas teks (bukan per-sesi mengajar). Satu entri per wali-kelas per kelas per
        // minggu (identitas minggu = tanggal Senin di minggu itu).
        Schema::create('weekly_reflections', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('teacher_id')->constrained('teachers')->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->date('minggu_mulai'); // Senin di minggu bersangkutan
            $table->text('catatan');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['teacher_id', 'class_id', 'minggu_mulai']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('weekly_reflections');
    }
};
