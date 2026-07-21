# Panduan Deploy Aman (cPanel / MySQL)

Tujuan: setiap deploy — **ada perubahan database atau tidak** — berjalan aman dan
**tidak pernah merusak data yang sudah ada**. Skrip: [`backend/deploy.sh`](../backend/deploy.sh).

## Kenapa migrasi bisa jadi masalah

Deploy hanya memindahkan **kode**. Kolom/tabel baru **tidak** otomatis muncul di
server — hanya ada kalau `php artisan migrate` dijalankan **di server**. Kalau kode
baru dipasang tapi migrate terlewat, kode menyebut kolom yang belum ada → **error 500**
di endpoint terkait (mis. cek pembebasan kokurikuler `selesai_pada`, `bell_schedules`,
`must_change_password` saat login). Skrip `deploy.sh` memastikan migrate **selalu**
dijalankan, dan aman.

## Jaminan keamanan skrip

- **Backup DB dulu** (`mysqldump` → `storage/db-backups/*.sql.gz`). Kalau backup gagal,
  deploy **dibatalkan** — tidak ada migrasi tanpa jaring pengaman.
- **Hanya `migrate --force`** (aditif). Skrip **tidak pernah** menjalankan
  `migrate:fresh` / `:refresh` / `:reset` / `db:wipe` / `key:generate` — perintah itulah
  yang menghapus data / merusak enkripsi. **Jangan pernah menambahkannya.**
- **Tidak menyentuh `.env`** dan **tidak** regenerate `APP_KEY` (APP_KEY berubah = semua
  data terenkripsi seperti kredensial R2/SMTP jadi tak terbaca).
- Aman diulang: kalau tak ada migrasi pending, `migrate` cuma no-op.

## Langkah deploy sekarang (yang mau Anda cek)

Jalankan semua dari **folder root Laravel di server** (mis. `~/api.agenda/`).

### 1. Ambil kode terbaru
```bash
cd ~/api.agenda            # sesuaikan
git pull origin main       # atau upload/ekstrak kode terbaru
composer install --no-dev --optimize-autoloader   # hanya jika ada paket baru
```

### 2. CEK dulu tanpa mengubah apa pun  ← lakukan ini pertama
```bash
bash deploy.sh --check
```
Ini menampilkan daftar migrasi yang **pending** (perubahan DB yang belum diterapkan)
dan **tidak menyentuh** kode maupun database. Aman dipanggil kapan saja.

### 3. Deploy (backup → migrate → clear cache)
```bash
bash deploy.sh
```
Skrip minta konfirmasi (`ketik 'ya'`), lalu: backup DB → maintenance mode →
`migrate --force` → `optimize:clear` → aplikasi hidup lagi.

> Bila PHP CLI di cPanel bukan `php`, set path-nya:
> ```bash
> PHP_BIN=/opt/cpanel/ea-php84/root/usr/bin/php bash deploy.sh
> ```

### 4. Frontend (opsional, sekalian salin dist.zip ke docroot)
```bash
FRONTEND_DOCROOT=~/public_html bash deploy.sh
```
atau manual: ekstrak `frontend/dist.zip` (berisi folder `dist/`) dan salin **isinya**
(termasuk `.htaccess`) ke docroot frontend.

## Kalau migrasi gagal / ada yang aneh

Aplikasi tetap di maintenance dan DB bisa dipulihkan dari backup terakhir:
```bash
gunzip < storage/db-backups/NAMA_FILE.sql.gz | mysql -u DB_USER -p DB_NAME
php artisan up
```

## Langkah PASCA-deploy (verifikasi)

Setelah `deploy.sh` selesai, jalankan pemeriksa read-only
[`backend/postdeploy-check.sh`](../backend/postdeploy-check.sh):

```bash
bash postdeploy-check.sh
```
Memeriksa (tanpa mengubah apa pun): migrasi 0 pending, kolom/tabel kritikal ada
(`selesai_pada`, `jenis_kelamin`, `must_change_password`, `bell_periods`, dll),
`APP_KEY` terpasang, DB terhubung, aplikasi tidak maintenance, symlink storage ada.
Keluar kode 0 = sehat; ≠0 = ada masalah yang diprint.

### Sertakan uji endpoint (opsional tapi disarankan)

```bash
# Liveness API (tanpa login):
BASE_URL=https://api.agenda.smkn2cmi.sch.id bash postdeploy-check.sh
```

Untuk membuktikan **guru benar-benar bisa mengisi agenda** (endpoint terproteksi yang
menyentuh query kokurikuler `selesai_pada`), sertakan token guru:

```bash
# 1) Ambil academic_year_id:
curl -s https://api.agenda.smkn2cmi.sch.id/api/v1/academic-years/pilihan

# 2) Login sebagai satu guru → salin "token" dari respons:
curl -s -X POST https://api.agenda.smkn2cmi.sch.id/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"NIP_GURU","password":"PASSWORD","academic_year_id":ID}'

# 3) Uji dengan token itu:
BASE_URL=https://api.agenda.smkn2cmi.sch.id TOKEN=xxxxx bash postdeploy-check.sh
```
`/agendas/perlu-diisi` dan `/schedules/today` yang membalas **2xx** (bukan 5xx)
membuktikan skema kokurikuler sudah benar dan guru bisa mengisi agenda.

## Checklist ringkas tiap deploy

- [ ] `git pull` / upload kode terbaru + `composer install` (bila perlu)
- [ ] `bash deploy.sh --check` → lihat migrasi pending
- [ ] `bash deploy.sh` → backup + migrate + clear cache
- [ ] Salin `dist.zip` frontend ke docroot (bila ada perubahan FE)
- [ ] **`bash postdeploy-check.sh`** → verifikasi migrasi & skema masuk
- [ ] Pastikan `.env` server **tidak** tertimpa & `APP_KEY` tetap sama
- [ ] Uji cepat: login, isi agenda, buka menu kokurikuler
