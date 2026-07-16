<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Penugasan mengajar (lesson aSc: guru × mapel × kelas + JP/minggu) TERPISAH
     * dari ploting grid (schedules). Lesson yang belum ditempatkan ke hari/jam
     * tetap terekam di sini, sehingga Beban Mengajar guru tidak kosong hanya
     * karena jadwalnya belum diplot.
     */
    public function up(): void
    {
        Schema::create('teaching_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->foreignId('teacher_id')->constrained('teachers')->cascadeOnDelete();
            $table->decimal('jp_per_minggu', 4, 1)->default(0);
            $table->timestamps();
            $table->unique(['class_id', 'subject_id', 'teacher_id'], 'teaching_assignments_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teaching_assignments');
    }
};
