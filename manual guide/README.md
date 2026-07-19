# Manual Guide — Aplikasi Agenda Pembelajaran

Panduan pengguna Aplikasi Agenda Pembelajaran Kelas SMK Negeri 2 Cimahi, terintegrasi
dengan Penilaian Karakter Berbasis Poin & Sistem Peringatan Dini (EWS).

Dokumen ini adalah **sumber tunggal** (single source of truth). Semua keluaran —
dokumen Word dan bahan paparan PowerPoint — dihasilkan otomatis dari berkas Markdown
di folder ini. Jika ada perubahan panduan, ubah Markdown-nya lalu bangun ulang keluaran.

---

## Struktur Folder

```
manual guide/
├── README.md                          ← Anda di sini: peta dokumen
├── 00-pendahuluan.md                  Ruang lingkup, peran pengguna, konvensi
├── 01-memulai.md                      Login, pilih tahun ajaran, profil, notifikasi
├── 02-dashboard.md                    Dashboard per peran & pusat notifikasi
│
├── 03-modul-guru/                     Panduan untuk Guru Mata Pelajaran
│   ├── 01-tujuan-pembelajaran.md
│   ├── 02-agenda-pembelajaran.md
│   ├── 03-presensi-sesi.md
│   ├── 04-penilaian-karakter.md
│   ├── 05-nilai-tambah.md
│   ├── 06-guru-inval.md
│   ├── 07-jadwal-kalender-minggu-efektif.md   (termasuk Beban Mengajar)
│   ├── 08-laporan.md
│   ├── 09-pkl.md                      PKL untuk guru pembimbing (Mode PKL)
│   └── 10-kokurikuler.md              Kokurikuler untuk fasilitator
│
├── 04-modul-wali-kelas/               Panduan untuk Wali Kelas
│   ├── 01-presensi-harian.md
│   ├── 02-ews-siswa.md
│   ├── 03-data-siswa.md
│   └── 04-penanganan-siswa.md        (termasuk refleksi mingguan & riwayat dokumen)
│
├── 05-modul-bk/                       Panduan untuk Guru BK
│   ├── 01-ews-murid-bk.md
│   ├── 02-konseling.md
│   └── 03-riwayat-dokumen.md
│
├── 06-modul-admin/                    Panduan untuk Admin & Wakasek
│   ├── 01-data-master.md
│   ├── 02-import-data.md
│   ├── 03-karakter-dan-ambang.md
│   ├── 04-tahun-ajaran-dan-backup.md
│   ├── 05-kalender-dan-minggu-efektif.md
│   ├── 06-ews-guru.md                 (termasuk grafik pengisian agenda)
│   ├── 07-integrasi-penyimpanan-dan-notifikasi.md
│   ├── 08-deploy-dan-maintenance.md
│   └── 09-jam-dan-bel.md              Jam bel per hari, mode Apel, impor Excel
│
├── 07-modul-siswa-orang-tua.md        Panduan untuk Siswa & Orang Tua
├── 08-lampiran.md                     FAQ, istilah, pemecahan masalah
│
├── PANDUAN-MENYUSUN-DOKUMEN-WORD.md   Cara dokumen Word final disusun & dibangun ulang
│
├── gambar/                            Pustaka tangkapan layar (dirujuk oleh Markdown)
│   ├── umum/                          Login, lupa password, tampilan mobile
│   ├── guru/                          Layar peran Guru
│   ├── wali_kelas/                    Layar peran Wali Kelas
│   ├── bk/                            Layar peran Guru BK
│   ├── admin/                         Layar peran Admin
│   │   └── tab/                       20 tab Panel Admin
│   ├── wakasek/                       Layar peran Wakasek Kurikulum
│   └── siswa/                         Layar peran Siswa
│
├── skrip/                             Generator keluaran (Node.js)
│   ├── md.mjs                         Pengurai Markdown (subset)
│   ├── build-docx.mjs                 Markdown → Word (.docx)
│   └── build-pptx.mjs                 → 4 berkas PowerPoint paparan
│
└── keluaran/                          Hasil akhir siap dibagikan
    ├── Panduan-Pengguna-Agenda-Pembelajaran.docx
    ├── Paparan-Guru.pptx
    ├── Paparan-Wali-Kelas.pptx
    ├── Paparan-BK.pptx
    └── Paparan-Admin.pptx
```

---

## Peta Peran → Dokumen

| Peran | Wajib dibaca | Opsional |
|---|---|---|
| Guru Mata Pelajaran | 00, 01, 02, 03-modul-guru/* | 08 |
| Wali Kelas | 00, 01, 02, 03-modul-guru/*, 04-modul-wali-kelas/* | 08 |
| Guru BK | 00, 01, 02, 05-modul-bk/* | 08 |
| Admin / Wakasek | 00, 01, 02, 06-modul-admin/* | seluruh modul |
| Siswa & Orang Tua | 00, 01, 07 | — |

Wali Kelas dan Guru BK adalah **kapabilitas tambahan** di atas peran Guru, bukan peran
terpisah. Seorang guru dapat sekaligus menjadi wali kelas dan guru BK; menu keduanya
akan muncul bersamaan.

---

## Cara Membangun Ulang Keluaran

Semua tangkapan layar diambil dari basis data demo berisi **data fiktif**, bukan data
siswa sebenarnya, agar dokumen aman dibagikan sesuai UU Pelindungan Data Pribadi
No. 27/2022.

```bash
cd "manual guide/skrip"
npm install          # sekali saja: memasang docx & pptxgenjs
node build-docx.mjs  # → keluaran/Panduan-Pengguna-Agenda-Pembelajaran.docx
node build-pptx.mjs  # → keluaran/Paparan-*.pptx
```

Rincian teknis penyusunan dokumen Word ada di `PANDUAN-MENYUSUN-DOKUMEN-WORD.md`.
