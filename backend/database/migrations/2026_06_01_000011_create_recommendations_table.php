<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recommendations', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('threshold_id')->constrained('action_thresholds')->restrictOnDelete();
            $table->integer('akumulasi_saat_trigger');
            $table->enum('status', ['pending', 'proses', 'selesai', 'diabaikan'])->default('pending');
            $table->foreignId('ditugaskan_ke')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->text('hasil_tindak_lanjut')->nullable();
            $table->timestamp('ditangani_pada')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['student_id', 'status']);
            $table->index('ditugaskan_ke');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recommendations');
    }
};
