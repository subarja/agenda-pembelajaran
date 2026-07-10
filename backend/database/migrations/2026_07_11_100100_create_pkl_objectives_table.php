<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tujuan Pembelajaran khusus PKL, dikelola admin. Berbeda dari learning_objectives
 * reguler yang terikat mata pelajaran: TP PKL terikat JURUSAN.
 *
 *   jurusan = NULL  → berlaku untuk semua jurusan (TP umum PKL)
 *   jurusan = "..."  → hanya untuk kelas jurusan tersebut
 *
 * Saat guru mengisi agenda PKL sebuah kelas, TP yang tersedia = yang jurusannya NULL
 * ATAU sama dengan jurusan kelas itu.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pkl_objectives', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->text('deskripsi');
            $table->string('jurusan')->nullable()->comment('NULL = semua jurusan');
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->boolean('aktif')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['academic_year_id', 'jurusan', 'aktif']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pkl_objectives');
    }
};
