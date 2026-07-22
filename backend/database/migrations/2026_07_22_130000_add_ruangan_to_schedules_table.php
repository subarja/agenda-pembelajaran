<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            // Ruangan/lokasi sesi (mis. "Ruang E1"). Diisi dari import aSc (classroomids)
            // atau manual lewat panel admin; nullable karena jadwal lama & PKL tak punya.
            $table->string('ruangan', 100)->nullable()->after('jam_selesai');
        });
    }

    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropColumn('ruangan');
        });
    }
};
