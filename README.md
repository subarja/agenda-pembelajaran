# Aplikasi Agenda Pembelajaran Kelas
SMKN 2 Cimahi

## Cara Menjalankan Aplikasi

> **Prasyarat:** Docker sudah berjalan + `make` terinstal. Di WSL Ubuntu: `sudo apt install make`

---

### Langkah 1 — Pertama Kali (hanya sekali)

```bash
make setup
```

Perintah ini otomatis mengerjakan semua setup dari nol:
- Menyalin `.env`
- Build image Docker
- Generate `APP_KEY` Laravel
- Migrasi database + isi data demo

Setelah selesai, buka: **http://localhost:5173**

---

### Langkah 2 — Sehari-hari (start / restart)

```bash
make start
```

Jalankan ini setiap kali ingin menghidupkan aplikasi kembali (setelah komputer restart, dll).

---

### Referensi Semua Perintah `make`

| Perintah | Kapan dipakai | Yang terjadi |
|---|---|---|
| `make setup` | Pertama kali / setelah `make reset` | Build image → migrasi → seed. Butuh beberapa menit. |
| `make start` | Setiap hari (container sudah ada) | Hidupkan container yang sudah ada. |
| `make restart` | Setelah ubah `.env` atau config | Restart semua container tanpa rebuild. |
| `make stop` | Selesai kerja | Hentikan semua container (data tetap ada). |
| `make reset` | Mau mulai dari nol total | Matikan + **hapus semua container & volume** (data hilang). Perlu `make setup` sesudahnya. |
| `make reseed` | Setelah ubah migration atau seeder | Drop semua tabel → jalankan ulang semua migration → seed. Container tetap jalan, lebih cepat dari reset+setup. |
| `make seed` | Debug seeder saja | Jalankan seeder tanpa drop tabel. Aman hanya jika data lama tidak konflik. |
| `make logs` | Debug / pantau log | Tampilkan log live semua service (`Ctrl+C` untuk keluar). |

**Alur kerja yang paling sering dipakai:**

```
# Pertama kali
make setup

# Setiap hari
make start

# Setelah ubah schema/migration/seeder
make reseed

# Setelah ubah kode Laravel/React saja (tanpa ubah DB)
# → tidak perlu perintah apapun, hot-reload otomatis

# Mau bersih total (ganti environment, dll)
make reset
make setup
```

---

### Akun Demo (semua password: `password`)

> Akun demo memakai data uji generik — bukan nama guru/siswa asli sekolah.

| Peran | Email | Keterangan |
|---|---|---|
| Admin | admin@smkn2cimahi.sch.id | Kelola semua data |
| Wakasek Kurikulum | kusman@smkn2cimahi.sch.id | Dashboard EWS & laporan |
| Guru (murni) | guru@smkn2cimahi.sch.id | Pemrograman Web |
| Guru Wali Kelas | walikelas@smkn2cimahi.sch.id | Wali kelas XI RPL A |
| Guru BK | bk@smkn2cimahi.sch.id | Bimbingan Konseling |
| Orang Tua | orangtua@smkn2cimahi.sch.id | Terhubung ke akun siswa demo |
| Siswa | siswa@smkn2cimahi.sch.id | Kelas XI RPL A |

**Akun demo guru tambahan** (password: `password`):

| Email | Mapel | Kelas |
|---|---|---|
| `wulan@smkn2cimahi.sch.id` | Matematika | X DKV A, X/XI Pemesinan, XI Animasi B, XI RPL B |
| `edy@smkn2cimahi.sch.id` | KK Mekatronika-11 | XI Mekatronika A–D |

> Kedua akun di atas menggunakan jadwal asli hasil import ASc XML dengan data siswa uji. Sudah dilengkapi agenda KBM, presensi, TP, dan penilaian karakter sebagai data uji.

**Guru seeder demo** (password: `password`, domain: `@smkn2cimahi.sch.id`):

