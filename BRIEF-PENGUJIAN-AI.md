# Brief Pengujian Menyeluruh — Aplikasi Agenda Pembelajaran SMKN 2 Cimahi

> **Peran AI:** Bertindaklah sebagai **QA Engineer / Test Architect senior** untuk aplikasi web tiga-lapis (React 19 SPA → Laravel 11 REST API `/api/v1/*` → MySQL). Tujuan akhir: **tidak ada celah error saat pengguna nyata menggunakan aplikasi**, di desktop maupun HP, dari input sampai laporan, dan aman dari akses tak berhak.
>
> Gunakan brief ini sebagai kontrak pengujian. Setiap klaim "lolos" **wajib** disertai bukti (nama test, langkah reproduksi, screenshot, atau respons API + kode status).

---

## 0. Konteks Aplikasi (baca dulu sebelum menguji)

| Aspek | Ringkasan |
|---|---|
| **Frontend** | React 19 + Vite + TypeScript + Tailwind 4, TanStack Query, Zustand, React Router 7. Bentuk **PWA**. |
| **Backend** | Laravel 11 (PHP 8.2+), Sanctum (token Bearer), ±303 endpoint, ±63 model Eloquent. |
| **Database** | MySQL/MariaDB (produksi cPanel), lokal via Docker. |
| **Keluaran** | PDF (`laravel-dompdf`), Excel (OpenSpout). |
| **Integrasi** | Cloudflare R2 (opsional), Firebase Cloud Messaging (Web Push). |
| **Aturan bisnis terpusat** | `App\Support\*`: `PklMode`, `KokurikulerMode`, `BellSchedule`, `ClassAccess`, `TahunAjaran`, `TanggalTagihan`, `SessionTeacher`. **Satu perilaku = satu sumber kebenaran.** |
| **Peran** | admin, guru, wali_kelas, siswa, wakasek, bk, orang_tua. Wali & BK = **kapabilitas** di atas `guru`, bukan role terpisah. |

**8 aturan bisnis yang paling sering menimbulkan bug (prioritaskan pengujiannya):**

1. Nama kelas selalu lewat `SchoolClass::label()` → `"XII RPL A"`. Jangan dirangkai manual.
2. Jam sesi selalu lewat `BellSchedule::resolve($schedule, $tanggal)`. Jangan baca `jam_mulai` mentah.
3. Guru efektif sebuah sesi = `SessionTeacher` (memperhitungkan inval disetujui).
4. Tanggal ditagih = dalam rentang semester aktif **dan** bukan hari tidak efektif (`TanggalTagihan::ditagih`).
5. Pembebasan PKL & Kokurikuler berbasis periode, dengan batas saklar/status **berlaku ke depan**.
6. Tanggal entry guru/wali/BK **dilarang masa depan** (≤ hari ini); masa lalu boleh.
7. Timezone: gunakan `toLocalDateStr()` (WIB), **jangan** `toISOString()` (menggeser mundur).
8. Cache statis `App\Support\*` di-`flush()` setelah data terkait berubah.

---

## 1. Penilaian Relevansi 9 Jenis Pengujian

Semua sembilan jenis **relevan**, tetapi bobotnya tidak sama. Alokasikan usaha sesuai peringkat berikut.

