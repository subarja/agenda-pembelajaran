<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('password_default_settings', function (Blueprint $table) {
            $table->id();
            // Disimpan terenkripsi (cast 'encrypted') — teks panjang krn ciphertext
            // Laravel jauh lebih panjang dari password aslinya.
            $table->text('teacher_password')->nullable();
            $table->text('student_password')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('password_default_settings');
    }
};
