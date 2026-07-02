<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('agenda_fill_settings', function (Blueprint $table) {
            $table->id();
            // Batas waktu guru boleh mengisi agenda baru, dihitung dari tanggal+jam_selesai
            // jadwal (bukan dari saat ini) — default 3 hari 0 jam kalau belum diatur admin.
            $table->unsignedSmallInteger('batas_hari')->default(3);
            $table->unsignedTinyInteger('batas_jam')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('agenda_fill_settings');
    }
};
