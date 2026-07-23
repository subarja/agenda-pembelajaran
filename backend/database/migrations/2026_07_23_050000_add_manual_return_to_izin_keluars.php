<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Validasi KEMBALI manual oleh piket (cadangan bila QR tak dipindai sekuriti — hilang/rusak,
 * atau tak ada sekuriti). Lintas hari: petugas piket hari mana pun boleh menyatakan kembali
 * izin yang masih menggantung "keluar". Wajib keterangan alasan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('izin_keluars', function (Blueprint $table) {
            $table->foreignId('kembali_manual_oleh')->nullable()->after('scan_masuk_oleh')
                ->constrained('teachers')->nullOnDelete();
            $table->string('catatan_kembali', 500)->nullable()->after('kembali_manual_oleh');
        });
    }

    public function down(): void
    {
        Schema::table('izin_keluars', function (Blueprint $table) {
            $table->dropConstrainedForeignId('kembali_manual_oleh');
            $table->dropColumn('catatan_kembali');
        });
    }
};
