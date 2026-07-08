<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('r2_settings', function (Blueprint $table) {
            $table->id();
            // access_key_id & secret_access_key dienkripsi (cast 'encrypted' di model
            // R2Setting) — kolom 'text' krn ciphertext jauh lebih panjang dari aslinya.
            $table->text('access_key_id')->nullable();
            $table->text('secret_access_key')->nullable();
            $table->string('account_id')->nullable(); // dipakai bangun endpoint https://<account_id>.r2.cloudflarestorage.com
            $table->string('bucket')->nullable();
            $table->string('public_url')->nullable(); // Public Development URL atau custom domain bucket
            $table->boolean('aktif')->default(false);
            $table->timestamps();
        });

        // Baris tunggal (singleton) — sama pola dgn calendar_settings/agenda_fill_settings.
        DB::table('r2_settings')->insert(['aktif' => false, 'created_at' => now(), 'updated_at' => now()]);
    }

    public function down(): void
    {
        Schema::dropIfExists('r2_settings');
    }
};
