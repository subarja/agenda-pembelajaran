# Agenda Pembelajaran — CLAUDE.md

## Identitas Proyek

**Nama:** Aplikasi Agenda Pembelajaran Kelas
**Subtitle:** Terintegrasi dengan Penilaian Karakter Berbasis Poin & Sistem Peringatan Dini Performa Siswa
**Institusi:** SMK Negeri 2 Cimahi
**Versi Dokumen:** RPD v2.1 (Mei 2026)

## Pemangku Kepentingan

| Peran | Nama / Unit | Tanggung Jawab |
|---|---|---|
| **Product Owner** | Kusman Subarja, S.Pd., M.T. (Wakasek Kurikulum) | Visi produk, prioritas fitur, persetujuan rilis |
| Sponsor | Kepala SMKN 2 Cimahi | Dukungan kebijakan, anggaran, validasi strategis |
| End User Primer | Guru, Wali Kelas, Siswa | Pengguna harian |
| End User Sekunder | Wakasek Kurikulum, BK, Orang Tua | Konsumen laporan & EWS |
| Tim Teknis | Developer / Vendor | Implementasi, deployment, pemeliharaan |

## Filosofi & Prinsip Pengembangan

> *"Setiap detik administratif yang dihemat dari guru adalah investasi untuk kualitas pembelajaran."*

Tiga prinsip utama yang menjadi kompas pengembangan:

1. **Hemat waktu guru** — pengisian agenda inti (di luar absensi & penilaian karakter) wajib selesai **≤ 2 menit**. Tidak ada upload foto, tidak ada bidang wajib yang berulang.
2. **Karakter sebagai aset kolektif** — seluruh guru yang mengajar menjadi observer karakter. Penilaian terstandar melalui poin objektif (+/−), bukan persepsi subjektif.
3. **Data berbicara untuk manajemen** — sistem otomatis mengkorelasikan kehadiran, catatan KBM, nilai aktivitas, dan poin karakter, lalu memunculkan peringatan dini (EWS).

## Visi Produk

> *"Menjadi platform agenda pembelajaran yang menyederhanakan administrasi guru di bawah 2 menit, mengubah seluruh guru menjadi mitra pembina karakter, dan memberi manajemen sekolah peringatan dini berbasis data sebelum masalah membesar."*

## Stack Teknologi yang Direkomendasikan

| Layer | Pilihan Utama | Alternatif |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui | Vue 3 + Nuxt 3 |
| State Management | TanStack Query + Zustand | Redux Toolkit |
| Mobile/PWA | Vite PWA Plugin (offline-first) | Next.js PWA |
| Backend | Laravel 11 (PHP 8.3) atau Node.js + NestJS | Django REST Framework |
| Database | PostgreSQL 16 + Redis (cache & queue) | MySQL 8 / MariaDB |
| Queue/Worker | Laravel Queue (Redis driver) / BullMQ | RabbitMQ |
| Auth | Laravel Sanctum / NextAuth.js (JWT + Refresh) | Keycloak |
| Generate PDF | Puppeteer (HTML→PDF) | Dompdf, mPDF |
| Generate Excel | PhpSpreadsheet / ExcelJS | openpyxl |
| Hosting | VPS Indonesia (Biznet Gio / IDCloudHost) | DigitalOcean, Vultr |
| Container | Docker + Docker Compose | Bare metal |
| CI/CD | GitHub Actions / GitLab CI | Jenkins |
| Monitoring | Uptime Kuma + Sentry + Grafana | New Relic, Datadog |

## Arsitektur

Three-tier (presentation → application → data) dengan RESTful API dan JWT stateless.
Komponen khas v2.0: **Character Aggregation Engine** dan **EWS Correlation Engine** berjalan asinkron via worker/queue agar UI tetap responsif.

## Modul Utama (In-Scope)

- Autentikasi multi-peran (Admin, Guru, Wali Kelas, Siswa, Wakasek, BK, Orang Tua)
- **Tujuan Pembelajaran (TP)** — input sekali, dipakai berulang; guru cukup multi-select saat isi agenda
- **Agenda Pembelajaran** — pilih TP + catatan resume KBM + nilai aktivitas kelas
- **Kehadiran** Guru & Siswa per sesi
- **Penilaian Karakter Berbasis Poin** — CRUD induk/sub-karakter, bobot, ambang; semua guru bisa beri apresiasi (+) atau catat pelanggaran (−)
- **Rekomendasi Tindakan Otomatis** berdasarkan ambang poin
- **EWS (Early Warning System)** di dashboard manajemen
- Laporan dengan ekspor **PDF & Excel**
- Dashboard analitik **mobile-first PWA**

