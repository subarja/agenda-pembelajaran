<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Null character_category_id = berlaku global (semua kategori)
        Schema::create('action_thresholds', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('character_category_id')
                ->nullable()
                ->constrained('character_categories')
                ->nullOnDelete();
            $table->integer('min_point');           // inklusif; boleh negatif
            $table->integer('max_point')->nullable(); // null = tidak ada batas atas
            $table->enum('sifat', ['positif', 'negatif']);
            $table->text('rekomendasi');
            $table->boolean('aktif')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['sifat', 'aktif']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('action_thresholds');
    }
};
