# Rencana Pengembangan Dokumen (RPD)
# Aplikasi Bel Sekolah Dinamis Berbasis Google Apps Script

**Nama Proyek:** SmartBell SMKN 2 Cimahi
**Platform:** Google Apps Script (GAS) + Google Sheets (sebagai database) + Google Drive (storage audio)
**Target Pengguna:** Admin Kurikulum, Operator Ruang Kontrol, Petugas Piket
**Versi Dokumen:** 1.0
**Tanggal:** 24 Juni 2026

---

## 1. Ringkasan Eksekutif

Aplikasi ini berfungsi sebagai sistem bel sekolah otomatis berbasis web yang berjalan di Google Apps Script. Sistem terdiri dari dua antarmuka utama, yaitu Halaman Admin untuk konfigurasi dan Halaman Klien untuk eksekusi audio. Penekanan utama pengembangan adalah pada **kedinamisan jadwal**, yaitu kemampuan admin untuk mengganti mode jadwal secara cepat (harian maupun mingguan) tanpa harus menyentuh data dasar jadwal reguler.

## 2. Arsitektur Sistem

### 2.1 Komponen Utama

| Komponen | Teknologi | Fungsi |
|----------|-----------|--------|
| Backend Logic | Google Apps Script (`.gs`) | Endpoint API, otentikasi, manajemen data |
| Database | Google Sheets | Penyimpanan jadwal, log, konfigurasi, hari libur |
| Storage Audio | Google Drive | Penyimpanan file MP3/WAV dengan link publik terbatas |
| Frontend Admin | HTML + JavaScript + Bootstrap 5 | Antarmuka pengelolaan |
| Frontend Klien | HTML + JavaScript murni | Antarmuka pemutar otomatis |
| Otentikasi | Google Account + Properties Service | Login admin via email whitelist |

### 2.2 Struktur Spreadsheet (Database)

Buat satu Google Spreadsheet dengan sheet berikut:

**Sheet Inti Bel:**
1. **AudioBank** : id, nama, kategori, driveFileId, durasi, tanggalUpload, uploader
2. **JadwalReguler** : id, namaMode, hari, jam, audioId, status, urutan
3. **ModeJadwal** : id, namaMode, deskripsi, warnaLabel, isDefault
4. **JadwalAktif** : tanggal, modeId, catatan, ditetapkanOleh, timestamp
5. **HariLibur** : id, tanggalMulai, tanggalSelesai, keterangan, kategori
6. **LogEksekusi** : timestamp, jadwalId, audioNama, status, deviceId, errorMsg
7. **Konfigurasi** : key, value, deskripsi
8. **AdminUsers** : email, nama, peran, status
9. **OverrideHarian** : tanggal, jam, audioId, tipe (tambah/skip/ganti), catatan

**Sheet Data Akademik (dari import XML):**
10. **Guru** : id, kode, nama, NIP, mapel, email, status
11. **Ruangan** : id, kode, nama, kapasitas, jenis (teori/lab/bengkel), gedung
12. **MataPelajaran** : id, kode, nama, jamPerMinggu, kelompok
13. **Rombel** : id, nama, tingkat, jurusan, waliKelasId, jumlahSiswa
14. **JadwalPelajaran** : id, hari, jamKe, guruId, mapelId, rombelId, ruanganId, tanggalEfektif, tanggalAkhir
15. **PeriodeJam** : jamKe, jamMulai, jamSelesai, isIstirahat, isSholat, keterangan
16. **ImportHistory** : timestamp, fileNama, format (csv/xlsx/xml), totalRecord, status, uploader, snapshotBackup

Sheet `PeriodeJam` adalah jembatan antara jam pelajaran (Jam ke-1, ke-2, dst dari aSc) dengan waktu nyata bel berbunyi. Admin mengatur tabel ini sekali, lalu sistem otomatis tahu kapan harus membunyikan bel masuk dan keluar setiap jam pelajaran.

## 3. Fitur Halaman Admin

