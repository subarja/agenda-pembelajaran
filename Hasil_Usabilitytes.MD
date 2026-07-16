# Hasil Usability & Audit Menyeluruh — Aplikasi Agenda Pembelajaran

**Tanggal:** 17 Juli 2026
**Cakupan:** Perombakan alur PKL + audit menyeluruh 7 peran (fungsional, visual, keamanan, optimasi desktop) di stack **asli** (bukan seed demo), menggunakan data produksi lokal (2.429 siswa, 100 guru, 492 penempatan PKL).
**Metode:** Browser sungguhan (Chromium/Playwright) untuk UI + HTTP API langsung (curl) untuk fungsional & keamanan. Setiap peran diuji pada dua viewport: desktop 1366/1920 dan mobile 390.

---

## 1. Ringkasan Eksekutif

| Aspek | Hasil |
|---|---|
| Test backend (PHPUnit) | **111 + 2 lolos** (0 gagal) |
| Typecheck frontend (`tsc -b`) | **Bersih** |
| Crawl visual 7 peran × 2 viewport | **0 overflow-x, 0 JS error/crash, 0 tab admin rusak** |
| Matriks keamanan (auth/otorisasi/IDOR) | **Semua lolos** (401/403/404 sesuai harapan) |
| Pembuatan laporan (PDF/Excel) | **Semua menghasilkan file valid** (XLSX zip / %PDF) |
| Bug ditemukan & diperbaiki | **1 bug 500 backend + 3 masalah UI/UX** |

**Kesimpulan:** Sistem sehat. Tidak ditemukan celah keamanan (semua akses lintas-peran ditolak backend). Satu bug server (500 saat buat kelas tanpa field opsional) ditemukan lewat audit dan diperbaiki + ditambah test regresi. Tata letak desktop dua halaman PKL dioptimalkan agar memakai lebar layar penuh secara dinamis.

---

## 2. Perombakan Alur PKL (permintaan utama)

Enam perubahan diminta dan diselesaikan:

1. **Tagihan agenda PKL muncul di dashboard guru saat mode aktif.** Ditambahkan `PklMode::tagihanPembimbing()` → daftar "Agenda Perlu Diisi" dashboard kini memuat baris **"Agenda PKL Mingguan"** per kelas bimbingan; klik langsung membuka form minggu itu. *Terverifikasi browser:* 2 tagihan muncul untuk Kusman Subarja (XII MEKA B & D).

2. **Daftar siswa PKL langsung menampilkan seluruh bimbingan** (lintas kelas) tanpa harus memilih kelas dulu, dengan **filter kelas & filter industri** yang saling mempersempit (cascade). *Terverifikasi:* header "Siswa Bimbingan (7)", filter kelas → "1 dari 7".

3. **Bug "32 siswa XII MEKA C" diperbaiki.** Akar masalah: fallback lama membuat guru ber-ploting jadwal XII (tanpa penugasan) melihat **seluruh** siswa kelas. Kebijakan diubah tegas: **hanya pembimbing (punya penugasan placement)** yang melihat & mengabsen siswa — dan hanya siswa bimbingannya. *Terverifikasi:* guru ploting tanpa penugasan kini `overview=[]`, `weeks`→403.

4. **Absen tap sekali-sentuh** menggantikan dropdown yang lambat: tombol berwarna **H/S/I/A** per hari, **default semua Hadir** untuk hari yang sudah berjalan (pembimbing cukup mengoreksi yang tak hadir). Desain radiogroup mencegah salah-tap. *Terverifikasi:* 5 sel default H aktif, tap S berubah amber, simpan sukses.

5. **Daftar minggu agenda diprioritaskan:** paling atas minggu berjalan ("Isi minggu ini"), lalu yang telat (lewat batas), riwayat terisi disembunyikan di balik toggle collapse, dan **minggu masa depan tidak ditampilkan** sama sekali. *Terverifikasi:* 0 baris "Belum mulai", riwayat di balik "Riwayat terisi (1)".

6. **Tagihan dibatasi periode semester:** minggu di luar rentang tanggal semester aktif tidak pernah ditagih (baik di daftar `weeks` maupun tagihan dashboard). Diuji dengan penempatan yang menembus akhir semester → minggu setelah 19 Jun tidak muncul.

---

## 3. Audit Keamanan (tidak ada celah)

Diuji via API langsung dengan token 7 peran nyata. **Semua lolos.**

| Kelas Uji | Hasil |
|---|---|
| Tanpa token → endpoint terproteksi | **401** (5/5 endpoint) |
| Siswa & orang tua → API admin / rekap / tulis kelas | **403** (semua) |
| Guru biasa → panel admin / EWS Guru / rekap perkembangan | **403** (semua) |
| BK & wali kelas → rekap perkembangan / data admin (school-wide) | **403** (scoping benar) |
| IDOR: akses UUID acak (agenda, rekap siswa) | **404** (tidak bocor) |
| Pembimbing PKL → siswa bimbingan guru lain | **diabaikan diam-diam** (absen hanya tercatat utk bimbingannya — ada test) |
| Wakasek (peran manajemen) → panel admin | **boleh** (memang `role:admin,wakasek` by design) |

**Catatan peran wakasek:** memiliki akses tulis panel admin adalah keputusan produk (Wakil Kepala Sekolah Kurikulum), bukan celah — route group `role:admin,wakasek`.

---

## 4. Bug Ditemukan & Diperbaiki

