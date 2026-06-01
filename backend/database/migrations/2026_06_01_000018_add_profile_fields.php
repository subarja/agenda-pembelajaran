<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('foto')->nullable()->after('status');
            $table->string('nomor_hp', 20)->nullable()->after('foto');
        });

        Schema::table('teachers', function (Blueprint $table) {
            $table->string('nomor_hp', 20)->nullable()->after('mapel_utama');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['foto', 'nomor_hp']);
        });
        Schema::table('teachers', function (Blueprint $table) {
            $table->dropColumn('nomor_hp');
        });
    }
};