| # | Jenis Pengujian | Relevansi | Alasan singkat terhadap aplikasi ini |
|---|---|---|---|
| 1 | **Unit Testing** | 🔴 **Wajib (tinggi)** | Aturan bisnis terpusat di `App\Support\*` (kalkulasi deadline agenda, EWS, pembebasan PKL/Kokurikuler, `BellSchedule`). Ini logika paling rawan bug dan paling mudah diuji terisolasi. |
| 2 | **Integration Testing** | 🔴 **Wajib (tinggi)** | ±303 endpoint API + Eloquent + scope Tahun Ajaran + otorisasi. Interaksi controller ↔ model ↔ `Support` adalah tempat bug lintas-modul muncul (mis. inval memindahkan kewajiban agenda). |
| 3 | **System / Functional Testing** | 🔴 **Wajib (tinggi)** | Harus memverifikasi tiap alur nyata "input → laporan" per peran sesuai §5–§7 dokumentasi. |
| 4 | **End-to-End (E2E) Testing** | 🟠 **Sangat dianjurkan** | SPA + token Sanctum + alur multi-langkah (login → pilih TA → isi agenda → cek "Perlu Diisi" hilang → laporan). E2E menangkap bug integrasi FE-BE yang tak terlihat di unit test. |
| 5 | **Regression Testing** | 🔴 **Wajib (tinggi)** | Dokumentasi mensyaratkan `php artisan test` **hijau** & `tsc -b` **bersih** sebelum rilis. Sudah ada suite untuk PKL, Kokurikuler, otorisasi, TA, import, jam & bel. |
| 6 | **Compatibility Testing** | 🟠 **Sangat dianjurkan** | PWA lintas peramban (Chrome/Edge/Firefox/Safari) & lintas perangkat (desktop 1366/1920 + HP 390). Ada perilaku responsif spesifik (navigasi bawah, mode Apel). |
| 7 | **Performance & Load Testing** | 🟡 **Dianjurkan (terarah)** | Target UX ketat: agenda ≤2 mnt, absen ≤90 dtk, poin ≤20 dtk. Beban puncak nyata: banyak guru mengisi agenda serentak di jam yang sama; generate laporan PDF/Excel massal; EWS Guru merentang tanggal. |
| 8 | **Security Testing** | 🔴 **Wajib (tinggi)** | Data siswa (UU PDP No. 27/2022). Model otorisasi ketat sudah didesain: 401/403/404, IDOR→404, scoping kelas DIAJAR vs DIBINA. Harus dibuktikan, bukan diasumsikan. |
| 9 | **Usability & Accessibility Testing** | 🟡 **Dianjurkan** | Pengguna = guru dengan waktu terbatas; efisiensi = fitur utama. Aksesibilitas (kontras mode gelap/terang, keyboard, label form) penting untuk pemakaian luas. |

**Ringkas:** Prioritas 1 (wajib lolos sebelum rilis) = Unit, Integration, System, Regression, Security. Prioritas 2 = E2E, Compatibility. Prioritas 3 (terarah, tidak memblokir rilis kecil tapi penting) = Performance, Usability/Accessibility.

---

## 2. Instruksi Umum untuk AI Penguji

Saat menjalankan brief ini:

1. **Selalu mulai dari data demo.** Reset ke keadaan bersih: `make reseed` atau `make reseed-demo`. Login dengan akun demo (password `password`), pilih **Tahun Ajaran aktif**.
2. **Uji per peran secara bergiliran** — jangan menganggap satu peran mewakili yang lain; kapabilitas Wali/BK/PKL/Kokurikuler mengubah menu & akses.
3. **Untuk setiap kasus uji, catat:** ID kasus, prasyarat, langkah, ekspektasi, hasil aktual, status (LULUS/GAGAL), bukti.
4. **Untuk API, selalu catat kode status HTTP** (200/201/401/403/404/422) dan payload.
5. **Jangan pernah menyatakan lolos tanpa mereproduksi.** Bila ragu, tandai `PERLU VERIFIKASI MANUAL`.
6. **Uji jalur bahagia DAN jalur gagal** (input kosong, tanggal masa depan, duplikat, token kedaluwarsa, ID acak).
7. **Timezone WIB (UTC+7)** — verifikasi tidak ada pergeseran tanggal H-1 pada entry/laporan.
8. **Data fiktif saja** — jangan pernah memasukkan data siswa asli ke lingkungan uji.

---

## 3. Rincian Per Jenis Pengujian (cara melakukannya)

### 3.1 Unit Testing — logika bisnis terisolasi

**Sasaran (kelas `App\Support\*` dan Enum/helper):**

