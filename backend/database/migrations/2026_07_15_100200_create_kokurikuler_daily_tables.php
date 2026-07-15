<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data harian projek kokurikuler:
 *  - absensi siswa per tanggal (diisi fasilitator, status sama dengan presensi reguler),
 *  - laporan singkat harian fasilitator per kelas,
 *  - refleksi siswa (harian + satu refleksi akhir projek).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kokurikuler_attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('kokurikuler_projects')->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->date('tanggal');
            $table->string('status'); // App\Enums\AttendanceStatus
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['project_id', 'student_id', 'tanggal'], 'kokurikuler_absen_unique');
            $table->index(['project_id', 'class_id', 'tanggal']);
        });

        Schema::create('kokurikuler_reports', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained('kokurikuler_projects')->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->date('tanggal');
            $table->text('isi');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['project_id', 'class_id', 'tanggal'], 'kokurikuler_laporan_unique');
        });

        Schema::create('kokurikuler_reflections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('kokurikuler_projects')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->string('jenis', 10); // harian | akhir
            // Untuk 'akhir', tanggal diisi tanggal_selesai projek saat submit; kunci
            // upsert refleksi akhir adalah (project, student, jenis) di lapisan aplikasi.
            $table->date('tanggal');
            $table->text('isi');
            $table->timestamps();

            $table->unique(['project_id', 'student_id', 'jenis', 'tanggal'], 'kokurikuler_refleksi_unique');
            $table->index(['project_id', 'tanggal']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kokurikuler_reflections');
        Schema::dropIfExists('kokurikuler_reports');
        Schema::dropIfExists('kokurikuler_attendances');
    }
};
