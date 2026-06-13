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
- Migrasi database + isi data awal (seeder)

Setelah selesai, buka: **http://localhost:5173**

| Peran | Email | Password | Keterangan |
|---|---|---|---|
| Admin | admin@smkn2cimahi.sch.id | password | Kelola semua data |
| Wakasek | kusman@smkn2cimahi.sch.id | password | Dashboard EWS & laporan |
| Guru | guru@smkn2cimahi.sch.id | password | Budi Santoso — Pemrograman Web |
| Wali Kelas | walikelas@smkn2cimahi.sch.id | password | Siti Rahayu — XI RPL A |
| Siswa | siswa@smkn2cimahi.sch.id | password | Ahmad Fauzi — XI RPL A |

Guru tambahan (password: `password`): `deni@` · `rina@` · `hendra@` · `yuni@` (domain: smkn2cimahi.sch.id)

---

### Langkah 2 — Sehari-hari (start / restart)

```bash
make start
```

Jalankan ini setiap kali ingin menghidupkan aplikasi kembali (setelah komputer restart, dll).

---

### Perintah Lainnya

| Perintah | Fungsi |
|---|---|
| `make setup` | Setup awal |
| `make start` | menjalankan setelah setup |
| `make restart` | Restart semua container tanpa rebuild |
| `make stop` | Hentikan semua service |
| `make reset` | Hentikan + **hapus semua data** (mulai dari nol lagi), untuk mengawali make start lagi |
| `make logs` | Lihat log live semua service |

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

| Peran | Email | Password |
|---|---|---|
| Admin | admin@smkn2cimahi.sch.id | password |
| Wakasek | kusman@smkn2cimahi.sch.id | password |
| Guru | guru@smkn2cimahi.sch.id | password |
| Wali Kelas | walikelas@smkn2cimahi.sch.id | password |
| Siswa | siswa@smkn2cimahi.sch.id | password |

> Guru tambahan demo: `deni@` · `rina@` · `hendra@` · `yuni@` (domain: smkn2cimahi.sch.id, password: `password`)

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

