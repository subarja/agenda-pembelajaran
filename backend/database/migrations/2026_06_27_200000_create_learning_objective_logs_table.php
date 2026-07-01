<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learning_objective_logs', function (Blueprint $table) {
            $table->id();
            $table->uuid()->unique();
            $table->foreignId('learning_objective_id')
                ->constrained('learning_objectives')
                ->cascadeOnDelete();
            $table->foreignId('changed_by')
                ->constrained('users')
                ->restrictOnDelete();
            $table->enum('action', ['create', 'update', 'delete', 'restore']);
            $table->json('snapshot')->nullable(); // state TP sebelum aksi ini dilakukan
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learning_objective_logs');
    }
};
