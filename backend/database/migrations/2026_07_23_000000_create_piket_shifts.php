<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Piket per-hari + shift (menggantikan penugasan per-tanggal `piket_assignments`).
 *
 * - piket_shifts: definisi shift per hari-dalam-seminggu (scope TA aktif). Satu hari boleh
 *   >1 shift; jam bebas (independen bel). Batas shift diperlakukan [jam_mulai, jam_selesai).
 * - piket_shift_teacher: petugas tetap per shift (pivot many-to-many).
 *
 * Aditif: tabel lama `piket_assignments` dibiarkan apa adanya (modul belum live, tak ada
 * data produksi) — cukup tak lagi dipakai runtime. Jangan destruktif (lihat insiden reset DB).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('piket_shifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->string('hari');            // enum App\Enums\Hari (senin..jumat)
            $table->string('nama_shift');      // mis. "Pagi", "Siang"
            $table->time('jam_mulai');
            $table->time('jam_selesai');
            $table->unsignedTinyInteger('urutan')->default(0);
            $table->timestamps();

            $table->unique(['academic_year_id', 'hari', 'nama_shift']);
            $table->index(['academic_year_id', 'hari']);
        });

        Schema::create('piket_shift_teacher', function (Blueprint $table) {
            $table->id();
            $table->foreignId('piket_shift_id')->constrained('piket_shifts')->cascadeOnDelete();
            $table->foreignId('teacher_id')->constrained('teachers')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['piket_shift_id', 'teacher_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('piket_shift_teacher');
        Schema::dropIfExists('piket_shifts');
    }
};
