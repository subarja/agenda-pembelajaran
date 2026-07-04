<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::connection()->getDriverName() === 'pgsql') {
            // Drop old check constraint FIRST (PostgreSQL)
            DB::statement('ALTER TABLE non_effective_days DROP CONSTRAINT IF EXISTS non_effective_days_status_check');
        }

        // Migrate existing records: libur/daring/lainnya → tidak_efektif
        DB::table('non_effective_days')
            ->whereIn('status', ['libur', 'daring', 'lainnya'])
            ->update(['status' => 'tidak_efektif']);

        if (DB::connection()->getDriverName() === 'pgsql') {
            // Add new constraint
            DB::statement("ALTER TABLE non_effective_days ADD CONSTRAINT non_effective_days_status_check CHECK (status = 'tidak_efektif')");
        } else {
            DB::statement("ALTER TABLE non_effective_days MODIFY COLUMN status ENUM('tidak_efektif') NOT NULL");
        }
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE non_effective_days DROP CONSTRAINT IF EXISTS non_effective_days_status_check');
            DB::statement("ALTER TABLE non_effective_days ADD CONSTRAINT non_effective_days_status_check CHECK (status IN ('libur', 'daring', 'lainnya'))");
        } else {
            DB::statement("ALTER TABLE non_effective_days MODIFY COLUMN status ENUM('libur','daring','lainnya') NOT NULL");
        }
    }
};
