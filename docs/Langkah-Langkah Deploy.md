# Langkah-Langkah Deploy — Aplikasi Agenda Pembelajaran

**SMK Negeri 2 Cimahi** · Panduan deploy ke server produksi (cPanel / MySQL)

Dokumen ini adalah langkah praktis. Penjelasan teknis lengkap ada di `docs/DEPLOY.md`.

---

## Prinsip Aman (wajib dipahami)

1. **Deploy hanya memindahkan kode.** Perubahan struktur database (kolom/tabel baru)
   TIDAK otomatis ada di server — harus dijalankan `php artisan migrate` di server.
   Kalau terlewat, aplikasi bisa error 500 (mis. guru tak bisa mengisi agenda).
2. **Data lama tidak akan rusak.** Skrip `deploy.sh` selalu membackup database dulu,
   dan hanya menjalankan migrasi *aditif* (menambah), bukan menghapus.
3. **Jangan pernah** menjalankan `migrate:fresh`, `migrate:refresh`, `migrate:reset`,
   `db:wipe`, atau `key:generate` di server berjalan — itu menghapus data / merusak
   enkripsi kredensial.
4. **Jangan menimpa `.env`** server dan **jangan mengubah `APP_KEY`**.

---

## Prasyarat

- Akses Terminal/SSH ke server (cPanel → Terminal).
- Berada di folder root Laravel di server, contoh: `~/api.agenda/`.
- Bila perintah `php` bukan versi yang benar, gunakan path lengkap, contoh:
  `PHP_BIN=/opt/cpanel/ea-php84/root/usr/bin/php`

---

## Langkah A — Ambil kode terbaru

```bash
cd ~/api.agenda
git pull origin main
# jalankan HANYA jika ada paket Composer baru:
composer install --no-dev --optimize-autoloader
```

## Langkah B — Cek dulu (tidak mengubah apa pun)

```bash
bash deploy.sh --check
```

Menampilkan daftar migrasi yang **pending** (perubahan DB yang belum diterapkan).
Aman — tidak menyentuh kode maupun database.

## Langkah C — Deploy (backup → migrate → clear cache)

```bash
bash deploy.sh
```

Skrip akan:
1. Backup database ke `storage/db-backups/*.sql.gz` (kalau gagal → deploy dibatalkan).
2. Aktifkan mode maintenance.
3. Jalankan `php artisan migrate --force` (aditif, aman).
4. Bersihkan cache (`optimize:clear`).
5. Hidupkan aplikasi kembali.

Ketik `ya` saat diminta konfirmasi. Untuk otomatis tanpa tanya: `bash deploy.sh -y`.

## Langkah D — Frontend (bila ada perubahan tampilan)

Ekstrak `frontend/dist.zip` (berisi folder `dist/`) lalu salin **isinya** — termasuk
`.htaccess` — ke docroot frontend. Atau otomatis:

```bash
FRONTEND_DOCROOT=~/public_html bash deploy.sh
```

## Langkah E — Verifikasi pasca-deploy

```bash
bash postdeploy-check.sh
```

Memeriksa (read-only): migrasi 0 pending, kolom/tabel penting ada
(`selesai_pada`, `jenis_kelamin`, `must_change_password`, `bell_periods`, dll),
`APP_KEY` terpasang, DB terhubung, app tidak maintenance, symlink storage ada.

Uji sampai endpoint (opsional, membuktikan guru bisa mengisi agenda):

```bash
BASE_URL=https://api.agenda.smkn2cmi.sch.id bash postdeploy-check.sh
# dengan token guru (cara ambil token ada di docs/DEPLOY.md):
BASE_URL=https://api.agenda.smkn2cmi.sch.id TOKEN=xxxxx bash postdeploy-check.sh
```

---

## Bila migrasi gagal / ada yang aneh

Aplikasi tetap maintenance; pulihkan database dari backup terakhir:

```bash
gunzip < storage/db-backups/NAMA_FILE.sql.gz | mysql -u DB_USER -p DB_NAME
php artisan up
```

---

## Checklist Ringkas

- [ ] `git pull origin main` (+ `composer install` bila perlu)
- [ ] `bash deploy.sh --check` — lihat migrasi pending
- [ ] `bash deploy.sh` — backup + migrate + clear cache
- [ ] Salin `dist.zip` frontend ke docroot (bila ada perubahan tampilan)
- [ ] `bash postdeploy-check.sh` — verifikasi migrasi & skema masuk
- [ ] Pastikan `.env` **tidak** tertimpa & `APP_KEY` tetap sama
- [ ] Uji manual: login → isi agenda → buka menu kokurikuler

---

## Yang TIDAK Boleh Dilakukan

| Perintah | Akibat |
|---|---|
| `php artisan migrate:fresh` | **Menghapus SEMUA data** lalu buat ulang tabel |
| `php artisan migrate:refresh` / `:reset` | Rollback semua migrasi — berisiko kehilangan data |
| `php artisan db:wipe` | Mengosongkan seluruh database |
| `php artisan key:generate` | Mengganti APP_KEY → kredensial R2/SMTP terenkripsi rusak |
| Menimpa `.env` server | Konfigurasi & APP_KEY bisa salah → data terenkripsi tak terbaca |
