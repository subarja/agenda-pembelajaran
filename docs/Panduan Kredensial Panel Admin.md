# Panduan Kredensial Panel Admin

Aplikasi Agenda Pembelajaran — SMK Negeri 2 Cimahi
Terakhir diperbarui: 9 Juli 2026

Panduan mengisi **semua kolom kredensial** di Panel Admin: dari mana nilainya diambil, apa artinya, dan apa akibatnya kalau salah.

---

## Ringkasan

Ada tiga tab di Panel Admin yang meminta kredensial. Ketiganya **opsional** — aplikasi berjalan penuh tanpa satupun diisi, hanya fitur terkait yang tidak aktif.

| Tab | Untuk apa | Kalau tidak diisi |
|---|---|---|
| **Kalender** | Menarik hari libur & agenda sekolah dari Google Calendar | Kalender & hari efektif diisi manual |
| **Penyimpanan** | Simpan foto, PDF, dokumen di Cloudflare R2 | File disimpan di disk server |
| **Notifikasi Push** | Kirim notifikasi ke HP walau aplikasi tertutup | Notifikasi hanya muncul di lonceng dalam aplikasi |

Satu kredensial **tidak ada** di Panel Admin dan sering dicari sia-sia: pengaturan **email/SMTP**. Lihat bagian terakhir.

---

## Bagaimana kredensial disimpan

Penting dipahami sebelum mengisi, karena perlakuannya **tidak sama**:

| Kredensial | Disimpan | Dikembalikan ke layar? |
|---|---|---|
| R2 Secret Access Key, R2 Access Key ID | **Terenkripsi** (kunci `APP_KEY`) | Tidak pernah |
| Firebase Service Account JSON | **Terenkripsi** | Tidak pernah — hanya `client_email`-nya |
| Firebase Web API Key, App ID, Sender ID, VAPID | Teks biasa | Ya |
| Google Calendar API Key | Teks biasa | Ya |
| Google Calendar Service Account JSON | Teks biasa di database | Tidak — hanya status "terpasang" |

Yang dienkripsi adalah yang memberi **akses tulis penuh**. Yang tidak dienkripsi memang bersifat publik — Firebase Web API Key dan VAPID Public Key ikut terkirim ke browser setiap pengguna, jadi mengenkripsinya hanya menyulitkan tanpa menambah keamanan sedikit pun.

Konsekuensi praktisnya: untuk kolom rahasia, **mengosongkan kolom lalu menekan Simpan berarti "jangan diubah"**, bukan "hapus". Itu disengaja — server tidak pernah mengirim nilai aslinya kembali untuk diisi ulang, sama seperti form ganti password.

> ⚠️ Kalau `APP_KEY` di `.env` server pernah berubah setelah kredensial disimpan, semua nilai terenkripsi menjadi tidak terbaca. Aplikasi **tidak akan crash** — fitur terkait otomatis nonaktif dan kolomnya perlu diisi ulang. Jangan pernah mengganti `APP_KEY` pada server yang sudah berjalan.

---

## 1. Tab Kalender

Menarik hari libur nasional, libur sekolah, dan agenda dari Google Calendar, agar perhitungan **Minggu Efektif** dan **Hari Efektif** tidak perlu diketik manual.

Tersedia **tiga metode**. Pilih satu.

### Metode A — ICS Feed URL (paling sederhana, direkomendasikan)

Tidak butuh akun Google Cloud sama sekali. Cocok kalau kalender sekolah dibuat di Google Calendar biasa.

1. Buka https://calendar.google.com dengan akun yang memiliki kalender itu.
2. Arahkan kursor ke nama kalender di sidebar kiri → klik **⋮** → **Settings and sharing**.
3. Gulir ke **Access permissions for events** → centang **Make available to public**.
4. Gulir terus ke bagian **Integrate calendar**.
5. Salin nilai **Public address in iCal format**. Bentuknya:
   `https://calendar.google.com/calendar/ical/xxxxx%40group.calendar.google.com/public/basic.ics`
6. Tempel ke kolom **ICS Feed URL**, atur **Sinkronisasi ke depan (bulan)**, lalu Simpan.

Kalender **wajib publik** agar metode ini bekerja. Kalau tidak boleh publik, gunakan Metode C.

### Metode B — API Key + Calendar ID

Butuh proyek Google Cloud, tapi tetap tanpa file rahasia. Kalender tetap harus publik.

1. Buka https://console.cloud.google.com → buat/pilih proyek.
2. **APIs & Services → Library** → cari **Google Calendar API** → **Enable**.
3. **APIs & Services → Credentials** → **Create credentials** → **API key**.
4. Salin kunci yang muncul (diawali `AIzaSy…`) ke kolom **Google Calendar API Key**.
5. Sangat disarankan: klik **Edit API key** → **API restrictions** → pilih **Restrict key** → centang hanya **Google Calendar API**. Tanpa ini, kunci yang bocor bisa dipakai untuk layanan Google lain atas nama proyek Anda.
6. **Calendar ID** diambil dari Google Calendar → Settings and sharing → **Integrate calendar** → **Calendar ID**. Bentuknya `kurikulum@smkn2cmi.sch.id` atau `xxxxx@group.calendar.google.com`.

