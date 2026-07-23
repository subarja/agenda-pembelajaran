# Alur Piket — Rencana Perubahan: Petugas Tetap per Hari + Shift/Sesi

**Status:** RENCANA (belum dieksekusi). Dokumen ini hanya perencanaan — belum ada kode yang disentuh.
**Branch kerja saat ini:** `feat/modul-bel-piket`
**Tanggal:** 2026-07-23
**Konteks pemicu:** Petugas piket seharusnya diset **tetap per hari-dalam-seminggu + per shift jam** (mis. setiap Senin, shift pagi 06.00–11.00 = Mr.X & Miss Y; shift siang 11.00–15.00 = Mr.Z & Mr.K), bukan diinput ulang per tanggal.

---

## 1. Kondisi Sekarang (yang perlu diubah)

Penugasan piket saat ini **per TANGGAL, tanpa shift/jam**.

| Aspek | Implementasi sekarang | Lokasi |
|---|---|---|
| Skema | `piket_assignments`: `academic_year_id`, **`tanggal` (date)**, `teacher_id`, `dibuat_oleh`. Unique `(academic_year_id, tanggal, teacher_id)` | `database/migrations/2026_07_22_170000_add_sekuriti_role_and_piket.php` |
| Model | Docblock "penugasan guru piket per tanggal" | `app/Models/PiketAssignment.php` |
| Resolusi "siapa piket" | Cocokkan `tanggal == hari ini`. **Jam tidak pernah dilihat** | `app/Support/PiketAccess.php` (`isPetugas`, `petugasUsers`, `assignmentIds`) |
| Admin | `store` validasi `tanggal` + `teacher_uuid[]`; import Excel kolom `tanggal \| nama_guru` | `app/Http/Controllers/Api/Admin/PiketAssignmentController.php` |
| Frontend admin | `<input type="date">` + multi-select guru; daftar dikelompokkan per tanggal | `frontend/src/components/admin/PiketAdminTab.tsx` |
| Dashboard piket | `/piket/ringkasan` kembalikan daftar `petugas` (semua nama hari itu) | `frontend/src/pages/PiketPage.tsx` |

**Kesimpulan:** tidak ada satu pun kolom/UI/logika untuk hari-dalam-seminggu, shift/sesi, maupun jam mulai–selesai. Model yang diinginkan belum tercover.

### Aset yang bisa dipakai ulang (biar konsisten dengan modul Bel)
- `App\Enums\Hari` — `senin..sabtu` (⚠️ **belum ada Minggu**, lihat §9 keputusan terbuka).
- Pola `hari` + `jam_mulai` + `jam_selesai` sudah ada di `BellPeriod` — kita ikuti gaya kolom yang sama.

---

## 2. Tujuan / Model Target

1. Admin men-**setup sekali** pola mingguan: untuk tiap **hari** × **shift**, siapa saja petugasnya (boleh >1 guru per shift).
2. Sistem menentukan petugas aktif berdasarkan **hari + jam sekarang** (Asia/Jakarta).
3. Menu & aksi piket muncul otomatis untuk guru yang bertugas, tanpa input per tanggal.
4. (Opsional/Fase 2) **Pengecualian per tanggal** — tukar/ganti/tambah/kosongkan petugas pada tanggal tertentu (tukar jaga, libur, guru berhalangan) tanpa mengubah pola tetap.

**Prinsip yang dipertahankan:**
- Piket = **KAPABILITAS**, bukan role (sesuai pola `ClassAccess` / `PklMode`).
- Semua di-scope **Tahun Ajaran aktif** (`TahunAjaran::id()`).
- Zona waktu tunggal **Asia/Jakarta** untuk semua perbandingan jam.

---

## 3. Rancangan Skema Database (baru)

Pendekatan: **tabel pola mingguan baru**, `piket_assignments` lama di-repurpose jadi tabel **pengecualian per-tanggal** (atau dibuat tabel override terpisah — lihat §3.3).

### 3.1 `piket_shifts` — definisi shift per hari
| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | bigint PK | |
| `academic_year_id` | FK `academic_years` cascade | scope TA |
| `hari` | string (enum `Hari`) | senin..sabtu (+minggu bila enum diperluas) |
| `nama_shift` | string | mis. "Pagi", "Siang" |
| `jam_mulai` | time | mis. `06:00` |
| `jam_selesai` | time | mis. `11:00` |
| `urutan` | tinyint | untuk sort tampilan |
| `timestamps` | | |

