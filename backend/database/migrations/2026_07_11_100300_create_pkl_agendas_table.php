<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agenda PKL mingguan — pengganti agenda reguler per-sesi untuk kelas XII selama Mode PKL.
 * Satu entri per (pembimbing, kelas, minggu). Identitas minggu = tanggal Senin, sama
 * seperti weekly_reflections.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pkl_agendas', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('pembimbing_teacher_id')->constrained('teachers')->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->date('minggu_mulai'); // Senin di minggu bersangkutan
            $table->text('catatan')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['pembimbing_teacher_id', 'class_id', 'minggu_mulai'], 'pkl_agenda_slot_unique');
            $table->index(['class_id', 'minggu_mulai']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pkl_agendas');
    }
};
