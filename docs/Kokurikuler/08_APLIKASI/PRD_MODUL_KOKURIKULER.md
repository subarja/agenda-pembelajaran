# PRD — MODUL KOKURIKULER
### Integrasi ke Aplikasi Agenda SMK Negeri 2 Cimahi

| | |
|---|---|
| **Versi** | 1.0 |
| **Tanggal** | 14 Juli 2026 |
| **Pemilik produk** | Koordinator Kokurikuler SMKN 2 Cimahi |
| **Status** | Siap dibangun |
| **Stack target** | PHP (Laravel / CodeIgniter / native) + MySQL 5.7+ / MariaDB 10.3+ |
| **Bentuk** | **Modul di dalam aplikasi Agenda yang sudah ada** (bukan aplikasi terpisah) |

> **Cara memakai dokumen ini.** Dokumen ditulis agar bisa diserahkan langsung ke AI coding assistant (Claude / Gemini) maupun ke developer manusia. Bagian **§3 Asumsi Aplikasi Eksisting** WAJIB diisi/dikoreksi dulu sesuai keadaan aplikasi Anda — sisanya sudah presisi. Prompt siap pakai ada di **§18**.

---

## 1. LATAR BELAKANG & MASALAH

Sekolah menjalankan kegiatan kokurikuler (projek) untuk kelas XI — 16 kelas paralel, ±576 murid, 96 tim. Saat ini seluruh pencatatan tersebar:

| Sekarang | Masalahnya |
|---|---|
| Google Form untuk survei | Data terpisah, harus diunduh manual |
| Google Spreadsheet per tim (96 file) | Admin harus buka 96 file untuk rekap |
| Penilaian di Excel per kelas (16 file) | Rekap sekolah = gabung manual 16 file |
| Jurnal refleksi di buku tulis | Tidak terekap sama sekali |
| Data siswa & kelas | Sudah ada di aplikasi Agenda, tapi diketik ulang di spreadsheet |

**Akibatnya:** rekap lambat, rawan salah ketik, dan deskripsi rapor kokurikuler disusun manual satu per satu.

## 2. TUJUAN & UKURAN KEBERHASILAN

**Tujuan produk:** satu tempat untuk merancang projek kokurikuler, mencatat pekerjaan murid setiap hari, menilai berdasarkan Dimensi Profil Lulusan, dan merekapnya otomatis — memakai data guru/siswa/kelas yang **sudah ada** di Agenda.

| Sasaran | Ukuran keberhasilan |
|---|---|
| Hapus Google Form & Spreadsheet | 0 file eksternal dipakai selama kegiatan |
| Rekap admin instan | Rekap 16 kelas tampil < 3 detik, tanpa gabung manual |
| Deskripsi rapor otomatis | ≥ 95% deskripsi tergenerate, guru hanya merapikan |
| Beban guru turun | Fasilitator cukup ≤ 10 menit/hari untuk menilai satu kelas |
| Dipakai ulang | Projek kokurikuler berikutnya dibuat **tanpa ganti kode** |

**Prinsip rancangan yang mengikat seluruh dokumen:**

1. **GENERIK, BUKAN HARDCODE.** Tema, judul, tujuan, dimensi, aktivitas harian, dan **isi lembar kerja** semuanya data — bukan kode. Projek berikutnya cukup dibuat lewat menu admin.
2. **JANGAN DUPLIKASI DATA.** Siswa, kelas, guru, login diambil dari tabel Agenda yang sudah ada. Modul ini **tidak punya tabel siswa sendiri**.
3. **MOBILE-FIRST.** Murid mengisi lewat HP, sering dengan sinyal jelek dan di luar ruangan.
4. **PRIVASI SURVEI MUTLAK.** Ada survei anonim yang menanyakan rasa tidak aman. Sistem harus **secara teknis tidak mampu** menghubungkan jawaban ke nama murid.

## 3. ASUMSI APLIKASI EKSISTING — **KOREKSI BAGIAN INI DULU**

Modul memakai tabel Agenda lewat **satu lapis adaptor**, supaya perbedaan nama kolom tidak menyebar ke seluruh kode.

### 3.1 Tabel yang diasumsikan sudah ada

```
users     (id, name, email, password, role, ...)
guru      (id, user_id, nip, nama, ...)
siswa     (id, user_id, nis, nama, kelas_id, ...)
kelas     (id, nama, tingkat, jurusan, wali_kelas_id, tahun_ajaran, ...)
```

### 3.2 Berkas konfigurasi adaptor (WAJIB dibuat)

`config/kokurikuler.php` — developer/AI mengubah **hanya berkas ini** kalau nama tabel/kolom di Agenda berbeda:

```php
return [
    'tabel' => [
        'users' => 'users',
        'guru'  => 'guru',
        'siswa' => 'siswa',
        'kelas' => 'kelas',
    ],
    'kolom' => [
        'siswa_id'        => 'id',
        'siswa_nama'      => 'nama',
        'siswa_nis'       => 'nis',
        'siswa_kelas_id'  => 'kelas_id',
        'siswa_user_id'   => 'user_id',
        'kelas_id'        => 'id',
        'kelas_nama'      => 'nama',
        'kelas_tingkat'   => 'tingkat',
        'kelas_wali_id'   => 'wali_kelas_id',   // merujuk ke guru.id ATAU users.id — tentukan di 'wali_merujuk_ke'
        'guru_id'         => 'id',
        'guru_nama'       => 'nama',
        'guru_user_id'    => 'user_id',
    ],
    'wali_merujuk_ke' => 'guru',   // 'guru' | 'users'
    'peran' => [
        // pemetaan nilai kolom users.role di Agenda -> peran modul
        'admin'       => ['admin', 'superadmin'],
        'koordinator' => ['kurikulum', 'wakasek'],
        'fasilitator' => ['guru'],
        'siswa'       => ['siswa'],
        'bk'          => ['bk'],
    ],
];
```

### 3.3 Aturan integrasi yang tidak boleh dilanggar

- **DILARANG** mengubah skema tabel Agenda yang sudah ada (tidak menambah kolom, tidak mengubah tipe).
- **DILARANG** membuat tabel siswa/kelas/guru baru.
- Semua tabel modul memakai awalan **`kk_`**.
- Relasi ke Agenda memakai kolom `*_id` **tanpa FOREIGN KEY lintas modul** (agar aman kalau engine/tabel Agenda berbeda). Integritas dijaga di lapisan aplikasi.
- Autentikasi memakai session/guard Agenda yang sudah ada. **Tidak membuat sistem login baru.**

---

## 4. PERAN & HAK AKSES

| Peran | Siapa | Bisa apa |
|---|---|---|
| **Admin** | Operator/IT | Semua. Kelola master dimensi, projek, impor/ekspor, kelola pengguna modul. |
| **Koordinator** | Wakasek Kurikulum / Koordinator Kokurikuler | Buat & atur projek, aktivitas, rubrik, tetapkan fasilitator per kelas, lihat rekap SEMUA kelas, ekspor. **Tidak bisa** hapus master dimensi. |
| **Fasilitator** | Wali kelas | Hanya **kelas yang ditugaskan kepadanya**. Kelola tim & peran anggota, lihat isian tim, beri nilai harian, catatan anekdotal, finalisasi nilai + deskripsi rapor. |
| **Siswa** | Murid | Hanya **projek & tim miliknya**. Mengisi lembar kerja tim, refleksi harian pribadi, mengunggah foto, mengisi survei anonim. Melihat nilainya sendiri **hanya jika koordinator mengizinkan** (flag per projek). |
| **BK** | Guru BK | **Hanya** melihat daftar permintaan bicara dari survei. Tidak melihat isian tim, tidak melihat nilai. |
| **Kepala Sekolah / Pengawas** | — | Baca-saja: dashboard & rekap seluruh kelas. Tidak bisa mengubah apa pun. |

**Matriks otorisasi (ringkas):**

| Aksi | Admin | Koord | Fasil | Siswa | BK | Kepsek |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| CRUD master dimensi | ✔ | – | – | – | – | – |
| CRUD projek & aktivitas | ✔ | ✔ | – | – | – | – |
| Tetapkan fasilitator/kelas | ✔ | ✔ | – | – | – | – |
| CRUD tim & peran anggota | ✔ | ✔ | ✔ (kelasnya) | – | – | – |
| Isi lembar kerja tim | – | – | – | ✔ (timnya) | – | – |
| Isi refleksi pribadi | – | – | – | ✔ (dirinya) | – | – |
| Nilai harian & akhir | ✔ | ✔ | ✔ (kelasnya) | – | – | – |
| Lihat rekap semua kelas | ✔ | ✔ | – | – | – | ✔ |
| Lihat isian tim kelas lain | ✔ | ✔ | – | – | – | ✔ |
| Lihat permintaan BK | – | – | – | – | ✔ | – |
| Ekspor Excel/PDF | ✔ | ✔ | ✔ (kelasnya) | – | – | ✔ |

