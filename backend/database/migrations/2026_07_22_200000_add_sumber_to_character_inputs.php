<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 5 modul Bel: poin karakter otomatis (anti-dobel) untuk kesiangan.
 *
 * - sumber          : guru (default) | sistem (poin otomatis).
 * - tanggal_kejadian: tanggal kejadian nyata (untuk poin sistem); NULL untuk input guru.
 * - poin_override   : besar poin proporsional (mis. tier keterlambatan) untuk baris sistem.
 *
 * Unique (student_id, tanggal_kejadian, subitem_id): di MySQL, NULL dianggap DISTINCT,
 * sehingga banyak input guru (tanggal_kejadian NULL) tetap boleh, tetapi baris SISTEM
 * (tanggal_kejadian terisi) hanya boleh satu per (siswa, tanggal, subitem) -> anti-dobel.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('character_inputs', function (Blueprint $table) {
            $table->string('sumber', 10)->default('guru')->after('sign');
            $table->date('tanggal_kejadian')->nullable()->after('sumber');
            $table->integer('poin_override')->nullable()->after('tanggal_kejadian');

            $table->unique(['student_id', 'tanggal_kejadian', 'subitem_id'], 'char_inputs_sistem_unik');
        });
    }

    public function down(): void
    {
        Schema::table('character_inputs', function (Blueprint $table) {
            $table->dropUnique('char_inputs_sistem_unik');
            $table->dropColumn(['sumber', 'tanggal_kejadian', 'poin_override']);
        });
    }
};
