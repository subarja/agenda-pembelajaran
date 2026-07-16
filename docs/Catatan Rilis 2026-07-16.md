# Catatan Rilis 16 Juli 2026 — Checklist Deploy cPanel

Rilis ini berisi: hardening password default, PDF Profil Siswa, scoping tahun ajaran
per-login + TA arsip baca-saja, perbaikan importer aSc (team-teaching, kartu multi-hari,
penugasan belum diplot), perbaikan tagihan kokurikuler, serta Jam & Bel dan kolom jenis
kelamin dari rilis sebelumnya yang belum sempat dideploy.

Ikuti alur update di README bagian *Deploy di cPanel*; di bawah ini hanya hal
**spesifik rilis ini**, urut pengerjaannya.

## 1. Tarik kode
cPanel → **Git™ Version Control** → repo → **Pull or Deploy** → **Update from Remote**
(branch `main`, commit terbaru rilis ini).

## 2. Backend

1. **Migrasi database — WAJIB, ada 7 migration baru** sejak rilis terakhir:
   - `create_bell_schedule_tables` (Jam & Bel)
   - `add_jenis_kelamin_to_students`
   - `add_must_change_password_to_users`
   - `allow_team_teaching_on_schedules` (ubah unique index jadwal)
   - `create_archive_write_settings_table`
   - `create_teaching_assignments_table`

   Lewat Terminal: `php artisan migrate --force` — atau tanpa Terminal: upload
   `cpanel-deploy.php` sementara, akses `?action=migrate`, lalu **hapus lagi** filenya.

2. **Tambahkan 2 baris baru di `backend/.env` server** (nilai bebas, JANGAN memakai
   password lama yang pernah tertulis di kode):

   ```
   DEFAULT_TEACHER_PASSWORD=<password default guru pilihan sekolah>
   DEFAULT_STUDENT_PASSWORD=<password default siswa pilihan sekolah>
   ```

   Tanpa ini tombol **Generate Akun** di Panel Admin akan menolak (disengaja).
   Setelah generate/reset, setiap akun otomatis diwajibkan mengganti password
   saat login pertama.

3. Bersihkan cache config: `php artisan config:clear` (atau `?action=configclear`
   di `cpanel-deploy.php` bila tersedia).

## 3. Frontend

`frontend/dist.zip` di repo sudah berisi build produksi terbaru
(`VITE_API_URL=https://api.agenda.smkn2cmi.sch.id`). Ekstrak isinya (folder `dist/`)
ke *document root* frontend menggantikan yang lama — `.htaccess` SPA jangan terhapus.
`backend/vendor.zip` TIDAK berubah (tidak ada paket Composer baru) — tidak perlu
diunggah ulang.

## 4. Sesudah deploy — langkah data (sekali saja)

1. **Upload ulang file aSc XML jadwal** (Panel Admin → tab Jadwal → import XML) memakai
   file yang sama seperti sebelumnya. Ini akan:
   - melengkapi jadwal guru **team-teaching** yang dulu saling menimpa (kasus beban
     mengajar kelas XII tidak lengkap),
   - mengisi tabel **penugasan mengajar** sehingga lesson yang belum diplot hari/jam
     tetap tampil di menu Beban Mengajar sebagai "Belum diplot".
2. Impor **penempatan PKL** bila belum — bagian "Penugasan PKL" di Beban Mengajar
   membacanya dari sana.
3. Cek Panel Admin → **Akademik → TA Arsip**: pastikan saklar dalam keadaan
   **tertutup** (default) — tahun ajaran non-aktif menjadi arsip baca-saja; buka
   hanya saat perlu koreksi data semester lama.

## 5. Verifikasi singkat

- Login memilih semester lama → seluruh app menampilkan semester itu + badge ARSIP;
  coba simpan sesuatu → ditolak dengan pesan arsip baca-saja.
- Dashboard guru: tidak ada tagihan agenda bertanggal sebelum 15 Juli 2026.
- Beban Mengajar guru kelas XII: baris ploting + baris "Belum diplot" muncul.
- Detail EWS siswa: tombol **Profil** menghasilkan PDF profil satu halaman.
