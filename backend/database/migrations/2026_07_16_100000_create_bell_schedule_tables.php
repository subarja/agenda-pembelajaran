<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Jadwal bel: memisahkan "jam ke berapa" (disimpan di schedules) dari "pukul berapa"
 * (tabel bel per hari + mode pergeseran per tanggal).
 *
 * - bell_periods       : pukul mulai/selesai tiap jam-ke per hari (Jumat boleh beda durasi).
 * - bell_modes         : mode waktu masuk sebagai pergeseran menit (Apel = 0, Tanpa Apel = -60).
 * - bell_day_defaults  : mode default per hari tertentu (mengalahkan default global).
 * - bell_mode_overrides: pengecualian per tanggal (insidental, mis. cuaca) — prioritas tertinggi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bell_periods', function (Blueprint $table) {
            $table->id();
            $table->string('hari', 10);
            $table->unsignedTinyInteger('jam_ke');
            $table->time('jam_mulai');
            $table->time('jam_selesai');
            $table->timestamps();

            $table->unique(['hari', 'jam_ke']);
        });

        Schema::create('bell_modes', function (Blueprint $table) {
            $table->id();
            $table->string('nama', 50)->unique();
            $table->smallInteger('offset_menit')->default(0);
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        Schema::create('bell_day_defaults', function (Blueprint $table) {
            $table->id();
            $table->string('hari', 10)->unique();
            $table->foreignId('bell_mode_id')->constrained('bell_modes')->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::create('bell_mode_overrides', function (Blueprint $table) {
            $table->id();
            $table->date('tanggal')->unique();
            $table->foreignId('bell_mode_id')->constrained('bell_modes')->cascadeOnDelete();
            $table->string('keterangan')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('schedules', function (Blueprint $table) {
            $table->unsignedTinyInteger('jam_ke_mulai')->nullable()->after('hari');
            $table->unsignedTinyInteger('jam_ke_selesai')->nullable()->after('jam_ke_mulai');
        });

        // Dua mode bawaan. Disemai di migrasi (bukan seeder) supaya deploy cPanel yang
        // hanya menjalankan migrate juga langsung punya mode default.
        $now = now();
        DB::table('bell_modes')->insert([
            ['nama' => 'Apel',       'offset_menit' => 0,   'is_default' => true,  'created_at' => $now, 'updated_at' => $now],
            ['nama' => 'Tanpa Apel', 'offset_menit' => -60, 'is_default' => false, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropColumn(['jam_ke_mulai', 'jam_ke_selesai']);
        });

        Schema::dropIfExists('bell_mode_overrides');
        Schema::dropIfExists('bell_day_defaults');
        Schema::dropIfExists('bell_modes');
        Schema::dropIfExists('bell_periods');
    }
};
