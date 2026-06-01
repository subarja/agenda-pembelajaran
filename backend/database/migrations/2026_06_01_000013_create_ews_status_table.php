<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tabel ringkasan per siswa per tahun ajaran — di-refresh oleh EWS worker
        Schema::create('ews_statuses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->enum('level', ['hijau', 'kuning', 'oranye', 'merah'])->default('hijau');
            $table->decimal('kehadiran_score', 5, 2)->default(100);  // persentase kehadiran
            $table->integer('karakter_score')->default(0);            // akumulasi poin karakter
            $table->unsignedSmallInteger('catatan_count')->default(0);
            $table->decimal('nilai_score', 5, 2)->nullable();         // rata-rata nilai aktivitas
            $table->timestamp('last_calculated_at')->nullable();
            $table->timestamps();

            $table->unique(['student_id', 'academic_year_id']);
            $table->index(['academic_year_id', 'level']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ews_statuses');
    }
};