- `BellSchedule::resolve()` — jam efektif sesi untuk hari biasa, **Jumat (durasi beda)**, dan **mode Apel/Tanpa Apel** (offset 0 / −60 menit) termasuk **pengecualian per tanggal**.
- `TanggalTagihan::ditagih()` — true hanya dalam rentang semester aktif & bukan hari tidak efektif; false untuk libur, di luar semester, akhir pekan sesuai kalender.
- `PklMode` — pembebasan **hanya kelas XII**, **hanya dalam periode penempatan**, batas saklar **ke depan**: saklar OFF → tanggal lampau tetap bebas, hari ini & ke depan ditagih reguler.
- `KokurikulerMode` — pembebasan kelas untuk projek berstatus **bukan `draft`** (aktif/selesai); tagihan fasilitator **hanya** untuk projek `aktif`.
- `SessionTeacher` — mengembalikan guru pengganti **hanya** bila inval berstatus **disetujui**; selain itu guru asal.
- `TahunAjaran` scope — query tidak mencampur data antar-semester; TA arsip baca-saja.
- Perhitungan **deadline agenda** dari jam selesai sesi + `AgendaFillSetting` (batas hari + jam).
- Perhitungan **level EWS** (`hijau/kuning/oranye/merah`) dari kombinasi kehadiran + KBM + poin karakter + nilai aktivitas.
- Perhitungan **EWS Guru** `pct_terisi` → warna (Merah <50%, Oranye 50–74%, Kuning 75–89%, Hijau ≥90%).

**Cara:** PHPUnit di `backend/tests/Unit`. Uji **batas nilai** (boundary): tepat di ambang 50/75/90%, tepat di hari deadline, tepat pukul selesai sesi, hari Kamis vs Jumat (gating PKL). Untuk frontend, uji helper tanggal (`toLocalDateStr` vs `toISOString`) memastikan tidak menggeser tanggal.

```bash
docker compose exec backend php artisan test --testsuite=Unit
```

**Kriteria lulus:** semua ambang & batas menghasilkan nilai persis; tidak ada off-by-one pada tanggal/persentase.

---

### 3.2 Integration Testing — endpoint + database + otorisasi

**Sasaran:** interaksi controller ↔ model ↔ `Support` ↔ MySQL, lewat HTTP API nyata (bukan mock DB — pakai database uji/transaksi).

**Skenario inti:**

- `POST agendas` (store) menghormati **deadline**: sebelum deadline → 201; lewat deadline → ditolak "lewat batas" (khusus `store`, bukan `update`).
- `GET agendas/perlu-diisi` menampilkan sesi hari ini + tertunda dalam jendela + **sesi yang dialihkan via inval**; **tidak** menagih tanggal di luar semester / hari tidak efektif.
- **Inval disetujui** → sesi hilang dari perlu-diisi guru asal, muncul di perlu-diisi guru pengganti.
- **Poin karakter** menambah akumulasi; melewati `ActionThreshold` memicu rekomendasi tindakan.
- **Import Excel** (siswa L/P, guru, jam-bel, PKL): baris valid tersimpan, baris salah dilaporkan; periode PKL bertumpuk **ditolak**; nama kelas format kode & nama jurusan penuh sama-sama diterima.
- **Scope TA**: request dengan `academic_year_id` berbeda tidak membocorkan data semester lain.
- **Laporan** endpoint mengembalikan berkas PDF/Excel valid (cek header content-type & ukuran > 0).

**Cara:** `backend/tests/Feature` (PHPUnit + `RefreshDatabase`). Bangun state via factory/seeder, panggil endpoint dengan token peran yang sesuai, assert status + struktur JSON + efek samping di DB.

**Kriteria lulus:** setiap aturan §5–§7 terbukti lewat minimal satu test integrasi; matriks status HTTP benar.

---

### 3.3 System / Functional Testing — alur nyata per peran (input → laporan)

Login bergiliran dan jalankan alur lengkap. **Setiap peran harus menyelesaikan alurnya sampai menghasilkan/melihat keluaran.**