### 3.1 Dashboard Utama
- Jam digital realtime dengan zona waktu Asia/Jakarta
- Card status: mode jadwal hari ini, jumlah audio aktif, jadwal berikutnya (countdown)
- Status klien yang terhubung (heartbeat dari setiap browser klien dalam 30 detik terakhir)
- Notifikasi peringatan: audio rusak, klien offline lebih dari 5 menit, jadwal kosong untuk hari ini
- Tombol akses cepat: ganti mode hari ini, putar bel darurat, refresh semua klien

### 3.2 Manajemen File Audio (Bank Suara)
- Upload file ke folder Drive khusus dengan validasi tipe (mp3, wav, ogg) dan ukuran maksimal 10 MB
- Auto-generate metadata (durasi audio dibaca via Web Audio API saat preview)
- Preview player inline dengan kontrol volume
- Kategorisasi multi-tag: Pembuka, Pergantian Jam, Istirahat, Pulang, Upacara, Ujian, Sholat, Darurat, Pengumuman, Murottal, Lagu Wajib
- Pencarian dan filter berdasarkan kategori dan nama
- Soft delete dengan opsi restore selama 30 hari
- Fitur replace audio tanpa mengubah ID, sehingga jadwal yang sudah memakai audio tersebut tidak perlu di-relink

### 3.3 Manajemen Mode Jadwal (Inti Kedinamisan)

Ini adalah fitur paling penting. Mode jadwal adalah template lengkap jadwal harian yang bisa dipanggil kapan saja.

**Mode bawaan yang harus tersedia:**
- Mode Reguler Senin-Kamis
- Mode Reguler Jumat
- Mode Reguler Sabtu
- Mode Upacara Senin
- Mode Ujian (UTS/UAS/ASAS/ASAT)
- Mode Ramadhan (jam dipersingkat)
- Mode Setengah Hari
- Mode Libur (bel mati total)
- Mode Kegiatan Khusus (workshop, IHT, kunjungan industri)

**Operasi yang tersedia:**
- Membuat mode baru dengan opsi duplikasi dari mode lain
- Mengatur jadwal per mode (jam, audio, deskripsi kegiatan)
- Mengubah label warna mode untuk identifikasi visual cepat
- Mengarsipkan mode lama tanpa menghapus historisnya

### 3.4 Penjadwalan Dinamis Harian dan Mingguan

**Penetapan Mode (Kontrol Cepat):**
- Tetapkan mode hari ini dengan satu klik dari dashboard
- Penjadwalan mode lanjutan: pilih rentang tanggal, set mode untuk setiap tanggal sekaligus (misal: 1 sampai 14 Desember 2026 pakai Mode Ujian)
- Penjadwalan mingguan otomatis: konfigurasi default per hari (Senin=Upacara, Selasa-Kamis=Reguler, Jumat=Jumat, Sabtu=Sabtu)
- Override harian: tambahkan, lewati, atau ganti satu slot jadwal pada hari tertentu tanpa mengubah mode dasarnya (contoh: hari ini saja, jam 09.45 putar pengumuman khusus)

**Kalender Visual:**
- Tampilan kalender bulanan dengan warna mode di tiap tanggal
- Klik tanggal untuk mengganti mode atau menambah override
- Drag and drop mode dari sidebar ke tanggal

### 3.5 Manajemen Hari Libur
- Input rentang tanggal libur (libur semester, libur nasional, cuti bersama)
- Auto-import kalender libur nasional Indonesia (opsional, via Google Calendar API)
- Kategori: libur nasional, libur semester, libur khusus sekolah, hari kejepit
- Saat tanggal masuk daftar libur, sistem otomatis memakai Mode Libur tanpa perlu intervensi

### 3.6 Import Jadwal dari File Eksternal

Sistem mendukung tiga format import dengan parser terpisah:

**A. Import dari CSV/XLSX (template sederhana)**
- Template kolom: hari, jam, audioId atau audioNama, mode, keterangan
- Cocok untuk operator yang menyiapkan jadwal secara manual