| Jurusan | Email | Mapel |
|---|---|---|
| RPL | `deni@` · `rina@` · `hendra@` · `yuni@` | Basis Data · PBO · Matematika · Bahasa Indonesia |
| TKJ | `ahmad.yanuar@` · `wahyu@` · `eko@` | Jaringan Komputer · ASJ · TLJ |
| DKV | `tono@` · `sari@` · `indah@` | Desain Grafis · DKV · Animasi 2D |

### Volume Data Demo

Data demo dirancang mendekati kondisi nyata untuk pengujian performa:

| Data | Jumlah |
|---|---|
| Jurusan | 3 (RPL, TKJ, DKV) |
| Kelas | 15 (X/XI/XII × A/B per jurusan) |
| Siswa | ±540 (36 per kelas) |
| Guru | 17 |
| Jadwal | 75 (5 per kelas per minggu) |
| Agenda (history) | ±600 (8 minggu ke belakang) |
| Presensi | ±21.600 record |
| Input Karakter | ±800 record |
| EWS Status | 540 record |

---

## Menjalankan dengan Docker (Cara Utama — Setup Pertama Kali)

### Prasyarat

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) atau Docker Engine + Docker Compose (Linux)
- Git

### Langkah-langkah

**1. Masuk ke folder proyek**
```bash
cd /home/kusman/projects/agenda-pembelajaran
```

**2. Salin file konfigurasi environment**
```bash
cp .env.example .env
```

**3. Build dan jalankan semua service**
```bash
docker compose up --build -d
```

Perintah ini akan menjalankan 5 service sekaligus:
| Service | Deskripsi | Port |
|---|---|---|
| `db` | PostgreSQL 16 | 5432 |
| `redis` | Redis 7 (cache & queue) | 6379 |
| `backend` | Laravel 11 API | 8000 |
| `worker` | Laravel Queue Worker | — |
| `frontend` | React + Vite dev server | 5173 |

**4. Generate APP_KEY untuk Laravel**
```bash
docker compose exec backend php artisan key:generate
```

Setelah ini, salin nilai `APP_KEY` yang tertulis di `backend/.env` ke file `.env` (root proyek) pada baris `APP_KEY=`. Kemudian restart backend:
```bash
docker compose restart backend worker
```

> **Cara cepat (satu perintah):**
> ```bash
> KEY=$(docker compose exec -T backend php artisan key:generate --show --no-ansi) \
>   && sed -i "s|^APP_KEY=.*|APP_KEY=$KEY|" .env \
>   && docker compose restart backend worker
> ```

**5. Jalankan migrasi database dan seeder**
```bash
docker compose exec backend php artisan migrate --seed
```

**6. Akses aplikasi**

| Aplikasi | URL |
|---|---|
| Frontend (React) | http://localhost:5173 |
| Backend API | http://localhost:8000 |

---

### Akun Login Bawaan (Setelah Seeder)

Lihat tabel lengkap di bagian **Akun Demo** di atas (semua password: `password`).

---

### Perintah Docker yang Berguna

```bash
# Lihat log semua service
docker compose logs -f

# Lihat log service tertentu (misalnya backend)
docker compose logs -f backend

# Masuk ke shell container backend
docker compose exec backend sh

# Masuk ke shell container database (psql)
docker compose exec db psql -U agenda_user -d agenda_db

# Hentikan semua service
docker compose down

# Hentikan dan hapus data volume (reset total)
docker compose down -v

# Restart satu service
docker compose restart backend
```

---

## Deploy ke Server Produksi

Ada dua jalur deploy yang didukung: **Docker di VPS/server** (direkomendasikan, lihat `CLAUDE.md`) atau **cPanel** (shared hosting, tanpa Docker). Pilih salah satu sesuai hosting yang tersedia.

### A. Menarik Kode dari GitHub

Kedua jalur di bawah dimulai dengan menarik kode dari repo GitHub ke server. Repo saat ini: `git@github.com:subarja/agenda-pembelajaran.git`.