> **Aturan keras:** fasilitator **tidak boleh** melihat isian/nilai kelas lain. Setiap query wajib disaring `kelas_id IN (kelas yang ditugaskan)`. Ini diuji di acceptance test.

---

## 5. MODEL DATA — DDL MySQL

Seluruh tabel: `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.

### 5.1 Master Dimensi (diisi sekali, dipakai semua projek)

```sql
CREATE TABLE kk_dimensi (
  id            TINYINT UNSIGNED PRIMARY KEY,
  kode          VARCHAR(40)  NOT NULL UNIQUE,
  nama          VARCHAR(80)  NOT NULL,
  deskripsi     TEXT         NOT NULL COMMENT 'kutipan Panduan Kokurikuler 2025',
  urutan        TINYINT      NOT NULL DEFAULT 0,
  aktif         TINYINT(1)   NOT NULL DEFAULT 1
);

CREATE TABLE kk_subdimensi (
  id            SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dimensi_id    TINYINT UNSIGNED NOT NULL,
  nama          VARCHAR(160) NOT NULL,
  urutan        TINYINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_subdim_dim FOREIGN KEY (dimensi_id) REFERENCES kk_dimensi(id) ON DELETE CASCADE,
  INDEX ix_subdim_dim (dimensi_id)
);
```

**Seeder wajib — 8 Dimensi Profil Lulusan (Permendikdasmen No. 10/2025, deskripsi dari Panduan Kokurikuler 2025 hlm. 3–4):**

| id | kode | nama |
|---|---|---|
| 1 | keimanan_ketakwaan | keimanan dan ketakwaan terhadap Tuhan Yang Maha Esa |
| 2 | kewargaan | kewargaan |
| 3 | penalaran_kritis | penalaran kritis |
| 4 | kreativitas | kreativitas |
| 5 | kolaborasi | kolaborasi |
| 6 | kemandirian | kemandirian |
| 7 | kesehatan | kesehatan |
| 8 | komunikasi | komunikasi |

Sub-dimensi seeder (diturunkan dari kalimat deskripsi panduan — panduan tidak memuat daftar baku, jadi kolom ini **boleh diedit admin**):

- **kreativitas** → Berperilaku produktif · Menciptakan inovasi · Merumuskan solusi bagi permasalahan di sekitarnya
- **kolaborasi** → Peduli dan berbagi · Membangun kerja sama dengan berbagai kalangan di lingkungan sekitar
- **kesehatan** → Hidup bersih dan sehat · Kebugaran, kesehatan fisik, dan kesehatan mental · Berkontribusi secara positif terhadap lingkungan
- **penalaran kritis** → Rasa ingin tahu · Berpikir logis dan analitis · Menganalisis dan menyelesaikan permasalahan · Berargumentasi logis · Memanfaatkan literasi dan numerasi untuk memecahkan masalah
- **komunikasi** → Menyimak · Membaca · Berbicara · Menulis dengan baik dan benar sesuai etika
- **kemandirian** → Bertanggung jawab · Berinisiatif · Beradaptasi dalam pembelajaran dan pengembangan diri
- **kewargaan** → Bangga akan identitas dan budaya · Menghargai keberagaman · Menjaga persatuan bangsa · Menaati aturan bernegara dan bermasyarakat · Menjaga keberlanjutan kehidupan dan lingkungan
- **keimanan dan ketakwaan** → Keyakinan dan pengamalan ajaran agama/kepercayaan · Akhlak mulia · Hubungan dengan Tuhan YME, sesama manusia, dan lingkungan

### 5.2 Projek

```sql
CREATE TABLE kk_projek (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tahun_ajaran    VARCHAR(12)  NOT NULL,          -- '2026/2027'
  semester        ENUM('ganjil','genap') NOT NULL,
  tingkat         TINYINT      NOT NULL,          -- 10 | 11 | 12
  tema            VARCHAR(200) NOT NULL,
  judul           VARCHAR(200) NOT NULL,
  tujuan_akhir    TEXT         NOT NULL,          -- kalimat "tujuan akhir kegiatan"
  deskripsi       TEXT         NULL,
  tanggal_mulai   DATE         NOT NULL,
  tanggal_selesai DATE         NOT NULL,
  total_jp        SMALLINT     NULL,
  sampul_path     VARCHAR(255) NULL,
  siswa_lihat_nilai TINYINT(1) NOT NULL DEFAULT 0,
  status          ENUM('draft','aktif','terkunci','selesai') NOT NULL DEFAULT 'draft',
  dibuat_oleh     INT UNSIGNED NOT NULL,          -- users.id
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX ix_projek_ta (tahun_ajaran, semester, tingkat, status)
);
```

> **`status`:** `draft` = belum terlihat murid · `aktif` = berjalan, murid bisa mengisi · `terkunci` = isian ditutup, nilai masih bisa diubah · `selesai` = read-only total.

### 5.3 Dimensi yang dinilai pada projek + rubrik

```sql
CREATE TABLE kk_projek_dimensi (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projek_id     INT UNSIGNED NOT NULL,
  dimensi_id    TINYINT UNSIGNED NOT NULL,
  aspek_dinilai VARCHAR(255) NOT NULL COMMENT 'kalimat "Aspek yang Dinilai" pada rubrik',
  urutan        TINYINT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_projek_dim (projek_id, dimensi_id),
  INDEX ix_pd_projek (projek_id),
  CONSTRAINT fk_pd_projek FOREIGN KEY (projek_id) REFERENCES kk_projek(id) ON DELETE CASCADE,
  CONSTRAINT fk_pd_dim    FOREIGN KEY (dimensi_id) REFERENCES kk_dimensi(id)
);

-- sub-dimensi yang diamati (PANDUAN MENGAMATI, bukan kolom nilai terpisah)
CREATE TABLE kk_projek_subdimensi (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projek_dimensi_id INT UNSIGNED NOT NULL,
  subdimensi_id     SMALLINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_ps (projek_dimensi_id, subdimensi_id),
  CONSTRAINT fk_ps_pd  FOREIGN KEY (projek_dimensi_id) REFERENCES kk_projek_dimensi(id) ON DELETE CASCADE,
  CONSTRAINT fk_ps_sub FOREIGN KEY (subdimensi_id) REFERENCES kk_subdimensi(id)
);

-- 4 baris per dimensi: SB, B, C, K
CREATE TABLE kk_rubrik (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projek_dimensi_id INT UNSIGNED NOT NULL,
  level             ENUM('SB','B','C','K') NOT NULL,
  deskriptor        TEXT NOT NULL,
  UNIQUE KEY uq_rubrik (projek_dimensi_id, level),
  CONSTRAINT fk_rub_pd FOREIGN KEY (projek_dimensi_id) REFERENCES kk_projek_dimensi(id) ON DELETE CASCADE
);
```

> **Aturan bisnis penting:** jumlah dimensi yang dinilai **dibatasi maksimal 4** (peringatan di UI bila > 3). Nilai diberikan **per DIMENSI**, bukan per sub-dimensi. Sub-dimensi hanya ditampilkan sebagai bantuan mengamati di layar penilaian.

### 5.4 Penugasan kelas & fasilitator

```sql
CREATE TABLE kk_projek_kelas (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projek_id     INT UNSIGNED NOT NULL,
  kelas_id      INT UNSIGNED NOT NULL,          -- kelas.id (Agenda)
  fasilitator_user_id INT UNSIGNED NOT NULL,    -- users.id (Agenda)
  sektor        VARCHAR(120) NULL,              -- area/zona kelas ini
  gelombang     VARCHAR(20)  NULL,              -- 'BIRU' | 'JINGGA' | dst
  UNIQUE KEY uq_pk (projek_id, kelas_id),
  INDEX ix_pk_fasil (fasilitator_user_id),
  CONSTRAINT fk_pk_projek FOREIGN KEY (projek_id) REFERENCES kk_projek(id) ON DELETE CASCADE
);
```

> Saat kelas ditambahkan, sistem **otomatis** mengambil seluruh siswa dengan `siswa.kelas_id = kelas_id` — tidak ada input manual anggota. Fasilitator default = `kelas.wali_kelas_id`, boleh diganti koordinator.

### 5.5 Tim & anggota

```sql
CREATE TABLE kk_tim (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projek_id   INT UNSIGNED NOT NULL,
  kelas_id    INT UNSIGNED NOT NULL,
  nomor       TINYINT NOT NULL,               -- 1..6
  nama        VARCHAR(120) NULL,
  warna       VARCHAR(7) NULL,                -- '#E5484D'
  zona        VARCHAR(120) NULL,              -- zona aksi yang dipilih tim
  UNIQUE KEY uq_tim (projek_id, kelas_id, nomor),
  INDEX ix_tim_kelas (projek_id, kelas_id),
  CONSTRAINT fk_tim_projek FOREIGN KEY (projek_id) REFERENCES kk_projek(id) ON DELETE CASCADE
);

