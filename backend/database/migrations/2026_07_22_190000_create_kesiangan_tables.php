<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 5 modul Bel: izin masuk kesiangan + tier poin keterlambatan.
 *
 * - kesiangan_point_tiers : rentang menit -> poin negatif (dikelola admin). Diseed default
 *   (1-15 -> -2, 16-30 -> -5, >30 -> -10) langsung di migrasi agar deploy cPanel siap pakai.
 * - izin_kesiangans       : pengajuan siswa terlambat, diverifikasi piket (foto profil),
 *   terlambat_menit dihitung dari BellSchedule::jamMasukSekolah. Unik (student_id, tanggal).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kesiangan_point_tiers', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('menit_min');
            $table->unsignedSmallInteger('menit_max')->nullable(); // null = tak terbatas
            $table->integer('poin'); // negatif
            $table->boolean('aktif')->default(true);
            $table->timestamps();
        });

        $now = now();
        DB::table('kesiangan_point_tiers')->insert([
            ['menit_min' => 1,  'menit_max' => 15,   'poin' => -2,  'aktif' => true, 'created_at' => $now, 'updated_at' => $now],
            ['menit_min' => 16, 'menit_max' => 30,   'poin' => -5,  'aktif' => true, 'created_at' => $now, 'updated_at' => $now],
            ['menit_min' => 31, 'menit_max' => null, 'poin' => -10, 'aktif' => true, 'created_at' => $now, 'updated_at' => $now],
        ]);

        Schema::create('izin_kesiangans', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->date('tanggal');
            $table->text('alasan')->nullable();
            $table->string('status', 20)->default('diajukan');
            $table->dateTime('waktu_tiba');
            $table->unsignedSmallInteger('terlambat_menit')->default(0);
            $table->foreignId('diverifikasi_oleh')->nullable()->constrained('teachers')->nullOnDelete();
            $table->foreignId('character_input_id')->nullable()->constrained('character_inputs')->nullOnDelete();
            $table->timestamps();

            $table->unique(['student_id', 'tanggal']);
            $table->index(['tanggal', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('izin_kesiangans');
        Schema::dropIfExists('kesiangan_point_tiers');
    }
};
