# Panduan Notifikasi Push

Aplikasi Agenda Pembelajaran — SMK Negeri 2 Cimahi
Status: **aktif & terverifikasi** sejak 9 Juli 2026

---

## Apa yang berubah

Sebelumnya, notifikasi hanya muncul di **lonceng** di dalam aplikasi. Kalau guru menutup aplikasi, tidak ada apa pun yang sampai ke HP-nya — peringatan alpha atau eskalasi EWS baru terlihat saat guru kebetulan membuka aplikasi lagi.

Sekarang notifikasi bisa sampai ke layar HP walau aplikasi tertutup, lewat Firebase Cloud Messaging.

Yang perlu dipahami sejak awal: **push adalah tambahan, bukan pengganti.** Lonceng di dalam aplikasi selalu terisi, apa pun pengaturan push seseorang. Mematikan push tidak pernah berarti kehilangan informasi — hanya berarti tidak ada pemberitahuan yang muncul di layar.

---

## Notifikasi apa saja yang dikirim

| Jenis | Dikirim ke | Kapan |
|---|---|---|
| Peringatan alpha berturut-turut | Wali kelas | Siswa alpha beberapa sesi beruntun |
| EWS siswa naik level | Wali kelas | Status EWS siswa naik (mis. kuning → oranye) |
| Rekomendasi tindakan baru | Wali kelas | Poin karakter siswa melewati ambang |
| Pengajuan konseling ke BK | Guru BK | Wali kelas mengeskalasi kasus siswa |
| Catatan manual menunggu review | Admin | Guru mengirim catatan karakter manual |

Khusus EWS yang naik ke **oranye** atau **merah**, notifikasi juga dikirim lewat email — dua level itu dianggap cukup mendesak untuk menuntut perhatian di luar aplikasi.

Setiap notifikasi bisa diklik dan langsung membuka halaman yang bersangkutan. Kalau aplikasi sudah terbuka di salah satu tab, tab itu yang difokuskan — bukan membuka jendela baru.

---

## Bagian 1 — Untuk Admin: menyalakan push

Dilakukan **sekali saja** untuk seluruh sekolah. Selama belum dilakukan, aplikasi tetap berjalan normal dengan lonceng saja.

