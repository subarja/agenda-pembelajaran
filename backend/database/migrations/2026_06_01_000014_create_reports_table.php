<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->enum('jenis', ['agenda', 'kehadiran', 'karakter', 'ews', 'rekapitulasi_siswa']);
            $table->string('periode', 50)->nullable();   // mis. "2025/2026-ganjil"
            $table->json('filter_json')->nullable();
            $table->enum('status', ['pending', 'processing', 'ready', 'gagal'])->default('pending');
            $table->string('generated_url')->nullable();
            $table->timestamp('generated_at')->nullable();
            $table->foreignId('generated_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->index(['generated_by', 'jenis']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reports');
    }
};