API Key ini disimpan **tanpa enkripsi** dan ditampilkan kembali di layar — karena sifatnya kunci baca-saja untuk kalender publik. Tetap jangan sebarkan; kunci yang tidak dibatasi bisa disalahgunakan.

### Metode C — Service Account JSON

Untuk kalender yang **tidak** boleh dipublikasikan.

1. Google Cloud Console → **IAM & Admin → Service Accounts** → **Create service account**.
2. Setelah dibuat, buka service account itu → tab **Keys** → **Add key** → **Create new key** → **JSON** → file terunduh.
3. Salin **email service account**-nya (bentuknya `nama@proyek.iam.gserviceaccount.com`).
4. Kembali ke Google Calendar → Settings and sharing kalender Anda → **Share with specific people** → tambahkan email service account itu dengan izin **See all event details**. **Langkah ini yang paling sering terlewat** — tanpa berbagi, service account tidak bisa melihat kalender apa pun dan sinkronisasi mengembalikan nol acara.
5. Unggah file `.json` di tab Kalender, dan isi **Calendar ID** seperti Metode B.

### Setelah mengisi

Klik **Simpan**, lalu **Sinkronkan Sekarang**. Kalau berhasil, `last_synced_at` terisi dan acara muncul di menu Kalender.

Kalau gagal, penyebab tersering: kalender belum publik (Metode A & B), API belum di-*enable* (Metode B), atau kalender belum dibagikan ke service account (Metode C).

---

## 2. Tab Penyimpanan (Cloudflare R2)

Memindahkan foto siswa/guru, jadwal PDF, dan dokumentasi penanganan siswa dari disk server ke object storage. Gunanya: file tidak ikut hilang kalau server diganti atau dimigrasi — cukup sambungkan kembali bucket yang sama.

Cloudflare R2 punya kuota gratis yang lebih dari cukup untuk skala sekolah, dan **tidak menagih biaya keluar data** (egress) — beda dari Amazon S3.

### Mendapatkan nilainya

Semuanya dari https://dash.cloudflare.com → menu **R2** di sidebar.

**Account ID.** Ada di halaman utama R2, di panel kanan. String heksadesimal 32 karakter.

**Bucket.** Klik **Create bucket**, beri nama (misalnya `agenda-smkn2`). Nama itulah isinya kolom **Bucket**.

**Access Key ID & Secret Access Key.** Di halaman R2 → **Manage R2 API Tokens** → **Create API token**.
- Permission: pilih **Object Read & Write**.
- Batasi ke bucket yang tadi dibuat saja, jangan "Apply to all buckets".
- Setelah dibuat, muncul **Access Key ID** dan **Secret Access Key**.

> ⚠️ **Secret Access Key hanya ditampilkan satu kali.** Salin sekarang. Kalau tertutup, Anda harus membuat token baru — tidak ada cara melihatnya kembali.

**Public URL.** Buka bucket → tab **Settings** → bagian **Public access**:
- Cara cepat: aktifkan **R2.dev subdomain**, salin **Public R2.dev Bucket URL** (bentuknya `https://pub-xxxxx.r2.dev`).
- Cara produksi: hubungkan **Custom Domain**, misalnya `https://file.smkn2cimahi.sch.id`. Lebih rapi dan tidak terikat domain `r2.dev`.

Bucket **harus** punya akses publik untuk dibaca, karena foto siswa ditampilkan langsung di browser. Yang dirahasiakan adalah kunci **tulis**-nya, bukan URL bacanya.

### Mengisinya

Panel Admin → tab **Penyimpanan**. Isi kelima kolom → **Simpan** → **Tes Koneksi**.

Tombol Tes Koneksi mengunggah satu file kecil ke bucket lalu menghapusnya lagi. Ia memakai kredensial yang **sudah tersimpan**, bukan yang baru diketik — jadi Simpan dulu, baru Tes.

Kalau tes berhasil, barulah aktifkan togglenya. Selama nonaktif, file tetap disimpan di disk server seperti biasa.

### Yang perlu diketahui

Mengaktifkan R2 **tidak memindahkan file lama** secara otomatis. File yang sudah terlanjur ada di disk server tetap di sana; hanya unggahan baru yang masuk ke R2. Rencanakan ini sebelum mengaktifkan di tengah tahun ajaran.

---

## 3. Tab Notifikasi Push (Firebase)

Mengirim peringatan alpha, eskalasi EWS, dan pengajuan konseling ke HP guru walau aplikasi tertutup.

### Mendapatkan nilainya

Semuanya dari https://console.firebase.google.com → pilih proyek → **ikon gerigi ⚙ → Project settings**. Buat dulu satu **Web app** kalau belum ada (ikon `</>` di tab General, jangan centang Firebase Hosting).

| Kolom | Tab | Letaknya |
|---|---|---|
| **Web API Key** | General | Your apps → `apiKey` |
| **Messaging Sender ID** | General | Your apps → `messagingSenderId` |
| **Web App ID** | General | Your apps → `appId` — salin utuh termasuk `1:` di depan |
| **VAPID Public Key** | Cloud Messaging | Web configuration → Web Push certificates → kolom **Key pair**. Kalau kosong, klik **Generate key pair**. String ±87 karakter diawali `B`. |
| **Service Account JSON** | Service accounts | **Generate new private key** → **Generate key** → file `.json` terunduh |