**Lewat SSH (VPS / server dengan akses terminal):**
```bash
git clone git@github.com:subarja/agenda-pembelajaran.git
cd agenda-pembelajaran
```
Kalau server belum punya SSH key yang terdaftar di GitHub, pakai URL HTTPS + [Personal Access Token](https://github.com/settings/tokens) sebagai gantinya:
```bash
git clone https://<username>:<personal-access-token>@github.com/subarja/agenda-pembelajaran.git
```

**Update kode setelah ada perubahan baru** (dijalankan lagi tiap kali mau deploy versi terbaru):
```bash
cd agenda-pembelajaran
git pull origin main
```

**Lewat fitur Git™ Version Control di cPanel** (tanpa terminal):
1. Login cPanel → menu **Git™ Version Control** → **Create**.
2. **Clone a Repository**, isi *Repository URL* dengan URL HTTPS di atas (gunakan token kalau repo private).
3. *Repository Path* — arahkan ke folder di luar `public_html`, misalnya `/home/<user>/repositories/agenda-pembelajaran` (jangan langsung di document root; frontend & backend akan disalin/dibuild terpisah ke document root masing-masing).
4. Klik **Create**. Untuk menarik update berikutnya, buka repo yang sama → tab **Pull or Deploy** → **Update from Remote**.

---

### B. Deploy dengan Docker (VPS / Server Sendiri)

Cocok untuk VPS (Biznet Gio, IDCloudHost, DigitalOcean, dll) yang memberi akses root/SSH penuh.

**Prasyarat di server:**
- Docker Engine + Docker Compose plugin ([panduan instal](https://docs.docker.com/engine/install/)) — Ubuntu: `curl -fsSL https://get.docker.com | sh`
- Domain sudah diarahkan (DNS A record) ke IP server
- Port 80/443 terbuka di firewall

**Langkah-langkah:**

1. **Tarik kode** (lihat bagian A di atas), lalu masuk ke folder proyek.

2. **Salin & isi `.env` produksi**
   ```bash
   cp .env.example .env
   ```
   Edit `.env`, minimal isi:
   ```bash
   APP_ENV=production
   APP_DOMAIN=agenda.namasekolah.sch.id   # domain asli tanpa https://
   DB_PASSWORD=<password-kuat-acak>       # WAJIB diganti dari default "secret"
   VITE_API_URL=                          # kosongkan — frontend prod otomatis pakai /api relatif ke domain sendiri
   ```

3. **Build & jalankan pakai override produksi** — `docker-compose.prod.yml` sudah disiapkan di repo untuk mengganti target image ke `production`, menutup port database/redis dari luar, dan menjalankan frontend sebagai build statis + nginx di port 80 (bukan Vite dev server):
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```

4. **Generate `APP_KEY`, migrasi, dan seed data awal** (sekali saja):
   ```bash
   KEY=$(docker compose exec -T backend php artisan key:generate --show --no-ansi | tr -d '\r\n') \
     && sed -i "s|^APP_KEY=.*|APP_KEY=$KEY|" .env \
     && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d backend worker
   docker compose exec backend php artisan migrate --force
   ```
   > Jangan pakai `migrate --seed` di server produksi asli — seeder berisi akun & data **demo**, bukan data sekolah sesungguhnya. Buat akun admin pertama secara manual, misalnya lewat `php artisan tinker` atau seeder khusus (`AdminOnlySeeder`) kalau memang hanya butuh satu akun admin awal:
   > ```bash
   > docker compose exec backend php artisan db:seed --class=AdminOnlySeeder --force
   > ```

5. **Pasang HTTPS.** Setup di atas menjalankan nginx polos di port 80 tanpa TLS. Cara termudah: taruh [Caddy](https://caddyserver.com/) atau [Nginx Proxy Manager](https://nginxproxymanager.com/) di depan sebagai reverse proxy + Let's Encrypt otomatis, arahkan ke `frontend:80` dan biarkan container `frontend` tidak lagi publish ke `80:80` langsung ke internet. Alternatif paling sederhana: instal Certbot di host dan taruh nginx host-level di depan container.

6. **Update ke versi baru di kemudian hari:**
   ```bash
   git pull origin main
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   docker compose exec backend php artisan migrate --force
   ```

**Perintah cek/monitor:**
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend
```

---

### C. Deploy di cPanel (Shared Hosting, Tanpa Docker)

Cocok kalau sekolah/vendor hanya punya akses cPanel biasa (tanpa root/Docker). Backend (Laravel) dan frontend (React statis) dideploy terpisah.

**Prasyarat di cPanel:**
- PHP **8.2 atau lebih baru** aktif untuk domain/subdomain backend (cPanel → **MultiPHP Manager**)
- Ekstensi PHP aktif: `pdo`, `mbstring`, `xml`, `bcmath`, `zip`, `gd`, `intl` — dan `pdo_pgsql`/`pgsql` **kalau** hosting mendukung PostgreSQL. Kebanyakan cPanel shared hosting **hanya menyediakan MySQL/MariaDB** — kalau begitu, set `DB_CONNECTION=mysql` di `.env` backend (Laravel/Eloquent tetap jalan normal di MySQL, cukup pastikan database dibuat lewat **MySQL® Databases** di cPanel).
- Akses **Terminal** (SSH) di cPanel untuk menjalankan Composer & `artisan` — **kalau tidak tersedia** (banyak paket shared hosting tidak menyediakan Terminal), lihat kotak **"Tanpa Terminal"** di bawah untuk cara alternatif lewat File Manager + `cpanel-deploy.php`.
- Composer tersedia di Terminal cPanel (`composer -V`), atau instal manual sesuai panduan provider.

> **Tanpa Terminal di cPanel, kode ditarik lewat Git:** Kode aplikasi ditarik otomatis lewat **Git™ Version Control** (bagian A) — tidak perlu diupload manual. Tapi ada beberapa file yang sengaja **di-`.gitignore`** (tidak ikut ter-*pull* oleh Git) karena sifatnya spesifik per-server atau berisi rahasia, jadi ini saja yang perlu diupload manual lewat File Manager:
> 1. **`backend/vendor/`** — hasil `composer install`, di-`.gitignore` karena isinya dependency pihak ketiga, bukan kode aplikasi. Sudah di-generate dan dibungkus bareng `cpanel-deploy.php` di `cpanel-manual-upload.zip`.
> 2. **`backend/public/cpanel-deploy.php`** — sengaja di-`.gitignore` juga (lihat `backend/.gitignore` baris `/public/cpanel-deploy.php`) karena filenya menyimpan token rahasia; kalau ikut ter-commit ke Git, token itu akan tersimpan permanen di riwayat repo.
> 3. **`.env`** — juga di-`.gitignore` (berisi password DB dll). Dibuat lewat File Manager: cari `backend/.env.example` (file ini ikut ter-*pull* Git), klik kanan → **Copy**, ganti nama salinannya jadi `.env`, lalu **Edit** untuk mengisi nilainya (isian sama seperti langkah 5 di bawah).
>
> **Alurnya:**
> - Tarik kode lewat Git™ Version Control (bagian A) ke `repositories/agenda-pembelajaran`.
> - Upload `cpanel-manual-upload.zip` lewat File Manager ke folder yang sama (`repositories/agenda-pembelajaran`), lalu **Extract** — ini otomatis menaruh isinya ke `backend/vendor/` dan `backend/public/cpanel-deploy.php` tanpa menimpa kode yang sudah ditarik Git.
> - Buat `.env` seperti langkah 3 di atas.
> - Jalankan **`key:generate`, `migrate`, `db:seed`, `storage:link`** sekaligus lewat URL (bukan Terminal), pakai token acak bawaan di file:
>   `https://api.agenda.namasekolah.sch.id/cpanel-deploy.php?token=0e58dfc76a7cb02e1ab18e8c25fab8d37c76c942730624ce&action=all`
> - **Setelah berhasil, HAPUS `cpanel-deploy.php` dari server lewat File Manager** — file ini bisa menjalankan migrasi/seed lewat URL, jangan dibiarkan menempel permanen di produksi.
> - **Update kode berikutnya:** cukup **Pull or Deploy** lagi lewat Git™ Version Control seperti biasa. `vendor/` tidak perlu diupload ulang kecuali `composer.json`/`composer.lock` berubah. Kalau ada migration baru, upload lagi `cpanel-deploy.php` sementara, jalankan `?action=migrate`, lalu hapus lagi.

**1. Tarik kode** — pakai fitur **Git™ Version Control** (lihat bagian A) atau `git clone` dari Terminal cPanel ke folder di luar `public_html`, misal `/home/<user>/repositories/agenda-pembelajaran`.

**2. Setup Backend (Laravel) sebagai subdomain, misal `api.agenda.namasekolah.sch.id`:**

1. cPanel → **Subdomains** → buat subdomain, arahkan *Document Root* ke `repositories/agenda-pembelajaran/backend/public` (folder `public`, bukan folder `backend`).
2. cPanel → **MultiPHP Manager** → pilih PHP 8.2+ untuk subdomain ini.
3. cPanel → **MySQL® Databases** → buat database + user, catat nama db/user/password.
4. Buka **Terminal**, masuk ke folder backend:
   ```bash
   cd ~/repositories/agenda-pembelajaran/backend
   composer install --no-dev --optimize-autoloader
   cp .env.example .env
   ```
   *(Tidak ada Terminal? Lihat kotak "Tanpa Terminal?" di atas.)*
5. Edit `backend/.env` (lewat File Manager atau `nano`), isi minimal:
   ```bash
   APP_ENV=production
   APP_DEBUG=false
   APP_URL=https://api.agenda.namasekolah.sch.id
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_DATABASE=<nama_db_dari_cpanel>
   DB_USERNAME=<user_db_dari_cpanel>
   DB_PASSWORD=<password_db>
   SESSION_DRIVER=file
   QUEUE_CONNECTION=sync
   CACHE_STORE=file
   SANCTUM_STATEFUL_DOMAINS=agenda.namasekolah.sch.id
   ```
   > `QUEUE_CONNECTION=sync` dan `SESSION_DRIVER=file`/`CACHE_STORE=file` dipakai karena shared hosting cPanel umumnya **tidak mengizinkan proses background** (`queue:work` atau Redis) berjalan terus-menerus. Job (Character Aggregation Engine, EWS) akan dieksekusi langsung saat request alih-alih di background — cukup untuk skala sekolah, tapi request jadi sedikit lebih lambat saat proses berat berjalan.
6. Generate key & migrasi:
   ```bash
   php artisan key:generate
   php artisan migrate --force
   php artisan db:seed --class=AdminOnlySeeder --force   # hanya buat akun admin awal, bukan data demo
   php artisan storage:link
   ```
   *(Tidak ada Terminal? Jalankan `cpanel-deploy.php?token=...&action=all` seperti dijelaskan di kotak "Tanpa Terminal?" di atas — hasilnya sama.)*
7. Pastikan permission folder bisa ditulis web server:
   ```bash
   chmod -R 775 storage bootstrap/cache
   ```
   *(Tidak ada Terminal? Lewat File Manager: klik kanan folder `storage` dan `bootstrap/cache` → **Change Permissions** → centang read/write/execute untuk owner & group → `775`.)*
8. **Cron job pengganti scheduler** (kalau ada fitur terjadwal seperti pengecekan EWS harian) — cPanel → **Cron Jobs**, tambahkan tiap menit:
   ```bash
   * * * * * php /home/<user>/repositories/agenda-pembelajaran/backend/artisan schedule:run >> /dev/null 2>&1
   ```

**3. Setup Frontend (React statis), misal di domain utama `agenda.namasekolah.sch.id`:**

Berbeda dari backend, frontend perlu **di-build** (`npm run build`) sebelum diupload — kebanyakan shared hosting cPanel tidak menyediakan Node.js untuk proses build interaktif. Build di komputer lokal atau lewat CI, baru upload hasilnya.

1. Di komputer lokal, set `VITE_API_URL` ke domain backend **sebelum build** (berbeda dari mode Docker — di cPanel frontend & backend biasanya beda subdomain, jadi harus eksplisit, tidak boleh dikosongkan):
   ```bash
   cd frontend
   echo "VITE_API_URL=https://api.agenda.namasekolah.sch.id" > .env.production.local
   npm install
   npm run build
   ```
2. Upload seluruh isi folder `frontend/dist/` (bukan folder `dist` itu sendiri, isinya saja) ke *Document Root* domain utama, biasanya `public_html/` (atau `public_html/agenda/` kalau di subfolder) — lewat **File Manager** (kompres jadi `.zip` dulu lalu extract di server) atau FTP/SFTP.
3. File `.htaccess` untuk SPA fallback React Router **sudah otomatis ikut ter-build** ke dalam `dist/` (sumbernya di `frontend/public/.htaccess`) — tidak perlu dibuat manual, tinggal pastikan ter-upload juga (file berawalan titik kadang disembunyikan FTP client, aktifkan "show hidden files").
4. Aktifkan **SSL** gratis lewat cPanel → **SSL/TLS Status** → **AutoSSL**, untuk domain utama maupun subdomain backend.

**4. Update ke versi baru di kemudian hari:**
```bash
# Backend
cd ~/repositories/agenda-pembelajaran && git pull origin main
cd backend && composer install --no-dev --optimize-autoloader && php artisan migrate --force

# Frontend — build ulang di lokal, upload ulang isi dist/ menimpa yang lama
```

---

## Panduan Kerja dengan WSL Linux

1. Buka Windows dan jalankan WSL Linux (misalnya Ubuntu).
2. Navigasi ke folder proyek di dalam WSL.
   - Jika proyek ada di filesystem WSL sendiri, gunakan:
     ```bash
     cd /home/kusman/projects/agenda-pembelajaran
     ```
   - Jika proyek ada di Windows drive, gunakan contoh path:
     ```bash
     cd /mnt/c/Users/<nama>/projects/agenda-pembelajaran
     ```
   - Untuk proyek yang dibuka lewat Windows Explorer dengan alamat `\\wsl.localhost\Ubuntu\home\kusman\projects\agenda-pembelajaran`, path WSL yang benar adalah `/home/kusman/projects/agenda-pembelajaran`.
3. Buka VS Code dari WSL dengan perintah:
   ```bash
   code .
   ```
   - Pastikan VS Code sudah terpasang dan fitur WSL sudah aktif.

## Menjalankan Proyek

### Backend Laravel
1. Buka terminal WSL di folder `backend`:
   ```bash
   cd backend
   ```
2. Install dependensi jika diperlukan:
   ```bash
   composer install
   ```
3. Jalankan server Laravel:
   ```bash
   php artisan serve
   ```

### Frontend React
1. Buka terminal WSL di folder `frontend`:
   ```bash
   cd frontend
   ```
2. Install dependensi jika diperlukan:
   ```bash
   npm install
   ```
3. Jalankan server frontend:
   ```bash
   npm run dev
   ```

## Menggunakan Claude Code / AI di VS Code

1. Setelah VS Code terbuka dari WSL, pastikan ekstensi Claude Code atau GitHub Copilot Chat sudah terpasang.
2. Buka Command Palette dengan `Ctrl + Shift + P`.
3. Ketik `Claude Code` atau `Copilot Chat` untuk mulai sesi editor atau bantuan AI.
4. Gunakan terminal WSL dalam VS Code untuk menjalankan perintah proyek dan gunakan panel editor untuk membuka file.

## Alur Singkat

1. Jalankan WSL Linux.
2. Masuk ke direktori proyek di WSL.
3. Jalankan `code .` untuk membuka proyek di VS Code.
4. Gunakan terminal WSL dalam VS Code untuk `composer install`, `npm install`, `php artisan serve`, dan `npm run dev`.
5. Gunakan Claude Code di panel VS Code untuk membantu editing dan review kode.