CREATE TABLE kk_tim_anggota (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tim_id    INT UNSIGNED NOT NULL,
  siswa_id  INT UNSIGNED NOT NULL,            -- siswa.id (Agenda)
  peran     ENUM('kapten','waktu','piket_data','k3','dokumentasi','logistik','anggota')
            NOT NULL DEFAULT 'anggota',
  UNIQUE KEY uq_anggota (tim_id, siswa_id),
  INDEX ix_anggota_siswa (siswa_id),
  CONSTRAINT fk_ta_tim FOREIGN KEY (tim_id) REFERENCES kk_tim(id) ON DELETE CASCADE
);
```

> **Validasi:** satu siswa hanya boleh berada di **satu tim** per projek (cek lintas tim dalam projek yang sama). Fitur **"Bagi otomatis"**: acak siswa kelas ke N tim seimbang, sekali klik.

### 5.6 Aktivitas harian & lembar kerja dinamis (INTI SISTEM)

```sql
CREATE TABLE kk_aktivitas (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projek_id     INT UNSIGNED NOT NULL,
  hari_ke       TINYINT NOT NULL,             -- 1..n
  tanggal       DATE NULL,
  kode          VARCHAR(40) NOT NULL,         -- 'H2_DATA_LAPANGAN'
  judul         VARCHAR(160) NOT NULL,
  instruksi     TEXT NULL,                    -- markdown, ditampilkan ke murid
  durasi_menit  SMALLINT NULL,
  tipe          ENUM('tim','individu','anonim') NOT NULL DEFAULT 'tim',
  wajib         TINYINT(1) NOT NULL DEFAULT 1,
  buka_pada     DATETIME NULL,                -- sebelum ini, murid tidak bisa mengisi
  tutup_pada    DATETIME NULL,
  urutan        SMALLINT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_akt (projek_id, kode),
  INDEX ix_akt_projek (projek_id, hari_ke, urutan),
  CONSTRAINT fk_akt_projek FOREIGN KEY (projek_id) REFERENCES kk_projek(id) ON DELETE CASCADE
);

CREATE TABLE kk_field (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  aktivitas_id  INT UNSIGNED NOT NULL,
  kode          VARCHAR(60) NOT NULL,
  label         VARCHAR(255) NOT NULL,
  bantuan       VARCHAR(255) NULL,            -- teks kecil di bawah field
  tipe          ENUM('teks','teks_panjang','angka','pilihan','pilihan_ganda',
                     'skala','tanggal','waktu','foto','tabel','kutipan') NOT NULL,
  opsi          JSON NULL,                    -- pilihan: ["a","b"] | skala: {"min":1,"max":10}
                                              -- tabel: {"kolom":[{"kode":"objek","label":"Objek","tipe":"teks"}, ...],
                                              --         "min_baris":10}
  wajib         TINYINT(1) NOT NULL DEFAULT 0,
  min_nilai     DECIMAL(10,2) NULL,
  max_nilai     DECIMAL(10,2) NULL,
  maks_file     TINYINT NULL,                 -- untuk tipe 'foto'
  urutan        SMALLINT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_field (aktivitas_id, kode),
  INDEX ix_field_akt (aktivitas_id, urutan),
  CONSTRAINT fk_field_akt FOREIGN KEY (aktivitas_id) REFERENCES kk_aktivitas(id) ON DELETE CASCADE
);
```

> **Inilah yang membuat modul dipakai ulang tanpa ganti kode.** Lembar kerja bukan halaman PHP tersendiri — ia dirender dari `kk_field`. Projek berikutnya cukup membuat aktivitas + field baru lewat menu admin (form builder).

### 5.7 Isian murid (satu mekanisme untuk tim & individu)

```sql
CREATE TABLE kk_isian (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  aktivitas_id  INT UNSIGNED NOT NULL,
  tim_id        INT UNSIGNED NULL,            -- diisi bila aktivitas.tipe = 'tim'
  siswa_id      INT UNSIGNED NULL,            -- diisi bila aktivitas.tipe = 'individu'
  client_uuid   CHAR(36) NOT NULL,            -- idempotensi untuk sinkronisasi offline
  status        ENUM('draft','terkirim') NOT NULL DEFAULT 'draft',
  diisi_oleh    INT UNSIGNED NULL,            -- siswa.id yang terakhir menyimpan
  dikirim_pada  DATETIME NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_isian_tim   (aktivitas_id, tim_id),
  UNIQUE KEY uq_isian_siswa (aktivitas_id, siswa_id),
  UNIQUE KEY uq_client      (client_uuid),
  INDEX ix_isian_status (aktivitas_id, status),
  CONSTRAINT fk_isian_akt FOREIGN KEY (aktivitas_id) REFERENCES kk_aktivitas(id) ON DELETE CASCADE
);

CREATE TABLE kk_jawaban (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  isian_id    BIGINT UNSIGNED NOT NULL,
  field_id    INT UNSIGNED NOT NULL,
  baris       SMALLINT NOT NULL DEFAULT 0,    -- >0 untuk field tipe 'tabel'
  kolom       VARCHAR(60) NULL,               -- kode kolom, untuk field tipe 'tabel'
  nilai_teks  TEXT NULL,
  nilai_angka DECIMAL(14,4) NULL,             -- diisi paralel bila numerik -> memudahkan rekap/agregasi
  UNIQUE KEY uq_jawaban (isian_id, field_id, baris, kolom),
  INDEX ix_jwb_field (field_id),
  CONSTRAINT fk_jwb_isian FOREIGN KEY (isian_id) REFERENCES kk_isian(id) ON DELETE CASCADE,
  CONSTRAINT fk_jwb_field FOREIGN KEY (field_id) REFERENCES kk_field(id) ON DELETE CASCADE
);

CREATE TABLE kk_lampiran (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  isian_id     BIGINT UNSIGNED NOT NULL,
  field_id     INT UNSIGNED NOT NULL,
  path         VARCHAR(255) NOT NULL,
  path_thumb   VARCHAR(255) NULL,
  nama_asli    VARCHAR(180) NULL,
  mime         VARCHAR(60)  NOT NULL,
  ukuran_byte  INT UNSIGNED NOT NULL,
  keterangan   VARCHAR(255) NULL,             -- 'sebelum' / 'sesudah' / caption bebas
  diunggah_oleh INT UNSIGNED NULL,            -- siswa.id
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_lamp_isian (isian_id, field_id),
  CONSTRAINT fk_lamp_isian FOREIGN KEY (isian_id) REFERENCES kk_isian(id) ON DELETE CASCADE
);
```

### 5.8 Penilaian

```sql
-- Penilaian HARIAN per murid per dimensi (inti permintaan: "penilaian harian berdasarkan dimensi")
CREATE TABLE kk_nilai_harian (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projek_id         INT UNSIGNED NOT NULL,
  siswa_id          INT UNSIGNED NOT NULL,
  hari_ke           TINYINT NOT NULL,
  projek_dimensi_id INT UNSIGNED NOT NULL,
  level             ENUM('SB','B','C','K') NOT NULL,
  catatan           VARCHAR(255) NULL,
  dinilai_oleh      INT UNSIGNED NOT NULL,   -- users.id
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_nh (projek_id, siswa_id, hari_ke, projek_dimensi_id),
  INDEX ix_nh_rekap (projek_id, hari_ke),
  INDEX ix_nh_siswa (siswa_id, projek_id)
);

