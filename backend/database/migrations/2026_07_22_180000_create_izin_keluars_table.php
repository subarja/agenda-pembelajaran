<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 4 modul Bel: izin keluar berbasis QR.
 * Siswa ajukan -> piket setujui (set masa berlaku + generate qr_token HMAC) -> sekuriti
 * scan keluar -> scan masuk. Semua transisi tercatat & terpantau piket real-time.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('izin_keluars', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->date('tanggal');
            $table->string('keperluan', 120);
            $table->text('alasan')->nullable();
            $table->string('status', 20)->default('diajukan');
            $table->foreignId('diproses_oleh')->nullable()->constrained('teachers')->nullOnDelete();
            $table->dateTime('berlaku_dari')->nullable();
            $table->dateTime('berlaku_sampai')->nullable();
            $table->string('qr_token', 128)->nullable()->unique();
            $table->dateTime('waktu_keluar')->nullable();
            $table->foreignId('scan_keluar_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('waktu_masuk')->nullable();
            $table->foreignId('scan_masuk_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->string('catatan_piket', 255)->nullable();
            $table->timestamps();

            $table->index(['tanggal', 'status']);
            $table->index(['student_id', 'tanggal']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('izin_keluars');
    }
};
