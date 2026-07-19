# Hasil Pengujian Menyeluruh — 19 Juli 2026

Dijalankan terhadap `BRIEF-PENGUJIAN-AI.md` di **stack asli** (DB `agenda_db`, 2429 siswa nyata),
bukan lingkungan demo. Empat jalur berjalan paralel: keamanan, crawl browser, alur fungsional,
serta unit test + performa.

## Rekomendasi rilis: **NO-GO**

Gerbang §4 gagal pada dua baris: *"seluruh matriks keamanan §3.8 lolos"* dan
*"alur input→laporan tiap peran"*. Tiga temuan kritis, semuanya diverifikasi ulang secara
independen (bukan sekadar klaim agen).

---

## 1. Temuan kritis — memblokir rilis

### K-01 · Laporan tidak punya kontrol akses kelas → kebocoran data pribadi
`ReportController` memakai `ClassAccess` **tepat satu kali**, di `classes()` (dropdown).
Endpoint datanya — `kehadiran`, `karakter`, `nilaiTambah` — hanya memvalidasi bentuk input lalu
`SchoolClass::where('uuid', $request->class_id)->firstOrFail()` tanpa otorisasi apa pun.

Bukti langsung: akun **siswa** `PRINCY FAWWAZ MUHAMMAD` (XI RPL A) mengunduh rekap kehadiran
**XI MEKA A** → `HTTP 200`, 7131 byte, berisi **nama lengkap + NIS seluruh siswa** kelas itu.
Siswa mendapat 403 di dropdown, tapi 200 di endpoint datanya — *broken access control* klasik.

Melanggar §3.8 brief dan UU PDP No. 27/2022.
Perbaikan: `abort_unless(ClassAccess::allows(...), 403)` di setiap endpoint laporan berbasis kelas.

### K-02 · Wakasek dapat mengeskalasi diri menjadi Admin
Seluruh prefix `/admin/*` berada di bawah satu middleware `role:admin,wakasek`
(`routes/api.php:291`). Pembatasan "hanya admin" hanya ada sebagai penjaga ad-hoc di 6 controller;
sisanya terbuka.

Bukti: token wakasek → `POST /admin/users` dengan `role: admin` → **201, akun admin terbuat**.
Juga `POST /admin/classes` → 201, `PUT /admin/password-defaults` → 200.
Rantai serangan: wakasek → buat akun admin → backup DB & ekspor kredensial → 2429 data pribadi.

Catatan jujur: endpoint `password-defaults` yang dibuat hari ini **langsung ikut terdampak**
karena ditaruh di grup rute itu tanpa memeriksa penghuninya — persis kelemahan pola
penjaga-manual: endpoint baru mewarisi izin terlalu luas secara diam-diam.

**Keputusan Product Owner (19 Jul):** wakasek = baca semua + kelola data akademik
(kelas/jadwal/mapel/tahun ajaran). TIDAK boleh: pengguna, password default, kredensial,
backup, deploy, R2/FCM.

### K-03 · Mesin rekomendasi tindakan terbalik
`CharacterService::checkThresholdsAndRecommend()` **tidak pernah membaca `$threshold->sifat`** —
hanya `netScore >= min_point`. Dengan ambang `sifat=negatif, min_point=5`:

- siswa **+5** (EWS hijau) → terpicu *"panggil orang tua dan konseling BK"*
- siswa **−15** (3 pelanggaran, EWS oranye) → **tidak ada rekomendasi sama sekali**

Persis kebalikan dari maksud fitur. EWS-nya sendiri menilai benar, jadi cacatnya murni di
pencocokan ambang. Fitur unggulan "Rekomendasi Tindakan Otomatis" (CLAUDE.md) tidak berfungsi.

---

## 2. Temuan tinggi

| ID | Temuan |
|---|---|
| T-01 | **54% wali kelas terkunci dari presensi harian kelasnya sendiri.** `DailyAttendanceController::resolveClass()` bercabang pada `UserRole::WaliKelas` — role literal, padahal wali adalah *kapabilitas di atas guru* (§0). Cabang itu dead code; wali jatuh ke cabang `Guru` yang hanya mengizinkan kelas yang ia **ajar** — 19 dari 35 wali tidak mengajar kelas perwaliannya. Cabang `Guru` juga tidak di-scope tahun ajaran → mengembalikan kelas TA lama beroster kosong. Pengulangan bug sistemik "kapabilitas dianggap role". |
| T-02 | **Tiga rumus berbeda menulis `ews_statuses.level`.** `EwsController:776` (4 indikator) vs `AlphaAlertService:154` (3 indikator, buang `nilai`) vs `CharacterService:138` (ambang absolut). Nilai tersimpan bergantung layanan mana yang terakhir jalan. Melanggar §0 "satu perilaku = satu sumber kebenaran". |
| T-03 | **Google Calendar API key dikembalikan plaintext** oleh `GET /admin/calendar/settings`, tidak konsisten dengan R2/FCM/password-default yang semuanya dimask. Bocor ke devtools tiap kali halaman setting dibuka. |

## 3. Temuan sedang & rendah

