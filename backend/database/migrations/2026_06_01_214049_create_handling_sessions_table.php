<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Satu rekomendasi bisa punya banyak sesi penanganan oleh wali kelas
        Schema::create('handling_sessions', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('recommendation_id')->constrained('recommendations')->cascadeOnDelete();
            $table->foreignId('handled_by')->constrained('users')->restrictOnDelete();
            $table->date('tanggal');
            $table->text('catatan');
            $table->string('link_dokumen', 500)->nullable();   // URL saja, bukan upload file
            $table->string('link_foto', 500)->nullable();      // URL saja
            $table->timestamps();

            $table->index(['recommendation_id', 'tanggal']);
            $table->index('handled_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('handling_sessions');
    }
};
