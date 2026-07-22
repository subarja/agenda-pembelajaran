<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 3 modul Bel: peran `sekuriti` (pemindai QR izin keluar) + penugasan piket.
 *
 * - users.role ENUM ditambah 'sekuriti' (driver-aware: MySQL MODIFY, pgsql CHECK).
 * - piket_assignments: siapa guru piket pada tanggal mana (scope TA). Guru piket adalah
 *   KAPABILITAS (muncul hanya saat bertugas), bukan role.
 */
return new class extends Migration
{
    private const ROLES = ['admin', 'guru', 'wali_kelas', 'siswa', 'wakasek', 'bk', 'orang_tua', 'sekuriti'];

    public function up(): void
    {
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
            $list = "'".implode("','", self::ROLES)."'";
            DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ($list))");
        } else {
            $list = "'".implode("','", self::ROLES)."'";
            DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM($list) NOT NULL");
        }

        Schema::create('piket_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->date('tanggal');
            $table->foreignId('teacher_id')->constrained('teachers')->cascadeOnDelete();
            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['academic_year_id', 'tanggal', 'teacher_id']);
            $table->index(['tanggal']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('piket_assignments');

        $without = array_values(array_diff(self::ROLES, ['sekuriti']));
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
            $list = "'".implode("','", $without)."'";
            DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ($list))");
        } else {
            $list = "'".implode("','", $without)."'";
            DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM($list) NOT NULL");
        }
    }
};
