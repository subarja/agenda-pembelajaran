<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recommendation_handlers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recommendation_id')->constrained('recommendations')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('suggested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['recommendation_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recommendation_handlers');
    }
};
