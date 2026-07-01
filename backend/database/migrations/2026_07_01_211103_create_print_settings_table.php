<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('print_settings', function (Blueprint $table) {
            $table->id();
            $table->enum('paper_size', ['A4', 'F4'])->default('A4');
            $table->decimal('margin_top', 4, 2)->default(1.5);
            $table->decimal('margin_bottom', 4, 2)->default(1.5);
            $table->decimal('margin_left', 4, 2)->default(2.0);
            $table->decimal('margin_right', 4, 2)->default(2.0);
            $table->unsignedTinyInteger('kop_width_percent')->default(100);
            $table->enum('kop_position', ['left', 'center', 'right'])->default('center');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('print_settings');
    }
};