Nilai `storageBucket`, `authDomain`, dan `measurementId` dari konfigurasi Firebase **tidak dipakai**: `authDomain` diturunkan otomatis dari `projectId`, dua sisanya milik fitur Firebase lain.

> ⚠️ File Service Account JSON berisi private key yang bisa mengirim notifikasi ke seluruh perangkat proyek. Jangan di-commit ke git, jangan dikirim lewat WhatsApp atau email. Setelah ditempel dan disimpan, hapus file unduhannya.

### Mengisinya

Buka file `.json` dengan editor teks biasa (Notepad/VS Code — **bukan** Excel), salin **seluruh isinya** dari `{` sampai `}`, tempel ke kotak Service Account JSON. Isi empat kolom lain, lalu:

1. **Simpan.** Kotak JSON otomatis dikosongkan — wajar. Di bawahnya muncul `Terpasang: firebase-adminsdk-…@…`.
2. **Aktifkan.**
3. Buka menu **Notifikasi** di sidebar, klik **Aktifkan**, **Izinkan** pada dialog browser.
4. Kembali ke tab ini — `0 perangkat terdaftar` berubah jadi `1`.
5. **Kirim Push Percobaan.**

`project_id` di dalam service account **harus sama** dengan proyek Web app Anda. Kalau tidak, push ditolak dengan `SENDER_ID_MISMATCH`. Periksa lewat `client_email` yang muncul setelah disimpan: bagian setelah `@` harus cocok dengan `projectId`.

### Wajib di server produksi

Push **tidak berjalan di `http://`** biasa — aktifkan AutoSSL di cPanel.

Dan yang paling mudah terlewat: di `.env` server ubah `QUEUE_CONNECTION=sync` menjadi `QUEUE_CONNECTION=database`, lalu pasang Cron Job tiap menit:

```
* * * * * php /home/<user>/repositories/agenda-pembelajaran/backend/artisan queue:work --stop-when-empty --max-time=55 >> /dev/null 2>&1
```

Tanpa cron ini notifikasi menumpuk di antrean dan **lonceng in-app pun ikut kosong**, karena penyimpanan ke lonceng juga lewat antrean yang sama.

Panduan lengkap sisi pengguna (guru, wali kelas, BK) ada di **[Panduan Notifikasi Push](Panduan%20Notifikasi%20Push.md)**.

---

## 4. Email / SMTP — tidak ada di Panel Admin

Aplikasi mengirim email pada dua keadaan: **reset password** dan **eskalasi EWS ke level oranye/merah**.

Pengaturannya **hanya di file `.env` server**, bukan di Panel Admin — karena dibutuhkan sebelum ada admin yang bisa login (reset password).

Secara bawaan `MAIL_MAILER=log`, artinya email **tidak benar-benar dikirim**, hanya dicatat ke `storage/logs/laravel.log`. Untuk mengaktifkannya, isi di `.env`:

```env
MAIL_MAILER=smtp
MAIL_HOST=mail.smkn2cimahi.sch.id
MAIL_PORT=587
MAIL_USERNAME=noreply@smkn2cimahi.sch.id
MAIL_PASSWORD=<password_email>
MAIL_SCHEME=tls
MAIL_FROM_ADDRESS=noreply@smkn2cimahi.sch.id
MAIL_FROM_NAME="Agenda Pembelajaran SMKN 2 Cimahi"
```

Di cPanel, akun email dibuat lewat menu **Email Accounts**, dan nilai host/port ada di **Connect Devices** pada akun email tersebut.

Kalau email tidak dikonfigurasi, fitur lain tetap berjalan normal — hanya tautan reset password yang tidak sampai, dan eskalasi EWS cukup mengandalkan notifikasi push + lonceng.

---

## Pemecahan masalah umum

| Gejala | Penyebab paling mungkin |
|---|---|
| Kolom rahasia terlihat kosong setelah Simpan | Normal. Server tidak pernah mengirim balik nilainya. Cek penanda "Terpasang" di bawah kolom. |
| Semua kredensial tiba-tiba tidak terbaca | `APP_KEY` di `.env` berubah. Isi ulang kolom terenkripsi. |
| Tombol Tes/Percobaan redup atau menolak | Belum Simpan, atau belum Aktifkan. Tombol tes memakai nilai tersimpan, bukan yang di layar. |
| Kalender tersinkron tapi nol acara | Kalender belum publik, atau (Metode C) belum dibagikan ke email service account. |
| Foto lama hilang setelah R2 diaktifkan | File lama tidak ikut dipindahkan. Nonaktifkan R2 untuk mengaksesnya kembali dari disk server. |
| Push jalan di localhost, mati di server | Belum HTTPS, atau cron `queue:work` belum dipasang. |
| Email reset password tidak sampai | `MAIL_MAILER` masih `log`. Cek `storage/logs/laravel.log`. |