-- Nilai AKHIR per murid per dimensi (untuk rapor)
CREATE TABLE kk_nilai_akhir (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projek_id         INT UNSIGNED NOT NULL,
  siswa_id          INT UNSIGNED NOT NULL,
  projek_dimensi_id INT UNSIGNED NOT NULL,
  level             ENUM('SB','B','C','K') NOT NULL,
  sumber            ENUM('otomatis','manual') NOT NULL DEFAULT 'otomatis',
  dinilai_oleh      INT UNSIGNED NOT NULL,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_na (projek_id, siswa_id, projek_dimensi_id),
  INDEX ix_na_projek (projek_id)
);

-- Deskripsi rapor (kolom Kokurikuler)
CREATE TABLE kk_deskripsi_rapor (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projek_id     INT UNSIGNED NOT NULL,
  siswa_id      INT UNSIGNED NOT NULL,
  draf          TEXT NOT NULL,        -- hasil generate otomatis
  final         TEXT NULL,            -- setelah dirapikan guru
  catatan_guru  VARCHAR(500) NULL,    -- kalimat tambahan dari guru, ikut masuk ke draf
  dikunci       TINYINT(1) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_desk (projek_id, siswa_id)
);

-- Catatan anekdotal (formatif)
CREATE TABLE kk_anekdot (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projek_id   INT UNSIGNED NOT NULL,
  siswa_id    INT UNSIGNED NOT NULL,
  tanggal     DATE NOT NULL,
  perilaku    TEXT NOT NULL COMMENT 'FAKTA yang teramati, bukan tafsir',
  dimensi_id  TINYINT UNSIGNED NULL,
  dicatat_oleh INT UNSIGNED NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_anek (projek_id, siswa_id, tanggal)
);
```

**Aturan nilai akhir otomatis (modus, dengan tie-break ke arah yang lebih tinggi):**

```
Untuk tiap (siswa, dimensi):
  ambil semua kk_nilai_harian pada projek itu
  hitung frekuensi tiap level
  level_akhir = level dengan frekuensi TERBANYAK
  bila seri  -> ambil level TERTINGGI di antara yang seri (SB > B > C > K)
  bila tidak ada nilai harian sama sekali -> nilai_akhir kosong, guru wajib mengisi manual
Guru boleh MENIMPA hasil otomatis (sumber = 'manual'). Nilai manual tidak pernah tertimpa ulang.
```

**Generator deskripsi rapor:**

```
Template:
"Ananda {NAMA} menunjukkan capaian {L1} dalam {DIM1}, {L2} dalam {DIM2}, dan {L3} dalam {DIM3},
 pada kegiatan kokurikuler {JUDUL_PROJEK}. {CATATAN_GURU}"

Pemetaan level -> kata:
  SB = "sangat baik" | B = "baik" | C = "cukup" | K = "perlu bimbingan"

