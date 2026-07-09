<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('substitution_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('request_id')->constrained('substitution_requests')->cascadeOnDelete();

            // Sesi = pasangan (jadwal, tanggal). Kunci yang sama dengan tabel `agendas`
            // (unique schedule_id+tanggal), jadi satu sesi selalu berpadanan tepat dengan
            // satu agenda — tidak perlu mengubah jadwal induk sama sekali.
            $table->foreignId('schedule_id')->constrained('schedules')->cascadeOnDelete();
            $table->date('tanggal');

            /*
             * Emulasi PARTIAL UNIQUE INDEX (MySQL tidak punya `WHERE` pada index).
             *
             * Aturan yang ditegakkan: satu sesi tidak boleh punya DUA pengajuan aktif
             * (status diajukan/disetujui) sekaligus — kalau tidak, dua guru bisa sama-sama
             * mengaku bertanggung jawab dan `SessionTeacher` tak punya jawaban tunggal.
             *
             * Caranya: kolom ini bernilai 1 selama pengajuan induknya aktif, dan NULL
             * begitu ditolak/dibatalkan/kedaluwarsa. MySQL memperlakukan setiap NULL sebagai
             * nilai berbeda pada unique index, jadi baris riwayat boleh menumpuk sebanyak
             * apa pun, sementara yang aktif dijamin cuma satu.
             *
             * Nilainya dijaga SubstitutionRequest::syncSlotAktif() setiap kali status
             * berubah — jangan pernah menulisnya langsung dari controller.
             */
            $table->unsignedTinyInteger('slot_aktif')->nullable();

            $table->timestamps();

            $table->unique(['schedule_id', 'tanggal', 'slot_aktif'], 'sub_sessions_slot_unique');
            $table->index(['tanggal']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('substitution_sessions');
    }
};
