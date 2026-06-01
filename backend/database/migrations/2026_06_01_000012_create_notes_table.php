<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notes', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            // Polymorphic: target bisa students, teachers, classes, dsb.
            $table->string('target_type', 100);
            $table->unsignedBigInteger('target_id');
            $table->enum('kategori', ['akademik', 'karakter', 'presensi', 'kesehatan', 'lainnya']);
            $table->text('isi');
            $table->text('tindak_lanjut')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['target_type', 'target_id']);
            $table->index('kategori');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notes');
    }
};
