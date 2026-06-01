<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('character_categories', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('nama', 100);
            $table->text('deskripsi')->nullable();
            $table->boolean('aktif')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('character_subitems', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('category_id')->constrained('character_categories')->cascadeOnDelete();
            $table->string('kode', 20)->unique();
            $table->string('deskripsi', 255);
            $table->integer('bobot')->default(1);         // nilai poin per kejadian
            $table->enum('sifat', ['positif', 'negatif', 'keduanya']);
            $table->boolean('aktif')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['category_id', 'aktif']);
        });

        Schema::create('character_inputs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('subitem_id')->constrained('character_subitems')->restrictOnDelete();
            $table->foreignId('teacher_id')->constrained('teachers')->restrictOnDelete();
            $table->foreignId('agenda_id')->nullable()->constrained('agendas')->nullOnDelete();
            $table->enum('sign', ['positif', 'negatif']);
            $table->text('catatan')->nullable();
            $table->timestamps();

            $table->index(['student_id', 'sign']);
            $table->index(['student_id', 'created_at']);
            $table->index('teacher_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('character_inputs');
        Schema::dropIfExists('character_subitems');
        Schema::dropIfExists('character_categories');
    }
};