**B. Import dari XML aSc Timetables (FET, ASC, dan turunannya)**

Software penjadwalan sekolah seperti aSc Timetables, FET, dan Untis menghasilkan file XML yang berisi struktur lengkap pembelajaran. Sistem harus dapat membaca struktur tersebut dan menarik data berikut:

- **Periods (jam pelajaran)** : nomor jam, jam mulai, jam selesai
- **Days (hari)** : nama hari, urutan
- **Teachers (guru)** : id, nama lengkap, kode singkat, NIP (jika ada)
- **Classrooms (ruangan)** : id, nama ruangan, kapasitas
- **Subjects (mata pelajaran)** : id, nama, kode
- **Classes (rombel)** : id, nama rombel, tingkat, jurusan
- **Lessons/Cards** : relasi guru, mata pelajaran, kelas, ruangan, hari, periode

**Proses Import XML:**
1. Upload file XML, sistem deteksi format otomatis (aSc, FET, Untis, generic)
2. Parsing dilakukan di sisi server (GAS) menggunakan `XmlService`
3. Preview hasil parsing dalam bentuk tabel: total guru, total ruangan, total mata pelajaran, total lesson
4. Mapping jam pelajaran ke jam bel (misal: Jam ke-1 = 07.00 sampai 07.45, bel masuk 06.55, bel keluar 07.45)
5. Konfirmasi sebelum commit ke spreadsheet
6. Data tersimpan di sheet baru: `Guru`, `Ruangan`, `MataPelajaran`, `Rombel`, `JadwalPelajaran`

**Validasi saat Import XML:**
- Cek duplikasi nama guru dengan data lama
- Peringatan jika ada lesson yang ruangannya kosong atau gurunya tidak terdaftar
- Opsi merge (gabung dengan data lama) atau replace (ganti total)
- Backup otomatis data lama sebelum import

**C. Import Manual via Form**
- Form sederhana untuk menambahkan satu jadwal sekaligus tanpa file

### 3.7 Manajemen Data Akademik (Guru, Ruangan, Mata Pelajaran)

Setelah import XML, sistem menampilkan data akademik secara terpisah agar dapat digunakan untuk fitur lain:

- **Daftar Guru** : foto opsional, nama, kode, NIP, jumlah jam mengajar per minggu, daftar mata pelajaran, daftar kelas yang diajar
- **Daftar Ruangan** : nama, kapasitas, jenis (teori, lab, bengkel), daftar jadwal pemakaian
- **Daftar Mata Pelajaran** : nama, kode, jumlah jam per minggu, daftar guru pengampu
- **Daftar Rombel** : nama kelas, tingkat, jurusan, wali kelas, daftar jadwal

Setiap data dapat di-search, di-edit manual, dan diekspor ke CSV.

### 3.8 Log dan Riwayat Eksekusi
- Tabel log dengan filter tanggal, status (sukses, gagal, dilewati), kategori audio
- Export log ke CSV untuk audit
- Grafik statistik mingguan: jumlah bel berbunyi, persentase keberhasilan, rata-rata delay
- Notifikasi otomatis ke email admin jika ada 3 kegagalan berturut-turut

### 3.9 Pencarian Global (Search)

Fitur search wajib tersedia di setiap halaman admin dengan scope berbeda:

**Search Bar Global (di header):**
- Pencarian universal lintas data: nama audio, nama mode, tanggal, nama guru, ruangan, mata pelajaran
- Hasil dikelompokkan per kategori (Audio, Mode, Jadwal, Guru, Ruangan, Tanggal/Hari)
- Shortcut keyboard `Ctrl+K` atau `/` untuk fokus ke search bar
- Riwayat pencarian terakhir disimpan di localStorage

