<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('calendar_settings', function (Blueprint $table) {
            $table->id();
            $table->string('calendar_id')->default('');
            $table->string('ics_url')->nullable();
            $table->string('sync_method')->default('service_account');
            $table->text('service_account_json')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->integer('sync_months_ahead')->default(6);
            $table->timestamps();
        });

        // Baris tunggal (singleton)
        \Illuminate\Support\Facades\DB::table('calendar_settings')->insert([
            'calendar_id'       => '',
            'sync_months_ahead' => 6,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('calendar_settings');
    }
};