- **Unique:** `(academic_year_id, hari, nama_shift)`.
- **Index:** `(academic_year_id, hari)`.
- Catatan: satu hari boleh punya beberapa shift; shift tiap hari boleh berbeda (Senin bisa 3 shift, Jumat 2 shift). Tidak dipaksa seragam antar hari.

### 3.2 `piket_shift_teacher` — petugas tetap per shift (pivot)
| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | bigint PK | |
| `piket_shift_id` | FK `piket_shifts` cascade | |
| `teacher_id` | FK `teachers` cascade | |
| `timestamps` | | |

- **Unique:** `(piket_shift_id, teacher_id)`.
- Boleh banyak guru per shift; satu guru boleh ada di banyak shift/hari.

### 3.3 Pengecualian per tanggal (Fase 2 — opsional)
Dua opsi, pilih salah satu saat eksekusi:

**Opsi A (disarankan): tabel baru `piket_shift_overrides`**
| Kolom | Tipe | Catatan |
|---|---|---|
| `academic_year_id` | FK | scope TA |
| `tanggal` | date | tanggal pengecualian |
| `piket_shift_id` | FK nullable | shift yang ditimpa (null = berlaku seluruh hari) |
| `teacher_id` | FK nullable | guru terkait |
| `tipe` | enum `tambah`/`hapus`/`libur` | tambah petugas, hapus petugas tertentu, atau kosongkan shift |
| `dibuat_oleh` | FK users nullable | audit |

Resolusi tanggal-X = petugas pola mingguan **±** override tanggal-X.

**Opsi B (lebih hemat): repurpose `piket_assignments` lama**
Tetap "per tanggal, seluruh hari" sebagai daftar petugas tambahan/pengganti tanggal tertentu, tanpa dimensi shift. Lebih sederhana tapi tidak bisa override per-shift.

> **Rekomendasi:** Fase 1 kirim tanpa override (pola mingguan saja). Override (Opsi A) masuk Fase 2 setelah pola mingguan terbukti jalan.

### 3.4 Nasib `piket_assignments` lama
Karena modul **belum pernah live di produksi** (branch belum di-push, tidak ada data produksi), aman untuk:
- **Fase 1:** biarkan tabel lama tetap ada (tidak dipakai runtime) untuk minim risiko, atau
- Bersihkan lewat migrasi baru bila memilih Opsi A untuk override.

⚠️ **Jangan `migrate:fresh`/`down -v`** — lihat catatan insiden kehilangan data di memori proyek. Cukup tambah migrasi baru (aditif).

---

## 4. Perubahan `App\Support\PiketAccess` (jantung perubahan)

Ini titik ketergantungan S3–S8. Semua konsumen memanggil 3 method ini, jadi **ubah di sini = otomatis merambat** tanpa banyak sentuh call-site.

### 4.1 `isPetugas(User $user, ?string $tanggal = null): bool`
**Perilaku baru:** guru = petugas pada `tanggal` bila punya baris di `piket_shift_teacher` untuk **shift di hari itu** (kapabilitas **sepanjang hari** bertugas, tidak dibatasi jam — agar guru shift pagi tetap bisa buka resume di siang hari). Plus override tanggal (Fase 2).
- Derivasi `hari` dari `Carbon::parse($tanggal)` → map ke enum `Hari`.
- Minggu (bila enum belum diperluas) → tidak ada shift → `false` (kecuali override).

### 4.2 `petugasUsers(?string $tanggal = null, ?string $jam = null): Collection` — **untuk notifikasi FCM**
**Perilaku baru:** target notifikasi = petugas **shift yang aktif pada jam kejadian** (bukan semua petugas hari itu).
- Default `jam = now('Asia/Jakarta')`.
- Ambil shift dengan `jam_mulai <= jam <= jam_selesai` di hari itu → kumpulkan petugasnya.
- **Fallback bila di luar semua shift** (mis. kejadian 05.50 atau 15.30): **KEPUTUSAN TERBUKA** (lihat §9-Q2). Rekomendasi default: kirim ke **seluruh petugas hari itu** agar tidak ada notifikasi hilang.

### 4.3 `assignmentIds(User $user, ?string $tanggal = null): array`
Dipakai `UserResource::piketStatus()` untuk flag kapabilitas `is_petugas_hari_ini`. Ganti sumber dari `piket_assignments` → id shift (atau id pivot) milik guru pada hari itu. `is_petugas_hari_ini = !empty(ids)`.

> **Prinsip pemisahan yang penting:**
> - **Akses menu/aksi (`isPetugas`)** = berbasis **hari** (toleran, sepanjang hari bertugas).
> - **Target notifikasi (`petugasUsers`)** = berbasis **hari + jam shift aktif** (presisi ke yang sedang jaga).
> Konfirmasi apakah ini sesuai keinginan (§9-Q1).

