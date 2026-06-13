<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('handling_sessions', function (Blueprint $table) {
            // Array of {url, keterangan} — max 5 items
            $table->json('links')->nullable()->after('link_foto');
        });
    }

    public function down(): void
    {
        Schema::table('handling_sessions', function (Blueprint $table) {
            $table->dropColumn('links');
        });
    }
};
