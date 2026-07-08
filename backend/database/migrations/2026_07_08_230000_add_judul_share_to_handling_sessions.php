<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Judul singkat per catatan penanganan (wajib utk entri baru via validasi; entri
        // lama tetap null → FE fallback) + kontrol berbagi catatan BK ke wali kelas.
        // `shared_with_wali_kelas` hanya relevan utk sesi jenis=bk (catatan wali_kelas
        // memang selalu terlihat wali kelas). Default false = privat (opt-in), sesuai
        // etika kerahasiaan BK; resume penutup di-set true saat kasus diselesaikan.
        Schema::table('handling_sessions', function (Blueprint $table) {
            $table->string('judul', 120)->nullable()->after('jenis');
            $table->boolean('shared_with_wali_kelas')->default(false)->after('is_resume');
        });
    }

    public function down(): void
    {
        Schema::table('handling_sessions', function (Blueprint $table) {
            $table->dropColumn(['judul', 'shared_with_wali_kelas']);
        });
    }
};
