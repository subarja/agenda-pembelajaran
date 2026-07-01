<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('academic_years', function (Blueprint $table) {
            $table->date('tanggal_mulai')->nullable()->after('semester');
            $table->date('tanggal_selesai')->nullable()->after('tanggal_mulai');
        });

        // Isi tanggal otomatis dari tahun + semester yang sudah ada
        // Format tahun: "2025/2026"
        foreach (DB::table('academic_years')->get() as $ay) {
            $parts = explode('/', $ay->tahun);
            $tahunAwal  = (int) ($parts[0] ?? date('Y'));
            $tahunAkhir = (int) ($parts[1] ?? $tahunAwal + 1);

            if ($ay->semester === 'ganjil') {
                $mulai   = "{$tahunAwal}-07-14";
                $selesai = "{$tahunAwal}-12-20";
            } else {
                $mulai   = "{$tahunAkhir}-01-06";
                $selesai = "{$tahunAkhir}-06-20";
            }

            DB::table('academic_years')->where('id', $ay->id)
                ->update(['tanggal_mulai' => $mulai, 'tanggal_selesai' => $selesai]);
        }
    }

    public function down(): void
    {
        Schema::table('academic_years', function (Blueprint $table) {
            $table->dropColumn(['tanggal_mulai', 'tanggal_selesai']);
        });
    }
};
