<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Pivot: TP PKL mana yang dipilih pada sebuah agenda PKL mingguan. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pkl_agenda_objective', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pkl_agenda_id')->constrained('pkl_agendas')->cascadeOnDelete();
            $table->foreignId('pkl_objective_id')->constrained('pkl_objectives')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['pkl_agenda_id', 'pkl_objective_id'], 'pkl_agenda_objective_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pkl_agenda_objective');
    }
};
