<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('push_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // Registration token FCM. Panjangnya ~160 karakter hari ini tapi Google
            // tidak menjanjikan batas atas, makanya 512. Unique GLOBAL (bukan per user):
            // satu perangkat/browser = satu token, dan token yang sama tidak boleh
            // menempel ke dua user — kalau guru A logout lalu guru B login di HP yang
            // sama, token itu HARUS berpindah kepemilikan, bukan menggandakan baris
            // (kalau tidak, guru B menerima notifikasi milik guru A).
            //
            // 512 * 4 byte (utf8mb4) = 2048 byte, masih di bawah batas index MySQL 3072.
            $table->string('token', 512)->unique();

            $table->string('device_label')->nullable();       // "Chrome di Android" — ditampilkan di halaman Pengaturan Notifikasi
            $table->string('user_agent', 512)->nullable();
            $table->timestamp('last_used_at')->nullable();    // disegarkan tiap kali browser melapor token yang sama
            $table->timestamps();

            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
    }
};
