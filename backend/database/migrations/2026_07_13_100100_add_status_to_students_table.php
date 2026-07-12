<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Siswa butuh siklus hidup: XII yang lulus tidak boleh selamanya tampil sebagai siswa
 * aktif (dan tetap bisa login), tapi datanya juga tidak boleh dihapus — presensi, poin
 * karakter, dan EWS historisnya adalah arsip sekolah.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->enum('status', ['aktif', 'lulus', 'pindah', 'keluar'])
                ->default('aktif')->after('angkatan');
            $table->date('tanggal_keluar')->nullable()->after('status');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropColumn(['status', 'tanggal_keluar']);
        });
    }
};
