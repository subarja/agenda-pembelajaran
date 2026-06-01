<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teacher_attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('teachers')->cascadeOnDelete();
            $table->foreignId('agenda_id')->constrained('agendas')->cascadeOnDelete();
            $table->enum('status', ['hadir', 'tidak_hadir', 'izin', 'sakit']);
            $table->string('bukti_url')->nullable();
            $table->text('catatan')->nullable();
            $table->timestamps();

            $table->unique(['teacher_id', 'agenda_id']);
        });

        Schema::create('student_attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('agenda_id')->constrained('agendas')->cascadeOnDelete();
            $table->enum('status', ['hadir', 'sakit', 'izin', 'alpha']);
            $table->unsignedSmallInteger('durasi_terlambat')->default(0); // menit
            $table->text('catatan')->nullable();
            $table->string('lampiran_url')->nullable();
            $table->timestamps();

            $table->unique(['student_id', 'agenda_id']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_attendances');
        Schema::dropIfExists('teacher_attendances');
    }
};