**Search per Modul:**
- **Bank Audio** : cari berdasarkan nama, kategori, uploader, durasi
- **Jadwal** : filter ganda (hari, jam mulai-selesai, mode, audio, guru, ruangan, kelas, mata pelajaran)
- **Mode** : cari nama mode, deskripsi
- **Kalender** : lompat ke tanggal spesifik dengan format DD/MM/YYYY atau "minggu depan", "Jumat ini"
- **Log Eksekusi** : filter tanggal, jam, status, audio, device
- **Guru dan Ruangan** : cari jadwal mengajar guru tertentu atau okupansi ruangan tertentu

**Search Berbasis Tanggal/Hari:**
- Input cepat: "hari ini", "kemarin", "Senin minggu ini", "1 Agustus 2026"
- Tampilkan jadwal lengkap pada tanggal tersebut beserta mode yang berlaku
- Bandingkan dua tanggal berdampingan (untuk audit perubahan jadwal)

### 3.10 Manajemen User Admin
- Daftar email yang berhak masuk halaman admin
- Peran: Super Admin (semua akses), Operator (hanya jadwal harian dan eksekusi), Auditor (hanya lihat log)
- Catatan aktivitas per admin (siapa mengubah apa kapan)

### 3.11 Konfigurasi Sistem
- Volume default pemutar klien
- Toleransi waktu pemutaran (misal: bel telat lebih dari 30 detik dianggap gagal)
- Zona waktu (default Asia/Jakarta)
- URL endpoint klien untuk validasi
- Pengaturan heartbeat (interval ping klien)
- Pengaturan auto-refresh klien (interval pengecekan jadwal)

## 4. Fitur Halaman User (Klien Pemutar)

### 4.1 Antarmuka Standby
- Jam digital besar dengan sinkronisasi server (NTP via GAS) setiap 60 detik
- Tanggal lengkap dalam Bahasa Indonesia dan tanggal Hijriyah (opsional)
- Nama mode jadwal aktif dengan label warna
- Daftar jadwal hari ini dengan highlight pada jadwal yang sudah berbunyi, sedang menunggu, dan jadwal berikutnya
- Countdown ke jadwal berikutnya dalam format menit dan detik
- **Panel Jadwal Pelajaran Aktif** : tampilkan jam ke berapa sedang berlangsung, mata pelajaran, nama guru pengajar, kelas, dan ruangan (data dari import XML)
- **Toggle Tampilan** : operator dapat memilih mode tampilan
  - Mode Ringkas : hanya jam dan jadwal bel
  - Mode Lengkap : ditambah informasi guru/ruangan/mata pelajaran (cocok untuk display di lobby)
  - Mode Daftar Guru : khusus menampilkan siapa mengajar di jam dan ruangan mana (cocok untuk display di ruang guru)
- **Pencarian Cepat di Klien** : kolom search untuk operator melihat "jam berapa Pak X mengajar hari ini" atau "ruangan Y dipakai siapa jam 10.00"

### 4.2 Indikator Status Visual

Empat indikator wajib di pojok layar:

1. **Koneksi Server** : hijau jika ping ke GAS sukses, kuning jika lambat, merah jika gagal
2. **Audio Permission** : hijau jika browser mengizinkan autoplay, merah jika perlu interaksi user
3. **Sinkronisasi Waktu** : hijau jika selisih dengan server kurang dari 2 detik
4. **Mode Aktif** : warna sesuai label mode hari ini

### 4.3 Pemutar Audio Otomatis
- Loop cek jadwal setiap 1 detik (lokal), refresh data jadwal dari server setiap 1 menit
- Mekanisme anti-duplikasi: satu jadwal hanya boleh diputar satu kali per slot
- Antrian audio jika dua jadwal berdekatan
- Volume control bisa di-override dari admin secara remote
- Auto-recovery: jika browser sempat sleep, sistem mengejar jadwal yang terlewat dalam window 2 menit terakhir

