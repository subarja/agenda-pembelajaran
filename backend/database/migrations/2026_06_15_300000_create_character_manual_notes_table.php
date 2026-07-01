<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('character_manual_notes', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('teacher_id')->constrained('teachers')->restrictOnDelete();
            $table->text('catatan');
            $table->integer('nilai')->nullable()->comment('-20 s.d. +20, boleh kosong');
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('admin_catatan')->nullable();
            $table->integer('nilai_final')->nullable()->comment('nilai yang disetujui admin');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['student_id', 'status']);
            $table->index('teacher_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('character_manual_notes');
    }
};
