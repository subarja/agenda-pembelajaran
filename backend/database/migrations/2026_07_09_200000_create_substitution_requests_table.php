<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('substitution_requests', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('requester_teacher_id')->constrained('teachers')->cascadeOnDelete();
            $table->foreignId('substitute_teacher_id')->constrained('teachers')->cascadeOnDelete();

            // Alasan berhalangan — diisi PENGAJU, wajib. Dibaca admin di menu Guru Inval.
            $table->string('alasan', 500);
            // Pesan & link tugas untuk guru pengganti. Link, bukan upload: tugas biasanya
            // sudah ada di Google Drive guru, mengunggah ulang cuma menggandakan berkas.
            $table->text('pesan')->nullable();
            $table->string('link_tugas', 500)->nullable();

            $table->string('status', 20)->default('diajukan')->index();
            $table->string('alasan_penolakan', 500)->nullable();
            // Kapan pengganti menjawab (setuju/tolak). Ditampilkan ke pengaju sebagai
            // "diterima tanggal … jam …", dan jadi bukti di menu admin.
            $table->timestamp('responded_at')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['requester_teacher_id', 'status']);
            $table->index(['substitute_teacher_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('substitution_requests');
    }
};