### 4.4 Bel Manual dan Darurat
- Tombol "Bel Manual" dengan dropdown kategori (Pengumuman, Evakuasi, Bahaya Kebakaran, Bahaya Gempa, Bel Pengganti)
- Konfirmasi dua tahap untuk bel darurat agar tidak salah pencet
- Aktivitas bel manual tercatat di log dengan nama operator dan alasan
- Opsi broadcast: bunyikan di semua klien yang terhubung (jika sekolah punya lebih dari satu titik speaker)

### 4.5 Fitur Tambahan Klien
- Mode fullscreen untuk display di ruang kontrol
- Tema gelap dan tema terang
- Tombol test audio (memainkan 3 detik audio untuk cek speaker)
- Reload paksa dari admin remote (admin bisa kirim sinyal refresh ke klien tanpa harus minta operator menekan F5)
- Multi-device ID: setiap klien punya ID unik agar log bisa membedakan klien mana yang berbunyi

## 5. Fitur Tambahan untuk Kedinamisan

### 5.1 Quick Switch Mode
- Tombol pintas di dashboard untuk mengganti mode hari ini secara instan
- Konfirmasi singkat, lalu semua klien otomatis menarik jadwal baru dalam 60 detik
- Notifikasi visual di klien: "Mode jadwal berubah ke Mode Ujian"

### 5.2 Template Minggu
- Buat template mingguan, contoh: Minggu Ujian, Minggu Reguler, Minggu Ramadhan
- Terapkan template ke rentang minggu sekaligus

### 5.3 Penjadwalan Bersyarat
- Aturan kondisional sederhana, contoh: "Jika hari Jumat dan minggu pertama bulan, gunakan Mode Jumat Berkah"
- Aturan dievaluasi setiap pagi pukul 00:01

### 5.4 Bel Berlapis (Layered Bell)
- Putar dua audio berurutan dalam satu slot (contoh: Murottal 5 menit, lalu bel masuk)
- Pengaturan gap antar audio

### 5.5 Integrasi WhatsApp (Opsional, lanjutan)
- Notifikasi ke admin via WhatsApp jika ada error kritis
- Memakai layanan webhook pihak ketiga atau WA Business API

### 5.6 Backup dan Restore
- Export seluruh konfigurasi (mode, jadwal, audio metadata, hari libur) ke file JSON
- Restore dari file JSON
- Auto-backup harian ke folder Drive admin

## 6. Spesifikasi Teknis Google Apps Script

### 6.1 Struktur File `.gs`

```
Code.gs              -> Entry point doGet(e), routing halaman
Auth.gs              -> Otentikasi email whitelist
AudioService.gs      -> CRUD bank suara dan operasi Drive
ScheduleService.gs   -> CRUD jadwal, mode, override
ModeService.gs       -> Logika resolusi mode aktif per tanggal
HolidayService.gs    -> Manajemen hari libur
LogService.gs        -> Pencatatan eksekusi
SearchService.gs     -> Mesin pencarian global lintas data
ImportService.gs     -> Parser CSV, XLSX, dan XML (aSc/FET/Untis)
AcademicService.gs   -> CRUD Guru, Ruangan, MataPelajaran, Rombel, JadwalPelajaran
ConfigService.gs     -> Akses Properties Service dan sheet Konfigurasi
ClientAPI.gs         -> Endpoint khusus klien (lebih ringan, tanpa otentikasi penuh)
Utils.gs             -> Helper format tanggal, validasi, parsing
```

### 6.2 Struktur File HTML

```
admin.html           -> Shell halaman admin
admin-dashboard.html -> Partial dashboard
admin-audio.html     -> Partial bank audio
admin-schedule.html  -> Partial penjadwalan
admin-mode.html      -> Partial mode jadwal
admin-holiday.html   -> Partial hari libur
admin-log.html       -> Partial log
client.html          -> Halaman klien pemutar
shared-css.html      -> CSS global
shared-js.html       -> JS helper global
```

### 6.3 Endpoint API (via `google.script.run`)