- **Admin** — CRUD Kelas/Guru/Siswa/Mapel/Jadwal; import Excel (unduh template dulu); generate akun (cek popup kredensial + tombol salin username/password); atur TA, Jam & Bel, Pengaturan Agenda; nyalakan/matikan **Mode PKL**; buat projek Kokurikuler; buka **EWS Guru** (grafik + tabel + klik detail guru + audit log IP); generate **Laporan** & **Rekap Perkembangan** (PDF + Excel — pastikan **benar-benar terunduh** & isinya wajar).
- **Guru** — isi **Agenda** sesi hari ini (TP + catatan + nilai aktivitas + presensi) → pastikan **hilang dari "Perlu Diisi"**; beri **poin Karakter** (+/−) & **Nilai Tambah**; ajukan/terima **Guru Inval** → cek kewajiban berpindah; buka **Beban Mengajar** & **Jadwal Saya**.
- **Wali Kelas** — **Presensi Harian**; catat **Konseling/Penanganan** + **unggah dokumen** (gambar & PDF); buka **EWS Siswa** kelas perwalian; isi **Refleksi Mingguan**.
- **BK** — **EWS Murid BK**; konseling **privat** (opt-in share); terima **eskalasi** dari wali.
- **Pembimbing PKL** (Mode PKL ON) — menu PKL: pastikan **satu tombol per minggu** menampilkan kelas + jumlah siswa; **hanya bisa diisi mulai Jumat**; isi absen tap 5 hari (H/S/I/A) untuk **semua anak lintas kelas**; simpan → cek **terdistribusi** ke tiap kelas & tagihan hilang; unduh Data Siswa & Rekap Absen.
- **Fasilitator Kokurikuler** — isi absen peserta, laporan harian, refleksi, nilai per dimensi; cek tagihan muncul di "Perlu Diisi"; TTD fasilitator muncul di export.
- **Siswa / Orang Tua** — Jadwal Saya, Kalender, rekap anak; pastikan **tidak** bisa membuka fitur manajemen.

**Uji Interaksi Mode (PKL × Kokurikuler)** — matriks wajib:

| PKL | Kokurikuler | Ekspektasi |
|---|---|---|
| OFF | OFF | Semua sesi (termasuk XII) ditagih agenda reguler normal. |
| ON | OFF | Sesi XII dalam periode PKL **dibebaskan**; pembimbing ditagih **agenda PKL** (mulai Jumat). |
| OFF | ON | Sesi XII **hari ini & ke depan kembali ditagih reguler**; sesi lampau tetap bebas; tagihan PKL hanya backlog lampau. Kelas projek dibebaskan; fasilitator ditagih (bila projek `aktif`). |
| ON | ON | Kedua pembebasan berlaku bersamaan & independen. |

Verifikasi tambahan: **kelas XI tidak pernah terpengaruh PKL**; mematikan Mode PKL tidak menagih retroaktif sesi PKL lampau, tetapi mengembalikan tagihan reguler ke depan.

**Kriteria lulus:** setiap peran menuntaskan alur; matriks mode sesuai tabel; keluaran PDF/Excel valid.

---

### 3.4 End-to-End Testing — perjalanan pengguna di browser nyata

**Alat:** Playwright (Chromium sudah tersedia di lingkungan) atau Cypress. Rekam trace/screenshot tiap langkah.

**Skenario E2E prioritas:**

1. **Login → pilih TA → Dashboard** untuk tiap peran; token Sanctum tersimpan; refresh halaman tetap login.
2. **Guru isi agenda end-to-end**: buka "Perlu Diisi" → isi 1 sesi → simpan → item hilang dari daftar → muncul di Laporan.
3. **Alur inval**: guru A ajukan inval → admin/guru B setuju → sesi pindah ke B (verifikasi di UI kedua akun).
4. **PKL gating Jumat**: pada hari Kamis tombol minggu berjalan tersembunyi/terkunci; pada Jumat bisa diisi.
5. **Ganti password wajib saat login pertama** untuk akun yang baru digenerate.
6. **Unduh laporan**: klik generate → berkas benar terunduh (cek event download + berkas > 0 byte, anti-IDM base64-JSON tetap berfungsi).

**Kriteria lulus:** semua skenario selesai tanpa error konsol/JS; tidak ada state UI yang menggantung.

---

### 3.5 Regression Testing — jaring pengaman sebelum rilis

**Cara:** jalankan seluruh suite yang sudah ada setiap kali ada perubahan.

```bash
# Backend (PHPUnit) — seluruh suite
docker compose exec backend php artisan test

# Frontend — typecheck ketat (WAJIB tsc -b, BUKAN tsc --noEmit)
cd frontend && npx tsc -b
```

Suite mencakup: PKL (akses, agregat, gating Jumat, mode-off cutoff), Kokurikuler billing, otorisasi data siswa, tahun ajaran, import, jam & bel, dll. **Keduanya harus hijau/bersih.**

