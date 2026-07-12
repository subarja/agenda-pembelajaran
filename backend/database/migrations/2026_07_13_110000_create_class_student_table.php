<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Riwayat keanggotaan kelas (enrollment). `students.class_id` hanya menyimpan kelas
 * SAAT INI — begitu siswa naik kelas, tidak ada lagi jejak "siapa saja isi X RPL A
 * tahun lalu". Tabel ini merekam SETIAP keanggotaan: satu baris per (siswa, kelas),
 * dengan status bagaimana keanggotaan itu berakhir. Kelas sudah per-TA, jadi TA
 * tidak perlu kolom sendiri.
 *
 * Backfill: keanggotaan sekarang dari students.class_id; siswa berstatus lulus
 * direkam sebagai 'lulus' di kelas terakhirnya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('class_student', function (Blueprint $table) {
            $table->id();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            // aktif = masih anggota; naik/tinggal/lulus/pindah = bagaimana keanggotaan berakhir
            $table->enum('status', ['aktif', 'naik', 'tinggal', 'lulus', 'pindah'])->default('aktif');
            $table->timestamps();

            $table->unique(['class_id', 'student_id']);
            $table->index('student_id');
        });

        $now = now();
        DB::table('students')->whereNotNull('class_id')->whereNull('deleted_at')
            ->orderBy('id')->chunk(500, function ($rows) use ($now) {
                DB::table('class_student')->insert(
                    $rows->map(fn ($s) => [
                        'class_id'   => $s->class_id,
                        'student_id' => $s->id,
                        'status'     => $s->status === 'lulus' ? 'lulus' : 'aktif',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ])->all(),
                );
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('class_student');
    }
};
