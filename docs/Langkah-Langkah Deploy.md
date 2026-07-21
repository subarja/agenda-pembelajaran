# Langkah-Langkah Deploy — Aplikasi Agenda Pembelajaran

**SMK Negeri 2 Cimahi** · Panduan deploy ke server produksi (cPanel / MySQL)

Ada **dua metode**. Untuk cPanel tanpa Terminal/SSH, pakai **Metode A (Panel Admin)**.

---

## Prinsip Aman (wajib dipahami)

1. **Deploy hanya memindahkan kode.** Perubahan struktur database (kolom/tabel baru)
   TIDAK otomatis ada di server — harus dijalankan **migrasi**. Kalau terlewat, aplikasi
   bisa error 500 (mis. guru tak bisa mengisi agenda).
2. **Data lama tidak akan rusak.** Panel Admin membackup database dulu sebelum migrasi,
   dan hanya menjalankan migrasi *aditif* (menambah), bukan menghapus.
3. **Jangan pernah** pakai migrate:fresh / refresh / reset / db:wipe / key:generate —
   itu menghapus data / merusak enkripsi. (Tombol di Panel Admin tidak menyediakannya.)
4. **Jangan menimpa `.env`** server dan **jangan mengubah `APP_KEY`**.

---

## Metode A — Panel Admin (tanpa Terminal, untuk cPanel) ✅ REKOMENDASI

### Langkah 1 — Tarik kode terbaru ke server (cPanel Git)

Di cPanel → **Git™ Version Control** → pilih repository → **Update from Remote** (Pull).
Ini membawa kode PHP terbaru, file migrasi baru, `vendor.zip`, dan `dist.zip` ke server.

> Kalau tidak pakai cPanel Git: upload & ekstrak kode terbaru lewat **File Manager**.

### Langkah 2 — Buka menu Deploy di aplikasi

Login sebagai **Admin** → **Panel Admin** → tab **Deploy & Maintenance**.

### Langkah 3 — Lihat "Status Server" (preflight)

Panel menampilkan **migrasi yang belum diterapkan** (perubahan DB yang menunggu).
Kalau ada, daftarnya muncul — itu yang akan diterapkan saat Deploy.

### Langkah 4 — Perbarui kode terpasang

- **Build Vendor** — hanya jika ada paket Composer baru (ganti `vendor/` dari `vendor.zip`).
- **Build Dist** — perbarui tampilan frontend dari `dist.zip`.

### Langkah 5 — Deploy (backup → migrate → clear cache)

Tekan tombol **Deploy**. Urutannya otomatis dan aman:
1. **Backup database** ke `storage/app/backups/` (kalau gagal → Deploy dibatalkan).
2. `migrate --force` (aditif — hanya menambah, data lama aman).
3. Seeder master idempoten + ekstrak `dist.zip` + clear cache.

> Tombol **Migrate** (biru) bila hanya ingin menerapkan perubahan DB tanpa menyentuh frontend.

### Langkah 6 — Verifikasi

Tekan tombol **Verifikasi**. Harus semua ✓: migrasi 0 pending, APP_KEY terpasang,
DB terhubung, bukan maintenance, symlink storage ada.

### Bila backup otomatis gagal

Jika server tidak mendukung backup otomatis, Deploy/Migrate akan **dibatalkan** dengan
pesan. Caranya: buka menu **Backup Database** → unduh backup manual, lalu centang
**"Saya sudah backup manual"** di tab Deploy, dan ulangi.

---

## Metode B — Terminal/SSH (bila tersedia)

Dari folder root Laravel di server:

```bash
git pull origin main
bash deploy.sh --check          # lihat migrasi pending (tidak mengubah apa pun)
bash deploy.sh                  # backup → migrate --force → clear cache
bash postdeploy-check.sh        # verifikasi migrasi & skema
```

Bila PHP CLI bukan `php`: `PHP_BIN=/opt/cpanel/ea-php84/root/usr/bin/php bash deploy.sh`.
Detail & pemulihan dari backup ada di `docs/DEPLOY.md`.

---

## Checklist Ringkas (Metode A)

- [ ] cPanel → Git → **Pull** (tarik kode + zip terbaru)
- [ ] Panel Admin → **Deploy & Maintenance**
- [ ] Lihat **Status Server** — cek migrasi pending
- [ ] **Build Vendor** (bila paket baru) & **Build Dist**
- [ ] **Deploy** (backup + migrate + cache otomatis)
- [ ] **Verifikasi** — pastikan semua ✓
- [ ] Uji manual: login → isi agenda → buka menu kokurikuler

---

## Yang TIDAK Boleh Dilakukan

| Perintah / Aksi | Akibat |
|---|---|
| `php artisan migrate:fresh` | **Menghapus SEMUA data** lalu buat ulang tabel |
| `php artisan migrate:refresh` / `:reset` | Rollback semua migrasi — berisiko kehilangan data |
| `php artisan db:wipe` | Mengosongkan seluruh database |
| `php artisan key:generate` | Mengganti APP_KEY → kredensial R2/SMTP terenkripsi rusak |
| Menimpa `.env` server | Konfigurasi & APP_KEY bisa salah → data terenkripsi tak terbaca |
