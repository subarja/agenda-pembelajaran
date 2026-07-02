<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// GK32/33: "Nilai Tambah" pakai tabel yang sama dengan Penilaian Manual, tapi TIDAK
// butuh approval admin (langsung final) — kolom ini membedakan asalnya untuk laporan
// terpisah (GK33) & logika auto-approve di controller.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('character_manual_notes', function (Blueprint $table) {
            $table->enum('sumber', ['manual', 'nilai_tambah'])->default('manual')->after('teacher_id');
        });
    }

    public function down(): void
    {
        Schema::table('character_manual_notes', function (Blueprint $table) {
            $table->dropColumn('sumber');
        });
    }
};
