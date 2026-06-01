<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Hapus kolom nilai_aktivitas dari agendas — semantiknya salah (bukan nilai kelas)
        Schema::table('agendas', function (Blueprint $table) {
            $table->dropColumn('nilai_aktivitas');
        });

        // Nilai per siswa per sesi agenda (bisa positif atau negatif)
        Schema::create('agenda_student_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agenda_id')->constrained('agendas')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('teacher_id')->constrained('teachers')->restrictOnDelete();
            $table->integer('nilai');           // boleh negatif
            $table->text('catatan')->nullable();
            $table->timestamps();

            $table->unique(['agenda_id', 'student_id']);
            $table->index(['student_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agenda_student_scores');
        Schema::table('agendas', function (Blueprint $table) {
            $table->unsignedTinyInteger('nilai_aktivitas')->nullable();
        });
    }
};
