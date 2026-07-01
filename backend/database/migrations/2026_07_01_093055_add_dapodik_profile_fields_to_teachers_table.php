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
        Schema::table('teachers', function (Blueprint $table) {
            $table->string('jk', 1)->nullable()->after('gelar_belakang');
            $table->string('tempat_lahir', 100)->nullable()->after('jk');
            $table->date('tanggal_lahir')->nullable()->after('tempat_lahir');
            $table->string('status_kepegawaian', 50)->nullable()->after('tanggal_lahir');
            $table->string('jenis_ptk', 50)->nullable()->after('status_kepegawaian');
            $table->string('agama', 30)->nullable()->after('jenis_ptk');
            $table->string('nik', 20)->nullable()->unique()->after('agama');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('teachers', function (Blueprint $table) {
            $table->dropColumn([
                'jk', 'tempat_lahir', 'tanggal_lahir',
                'status_kepegawaian', 'jenis_ptk', 'agama', 'nik',
            ]);
        });
    }
};
