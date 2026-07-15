<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tim projek kokurikuler per kelas + anggotanya + tautan dokumen hasil projek per tim.
 * Dokumen hanya berupa link (Google Drive dsb.), bukan upload file.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kokurikuler_teams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('kokurikuler_projects')->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->unsignedTinyInteger('nomor');
            $table->string('nama', 120)->nullable();
            $table->timestamps();

            $table->unique(['project_id', 'class_id', 'nomor'], 'kokurikuler_team_unique');
        });

        Schema::create('kokurikuler_team_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id')->constrained('kokurikuler_teams')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['team_id', 'student_id'], 'kokurikuler_member_unique');
            $table->index('student_id');
        });

        Schema::create('kokurikuler_documents', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('team_id')->constrained('kokurikuler_teams')->cascadeOnDelete();
            $table->string('judul', 200);
            $table->string('url', 500);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('team_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kokurikuler_documents');
        Schema::dropIfExists('kokurikuler_team_members');
        Schema::dropIfExists('kokurikuler_teams');
    }
};
