<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// GK30: pengaturan kertas (ukuran/margin/kop) sebelumnya SATU baris global dipakai
// bareng semua orang, endpoint-nya sengaja admin-only karena kalau dibuka ke semua
// guru, satu guru bisa mengubah format kertas laporan semua orang. Sekarang per-akun:
// tiap user (guru/wali kelas/BK/admin) punya baris sendiri, isolasi penuh — user lain
// tetap default sampai dia ubah sendiri.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('print_settings', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->unique()->after('id')
                ->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('print_settings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
        });
    }
};
