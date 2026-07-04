<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // GK6: Rekomendasi/Riwayat Penanganan harus BISA dibuat manual oleh wali kelas
        // kapan pun (bukan cuma otomatis saat ambang tercapai) — threshold_id & akumulasi
        // jadi opsional untuk kasus manual. Pakai DB::statement (bukan Blueprint::change())
        // supaya tidak butuh doctrine/dbal yang tidak terinstal di proyek ini.
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE recommendations ALTER COLUMN threshold_id DROP NOT NULL');
            DB::statement('ALTER TABLE recommendations ALTER COLUMN akumulasi_saat_trigger DROP NOT NULL');
        } else {
            DB::statement('ALTER TABLE recommendations MODIFY COLUMN threshold_id BIGINT UNSIGNED NULL');
            DB::statement('ALTER TABLE recommendations MODIFY COLUMN akumulasi_saat_trigger INT NULL');
        }

        // GK8-GK11: alur eskalasi ke BK — status BK terpisah dari status wali-kelas
        // (recommendations.status) supaya dua "state machine" (wali kelas vs BK) tidak
        // saling menimpa.
        Schema::table('recommendations', function (Blueprint $table) {
            $table->enum('bk_status', ['none', 'diajukan', 'diterima', 'selesai'])
                ->default('none')->after('status');
            $table->foreignId('bk_teacher_id')->nullable()->after('bk_status')
                ->constrained('teachers')->nullOnDelete();
            $table->timestamp('diajukan_konseling_pada')->nullable()->after('bk_teacher_id');
            $table->timestamp('diterima_bk_pada')->nullable()->after('diajukan_konseling_pada');
            $table->text('resume_bk')->nullable()->after('diterima_bk_pada');
            $table->timestamp('bk_selesai_pada')->nullable()->after('resume_bk');
        });

        // GK9-GK11: bedakan sesi yang diisi wali kelas vs BK (buat kunci input wali
        // kelas saat status "diterima" BK, dan buat sembunyikan detail sesi BK dari
        // wali kelas kecuali entri resume akhir).
        Schema::table('handling_sessions', function (Blueprint $table) {
            $table->enum('jenis', ['wali_kelas', 'bk'])->default('wali_kelas')->after('recommendation_id');
            $table->boolean('is_resume')->default(false)->after('jenis');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('handling_sessions', function (Blueprint $table) {
            $table->dropColumn(['jenis', 'is_resume']);
        });

        Schema::table('recommendations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('bk_teacher_id');
            $table->dropColumn(['bk_status', 'diajukan_konseling_pada', 'diterima_bk_pada', 'resume_bk', 'bk_selesai_pada']);
        });

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE recommendations ALTER COLUMN threshold_id SET NOT NULL');
            DB::statement('ALTER TABLE recommendations ALTER COLUMN akumulasi_saat_trigger SET NOT NULL');
        } else {
            DB::statement('ALTER TABLE recommendations MODIFY COLUMN threshold_id BIGINT UNSIGNED NOT NULL');
            DB::statement('ALTER TABLE recommendations MODIFY COLUMN akumulasi_saat_trigger INT NOT NULL');
        }
    }
};
