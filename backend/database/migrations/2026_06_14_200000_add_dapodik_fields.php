<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // NUPTK guru (nomor unik nasional)
        Schema::table('teachers', function (Blueprint $table) {
            $table->string('nuptk', 20)->nullable()->unique()->after('nip');
        });

        // Data orang tua siswa (dari Dapodik)
        Schema::table('students', function (Blueprint $table) {
            $table->string('nama_ayah', 100)->nullable()->after('angkatan');
            $table->string('nama_ibu', 100)->nullable()->after('nama_ayah');
            $table->string('hp_ortu', 20)->nullable()->after('nama_ibu');
        });
    }

    public function down(): void
    {
        Schema::table('teachers', function (Blueprint $table) {
            $table->dropColumn('nuptk');
        });
        Schema::table('students', function (Blueprint $table) {
            $table->dropColumns(['nama_ayah', 'nama_ibu', 'hp_ortu']);
        });
    }
};