Langkah lengkapnya — dari membuat proyek Firebase, mengambil kelima nilai, sampai cron antrean dan HTTPS yang wajib di server produksi — ada di **[Panduan Kredensial Panel Admin § Notifikasi Push](Panduan%20Kredensial%20Panel%20Admin.md#3-tab-notifikasi-push-firebase)**. Dokumen itu juga mencakup kredensial Kalender, Penyimpanan R2, dan SMTP email.

Dua hal yang paling sering membuat push "diam-diam tidak sampai" di server, diulang di sini karena akibatnya fatal:

- Push **tidak berjalan di `http://`**. Wajib HTTPS.
- Kalau `QUEUE_CONNECTION=database` tanpa cron `queue:work`, notifikasi menumpuk di antrean — dan **lonceng in-app ikut kosong**, karena penyimpanannya lewat antrean yang sama.

---

## Bagian 2 — Untuk Guru, Wali Kelas, BK

### 2.1 Menyalakan notifikasi

Saat pertama membuka aplikasi setelah admin mengaktifkan push, muncul kartu ajakan di atas halaman. Klik **Aktifkan**, lalu **Izinkan** pada dialog browser.

Kalau kartunya sudah terlanjur ditutup, buka menu **Notifikasi** di sidebar dan aktifkan dari sana.

Aplikasi sengaja **tidak pernah** memunculkan dialog izin secara otomatis saat halaman dimuat. Kalau Anda menekan "Blokir", izin itu permanen dan aplikasi tidak punya cara apa pun untuk bertanya lagi — satu-satunya jalan pulih adalah mengubahnya sendiri lewat pengaturan browser.

### 2.2 Kalau terlanjur diblokir

Klik ikon gembok 🔒 di sebelah alamat situs → **Izin situs** → **Notifikasi** → **Izinkan** → muat ulang halaman.

### 2.3 Pengguna iPhone / iPad

Notifikasi baru berjalan setelah aplikasi **ditambahkan ke Layar Utama**: buka aplikasi di Safari → tombol **Bagikan** → **Tambahkan ke Layar Utama**. Setelah itu buka aplikasi dari ikon di Layar Utama, bukan dari Safari.

Ini batasan Safari (butuh iOS 16.4+), bukan kekurangan aplikasi. Halaman Notifikasi akan memberi tahu sendiri kalau mendeteksi kondisi ini.

### 2.4 Mengatur apa yang masuk

Menu **Notifikasi** di sidebar berisi:

- **Notifikasi push** — saklar utama. Dimatikan pun, lonceng tetap terisi.
- **Per jenis** — matikan hanya jenis yang mengganggu, misalnya "Catatan manual". Jenis lain tetap jalan.
- **Jam tenang** — tahan pemberitahuan pada rentang jam tertentu, misalnya 21:00–05:00 (boleh melewati tengah malam). Notifikasi tetap tersimpan di lonceng, hanya pemberitahuan ke layar yang ditahan. Waktunya mengikuti WIB, bukan zona waktu server.
- **Perangkat aktif** — daftar HP/komputer yang menerima notifikasi. Cabut yang sudah tidak dipakai.

### 2.5 Berbagi HP dengan guru lain

Aman. Saat Anda logout, langganan notifikasi di perangkat itu ikut dicabut otomatis — guru berikutnya yang login tidak akan menerima notifikasi milik Anda.

### 2.6 Saat aplikasi sedang terbuka

Notifikasi tidak muncul sebagai pemberitahuan sistem, melainkan sebagai kartu kecil di sudut kanan atas layar yang hilang sendiri setelah beberapa detik. Ini disengaja — menumpuk notifikasi OS di atas halaman yang sedang Anda tatap itu mengganggu, bukan membantu. Kartunya bisa diklik untuk langsung membuka halaman terkait.

### 2.7 Badge di ikon aplikasi

Kalau aplikasi sudah di-install (PWA), jumlah notifikasi belum dibaca muncul sebagai angka kecil di ikonnya. Belum didukung Firefox dan Safari desktop; di sana loncengnya tetap jadi acuan.

---

## Pemecahan masalah

| Gejala | Penyebab paling mungkin |
|---|---|
| Tombol "Kirim Push Percobaan" redup | Push belum diaktifkan. Klik **Aktifkan** dulu. |
| "Belum ada perangkat terdaftar untuk akun Anda" | Anda belum mengizinkan notifikasi di browser ini. Buka menu Notifikasi. |
| "Push gagal terkirim ke N perangkat" | `project_id` service account berbeda dari proyek Web app. Periksa `client_email` yang tampil setelah disimpan — bagian setelah `@` harus sama dengan `projectId` Anda. |
| Tombol "Aktifkan" menolak: "Lengkapi ..." | Ada kolom kosong, atau JSON tidak disalin utuh. |
| Push tidak sampai di server, tapi lancar di localhost | Belum HTTPS, atau cron `queue:work` belum dipasang. |
| Notifikasi **dan** lonceng dua-duanya kosong di server | Hampir pasti cron antrean belum jalan. Cek tabel `jobs` — kalau menumpuk, itu penyebabnya. |
| Notifikasi tidak muncul padahal semua hijau | Cek jam tenang & saklar per jenis di menu Notifikasi. |

---

## Catatan teknis singkat

Untuk yang memelihara sistem ini kelak:

- Kredensial Firebase disimpan **terenkripsi di database** lewat Admin Panel, bukan di `.env` — pola yang sama dengan pengaturan Penyimpanan R2.
- Pengiriman memakai **FCM HTTP v1** dan tidak menambah satu pun dependensi Composer baru; token OAuth2 diambil dari `google/auth` yang sudah ikut terpasang bersama modul Google Calendar.
- Tombol **Kirim Push Percobaan** sengaja melewati preferensi dan jam tenang — itu aksi eksplisit admin, menahannya karena kebetulan pukul 22:00 hanya akan tampak seperti fitur rusak.
- Token perangkat yang ditolak permanen oleh Google (browser di-uninstall, izin dicabut, cache dibersihkan) otomatis dibuang dari database, tidak dicoba lagi selamanya.
- `SCHOOL_TIMEZONE` di `.env` (default `Asia/Jakarta`) menentukan jam tenang, terpisah dari `APP_TIMEZONE` yang boleh saja UTC.