**Praktik:** jadikan bagian **CI** yang memblokir merge; setiap bug yang ditemukan brief ini **ditambahkan sebagai test baru** agar tidak kambuh (regression pack yang tumbuh).

**Kriteria lulus:** 0 test gagal, 0 error TypeScript.

---

### 3.6 Compatibility Testing — lintas peramban & perangkat

**Matriks perangkat/peramban:**

| Perangkat | Lebar | Peramban |
|---|---|---|
| Desktop | 1366, 1920 | Chrome, Edge, Firefox, Safari |
| HP | 390 | Chrome (Android), Safari (iOS) |

**Yang diperiksa:**

- **Tidak ada overflow horizontal** pada halaman (tabel lebar boleh scroll di kontainernya sendiri).
- Layar desktop **memanfaatkan lebar dinamis** (mis. daftar PKL & form agenda dua kolom di layar lebar), bukan menyisakan ruang kosong besar.
- HP: sidebar menjadi **navigasi bawah**; menu berlebih masuk tombol **Menu**; navigasi bawah **tidak menutupi konten**.
- **Mode gelap & terang** konsisten; badge Tahun Ajaran di header tampil benar.
- PWA: **Tambahkan ke Layar Utama** berfungsi; buka tanpa bilah alamat; service worker/offline-shell tidak error.

**Kriteria lulus:** tampilan utuh & fungsional di seluruh sel matriks; tidak ada elemen terpotong/tertutup.

---

### 3.7 Performance & Load Testing — target kecepatan & beban puncak

**Target UX (dari dokumentasi) yang harus diverifikasi:**

- Pengisian agenda inti **≤ 2 menit**, absensi satu kelas **≤ 90 detik**, satu input poin karakter **≤ 20 detik** (uji waktu interaksi nyata, bukan hanya latensi server).

**Skenario beban (alat: k6 / JMeter / Locust):**

1. **Isi agenda serentak** — simulasikan mis. 50–100 guru mengirim `POST agendas` di menit yang sama (jam pergantian pelajaran). Ukur p95 latensi & error rate; pastikan tidak ada deadlock/timeout DB.
2. **Generate laporan massal** — beberapa admin generate PDF/Excel besar bersamaan; pantau memori PHP & waktu render dompdf/OpenSpout.
3. **EWS Guru rentang lebar** — buka rekap seluruh guru untuk rentang satu semester; ukur waktu query & cek indeks DB.
4. **Dashboard "Perlu Diisi"** — endpoint yang dipanggil paling sering; harus cepat (< ~300 ms p95 pada data realistis).

**Yang dipantau:** waktu respons p50/p95/p99, throughput, error rate, penggunaan CPU/memori/koneksi DB, N+1 query (aktifkan query log/telescope).

**Kriteria lulus:** target UX terpenuhi pada data realistis; tidak ada kegagalan/timeout pada beban puncak yang diharapkan; tidak ada N+1 mencolok pada endpoint panas.

---

### 3.8 Security Testing — wajib lolos

**Matriks otorisasi (uji tiap baris via API langsung, bukan hanya sembunyikan menu):**

| Kondisi | Ekspektasi |
|---|---|
| Tanpa token → semua endpoint terproteksi | **401** |
| Siswa/orang tua/guru biasa → API admin/rekap/EWS-guru | **403** |
| Wali & BK → kelas di luar haknya (DIAJAR vs DIBINA) | **403/404** |
| ID acak / milik orang lain (IDOR) | **404** (bukan bocor data) |
| Pembimbing PKL → siswa non-bimbingan | diabaikan diam-diam (tidak tampil/tidak bisa diabsen) |

**Uji tambahan:**

- **Kontrol akses fungsi** — coba akses endpoint mutasi lintas peran (mis. guru meng-CRUD kelas). Harus 403.
- **Validasi input** — payload kotor, tipe salah, XSS pada catatan/resume KBM, SQL injection pada filter tanggal/nama → ditolak/di-escape (422 untuk validasi).
- **Token** — token kedaluwarsa/dicabut → 401; token peran A tidak bisa dipakai jalur peran B.
- **Enforce ganti password** login pertama tidak bisa dilewati.
- **Unggah dokumen** — cek tipe berkas, batas ukuran, kompresi (GD/Ghostscript) tidak menyimpan skrip berbahaya; berkas tidak bisa diakses tanpa otorisasi.
- **Aturan tanggal masa depan** ditegakkan di backend (bukan hanya disabled di UI).
- **PDP UU 27/2022** — data pribadi tidak bocor di error/log; lingkungan uji hanya data fiktif.