---

## 5. Perubahan Controller Runtime (S3–S8) — dampak & aksi

Karena logika terpusat di `PiketAccess`, sebagian besar controller **tidak perlu diubah**. Yang perlu dicek:

| Sprint | File | Dampak |
|---|---|---|
| S4 Izin keluar | `IzinKeluarController.php:51` | `petugasUsers()` kini shift-aktif. Tidak ubah kode, perilaku ikut method. ✅ |
| S4 Sekuriti scan | `SekuritiController.php:53,67` | Sama, ikut `petugasUsers()`. ✅ |
| S5 Kesiangan | `IzinKesianganController.php:52` | Sama. ✅ |
| S3–S6 Dashboard | `PiketController.php:48,314` — query `PiketAssignment::...where('tanggal')` langsung | **PERLU DIUBAH**: `ringkasan()` & tempat lain yang query `PiketAssignment` langsung harus pindah ke sumber shift, dan sebaiknya tampilkan **per-shift** (nama shift, jam, petugas, tandai shift aktif sekarang). |
| S6 Absensi | `PiketController.php:385` `pastikanPetugas` | Pakai `isPetugas` → otomatis benar. ✅ |
| S6 Resume | `piket_resumes` unique `tanggal` | Tetap **gabungan per tanggal** (keputusan lama user). Opsional per-shift = Fase lanjutan (§9-Q3). |
| Kapabilitas | `UserResource.php:116` | Ikut `assignmentIds` baru. ✅ |

**Aksi konkret controller:**
1. `PiketController::ringkasan()` — ganti query petugas jadi berbasis shift; tambah field `shifts: [{nama, jam_mulai, jam_selesai, petugas[], aktif_sekarang}]` selain/menggantikan `petugas[]` lama.
2. Cek endpoint lain di `PiketController` yang menyebut `PiketAssignment` langsung → arahkan ke helper baru.

---

## 6. Perubahan Panel Admin (`PiketAssignmentController` → penataan shift)

Ganti/lengkapi endpoint `/admin/piket/*`:

**Endpoint baru (pola mingguan):**
- `GET /admin/piket/shifts` — daftar shift per hari + petugasnya (grid Hari × Shift).
- `POST /admin/piket/shifts` — buat/ubah shift (`hari`, `nama_shift`, `jam_mulai`, `jam_selesai`).
- `DELETE /admin/piket/shifts/{shift}`.
- `PUT /admin/piket/shifts/{shift}/petugas` — set daftar `teacher_uuid[]` untuk shift (sync pivot).
- **Import/Template** kolom baru: `hari | nama_shift | jam_mulai | jam_selesai | nama_guru` (satu baris = satu guru pada satu shift-hari). Ganti template lama `tanggal | nama_guru`.

**Validasi penting:**
- `jam_mulai < jam_selesai`.
- Larang/segel **shift tumpang tindih** pada hari yang sama? → **KEPUTUSAN TERBUKA** (§9-Q4). Kalau boleh tumpang tindih, `petugasUsers` bisa mengembalikan >1 shift aktif (union petugas) — aman, tapi perlu disepakati.
- Guru harus punya akun `teachers` valid (pola lama `Teacher::where('uuid')`).

**Endpoint override per-tanggal (Fase 2, Opsi A):** `GET/POST/DELETE /admin/piket/overrides`.

---

## 7. Perubahan Frontend

### 7.1 `PiketAdminTab.tsx` (admin) — rombak
- Dari kalender-per-tanggal → **grid Hari × Shift**:
  - Baris = hari (Senin–Sabtu[/Minggu]).
  - Tiap hari: daftar shift (nama + rentang jam) → tiap shift punya chip petugas + tombol tambah/hapus guru.
  - Tombol "Tambah shift" per hari (form: nama, jam mulai, jam selesai).
- Tab/aksi "Pengecualian" (Fase 2): pilih tanggal → override shift tertentu.
- Import: tombol unduh template baru + upload (format kolom baru).

### 7.2 `PiketPage.tsx` (dashboard guru piket) — sesuaikan
- Header tampilkan **shift yang sedang aktif** (nama + jam + rekan se-shift), dan daftar shift lain hari itu (redup).
- Konsumsi field `shifts[]` baru dari `/piket/ringkasan`.

### 7.3 Tipe TypeScript
- Tambah tipe `PiketShift`, sesuaikan respons `ringkasan`. Verifikasi FE wajib `tsc -b` (bukan `tsc --noEmit`) sesuai aturan proyek.

