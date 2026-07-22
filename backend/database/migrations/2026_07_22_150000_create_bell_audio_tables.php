<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 2 modul Bel: bank audio + pemetaan event -> audio + perangkat kiosk + log bunyi.
 *
 * - bell_audios      : bank suara (mp3/ogg) di disk public/R2, nama file deterministik.
 * - bell_audio_maps  : event (mis. masuk/pergantian) -> audio, per mode; bell_mode_id null = global.
 * - bell_devices     : perangkat pemutar (kiosk) + token + heartbeat.
 * - bell_ring_logs   : audit setiap bel berbunyi (berhasil/gagal/dilewati).
 *
 * Semua aditif. String enum lowercase (konvensi proyek), divalidasi di controller.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bell_audios', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('nama', 120);
            $table->string('kategori', 30);           // BellEvent value
            $table->string('disk', 20)->default('public');
            $table->string('path', 255);
            $table->unsignedSmallInteger('durasi_detik')->nullable();
            $table->unsignedBigInteger('ukuran_byte')->default(0);
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('aktif')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index('kategori');
        });

        Schema::create('bell_audio_maps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bell_mode_id')->nullable()->constrained('bell_modes')->cascadeOnDelete();
            $table->string('jenis_event', 30);        // BellEvent value
            $table->foreignId('bell_audio_id')->constrained('bell_audios')->cascadeOnDelete();
            $table->boolean('aktif')->default(true);
            $table->timestamps();

            // Satu event hanya boleh satu pemetaan per mode (null = global).
            $table->unique(['bell_mode_id', 'jenis_event']);
        });

        Schema::create('bell_devices', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('nama', 80);
            $table->string('token', 64)->unique();
            $table->timestamp('last_heartbeat_at')->nullable();
            $table->boolean('aktif')->default(true);
            $table->timestamps();
        });

        Schema::create('bell_ring_logs', function (Blueprint $table) {
            $table->id();
            $table->date('tanggal');
            $table->time('waktu');
            $table->string('jenis_event', 30);
            $table->foreignId('bell_audio_id')->nullable()->constrained('bell_audios')->nullOnDelete();
            $table->foreignId('bell_device_id')->nullable()->constrained('bell_devices')->nullOnDelete();
            $table->string('status', 12)->default('berhasil'); // berhasil|gagal|dilewati
            $table->string('keterangan', 255)->nullable();
            $table->timestamps();

            $table->index(['tanggal', 'jenis_event']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bell_ring_logs');
        Schema::dropIfExists('bell_devices');
        Schema::dropIfExists('bell_audio_maps');
        Schema::dropIfExists('bell_audios');
    }
};