**Cara:** kombinasi test Feature otorisasi (assert 401/403/404) + pengujian manual/otomatis dengan mengganti token & memanipulasi ID.

**Kriteria lulus:** **seluruh** baris matriks & uji tambahan sesuai ekspektasi. Satu kebocoran = blokir rilis.

---

### 3.9 Usability & Accessibility Testing

**Usability:**

- Verifikasi janji efisiensi (§3.7) dari sudut pengguna: apakah guru benar bisa isi agenda ≤2 menit tanpa kebingungan? Hitung jumlah klik & bidang wajib.
- Pesan error jelas & dalam Bahasa Indonesia yang membantu (bukan stack trace).
- Alur "Perlu Diisi" intuitif; status tersimpan/terkirim jelas.

**Accessibility (acuan WCAG 2.1 AA):**

- **Kontras warna** cukup pada mode gelap & terang (teks, badge, tombol).
- **Navigasi keyboard** — form agenda/absen bisa diisi tanpa mouse; fokus terlihat; urutan tab logis.
- **Label form** & atribut `aria-*` pada input; ikon punya teks alternatif.
- Target sentuh di HP cukup besar (absen tap).

**Cara:** audit otomatis (Lighthouse / axe-core) + uji manual keyboard-only + pemeriksaan kontras. Untuk usability, lakukan **uji koridor** dengan 3–5 guru bila memungkinkan; kalau tidak, walkthrough heuristik.

**Kriteria lulus:** tidak ada pelanggaran kontras/keyboard kritis; target waktu tercapai; tidak ada dead-end tanpa umpan balik.

---

## 4. Ceklis Sebelum Rilis (gerbang kualitas)

- [ ] `php artisan test` **hijau** · `tsc -b` **bersih**.
- [ ] Semua peran bisa login & menu sesuai **kapabilitas**.
- [ ] Alur **input → laporan** tiap peran menghasilkan berkas PDF/Excel valid & terunduh.
- [ ] Matriks **Mode PKL × Kokurikuler** sesuai tabel §3.3.
- [ ] Kelas **XI tidak pernah** terpengaruh PKL; batas saklar berlaku ke depan.
- [ ] Tidak ada **overflow** di HP maupun desktop; layar lebar termanfaatkan.
- [ ] Seluruh matriks **keamानan** (§3.8) lolos; IDOR → 404.
- [ ] Target kecepatan UX (agenda ≤2 mnt, absen ≤90 dtk, poin ≤20 dtk) tercapai.
- [ ] Kontras & navigasi keyboard tidak ada pelanggaran kritis.
- [ ] `.env` produksi mengisi `DEFAULT_TEACHER_PASSWORD`/`DEFAULT_STUDENT_PASSWORD`; storage (R2/lokal) & FCM terkonfigurasi bila dipakai.
- [ ] **Timezone WIB** — tidak ada pergeseran tanggal H-1 pada entry & laporan.
- [ ] Setiap bug yang ditemukan sudah **ditutup dengan test regresi baru**.

---

## 5. Format Pelaporan Hasil (yang harus AI keluarkan)

Untuk tiap kasus uji, keluarkan baris tabel:

| ID | Jenis | Modul/Peran | Langkah | Ekspektasi | Aktual | Status | Bukti |
|---|---|---|---|---|---|---|---|

Lalu ringkasan akhir:

1. **Ringkasan eksekutif** — jumlah lulus/gagal per jenis pengujian, tingkat keparahan bug (Kritis/Tinggi/Sedang/Rendah).
2. **Daftar bug** — reproduksi + dugaan akar masalah (rujuk aturan §0 bila relevan) + saran perbaikan.
3. **Rekomendasi rilis** — GO / NO-GO beserta alasan berbasis gerbang §4.

> **Aturan emas:** jangan pernah menandai fitur "aman untuk pengguna" tanpa bukti reproduksi. Jika sebuah jalur tidak bisa diuji, laporkan sebagai **risiko terbuka**, bukan sebagai lolos.
