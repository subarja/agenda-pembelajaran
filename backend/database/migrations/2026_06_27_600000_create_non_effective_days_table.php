<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('non_effective_days', function (Blueprint $table) {
            $table->id();
            $table->date('tanggal')->unique();
            $table->enum('status', ['libur', 'daring', 'lainnya']);
            $table->string('keterangan', 255)->nullable();
            $table->unsignedBigInteger('calendar_event_id')->nullable();
            $table->foreign('calendar_event_id')
                ->references('id')->on('calendar_events')
                ->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('tanggal');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('non_effective_days');
    }
};
