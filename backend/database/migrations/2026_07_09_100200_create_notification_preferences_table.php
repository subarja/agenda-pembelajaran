<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();

            // Saklar induk. Hanya mempengaruhi PUSH — lonceng notifikasi in-app
            // (channel 'database') selalu terisi apa pun isi tabel ini, supaya
            // mematikan push tidak pernah berarti kehilangan informasi.
            $table->boolean('push_enabled')->default(true);

            // Peta jenis→bool, mis. {"alpha_alert":true,"rekomendasi":false}.
            // NULL / kunci yang tidak ada = aktif. Disimpan sebagai opt-OUT (bukan
            // opt-in) supaya jenis notifikasi BARU yang ditambahkan di versi berikutnya
            // otomatis menyala tanpa perlu migrasi data untuk pengguna lama.
            $table->json('types')->nullable();

            // Jam tenang: push ditahan, notifikasi database tetap tersimpan.
            // Format "HH:MM" (string, bukan kolom TIME) supaya perbandingan di PHP
            // apa adanya tanpa bergantung driver/zona waktu koneksi DB.
            $table->boolean('quiet_hours_enabled')->default(false);
            $table->string('quiet_start', 5)->default('21:00');
            $table->string('quiet_end', 5)->default('05:00');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_preferences');
    }
};