### BUG-1 (server 500) — Buat kelas tanpa field opsional
- **Gejala:** `POST /admin/classes` tanpa `academic_year_id`/`wali_kelas_id` (dua-duanya opsional) → **500 "Undefined array key"**.
- **Akar:** aturan validasi `nullable` **tidak** menambahkan key ke array `$validated` saat field absen dari body; kode mengakses `$data['academic_year_id']` langsung. FE selalu mengirim string kosong sehingga lolos di UI, tapi API rapuh.
- **Perbaikan:** `($data['academic_year_id'] ?? null)` di `ClassAdminController::store()`. Sekarang **201**. Ditambah **test regresi** `ClassAdminStoreTest` (buat tanpa field opsional = 201; non-admin = 403).

### FIX-2 (UI) — Kartu tagihan dashboard tampil tertutup
- **Gejala:** `NotifCard` memakai `defaultOpen` hanya sekali; karena data query datang setelah render pertama (0 item), kartu "Agenda Perlu Diisi" berisi tagihan PKL kadang tampil tertutup.
- **Perbaikan:** `NotifCard` kini mengikuti perubahan `defaultOpen` selama user belum menyentuh toggle. *Terverifikasi:* tagihan PKL langsung terlihat terbuka.

### FIX-3 (UI) — Warning React `useMemo` di halaman PKL
- **Gejala:** dependency array `useMemo` berukuran dinamis (`...weekQueries.map`) memicu warning "final argument changed size".
- **Perbaikan:** diganti signature string stabil (`dataUpdatedAt.join`).

### FIX-4 (responsif) — Overflow-x halaman PKL di mobile
- **Gejala:** grid single-column mobile memakai lebar konten (`grid auto`) → konten 6px melewati viewport 390.
- **Perbaikan:** `flex flex-col` di mobile, `grid` hanya di `lg`. *Terverifikasi:* overflow-x hilang di kedua halaman PKL.

---

## 5. Optimasi Tata Letak Desktop

**Temuan:** di 1920px, halaman PKL (`max-w-3xl`) hanya memakai ~740px — separuh kanan layar kosong (keluhan user).

**Perbaikan (dinamis mengikuti resolusi):**
- **Halaman PKL:** layout dua kolom `lg:grid-cols-[minmax(0,22rem)_1fr]` — agenda mingguan kolom kiri ramping (sticky), daftar siswa **grid responsif** (`md:2 kolom`, `2xl:3 kolom`) mengisi sisa lebar. Ruang kosong hilang.
- **Form Agenda PKL:** dua kolom `lg:grid-cols-[minmax(0,24rem)_1fr]` — TP + catatan monitoring di kiri (sticky), tabel presensi mengisi lebar kanan.
- Keduanya runtuh mulus ke satu kolom di mobile (terverifikasi tanpa overflow).

**Prinsip yang dipertahankan:** halaman **form murni** (mis. Laporan, Ganti Password) sengaja tetap lebar terbatas di kiri — form full-width justru menurunkan keterbacaan. Halaman daftar/tabel/dashboard sudah full-width sejak awal (layout `md:pl-64` tanpa max-width global).

---

## 6. Cakupan Fungsional per Peran (ringkas)

| Peran | Diuji | Status |
|---|---|---|
| **Admin** | 26 route + 23 tab panel (Data Master/Akademik/Karakter/Import/Sistem), CRUD kelas, semua laporan | ✅ |
| **Guru** | Dashboard, agenda, TP, presensi, karakter (tulis 201), nilai tambah, kalender, jadwal, beban mengajar, laporan | ✅ |
| **Pembimbing PKL** | Overview, bimbingan lintas kelas + filter, agenda mingguan, absen tap, export siswa/rekap (Excel+PDF valid) | ✅ |
| **Wali Kelas** | EWS siswa, catatan, refleksi, riwayat dokumen, presensi harian (scoping kelas perwalian) | ✅ |
| **BK** | EWS BK (scope kelas ampu), konseling, riwayat dokumen | ✅ |
| **Wakasek** | EWS, rekap perkembangan (Excel 101KB valid), panel admin | ✅ |
| **Siswa** | Jadwal saya, kalender, profil; ditolak dari semua API manajemen | ✅ |
| **Orang Tua** | Dashboard + profil anak tertaut; ditolak dari API lain | ✅ |

**Laporan terbukti menghasilkan berkas nyata:** karakter (6.7KB xlsx), EWS (7.1KB), nilai tambah (4.8KB), PKL rekap absen (5.4KB), PKL data siswa (5.4KB xlsx / 64KB pdf), rekap perkembangan (101KB xlsx). Validasi rentang tanggal pada laporan kehadiran bekerja (422 tanpa tanggal — benar).

---

## 7. Berkas & Test Terkait

- Backend: `PklMode.php`, `PklController.php`, `AgendaController.php`, `ClassAdminController.php`
- Frontend: `PklPage.tsx`, `PklAgendaFormPage.tsx`, `AgendaPerluDiisiList.tsx`, `NotifCard.tsx`, `nav-config.ts`, tipe `agenda/types.ts` & `pkl/api.ts`
- Test: `PklScheduleAccessTest` (dirombak ke kebijakan pembimbing-only + tagihan + clamp semester), `PklModeTest` (rekap 'semua' sesuai hak), `ClassAdminStoreTest` (baru)

---

## 8. Sisa Catatan (non-blok)

- `/jadwal-saya` memanggil `schedules/my-pdf` → **404** bila guru/wali belum punya PDF jadwal terunggah. Ini **empty-state wajar** (bukan crash; UI menanganinya), namun memunculkan 404 di console. Bisa dihaluskan lain waktu dengan cek keberadaan sebelum fetch.
- Halaman form murni (Laporan dsb.) menyisakan ruang kanan di layar sangat lebar — **disengaja** demi keterbacaan form; bukan defek.