---

## 8. Migrasi Data & Kompatibilitas

- **Tidak ada data produksi** (modul belum live) → tidak perlu skrip backfill.
- Data demo/seeder piket (bila ada) perlu diperbarui ke format shift. Cek `database/seeders/*` yang menyentuh `piket_assignments`.
- Migrasi **aditif** saja; jangan destruktif. Server produksi = MySQL (cPanel), pastikan tipe `time` & enum aman untuk MySQL 8.
- Deploy cPanel: perubahan ini **menyentuh migrasi + vendor tidak berubah** → jalankan Migrate (aditif, auto-backup) + rebuild `dist.zip` (frontend berubah). Lihat memori `feedback_deploy_frontend_workflow` & `deploy_produksi_insiden_reset`.

---

## 9. Keputusan yang Perlu Anda Konfirmasi Sebelum Eksekusi

| # | Pertanyaan | Rekomendasi default |
|---|---|---|
| **Q1** | Akses menu piket: guru shift pagi boleh buka menu piket **sepanjang hari** ia bertugas, atau **hanya saat jam shiftnya**? | Sepanjang hari (toleran). Notifikasi tetap presisi ke shift aktif. |
| **Q2** | Kejadian di **luar semua jam shift** (mis. 05.50 / 15.30): notifikasi dikirim ke siapa? | Fallback ke seluruh petugas hari itu (jangan sampai hilang). |
| **Q3** | Resume piket tetap **gabungan per tanggal**, atau dipecah **per shift**? | Tetap per tanggal (Fase 1). Per-shift dipertimbangkan nanti. |
| **Q4** | Shift dalam satu hari boleh **tumpang tindih jam**? | Larang tumpang tindih (validasi) untuk kejelasan. |
| **Q5** | Butuh **hari Minggu**? Enum `Hari` sekarang hanya Senin–Sabtu | Tambahkan `Minggu` ke enum bila sekolah kadang piket Minggu. |
| **Q6** | **Override per-tanggal** (tukar/libur) masuk sekarang atau nanti? | Fase 2 (setelah pola mingguan jalan). |
| **Q7** | Apakah shift piket perlu terkait **BellSchedule/jam pelajaran**, atau murni jam bebas? | Murni jam bebas (`time`), independen dari bel. |

---

## 10. Urutan Pengerjaan (saat eksekusi nanti)

1. **DB:** migrasi `piket_shifts` + `piket_shift_teacher` (+ `piket_shift_overrides` bila Q6=sekarang).
2. **Model:** `PiketShift` (relasi `teachers` many-to-many, scope `tahunAjaran`, cast `hari`), sesuaikan `PiketAssignment` (deprecate atau alihkan).
3. **Core:** rombak `PiketAccess` (§4) — ini kunci; tulis dengan hati-hati + unit test.
4. **Controller runtime:** sesuaikan `PiketController::ringkasan` & query `PiketAssignment` langsung (§5).
5. **Admin:** endpoint shift + import/template baru (§6).
6. **Frontend:** `PiketAdminTab` grid Hari×Shift, `PiketPage` shift aktif, tipe TS (§7).
7. **Uji:** unit test `PiketAccess` (kombinasi hari×jam, batas jam, fallback), uji manual 3 skenario (dalam shift, luar shift, ganti hari). Verifikasi FE `tsc -b`, CI hijau.
8. **Fase 2 (opsional):** override per-tanggal + UI pengecualian.
9. **Rilis:** rebuild `dist.zip`, Catatan Rilis, commit; push saat diminta (aturan: branch + PR, jangan push tanpa diminta).

---

## 11. Risiko

- **`PiketAccess` dipakai 6+ tempat (S4/S5/S6 + UserResource).** Regresi di sini mematikan seluruh alur izin keluar/scan/kesiangan/absensi. Wajib test menyeluruh.
- **Zona waktu/parse jam.** Perbandingan `time` harus konsisten Asia/Jakarta; hati-hati batas inklusif (`<=`/`<`) di pergantian shift 11.00 (jangan sampai 11.00 masuk dua shift atau tidak masuk sama sekali). Sepakati: shift = `[jam_mulai, jam_selesai)` (mulai inklusif, selesai eksklusif).
- **Minggu tidak ada di enum `Hari`** → tanggal Minggu selalu "tidak ada petugas" sampai enum diperluas.
- **Perubahan skema di produksi** — patuhi larangan destruktif & wajib auto-backup panel Deploy.

---

*Dokumen perencanaan — belum ada perubahan kode. Menunggu konfirmasi keputusan §9 dan perintah eksekusi.*