| Endpoint | Akses | Fungsi |
|----------|-------|--------|
| getDashboardData | Admin | Ringkasan untuk dashboard |
| getActiveMode(date) | Klien + Admin | Mode aktif untuk tanggal tertentu |
| getTodaySchedule(deviceId) | Klien | Jadwal hari ini setelah resolusi mode dan override |
| getTodayLessons(deviceId) | Klien | Jadwal pelajaran (guru/ruangan/mapel) hari ini |
| reportPlayback(payload) | Klien | Lapor hasil pemutaran audio |
| heartbeat(deviceId) | Klien | Ping status klien |
| getAudioUrl(audioId) | Klien | Stream URL audio dari Drive |
| setModeForDate(date, modeId) | Admin | Ganti mode untuk tanggal |
| triggerEmergencyBell(audioId) | Admin | Bel darurat broadcast |
| broadcastRefresh() | Admin | Paksa klien refresh data |
| globalSearch(query, scope) | Admin | Pencarian universal lintas data |
| searchByDate(dateExpr) | Admin + Klien | Pencarian berdasarkan tanggal/hari natural |
| searchTeacher(query) | Admin + Klien | Cari jadwal guru |
| searchRoom(query) | Admin + Klien | Cari okupansi ruangan |
| importXmlTimetable(xmlContent, options) | Admin | Parse dan import XML aSc/FET/Untis |
| importCsvSchedule(csvContent, mapping) | Admin | Import CSV/XLSX |
| previewImport(payload) | Admin | Preview hasil import sebelum commit |

### 6.4 Trigger Time-Based
- Trigger harian pukul 00:01 untuk evaluasi aturan bersyarat dan caching jadwal hari ini
- Trigger mingguan untuk auto-backup konfigurasi
- Trigger setiap 6 jam untuk membersihkan log lama (lebih dari 90 hari, opsional konfigurasi)

### 6.5 Pertimbangan Performa
- Cache jadwal hari ini di CacheService selama 5 menit untuk mengurangi pembacaan Spreadsheet
- Gunakan batch operation saat baca tulis Sheets
- Audio di-stream langsung dari Drive dengan parameter `?alt=media` agar tidak membebani GAS
- Hindari `SpreadsheetApp.flush()` kecuali setelah transaksi multi-write
- Quota GAS: maksimal 6 menit per eksekusi, antisipasi dengan jobs yang ringan

### 6.6 Keamanan
- Email whitelist di sheet AdminUsers, divalidasi setiap request admin
- Klien dilindungi dengan token sederhana yang di-generate per device, dicek di endpoint klien
- Audio Drive di-share dengan mode "Anyone with the link, viewer", tetapi link disembunyikan dari sumber HTML klien (diambil saat dibutuhkan)
- Semua aktivitas perubahan tercatat dengan user dan timestamp

## 7. Roadmap Pengembangan (Sprint)

| Sprint | Durasi | Deliverable |
|--------|--------|-------------|
| Sprint 1 | 1 minggu | Setup spreadsheet (16 sheet), struktur folder Drive, otentikasi admin, CRUD AudioBank |
| Sprint 2 | 1 minggu | Manajemen Mode dan Jadwal Reguler, kalender visual |
| Sprint 3 | 1 minggu | Halaman Klien dasar, pemutar otomatis, heartbeat |
| Sprint 4 | 1 minggu | Override harian, hari libur, quick switch mode |
| Sprint 5 | 1 minggu | Log eksekusi, dashboard analitik, bel darurat |
| Sprint 6 | 1 minggu | Import CSV/XLSX, **parser XML aSc Timetables**, manajemen data akademik |
| Sprint 7 | 1 minggu | **Fitur Pencarian Global**, tampilan klien dengan data guru/ruangan, mode tampilan |
| Sprint 8 | 1 minggu | Backup restore, template minggu, polish UI, dokumentasi |
| Sprint 9 | 1 minggu | Deploy, training operator, monitoring 1 minggu pertama |

## 8. Kriteria Penerimaan (Acceptance Criteria)