| ID | Temuan |
|---|---|
| S-01 | `/admin/teacher-ews` **1388 ms / 2043 query**. Biang: **1627×** `select * from pkl_settings` — `PklSetting::instance()` tanpa memoize (`placementRanges` di file yang sama sudah di-cache; saklarnya terlewat). Memoize saja membuang ~80% query. |
| S-02 | `/admin/effective-days/export` **5160 ms / 3140 query** — `EffectiveDayService` mengambil ulang academic year, jadwal, dan seluruh tabel hari-tidak-efektif tiap panggilan (979 invokasi), semuanya loop-invariant. |
| S-03 | Overflow-x 390 px di kartu projek Kokurikuler — `KokurikulerAdminTab.tsx:140`, baris 5 tombol dengan `shrink-0` di dalam induk 324 px. (Tombol "Unduh Semua Program" di baris 96 **aman**.) |
| S-04 | `CharacterAdminController::storeThreshold():158` → **500** bila `category_id` tidak dikirim (`nullable` tak menambah key ke `$validated`). Baris di bawahnya sudah benar memakai `?? null`. |
| R-01 | Token malformed tanpa header `Accept` → **500** `Route [login] not defined`. |
| R-02 | `GET /pkl/agenda` dengan `placement_id` tak dikenal → 200 (tanpa kebocoran data), menyimpang dari kontrak IDOR→404. |
| R-03 | `/jadwal-saya` memuntahkan 404 + stack trace ke konsol untuk empty-state normal. |
| R-04 | `teacher-ews` mendokumentasikan tanggal sebagai wajib/422, kodenya `nullable` default 30 hari. **Kodenya masuk akal — dokumennya yang perlu diselaraskan.** |

## 4. Yang terbukti sehat

- **Matriks Mode PKL × Kokurikuler 4/4 sesuai tabel §3.3.** Kelas XI tidak pernah terpengaruh PKL;
  mematikan saklar tidak menagih retroaktif tapi mengembalikan tagihan ke depan.
- **Alur agenda guru end-to-end**: isi → hilang dari "Perlu Diisi" → muncul di laporan, tanpa
  pergeseran tanggal H-1. Jalur gagal (tanggal masa depan, lewat deadline, duplikat, jadwal
  guru lain) semuanya ditolak benar.
- **Keamanan yang lolos**: 401 tanpa token (22/22), 403 lima peran non-admin (65 kombinasi),
  scoping DIAJAR vs DIBINA untuk wali/BK/guru mapel, IDOR UUID acak (8/8 → 404), path traversal
  dokumen, SQLi (path/filter/pencarian/sort), payload kotor (6/6 → 422, nol 500), pencabutan
  token, enforcement ganti password pertama.
- **Tampilan**: 237 halaman (7 peran × 3 viewport) → **0 overflow** kecuali S-03.
- **Unit suite**: 120 → **168 test, semuanya hijau**. Sebelumnya `tests/Unit` praktis kosong.
- **Dua fitur baru hari ini** (panel password default, unduh program kokurikuler) lolos penuh di
  semua viewport; berkas ekspor terverifikasi 10501 byte, signature xlsx, 3 sheet valid.

## 5. Risiko terbuka — dilaporkan, bukan diklaim lolos

| ID | Risiko |
|---|---|
| O-01 | **`APP_DEBUG` di produksi belum diverifikasi.** Lokal `true` sehingga 403/422 membawa stack trace + path server. Gerbang §4 menuntut bukti `false` di server. |
| O-02 | **Mode gelap belum ada sama sekali** — tidak ada satu pun varian `dark:` di `frontend/src`. Butir §3.6 "mode gelap & terang konsisten" tidak dapat dinilai; ini fitur belum dibangun, bukan regresi. |
| O-03 | Target `<300 ms` untuk `/agendas/perlu-diisi` **tidak terbukti** — endpoint balas 38 ms tapi isinya kosong. Cepat karena kosong, bukan karena optimal. |
| O-04 | Form login tidak diuji end-to-end (otentikasi lewat injeksi token). Skenario §3.4 "login → pilih TA" belum terbukti. |
| O-05 | Hanya Chromium. Firefox/WebKit/Safari dan PWA (add-to-homescreen, service worker) belum diuji. |
| O-06 | Penyimpanan & rendering XSS end-to-end belum terbukti — validasi enum menolak payload sebelum mencapai lapis penyimpanan. |
| O-07 | Validasi tipe & ukuran berkas pada unggah dokumen belum diuji (butuh multipart). |
| O-08 | Fasilitator Kokurikuler tidak teruji tuntas — satu-satunya projek berstatus `selesai`, bukan `aktif`. |
| O-09 | `dist.zip` dibuat 17 Juli 17:32, **sebelum** seluruh pekerjaan 19 Juli. Perlu build ulang lewat `.env.production.local` sebelum rilis. |

## 6. Keselamatan data

Baseline dicatat sebelum pengujian dan diverifikasi sesudah pembersihan — **cocok seluruhnya**:

| | siswa | guru | pengguna | kelas | jadwal | agenda | projek |
|---|---|---|---|---|---|---|---|
| baseline | 2429 | 100 | 2530 | 96 | 1319 | 1 | 1 |
| sesudah | 2429 | 100 | 2530 | 96 | 1319 | 1 | 1 |

Tidak ada `migrate:fresh`, `db:wipe`, atau `down -v` yang dijalankan.

**Insiden internal (dicatat untuk kejujuran):** saat membersihkan satu input karakter uji yang
menyentuh siswa asli, seluruh `ews_statuses` siswa itu sempat dihapus lalu hanya dibuat ulang
untuk TA aktif — baris TA 2025/2026 ikut hilang. Sudah dipulihkan (dari 1729 baris tersisa, 1728
seragam `hijau/100/0` dan satu-satunya pencilan `kuning` masih utuh milik siswa lain, jadi baris
yang hilang dapat direkonstruksi dengan yakin). Total TA lama kembali **1730**. Pelajarannya:
untuk data turunan, **hitung ulang di tempat**, jangan hapus-lalu-buat-ulang.
