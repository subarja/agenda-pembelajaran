<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            // 'L' / 'P'. Nullable — data lama hasil import tidak punya nilai ini.
            $table->string('jenis_kelamin', 1)->nullable()->after('nisn');
        });
    }

    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn('jenis_kelamin');
        });
    }
};
