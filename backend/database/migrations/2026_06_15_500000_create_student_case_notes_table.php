<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_case_notes', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('author_id')->constrained('users')->restrictOnDelete();
            $table->enum('jenis', ['bk', 'wali_kelas']);
            $table->text('catatan');
            $table->string('tindak_lanjut', 255)->nullable();
            $table->date('tanggal');
            $table->boolean('konfidensial')->default(false);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['student_id', 'jenis']);
            $table->index('author_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_case_notes');
    }
};
