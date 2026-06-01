<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agendas', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('schedule_id')->constrained('schedules')->restrictOnDelete();
            $table->date('tanggal');
            $table->text('resume_kbm')->nullable();
            $table->unsignedTinyInteger('nilai_aktivitas')->nullable(); // 0–100
            $table->enum('status', ['draft', 'submitted'])->default('draft');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            // Satu jadwal hanya boleh punya satu agenda per tanggal
            $table->unique(['schedule_id', 'tanggal']);
            $table->index('tanggal');
            $table->index('status');
        });

        // Pivot many-to-many agenda ↔ learning_objectives (TP yang dicapai di sesi tersebut)
        Schema::create('agenda_learning_objectives', function (Blueprint $table) {
            $table->foreignId('agenda_id')->constrained('agendas')->cascadeOnDelete();
            $table->foreignId('learning_objective_id')->constrained('learning_objectives')->cascadeOnDelete();
            $table->primary(['agenda_id', 'learning_objective_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agenda_learning_objectives');
        Schema::dropIfExists('agendas');
    }
};
