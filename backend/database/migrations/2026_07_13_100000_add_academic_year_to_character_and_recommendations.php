<?php

use App\Models\AcademicYear;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Poin karakter, Nilai Tambah (catatan manual), dan rekomendasi tindakan dulu menempel
 * langsung ke siswa tanpa penanda tahun ajaran — akumulasi poin & laporan jadi kumulatif
 * seumur hidup dan bercampur lintas tahun begitu ada TA kedua. Kolom ini membuat semua
 * perhitungan & tampilan bisa dikotakkan per semester.
 *
 * Backfill: baris lama diberi TA yang rentang semesternya memuat created_at; kalau tidak
 * ada yang cocok (tanggal semester belum diisi), jatuh ke TA aktif — aman untuk instalasi
 * yang selama ini baru punya satu TA.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['character_inputs', 'character_manual_notes', 'recommendations'] as $tabel) {
            Schema::table($tabel, function (Blueprint $table) {
                $table->foreignId('academic_year_id')->nullable()->after('id')
                    ->constrained('academic_years')->nullOnDelete();
                $table->index(['academic_year_id']);
            });
        }

        $fallbackId = AcademicYear::where('aktif', true)->value('id')
            ?? AcademicYear::orderByDesc('id')->value('id');

        $years = AcademicYear::whereNotNull('tanggal_mulai')
            ->whereNotNull('tanggal_selesai')
            ->get(['id', 'tanggal_mulai', 'tanggal_selesai']);

        foreach (['character_inputs', 'character_manual_notes', 'recommendations'] as $tabel) {
            foreach ($years as $ay) {
                DB::table($tabel)
                    ->whereNull('academic_year_id')
                    ->whereBetween(DB::raw('DATE(created_at)'), [
                        $ay->tanggal_mulai->toDateString(),
                        $ay->tanggal_selesai->toDateString(),
                    ])
                    ->update(['academic_year_id' => $ay->id]);
            }

            if ($fallbackId !== null) {
                DB::table($tabel)->whereNull('academic_year_id')
                    ->update(['academic_year_id' => $fallbackId]);
            }
        }
    }

    public function down(): void
    {
        foreach (['character_inputs', 'character_manual_notes', 'recommendations'] as $tabel) {
            Schema::table($tabel, function (Blueprint $table) {
                $table->dropConstrainedForeignId('academic_year_id');
            });
        }
    }
};
