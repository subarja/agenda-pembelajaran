<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Penyempurnaan modul Bel (permintaan user):
 * - bell_audios.volume : level volume per audio (persen, default 100) supaya audio yang
 *   amplitudonya beda bisa disamakan; pemutar boleh menguatkan >100 (Web Audio gain).
 * - bell_custom_rings  : jadwal bunyi KUSTOM berbasis jam dinding eksplisit (mis. 06.50
 *   murottal, 06.30 lagu pagi) — lepas dari struktur jam pelajaran. Inilah cara "bunyikan
 *   audio X pada pukul sekian" tanpa harus mengikat ke pergantian jam.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bell_audios', function (Blueprint $table) {
            $table->unsignedSmallInteger('volume')->default(100)->after('durasi_detik');
        });

        Schema::create('bell_custom_rings', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('nama', 120);                 // label, mis. "Murottal Pagi"
            $table->time('waktu');                        // jam dinding tetap (tidak digeser mode)
            $table->foreignId('bell_audio_id')->constrained('bell_audios')->cascadeOnDelete();
            $table->json('hari')->nullable();             // ["senin",...]; null/kosong = setiap hari
            $table->boolean('aktif')->default(true);
            $table->timestamps();

            $table->index('waktu');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bell_custom_rings');
        Schema::table('bell_audios', function (Blueprint $table) {
            $table->dropColumn('volume');
        });
    }
};
