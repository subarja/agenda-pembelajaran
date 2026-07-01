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

| Peran | Email | Keterangan |
|---|---|---|
| Admin | admin@smkn2cimahi.sch.id | Kelola semua data |
| Wakasek Kurikulum | kusman@smkn2cimahi.sch.id | Dashboard EWS & laporan |
| Guru (murni) | guru@smkn2cimahi.sch.id | Budi Santoso — Pemrograman Web |
| Guru Wali Kelas | walikelas@smkn2cimahi.sch.id | Siti Rahayu — Wali XI RPL A |
| Guru BK | bk@smkn2cimahi.sch.id | Dewi Rahayu — Bimbingan Konseling |
| Orang Tua | orangtua@smkn2cimahi.sch.id | Terhubung ke Ahmad Fauzi |
| Siswa | siswa@smkn2cimahi.sch.id | Ahmad Fauzi — XI RPL A |

**Akun demo guru tambahan** (password: `password`):

| Email | Nama | Mapel | Kelas |
|---|---|---|---|
| `wulan@smkn2cimahi.sch.id` | Wulan Indah Pratiwi, M.Pd | Matematika | X DKV A, X/XI Pemesinan, XI Animasi B, XI RPL B |
| `edy@smkn2cimahi.sch.id` | Edy Santoso, ST., M.Pd. | KK Mekatronika-11 | XI Mekatronika A–D |

> Kedua akun di atas menggunakan jadwal asli hasil import ASc XML dengan data siswa nyata. Sudah dilengkapi agenda KBM, presensi, TP, dan penilaian karakter sebagai data uji.

**Guru seeder demo** (password: `password`, domain: `@smkn2cimahi.sch.id`):

| Key | Email | Mapel |
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

