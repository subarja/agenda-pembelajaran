<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Penilaian kokurikuler berbasis Dimensi Profil Lulusan (Permendikdasmen 10/2025):
 *  - master dimensi + sub-dimensi (di-seed 8 dimensi, boleh diedit admin),
 *  - dimensi yang dinilai per projek (+ "aspek yang dinilai" + sub-dimensi yang diamati),
 *  - nilai per (projek, siswa, dimensi) dengan level SB/B/C/K oleh fasilitator.
 * Projek juga diperluas: tingkat sasaran (X/XI/XII/null=semua) dan tujuan akhir.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kokurikuler_projects', function (Blueprint $table) {
            $table->string('tingkat', 10)->nullable()->after('tema');  // X | XI | XII | null = semua
            $table->text('tujuan')->nullable()->after('tingkat');
        });

        Schema::create('kokurikuler_dimensions', function (Blueprint $table) {
            $table->id();
            $table->string('kode', 40)->unique();
            $table->string('nama', 160);
            $table->text('deskripsi')->nullable();
            $table->unsignedTinyInteger('urutan')->default(0);
            $table->boolean('aktif')->default(true);
            $table->timestamps();
        });

        Schema::create('kokurikuler_subdimensions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dimension_id')->constrained('kokurikuler_dimensions')->cascadeOnDelete();
            $table->string('nama', 200);
            $table->unsignedTinyInteger('urutan')->default(0);
            $table->timestamps();
        });

        Schema::create('kokurikuler_project_dimensions', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained('kokurikuler_projects')->cascadeOnDelete();
            $table->foreignId('dimension_id')->constrained('kokurikuler_dimensions')->cascadeOnDelete();
            $table->string('aspek', 255)->nullable(); // kalimat "Aspek yang Dinilai"
            $table->unsignedTinyInteger('urutan')->default(0);
            $table->timestamps();

            $table->unique(['project_id', 'dimension_id'], 'kokurikuler_projdim_unique');
        });

        Schema::create('kokurikuler_project_subdimensions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_dimension_id')->constrained('kokurikuler_project_dimensions')->cascadeOnDelete();
            $table->foreignId('subdimension_id')->constrained('kokurikuler_subdimensions')->cascadeOnDelete();

            $table->unique(['project_dimension_id', 'subdimension_id'], 'kokurikuler_projsub_unique');
        });

        Schema::create('kokurikuler_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('kokurikuler_projects')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('project_dimension_id')->constrained('kokurikuler_project_dimensions')->cascadeOnDelete();
            $table->string('level', 2); // SB | B | C | K
            $table->string('catatan', 255)->nullable();
            $table->foreignId('dinilai_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['project_id', 'student_id', 'project_dimension_id'], 'kokurikuler_score_unique');
            $table->index(['project_id', 'project_dimension_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kokurikuler_scores');
        Schema::dropIfExists('kokurikuler_project_subdimensions');
        Schema::dropIfExists('kokurikuler_project_dimensions');
        Schema::dropIfExists('kokurikuler_subdimensions');
        Schema::dropIfExists('kokurikuler_dimensions');
        Schema::table('kokurikuler_projects', function (Blueprint $table) {
            $table->dropColumn(['tingkat', 'tujuan']);
        });
    }
};
