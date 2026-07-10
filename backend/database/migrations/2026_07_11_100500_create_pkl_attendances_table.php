<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Presensi PKL harian (Senin–Jumat) untuk tiap siswa bimbingan pada sebuah agenda PKL
 * mingguan. Satu status per (agenda, siswa, tanggal). Status memakai enum AttendanceStatus
 * yang sama dengan presensi reguler (hadir/sakit/izin/alpha).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pkl_attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pkl_agenda_id')->constrained('pkl_agendas')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->date('tanggal');
            $table->string('status'); // App\Enums\AttendanceStatus
            $table->timestamps();

            $table->unique(['pkl_agenda_id', 'student_id', 'tanggal'], 'pkl_attendance_unique');
            $table->index(['student_id', 'tanggal']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pkl_attendances');
    }
};