## Out-of-Scope (v2.0)

- Upload/dokumentasi foto KBM (dihapus demi efisiensi waktu guru)
- Modul penilaian rapor lengkap
- Integrasi Dapodik langsung (endpoint disiapkan, implementasi versi berikutnya)
- Modul keuangan/SPP
- Aplikasi native iOS/Android (cukup PWA)
- Modul e-learning / LMS

## Target KPI Utama

| Metrik | Target |
|---|---|
| Waktu pengisian agenda inti | ≤ 2 menit |
| Waktu pengisian absensi 1 kelas | ≤ 90 detik |
| Waktu input 1 poin karakter | ≤ 20 detik |
| Guru aktif mingguan | ≥ 90% |
| Uptime sistem | ≥ 99,5% |
| SUS Score kepuasan pengguna | ≥ 80 |
| FCP di HP 4G | ≤ 2,5 detik |
| Kasus EWS yang ditindaklanjuti | ≥ 75% dari total trigger |

## Timeline

- **MVP:** 4 bulan dari kick-off
- **Versi 2.0 lengkap:** 7 bulan dari kick-off

## Batasan & Kendala

- Anggaran terbatas — prioritaskan teknologi open-source dan hosting hemat biaya
- Wajib patuh **UU Pelindungan Data Pribadi No. 27/2022** dan Permendikbud terkait
- Sumber daya developer terbatas — prioritisasi fitur ketat

## Konvensi Kode Wajib

> Aturan ini mengikat SEMUA pengembangan berikutnya. Melanggarnya = memunculkan
> kembali bug yang sudah berkali-kali diperbaiki. Wajib dipatuhi & diverifikasi.

### 1. Kapabilitas, BUKAN role literal (aturan paling sering dilanggar)

Status **wali kelas** dan **BK** adalah **KAPABILITAS yang ditempel di atas akun guru**,
bukan role. Faktanya di DB:
- Akun guru bisa ber-role `guru` **ATAU** `wali_kelas` (import menaikkan role guru wali
  kelas ke `wali_kelas` — data lama tak dinormalisasi).
- **BK = flag `Teacher.is_bk = true`, BUKAN role `'bk'`.** (0 akun role `'bk'`.)
- Wali kelas sejati = `SchoolClass.wali_kelas_id === user.id` di TA aktif.

**DILARANG** membuka/menutup fitur dengan role literal:
```
if ($user->role->value === 'guru')      // ❌ memblokir wali kelas/BK
['wali_kelas','bk'].includes(user.role)  // ❌ hampir tak pernah match akun sungguhan
```

**Pola BENAR:**
- Backend, "ini akun guru/siswa?": `$user->isTeacherAccount()` / `$user->isStudentAccount()`
  (helper di `App\Models\User`). JANGAN gate jalur guru/siswa dengan role.
- Backend, "wali kelas / BK?": lewat `App\Support\ClassAccess`, `SchoolClass::where(
  'wali_kelas_id', $user->id)`, atau `Teacher.is_bk` — bukan role.
- Frontend: `user.kapabilitas.is_wali_kelas` / `is_bk` (dari UserResource), bukan `user.role`.
- Role literal HANYA sah untuk: assign role saat import, atau filter kategori admin
  (mis. `?role=guru` yang di-expand ke Guru/WaliKelas/BK/Wakasek).

Riwayat pelanggaran: nav (2026-07-02, 2026-07-22), Rekomendasi/EWS (2026-07-02),
Jadwal Saya `myWeek`/`myPdf` (2026-07-23). Tiap keluhan "fitur X tak muncul / 403 untuk
guru tertentu" → **curigai ini lebih dulu**; `grep -rn "role.*'guru'\|'wali_kelas'\|'bk'"`.

### 2. Aturan pendukung (sudah tertanam di kode, pertahankan)

- **Multi-endpoint per resource**: menutup `index()` TIDAK mengamankan `show()/export/pdf`.
  Cek otorisasi tiap method (`grep -n "public function"`), reuse satu helper otorisasi.
- **Verifikasi wajib**: backend Pint + `php artisan test` (tambah test regresi untuk tiap
  bug perilaku); frontend `tsc -b` (bukan `tsc --noEmit`). Tulis test yang MENGGAGALKAN
  build bila aturan #1 dilanggar lagi (mis. `ScheduleMyWeekTest` menguji akses wali_kelas).
- **Scope Tahun Ajaran & waktu**: query baru ber-TA pakai `TahunAjaran::id()`; tanggal FE
  pakai `toLocalDateStr()` (jangan `toISOString()`, geser di WIB).