Aturan:
- Urutkan dimensi dari level TERTINGGI ke terendah (sebut yang baik lebih dulu — amanat Panduan).
- Kata "kurang"/"gagal" DILARANG muncul.
- Jumlah dimensi mengikuti kk_projek_dimensi (2, 3, atau 4) — kalimat menyesuaikan otomatis.
- Guru dapat menyunting hasilnya di kolom `final`; yang dipakai rapor = COALESCE(final, draf).
```

### 5.9 Survei anonim — **RANCANGAN PRIVASI**

> **Ini bagian paling sensitif.** Survei menanyakan rasa tidak aman & perundungan. Rancangan harus membuat sistem **secara teknis tidak mampu** menghubungkan jawaban ke nama murid — bukan sekadar "tidak menampilkan".

```sql
CREATE TABLE kk_survei (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  projek_id   INT UNSIGNED NOT NULL,
  judul       VARCHAR(160) NOT NULL,
  pengantar   TEXT NULL,
  buka_pada   DATETIME NULL,
  tutup_pada  DATETIME NULL,
  aktif       TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE kk_survei_pertanyaan (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  survei_id   INT UNSIGNED NOT NULL,
  label       VARCHAR(255) NOT NULL,
  tipe        ENUM('teks_panjang','pilihan','skala','centang') NOT NULL,
  opsi        JSON NULL,
  wajib       TINYINT(1) NOT NULL DEFAULT 0,
  sensitif    TINYINT(1) NOT NULL DEFAULT 0,  -- 1 = hanya BK yang boleh melihat
  urutan      SMALLINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_sp_survei FOREIGN KEY (survei_id) REFERENCES kk_survei(id) ON DELETE CASCADE
);

-- RESPON: TIDAK ADA siswa_id. TIDAK ADA user_id. TIDAK ADA IP address.
CREATE TABLE kk_survei_respon (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  survei_id   INT UNSIGNED NOT NULL,
  kelas_id    INT UNSIGNED NOT NULL,   -- satu-satunya penanda, agar rekap bisa dipisah per kelas
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_respon (survei_id, kelas_id)
);

CREATE TABLE kk_survei_jawaban (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  respon_id     BIGINT UNSIGNED NOT NULL,
  pertanyaan_id INT UNSIGNED NOT NULL,
  nilai_teks    TEXT NULL,
  nilai_angka   DECIMAL(6,2) NULL,
  CONSTRAINT fk_sj_respon FOREIGN KEY (respon_id) REFERENCES kk_survei_respon(id) ON DELETE CASCADE
);

-- Tabel TERPISAH: mencatat siapa SUDAH mengisi, tanpa tahu APA yang diisi.
CREATE TABLE kk_survei_partisipasi (
  survei_id   INT UNSIGNED NOT NULL,
  siswa_id    INT UNSIGNED NOT NULL,
  diisi_pada  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (survei_id, siswa_id)
);
```

**Aturan implementasi survei (WAJIB, akan diuji):**

1. Saat murid submit: sistem membuat 1 baris `kk_survei_respon` (+ jawaban) **dan** 1 baris `kk_survei_partisipasi`, di dalam **satu transaksi**, tetapi **tanpa menyimpan id respon di tabel partisipasi**. Tidak ada kolom penghubung.
2. `kk_survei_respon` **tidak boleh** memiliki `created_at` beresolusi detik yang bisa dikorelasikan dengan `kk_survei_partisipasi.diisi_pada` → **bulatkan `created_at` ke jam terdekat** sebelum disimpan.
3. **Tabel respon tidak boleh diurutkan/ditampilkan berdampingan dengan tabel partisipasi** di kode mana pun. Tambahkan komentar pada model.
4. Pertanyaan `sensitif = 1` (mis. "Saya ingin bicara dengan Guru BK") **hanya** boleh muncul di layar peran **BK**. Query untuk peran lain wajib `WHERE p.sensitif = 0`.
5. Nama pada survei bersifat **opsional dan sukarela**, disimpan sebagai jawaban teks biasa di pertanyaan sensitif — bukan kolom identitas.
6. Rekap yang ditayangkan ke kelas hanya boleh menampilkan agregat/daftar jawaban **tanpa nama**, disaring `kelas_id` = kelas itu.

---

## 6. FITUR & ALUR PER PERAN

### 6.1 Admin / Koordinator — Menyiapkan Projek

**Menu: Kokurikuler → Projek → Buat Projek**

Wizard 5 langkah:

| Langkah | Isi | Catatan |
|---|---|---|
| **1. Identitas** | tahun ajaran, semester, tingkat, **tema**, **judul**, **tujuan akhir**, tanggal mulai–selesai, total JP, sampul | Persis kolom yang diminta: Tema → Judul → Tujuan Akhir |
| **2. Dimensi Profil Lulusan** | pilih dari 8 dimensi. Untuk tiap dimensi: centang **sub-dimensi** yang diamati + tulis **Aspek yang Dinilai** + isi **4 deskriptor rubrik** (SB/B/C/K) | UI memberi **peringatan bila memilih > 3 dimensi**: "Panduan Kokurikuler mencontohkan 2 dimensi. Semakin banyak dimensi, semakin rendah mutu penilaian." Maks. keras: 4 |
| **3. Kelas & Fasilitator** | pilih kelas (multi). Fasilitator terisi otomatis dari wali kelas, boleh diganti. Isi sektor & gelombang | Siswa **otomatis** ikut dari data Agenda |
| **4. Aktivitas Harian** | untuk tiap hari: tambah aktivitas (judul, instruksi, durasi, tipe tim/individu/anonim, jadwal buka–tutup) | |
| **5. Lembar Kerja** | **Form Builder**: untuk tiap aktivitas, susun field (tarik-lepas) | Lihat §6.2 |

Tombol **"Duplikat dari projek lain"** — menyalin seluruh dimensi, rubrik, aktivitas, dan field dari projek sebelumnya. **Ini kunci agar projek ke-2, ke-3 dst. selesai dalam hitungan menit.**

### 6.2 Form Builder (dipakai Koordinator)

Tipe field yang WAJIB didukung:

| Tipe | Untuk apa | Konfigurasi |
|---|---|---|
| `teks` | jawaban pendek | — |
| `teks_panjang` | uraian, refleksi | — |
| `angka` | data hasil pengukuran | min, max, satuan |
| `pilihan` | satu pilihan | daftar opsi |
| `pilihan_ganda` | banyak pilihan | daftar opsi |
| `skala` | skor diri 1–10, aman 1–5 | min, max, label ujung |
| `tanggal`, `waktu` | — | — |
| `foto` | bukti before/after | maks. file, keterangan wajib/tidak |
| `kutipan` | kutipan wawancara persis | — |
| **`tabel`** | **data lapangan berulang** (10 baris angka, dst.) | definisi kolom + **minimal baris** |

Contoh konfigurasi field tipe `tabel` (JSON di `kk_field.opsi`):

```json
{
  "min_baris": 10,
  "kolom": [
    {"kode":"objek",   "label":"Objek yang diukur", "tipe":"teks",  "wajib":true},
    {"kode":"lokasi",  "label":"Lokasi persis",     "tipe":"teks",  "wajib":true},
    {"kode":"angka",   "label":"ANGKA",             "tipe":"angka", "wajib":true},
    {"kode":"satuan",  "label":"Satuan",            "tipe":"teks",  "wajib":true},
    {"kode":"waktu",   "label":"Waktu ukur",        "tipe":"waktu", "wajib":false}
  ]
}
```

### 6.3 Siswa — Mengisi (mobile)

**Menu: Kokurikuler** (muncul otomatis kalau kelasnya terdaftar di projek aktif)

```
[Beranda Kokurikuler]
 ├─ Kartu projek: judul, tema, hari ke-berapa
 ├─ TIM SAYA: nomor tim, zona, daftar anggota + peran saya
 ├─ HARI INI (daftar aktivitas):
 │    ○ Belum diisi      → tombol "Isi"
 │    ◐ Draft tersimpan  → tombol "Lanjutkan"
 │    ● Terkirim         → tombol "Lihat / Ubah" (bila belum tutup)
 └─ REFLEKSI SAYA (individu) → wajib tiap hari
```

**Layar isian:**
- Judul aktivitas + instruksi (markdown) di atas, bisa dilipat.
- Field dirender dari `kk_field`, satu per satu, besar-besar (mobile).
- **Autosave tiap 5 detik** ke `localStorage` + kirim ke server bila online (`status='draft'`).
- Indikator jelas: **"Tersimpan di HP"** (offline) vs **"Tersimpan di server"** (online).
- Tombol **KIRIM** hanya aktif bila seluruh field `wajib` terisi & `min_baris` terpenuhi.
- Setelah terkirim, isian **masih bisa diubah** sampai `tutup_pada` — perubahan tercatat di `updated_at`.

**Aturan tim vs individu:**
- Aktivitas `tipe='tim'` → **satu isian per tim**. Siapa pun anggota tim boleh mengisi/mengubah. Sistem mencatat `diisi_oleh`. Bila dua anggota membuka bersamaan → **peringatan konflik** dan opsi "muat ulang isian terbaru" (last-write-wins + banner).
- Aktivitas `tipe='individu'` → **satu isian per siswa** (refleksi harian). Tidak terlihat oleh anggota tim lain; hanya siswa itu + fasilitatornya.
- Aktivitas `tipe='anonim'` → mengarah ke modul survei (§5.9). Tidak menyimpan siswa_id.

### 6.4 Fasilitator — Memantau & Menilai

**Menu: Kokurikuler → Kelas Saya**

```
[Dasbor Kelas]
 ├─ Papan keterisian: matriks 6 tim x aktivitas hari ini
 │     hijau = terkirim | kuning = draft | merah = belum
 ├─ Papan refleksi: 36 murid, siapa sudah menulis refleksi hari ini
 ├─ Tombol: LIHAT ISIAN TIM (baca semua jawaban + foto)
 ├─ Tombol: NILAI HARI INI
 └─ Tombol: CATATAN ANEKDOTAL (+)
```

**Layar "NILAI HARI INI" — dioptimalkan untuk cepat:**

- Tabel: **baris = 36 murid**, **kolom = dimensi yang dinilai** (2–4 kolom saja).
- Tiap sel = 4 tombol pilihan cepat: `SB` `B` `C` `K` (tap, bukan dropdown).
- Di atas tabel: **panel bantuan mengamati** yang menampilkan **sub-dimensi** + deskriptor rubrik dimensi yang sedang dinilai (bisa dilipat).
- Fitur **"Samakan satu kolom"**: set semua murid ke level tertentu sekaligus, lalu ubah yang berbeda. Ini yang membuat penilaian 36 murid selesai < 10 menit.
- Autosave per sel (AJAX), tidak ada tombol simpan besar.
- Nilai harian **boleh kosong** — tidak semua dimensi teramati tiap hari.

**Layar "NILAI AKHIR & RAPOR":**
- Tombol **"Hitung dari nilai harian"** → mengisi `kk_nilai_akhir` dengan aturan modus (§5.8).
- Guru boleh menimpa tiap sel.
- Tombol **"Susun deskripsi rapor"** → mengisi `kk_deskripsi_rapor.draf` untuk 36 murid sekaligus.
- Kolom **Catatan Guru** (opsional) → ikut disisipkan ke deskripsi.
- Guru menyunting `final`, lalu **Kunci**.

### 6.5 Admin — Rekap

**Menu: Kokurikuler → Rekap**

| Laporan | Isi |
|---|---|
| **Keterisian** | Matriks 16 kelas × hari. % tim yang sudah mengirim, % murid yang sudah refleksi. Klik → daftar tim/murid yang belum. |
| **Distribusi nilai** | Per kelas & sekolah: jumlah SB/B/C/K per dimensi. Grafik batang. |
| **Rekap nilai** | Tabel semua murid × dimensi (nilai akhir) + kolom deskripsi. Filter kelas/jurusan. |
| **Rekap survei** | Agregat per kelas & sekolah. **Tanpa nama.** Pertanyaan sensitif TIDAK muncul di sini. |
| **Galeri karya** | Semua foto before/after per tim, per zona. |
| **Ekspor** | Excel (.xlsx) per kelas & gabungan · PDF daftar deskripsi rapor per kelas · CSV untuk impor ke aplikasi rapor |

**Menu: Kokurikuler → Permintaan BK** *(hanya peran BK)*
- Daftar respon yang mencentang "ingin bicara dengan Guru BK", menampilkan **kelas** + nama **bila murid sukarela menuliskannya**.
- Tidak ada tombol "lihat jawaban lain dari orang ini" — secara teknis memang tidak bisa.

---

## 7. UNGGAH FOTO

| Aspek | Ketentuan |
|---|---|
| Format diterima | JPG, PNG, HEIC (konversi ke JPG di server) |
| **Kompresi di sisi klien** | **WAJIB.** Sebelum diunggah, gambar diperkecil di browser sampai sisi terpanjang **1600 px**, kualitas JPEG **0.8**. Gunakan `<canvas>` / `browser-image-compression`. Tanpa ini, foto HP 4 MB × ribuan = server penuh. |
| Ukuran maks. setelah kompresi | 800 KB per file (tolak bila lebih) |
| Maks. file per field | dari `kk_field.maks_file` (default 5) |
| Thumbnail | Server membuat thumb 400 px untuk galeri & daftar |
| Penyimpanan | `storage/kokurikuler/{projek_id}/{kelas_id}/{tim_id}/{uuid}.jpg` — **di luar** document root, disajikan lewat controller yang memeriksa hak akses |
| Nama file | UUID, **bukan** nama asli (cegah path traversal & bocor identitas) |
| Validasi | Cek MIME **sungguhan** (`finfo`), bukan ekstensi. Tolak file yang bukan gambar. |
| EXIF | **Buang seluruh EXIF**, termasuk GPS. (Foto murid tidak boleh menyimpan koordinat lokasi.) |

**Perkiraan kebutuhan storage (Sakola Waluya):**

```
96 tim × 5 hari × 5 foto × 0,5 MB  ≈  1,2 GB per projek
+ thumbnail (±10%)                  ≈  0,12 GB
TOTAL                               ≈  1,4 GB per projek
```

> **Peringatan untuk shared hosting:** cek kuota disk sebelum rilis. Bila kuota < 5 GB, aktifkan opsi **"Arsipkan foto projek selesai"** — pindahkan ke Google Drive/penyimpanan lain, sisakan thumbnail + tautan.

## 8. MODE OFFLINE (SINYAL JELEK)

Kegiatan berlangsung **di lapangan**. Sinyal buruk adalah keadaan normal, bukan pengecualian.

**Strategi: draft lokal + antrean sinkronisasi (bukan PWA penuh).**

1. **Autosave lokal.** Setiap perubahan field disimpan ke `localStorage` dengan kunci
   `kk_draft_{aktivitas_id}_{tim_id|siswa_id}`, berisi `{client_uuid, jawaban:{...}, updated_at}`.
2. **client_uuid.** Dibuat di browser saat isian pertama kali dibuka (UUID v4), disimpan bersama draft. Dipakai server untuk **idempotensi** — kirim ulang berkali-kali tidak menghasilkan baris ganda (`UNIQUE(client_uuid)` → `INSERT ... ON DUPLICATE KEY UPDATE`).
3. **Indikator status** yang selalu terlihat di layar:
   - 🟡 *Tersimpan di HP — belum terkirim*
   - 🟢 *Tersimpan di server*
   - 🔴 *Gagal kirim — akan dicoba lagi*
4. **Antrean.** Bila `navigator.onLine === false` atau request gagal, isian masuk antrean di `localStorage`. Saat `online` kembali (event listener) atau tiap 30 detik, antrean dikirim ulang otomatis.
5. **Foto offline.** Foto disimpan sebagai Blob di **IndexedDB** (bukan localStorage — batas 5 MB terlalu kecil), diunggah saat online.
6. **Penyelesaian konflik:** *last-write-wins* berdasarkan `updated_at` klien. Bila server punya versi lebih baru, tampilkan banner: *"Anggota tim lain sudah memperbarui isian ini. [Muat versi terbaru] / [Timpa dengan punya saya]"*.
7. **Tanpa Service Worker pun tetap jalan.** Service Worker (agar halaman bisa dibuka saat offline) adalah **peningkatan opsional** di fase berikutnya, bukan syarat rilis.

## 9. KONTRAK API (JSON, dipakai front-end)

Semua endpoint di bawah `/api/kokurikuler`, autentikasi memakai session Agenda + CSRF token. Balasan seragam:

```json
{ "sukses": true, "data": {...}, "pesan": null }
{ "sukses": false, "data": null, "pesan": "Anda tidak berhak mengakses kelas ini.", "kode": "AKSES_DITOLAK" }
```

| Method | Endpoint | Peran | Keterangan |
|---|---|---|---|
| GET | `/projek/aktif` | semua | Projek aktif untuk pengguna ini |
| GET | `/projek/{id}` | semua | Detail projek + dimensi + rubrik |
| POST | `/projek` | koord | Buat projek |
| POST | `/projek/{id}/duplikat` | koord | Salin dimensi+aktivitas+field dari projek lain |
| GET | `/projek/{id}/kelas` | koord | Daftar kelas + fasilitator |
| POST | `/projek/{id}/kelas` | koord | Tambah kelas (siswa ikut otomatis) |
| GET | `/kelas/{id}/tim` | fasil, siswa | Daftar tim + anggota |
| POST | `/kelas/{id}/tim/bagi-otomatis` | fasil | Acak siswa ke N tim |
| PATCH | `/tim/{id}/anggota/{siswaId}` | fasil | Ubah peran anggota |
| GET | `/aktivitas?projek={id}&hari={n}` | semua | Daftar aktivitas + status isian saya |
| GET | `/aktivitas/{id}/form` | siswa | Definisi field + isian saya yang tersimpan |
| **PUT** | **`/isian`** | siswa | **Upsert by `client_uuid`.** Body: `{client_uuid, aktivitas_id, tim_id?, siswa_id?, status, jawaban:[{field_id, baris, kolom, nilai}]}` |
| POST | `/isian/{id}/lampiran` | siswa | Unggah foto (multipart) |
| DELETE | `/lampiran/{id}` | siswa (pemilik), fasil | Hapus foto |
| GET | `/kelas/{id}/keterisian?hari={n}` | fasil | Matriks tim × aktivitas |
| GET | `/kelas/{id}/nilai?hari={n}` | fasil | Murid × dimensi (nilai harian) |
| **PUT** | **`/nilai-harian`** | fasil | Body: `{projek_id, hari_ke, nilai:[{siswa_id, projek_dimensi_id, level, catatan?}]}` — **batch**, satu request untuk seluruh kelas |
| POST | `/projek/{id}/kelas/{kelasId}/hitung-nilai-akhir` | fasil | Jalankan aturan modus |
| POST | `/projek/{id}/kelas/{kelasId}/susun-deskripsi` | fasil | Generate draf rapor 36 murid |
| PATCH | `/deskripsi/{id}` | fasil | Simpan versi final |
| POST | `/anekdot` | fasil | Tambah catatan anekdotal |
| GET | `/rekap/keterisian?projek={id}` | koord | 16 kelas × hari |
| GET | `/rekap/nilai?projek={id}` | koord | Distribusi + tabel |
| GET | `/ekspor/nilai.xlsx?projek={id}&kelas={id}` | fasil, koord | Unduh Excel |
| GET | `/survei/{id}` | siswa | Pertanyaan (sensitif disembunyikan sesuai peran) |
| POST | `/survei/{id}/kirim` | siswa | **Tidak mengirim siswa_id.** Server ambil kelas_id dari session, catat partisipasi terpisah. |
| GET | `/survei/{id}/rekap` | koord | Agregat tanpa nama, **tanpa** pertanyaan sensitif |
| GET | `/survei/{id}/permintaan-bk` | **bk saja** | Daftar permintaan bicara |

## 10. NON-FUNGSIONAL

| Aspek | Ketentuan |
|---|---|
| **Beban puncak** | 96 tim + 576 murid mengisi bersamaan pada jam yang sama. Endpoint `PUT /isian` harus tahan **≥ 50 request/detik**. Autosave di-*debounce* 5 detik dan hanya mengirim bila ada perubahan. |
| **Indeks** | Semua kolom di klausa WHERE rekap sudah diindeks (lihat DDL). Rekap 16 kelas **wajib** memakai agregasi SQL (`GROUP BY`), **dilarang** N+1 query. |
| **Waktu muat** | Halaman siswa < 2 detik di 3G. Ukuran JS+CSS modul < 200 KB gzip. |
| **Keamanan** | Prepared statement (anti SQL injection) · escape output (anti XSS) · CSRF token di semua POST/PUT · rate limit 20 unggahan/menit per pengguna · validasi MIME sungguhan. |
| **Otorisasi** | Diperiksa di **server**, bukan hanya menyembunyikan tombol. Setiap query dibatasi lingkup peran. |
| **Audit** | Tabel `kk_log` (opsional fase 2): siapa mengubah nilai apa, kapan, dari nilai berapa ke berapa. |
| **Aksesibilitas** | Kontras minimal AA · target sentuh ≥ 44×44 px · seluruh label terbaca dari jarak baca HP. |
| **Bahasa** | Seluruh antarmuka **Bahasa Indonesia**. Tidak ada istilah teknis Inggris di layar murid. |
| **Backup** | Sebelum rilis: backup DB. Foto ikut dalam jadwal backup harian. |

## 11. MIGRASI DATA DARI SPREADSHEET (opsional)

Bila kegiatan telanjur mulai dengan Google Sheet:

- Menu **Impor** (admin): unggah CSV per aktivitas.
- Kolom CSV harus dipetakan ke `kk_field.kode` lewat layar pemetaan.
- Baris yang gagal divalidasi ditampilkan, tidak menggagalkan seluruh impor.
- **Impor tidak menimpa** isian yang sudah ada kecuali admin mencentang "timpa".

## 12. YANG TIDAK TERMASUK (Out of Scope v1.0)

- Aplikasi mobile native (Android/iOS). Cukup web responsif.
- Push notification. (Pengingat cukup lewat pengumuman di Agenda.)
- Chat/komentar antar murid.
- Penilaian antar teman sebaya otomatis (Silih Asah tetap diisi sebagai field biasa).
- Integrasi langsung ke aplikasi e-Rapor. v1.0 cukup **ekspor CSV** dengan format kolom yang cocok.
- Tanda tangan digital orang tua.

## 13. ACCEPTANCE CRITERIA (diuji sebelum dianggap selesai)

**Master & Projek**
- [ ] Seeder memuat 8 dimensi + sub-dimensinya, sesuai nama pada Panduan Kokurikuler.
- [ ] Koordinator bisa membuat projek dengan tema, judul, tujuan akhir, dan memilih 3 dimensi + sub-dimensi + rubrik SB/B/C/K.
- [ ] Memilih dimensi ke-4 memunculkan peringatan; dimensi ke-5 ditolak.
- [ ] "Duplikat projek" menghasilkan salinan lengkap dimensi + aktivitas + field, dengan tanggal kosong.

**Data & Integrasi**
- [ ] Menambah kelas ke projek **otomatis** memunculkan seluruh siswa kelas itu, tanpa input manual.
- [ ] Tidak ada tabel siswa/kelas/guru baru di database.
- [ ] Mengubah nama siswa di Agenda langsung terlihat di modul (tidak ada salinan data).
- [ ] "Bagi otomatis" membagi 36 siswa ke 6 tim seimbang; tidak ada siswa di dua tim.

**Isian Murid**
- [ ] Aktivitas tipe `tim`: dua anggota berbeda mengisi → tetap **satu** baris `kk_isian`.
- [ ] Aktivitas tipe `individu`: 36 murid → 36 baris isian terpisah.
- [ ] Field `tabel` dengan `min_baris:10` menolak KIRIM bila baris < 10.
- [ ] Mematikan koneksi di tengah pengisian → isian tetap tersimpan; saat online kembali, terkirim otomatis **tanpa duplikat**.
- [ ] Mengirim ulang request yang sama (client_uuid sama) 5× → tetap 1 baris di database.
- [ ] Foto 4 MB dari HP terkompresi < 800 KB sebelum terkirim; EXIF GPS hilang.

**Penilaian**
- [ ] Fasilitator menilai 36 murid × 3 dimensi dalam satu layar, tersimpan tanpa menekan tombol simpan.
- [ ] "Hitung nilai akhir" mengambil modus dari nilai harian; seri → level tertinggi.
- [ ] Nilai yang ditimpa manual **tidak** berubah saat hitung ulang.
- [ ] "Susun deskripsi" menghasilkan kalimat yang menyebut dimensi berlevel tinggi lebih dulu; kata "kurang"/"gagal" tidak pernah muncul.

**Keamanan & Privasi**
- [ ] Fasilitator kelas A membuka URL isian kelas B secara langsung → **403**, bukan hanya tombol tersembunyi.
- [ ] Siswa membuka isian tim lain → **403**.
- [ ] Tidak ada kolom apa pun di `kk_survei_respon` / `kk_survei_jawaban` yang merujuk ke siswa/user.
- [ ] Query gabungan `kk_survei_respon` × `kk_survei_partisipasi` **tidak bisa** menghasilkan pemetaan jawaban→murid (diverifikasi manual saat review kode).
- [ ] Pertanyaan `sensitif=1` tidak muncul di rekap koordinator maupun di API-nya.
- [ ] Peran BK tidak bisa membuka halaman nilai maupun isian tim.

**Kinerja**
- [ ] Rekap 16 kelas tampil < 3 detik dengan data penuh (576 siswa × 5 hari × 3 dimensi ≈ 8.640 baris nilai).
- [ ] Halaman isian murid < 2 detik di jaringan 3G tersimulasi.

## 14. RENCANA RILIS BERTAHAP

| Tahap | Isi | Hasil yang bisa dipakai |
|---|---|---|
| **M1 — Fondasi** | Adaptor Agenda, RBAC, migrasi + seeder 8 dimensi, CRUD projek + dimensi + rubrik | Koordinator bisa mendaftarkan projek & rubrik |
| **M2 — Kelas & Tim** | Penugasan kelas + fasilitator, tarik siswa otomatis, CRUD tim, bagi otomatis, peran anggota | Struktur kelas siap sebelum hari-H |
| **M3 — Aktivitas & Isian** | Form builder, render form di HP, autosave, draft offline, upload foto | **Murid sudah bisa berhenti memakai spreadsheet** |
| **M4 — Penilaian** | Nilai harian (layar cepat), anekdot, nilai akhir otomatis, generator deskripsi rapor | Guru bisa menilai & menyusun rapor |
| **M5 — Rekap & Ekspor** | Dasbor keterisian, distribusi nilai, galeri, ekspor Excel/PDF/CSV | Admin bisa merekap sekali klik |
| **M6 — Survei Anonim** | Survei + rekap tanpa nama + panel BK | Google Form ditinggalkan sepenuhnya |

> **Urutan ini disengaja.** M3 sudah memberi nilai terbesar (menghapus 96 spreadsheet). Bila waktu mepet menjelang kegiatan, **M1–M3 saja sudah layak dipakai**; penilaian sementara masih bisa lewat Excel.

## 15. RISIKO & MITIGASI

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Nama tabel/kolom Agenda berbeda dari asumsi §3 | Modul tidak jalan | **Lapisan adaptor** — hanya 1 berkas config yang diubah |
| Wi-Fi sekolah tidak kuat untuk 576 murid serentak | Murid gagal mengirim | Draft offline (§8) + jadwal pengisian bergelombang per kelas |
| Kuota disk shared hosting habis karena foto | Server mati | Kompresi klien wajib + estimasi storage (§7) + fitur arsip |
| Guru senior kesulitan memakai aplikasi | Nilai tidak terisi | Layar penilaian 1 halaman, tombol besar, fitur "samakan satu kolom", tanpa tombol simpan |
| Kebocoran data survei | **Serius** — kepercayaan murid hancur, potensi masalah hukum | Rancangan anonim struktural (§5.9), akses BK terpisah, diuji di acceptance |
| Dua anggota tim menimpa isian | Data hilang | Deteksi konflik + banner pilihan (§8.6) |

## 16. PERTANYAAN TERBUKA (jawab sebelum coding)

1. Framework persisnya apa — Laravel (versi?), CodeIgniter (3/4?), atau PHP native? Ini menentukan struktur berkas.
2. Apakah murid **sudah punya akun** di aplikasi Agenda (bisa login)? Kalau belum, perlu tahap pembuatan akun massal — itu **prasyarat** modul ini.
3. Versi MySQL/MariaDB berapa? (Kolom `JSON` butuh MySQL ≥ 5.7 / MariaDB ≥ 10.2. Bila lebih tua, ganti ke `TEXT` + serialisasi manual.)
4. Hosting: shared hosting/cPanel, VPS, atau server sekolah? Berapa kuota disk?
5. Apakah aplikasi Agenda sudah punya sistem peran/permission, atau `users.role` sekadar kolom teks?
6. Apakah ada Guru BK yang punya akun di Agenda?

---

## 17. DATA CONTOH — SEEDER PROJEK "SAKOLA WALUYA"

Agar aplikasi bisa langsung diuji, sertakan seeder projek nyata berikut.

**Projek:**
- tahun_ajaran `2026/2027` · semester `ganjil` · tingkat `11`
- **tema:** Pendidikan Karakter Pancawaluya — Sekolah yang Cageur, Bageur, Bener, Pinter, tur Singer
- **judul:** SAKOLA WALUYA — Ngamimitian ti Diri, Mere Mangpaat pikeun Sakola
- **tujuan_akhir:** membiasakan tujuh kebiasaan anak Indonesia hebat serta menemukan, merancang, dan mewujudkan solusi nyata atas permasalahan lingkungan sekolah dengan menggunakan kompetensi keahlian yang dimiliki
- tanggal 15–21 Juli 2026 · total_jp 28

**Dimensi yang dinilai (3) + sub-dimensi + aspek:**

| Dimensi | Sub-dimensi diamati | Aspek yang Dinilai |
|---|---|---|
| kreativitas | Merumuskan solusi bagi permasalahan di sekitarnya; Menciptakan inovasi | Merancang dan mewujudkan solusi atas masalah nyata sekolah dengan kompetensi keahliannya |
| kolaborasi | Peduli dan berbagi; Membangun kerja sama dengan berbagai kalangan di lingkungan sekitar | Menjalankan peran dalam tim, dan membantu tim lain |
| kesehatan | Hidup bersih dan sehat; Berkontribusi secara positif terhadap lingkungan | Menjalankan pembiasaan 7 KAIH dan berkontribusi pada kesehatan/kebersihan sekolah |

**Rubrik (contoh untuk kolaborasi):**
- **SB** — Menjalankan perannya secara konsisten tanpa diingatkan, menyelesaikan konflik dalam timnya sendiri, dan membantu tim lain.
- **B** — Menjalankan perannya dengan baik dan berkontribusi nyata pada hasil kerja tim.
- **C** — Menjalankan perannya bila diingatkan; kontribusinya belum merata.
- **K** — Tidak menjalankan perannya; pekerjaan tim ditanggung anggota lain.

**Aktivitas & field (ringkas — selengkapnya 11 lembar):**

| Hari | kode | judul | tipe | field utama |
|---|---|---|---|---|
| 1 | H1_RADAR | Radar Kebiasaan | tim | 7 × `skala` (1–10) per kebiasaan, per anggota |
| 1 | H1_REFLEKSI | Jurnal Waluya | **individu** | 3 × `teks_panjang` |
| 2 | H2_DATA | Data Lapangan | tim | `tabel` (min 10 baris: objek, lokasi, angka, satuan, waktu) + `foto` (min 5) + `teks_panjang` "hal yang mengejutkan" |
| 2 | H2_POHON | Pohon Akar Masalah | tim | `teks` buah, `teks` batang, 3 × `teks` akar, 3 × `teks_panjang` bukti |
| 3 | H3_WAWANCARA | Kutipan Narasumber | tim | `tabel` (narasumber, peran, pertanyaan, `kutipan`, perasaan) |
| 3 | H3_EMPATI | Peta Empati | tim | 6 × `teks_panjang` |
| 3 | H3_PRIORITAS | Matriks Prioritas | tim | `tabel` (masalah, dampak 1–5, bisa dikerjakan 1–5) |
| 4 | H4_IDE | Ide & Rancangan | tim | `teks_panjang` × 18 ide, `pilihan` ide terpilih, `foto` sketsa |
| 4 | H4_SILIH_ASAH | Silih Asah | tim | `teks_panjang` sudah baik / perlu diperbaiki / saran |
| 5 | H5_AKSI | Aksi & Bukti | tim | `foto` sebelum, `foto` sesudah, `teks_panjang` cara pasang |
| 1 | SUARA_WALUYA | Suara Waluya | **anonim** | lihat §5.9 — 9 pertanyaan, 2 di antaranya `sensitif=1` |

**Survei "Suara Waluya" — 9 pertanyaan:**

| # | Pertanyaan | Tipe | Wajib | Sensitif |
|---|---|---|---|---|
| 1 | Kelas kamu apa? | (diambil dari session, bukan ditanya) | — | — |
| 2 | Sebutkan SATU hal yang membuat kamu BETAH di sekolah ini. | teks_panjang | ya | tidak |
| 3 | Sebutkan SATU hal yang membuat kamu TIDAK NYAMAN di sekolah ini. | teks_panjang | ya | tidak |
| 4 | Sebutkan SATU hal yang membuat kamu merasa TIDAK AMAN di sekolah ini. | teks_panjang | **tidak** | tidak |
| 5 | Seberapa AMAN kamu merasa di sekolah ini? | skala 1–5 | ya | tidak |
| 6 | Seberapa BETAH kamu belajar di sekolah ini? | skala 1–5 | ya | tidak |
| 7 | Masalah mana yang PALING MENDESAK diperbaiki? | pilihan (5 zona) | ya | tidak |
| 8 | Apakah kamu ingin berbicara langsung dengan Guru BK? | centang | tidak | **YA** |
| 9 | Kalau ya, tulis namamu (boleh dikosongkan). | teks | tidak | **YA** |

---

## 18. PROMPT SIAP PAKAI UNTUK AI CODING ASSISTANT

Salin blok di bawah ke Claude/Gemini, **lampirkan berkas PRD ini**, dan jawab dulu §16.

```
Kamu adalah senior PHP engineer. Bangun MODUL KOKURIKULER sebagai bagian dari
aplikasi Agenda sekolah yang SUDAH ADA (PHP + MySQL).

BERKAS TERLAMPIR: PRD_MODUL_KOKURIKULER.md — baca seluruhnya, ini spesifikasi mengikat.

KONTEKS APLIKASI SAYA (isi sebelum mengirim):
- Framework      : ...............   (mis. Laravel 10 / CodeIgniter 4 / PHP native)
- Versi PHP      : ...............
- Versi MySQL    : ...............
- Struktur folder: ...............
- Tabel users    : (tempel hasil `SHOW CREATE TABLE users;`)
- Tabel siswa    : (tempel hasil `SHOW CREATE TABLE siswa;`)
- Tabel kelas    : (tempel hasil `SHOW CREATE TABLE kelas;`)
- Tabel guru     : (tempel hasil `SHOW CREATE TABLE guru;`)
- Cara auth      : ...............   (mis. Laravel Auth / session manual)
- Cara peran     : ...............   (mis. kolom users.role bertipe string)

ATURAN YANG TIDAK BOLEH DILANGGAR:
1. JANGAN ubah skema tabel Agenda yang sudah ada. Jangan tambah kolom, jangan ubah tipe.
2. JANGAN buat tabel siswa/kelas/guru baru. Ambil dari tabel yang ada.
3. Semua tabel baru berawalan kk_.
4. Buat config/kokurikuler.php sebagai lapisan adaptor (PRD §3.2). Semua akses ke tabel
   Agenda HARUS lewat adaptor ini — jangan tulis nama tabel Agenda langsung di query.
5. Otorisasi diperiksa di SERVER pada setiap request, bukan sekadar menyembunyikan tombol.
6. Survei anonim: ikuti PRD §5.9 PERSIS. Tabel respon TIDAK BOLEH punya kolom apa pun
   yang merujuk ke siswa/user. Ini syarat mutlak, bukan preferensi.
7. Seluruh antarmuka berbahasa Indonesia.
8. Mobile-first. Murid memakai HP dengan sinyal buruk.

KERJAKAN BERTAHAP, jangan sekaligus. Mulai dari TAHAP M1 (PRD §14):
  a. Migrasi database (seluruh DDL di PRD §5) + seeder 8 dimensi & sub-dimensi (§5.1)
  b. config/kokurikuler.php + kelas Adaptor (repository) untuk siswa/kelas/guru
  c. Middleware & policy RBAC (§4)
  d. CRUD Projek + Dimensi + Rubrik (§6.1 langkah 1–2)

Setelah tiap tahap: tampilkan daftar berkas yang dibuat/diubah, dan tunggu saya
mengonfirmasi sebelum lanjut ke tahap berikutnya.

Untuk setiap berkas, tulis kode LENGKAP — bukan potongan atau "// dan seterusnya".
```

**Prompt lanjutan tiap tahap:** cukup tulis
> *"Lanjut ke TAHAP M2 sesuai PRD §14. Ikuti aturan yang sama."*

---

## 19. CATATAN PENUTUP UNTUK PEMBANGUN

Tiga hal yang paling sering membuat modul seperti ini gagal dipakai — semuanya sudah dijawab di PRD, tapi mudah terlewat:

1. **Menghardcode Sakola Waluya.** Kalau tema/dimensi/lembar kerja ditulis di kode, projek kedua akan minta developer lagi. Seluruh isi projek **harus** data (`kk_projek`, `kk_aktivitas`, `kk_field`). Uji dengan membuat projek dummy kedua tanpa menyentuh kode.

2. **Meremehkan sinyal.** Kegiatan ini berlangsung di toilet, kantin, lapangan — bukan di lab komputer. Kalau isian hilang sekali saja, murid tidak akan percaya lagi pada aplikasinya dan kembali ke kertas. Draft offline **bukan fitur tambahan**, ia syarat kelayakan.

3. **Menganggap survei sebagai form biasa.** Ada murid yang akan menuliskan hal yang belum pernah ia ceritakan ke siapa pun. Kalau ada satu saja kolom yang bisa menghubungkan jawaban ke namanya, kepercayaan itu hilang — dan sekolah menanggung akibatnya. Rancangan di §5.9 dibuat supaya **sistemnya sendiri tidak mampu** membocorkan, bukan sekadar tidak menampilkan.