1. Admin dapat mengganti mode jadwal hari ini dalam waktu kurang dari 10 detik
2. Klien otomatis menarik jadwal baru maksimal 60 detik setelah perubahan
3. Selisih waktu pemutaran bel dengan jadwal tidak lebih dari 3 detik
4. Sistem tetap berjalan saat satu klien offline (klien lain tidak terpengaruh)
5. Log eksekusi mencatat 100% percobaan pemutaran (sukses maupun gagal)
6. Import jadwal CSV dengan 100 baris berhasil tanpa error
7. Bel darurat berfungsi pada semua klien aktif dalam waktu kurang dari 5 detik
8. Halaman klien dapat berjalan stabil minimal 12 jam tanpa reload

## 9. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Browser klien sleep/throttle audio | Bel tidak berbunyi | Pakai Web Audio API + visibility API, recovery window |
| Quota GAS terlampaui | Sistem down sementara | Cache agresif, batasi heartbeat ke 60 detik |
| Audio gagal load dari Drive | Bel kosong | Preload audio berikutnya 1 menit sebelum jadwal |
| Operator salah ganti mode | Bel tidak sesuai | Konfirmasi dua tahap untuk mode kritis (Libur, Ujian) |
| Listrik mati di ruang kontrol | Bel mati total | Dokumentasi prosedur manual + UPS untuk PC klien |

## 10. Catatan untuk Claude Code

Saat mengembangkan, ikuti prinsip berikut:

1. Mulai dari Sprint 1 dan minta konfirmasi sebelum lanjut sprint berikutnya
2. Gunakan Bahasa Indonesia untuk semua label antarmuka, komentar boleh Bahasa Inggris
3. Hindari penggunaan em dash dan double hyphen dalam string apapun yang ditampilkan ke pengguna
4. Setiap fungsi `.gs` wajib memiliki JSDoc dengan parameter dan return type
5. Validasi input di sisi server (GAS), jangan hanya mengandalkan validasi client
6. Tulis kode modular per service, hindari logic dashboard tercampur dengan logic audio
7. Setiap commit ke repositori (jika dipakai clasp) harus disertai pesan deskriptif
8. Sediakan file `README.md` dan `INSTALL.md` di akhir Sprint 8

**Khusus Sprint 6 (Import XML):**
- Tunggu sampel file XML dari user sebelum menulis parser final
- Buat parser dengan pendekatan adaptif: deteksi root tag (`<asc_timetable>`, `<fet>`, `<timetable>`) untuk identifikasi format
- Gunakan `XmlService.parse()` bawaan GAS, jangan menulis parser regex manual
- Sediakan fungsi `analyzeXmlStructure(xmlContent)` yang menampilkan struktur tag dan jumlah node sebelum import (untuk inspeksi)
- Petakan periode jam aSc (biasanya angka 1, 2, 3) ke waktu nyata melalui sheet `PeriodeJam` yang dapat diedit admin
- Hari di aSc biasanya menggunakan kode (1=Mon, 2=Tue, dst). Sediakan mapping yang fleksibel
- Simpan file XML asli di Drive sebagai arsip dengan timestamp, supaya bisa di-reimport jika ada masalah

**Khusus Sprint 7 (Search):**
- Implementasi pencarian dengan indexing sederhana di CacheService agar tidak membaca Spreadsheet berulang
- Parser tanggal natural language mendukung minimal: "hari ini", "kemarin", "besok", "Senin", "Senin depan", "minggu depan", "1 Agustus", "01/08/2026", "1-8-2026"
- Hasil search ditampilkan dalam waktu kurang dari 1 detik untuk dataset hingga 5000 baris

---

**Dokumen ini bersifat hidup dan dapat diperbarui sesuai kebutuhan pengembangan.**

**Lampiran yang akan menyusul dari user:**
- Sampel file XML hasil export aSc Timetables (atau software penjadwal yang dipakai SMKN 2 Cimahi)
- Daftar audio yang sudah dimiliki (jika ada)
- Template kalender akademik 2026/2027
