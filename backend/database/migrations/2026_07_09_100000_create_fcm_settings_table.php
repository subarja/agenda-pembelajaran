<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fcm_settings', function (Blueprint $table) {
            $table->id();

            // Kredensial SERVER: service account JSON dari Firebase Console >
            // Project Settings > Service Accounts. Isinya private key yang bisa
            // mengirim push ke SELURUH perangkat proyek, jadi dienkripsi APP_KEY
            // (cast 'encrypted' di model) — pola sama dgn R2Setting::secret_access_key.
            // Kolom 'text' karena ciphertext JSON jauh lebih panjang dari aslinya.
            $table->text('service_account_json')->nullable();

            // project_id disalin keluar dari JSON supaya bisa dibaca tanpa dekripsi
            // (dipakai membangun URL endpoint FCM v1) dan ditampilkan di Admin Panel.
            $table->string('project_id')->nullable();

            // Kredensial KLIEN (Firebase Console > Project Settings > General >
            // "Your apps" > Web app). Nilai-nilai ini memang publik — ikut terkirim ke
            // browser setiap pengguna — jadi TIDAK dienkripsi. Yang mengamankan FCM
            // bukan kerahasiaan nilai ini, melainkan service account di atas.
            $table->string('web_api_key')->nullable();
            $table->string('web_app_id')->nullable();
            $table->string('messaging_sender_id')->nullable();

            // Web Push certificate "Key pair" (Cloud Messaging > Web configuration).
            // Kunci publik VAPID, dipakai frontend saat getToken(). Publik juga.
            $table->text('vapid_public_key')->nullable();

            $table->boolean('aktif')->default(false);
            $table->timestamps();
        });

        // Baris tunggal (singleton) — sama pola dgn r2_settings/calendar_settings.
        DB::table('fcm_settings')->insert(['aktif' => false, 'created_at' => now(), 'updated_at' => now()]);
    }

    public function down(): void
    {
        Schema::dropIfExists('fcm_settings');
    }
};
