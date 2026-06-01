<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recommendations', function (Blueprint $table) {
            $table->text('catatan_admin')->nullable()->after('hasil_tindak_lanjut');
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete()->after('catatan_admin');
            $table->timestamp('verified_at')->nullable()->after('verified_by');
        });

        // Tambah value baru ke enum status (PostgreSQL)
        DB::statement("ALTER TABLE recommendations DROP CONSTRAINT IF EXISTS recommendations_status_check");
        DB::statement("ALTER TABLE recommendations ALTER COLUMN status TYPE varchar(30)");
        DB::statement("ALTER TABLE recommendations ADD CONSTRAINT recommendations_status_check CHECK (status IN ('pending','proses','menunggu_verifikasi','selesai','diabaikan'))");
    }

    public function down(): void
    {
        Schema::table('recommendations', function (Blueprint $table) {
            $table->dropColumn(['catatan_admin', 'verified_by', 'verified_at']);
        });
    }
};
