<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Projek kokurikuler ringkas (mis. Sakola Waluya): identitas projek + kelas peserta.
 * Fasilitator per kelas default-nya wali kelas (users.id), boleh diganti admin.
 * Lingkup data harian (absen, laporan, refleksi, dokumen) ada di migrasi berikutnya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kokurikuler_projects', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->string('judul', 200);
            $table->string('tema', 200)->nullable();
            $table->text('deskripsi')->nullable();
            $table->date('tanggal_mulai');
            $table->date('tanggal_selesai');
            $table->string('status', 20)->default('draft'); // draft | aktif | selesai
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['academic_year_id', 'status']);
        });

        Schema::create('kokurikuler_project_classes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('kokurikuler_projects')->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            // Fasilitator = wali kelas saat kelas ditambahkan; admin boleh menggantinya.
            $table->foreignId('fasilitator_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['project_id', 'class_id'], 'kokurikuler_project_class_unique');
            $table->index('fasilitator_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kokurikuler_project_classes');
        Schema::dropIfExists('kokurikuler_projects');
    }
};
