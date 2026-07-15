# Lampiran

## Daftar Istilah

| Istilah | Arti |
|---|---|
| **Agenda** | Catatan resmi bahwa sebuah sesi pembelajaran telah berlangsung |
| **TP** | Tujuan Pembelajaran; diketik sekali, dipakai berulang |
| **Fase E / F** | Fase E untuk kelas X; Fase F untuk kelas XI dan XII |
| **EWS** | *Early Warning System*, sistem peringatan dini berbasis empat dimensi data |
| **Poin bersih** | Jumlah seluruh poin karakter positif dikurangi poin negatif |
| **Ambang** | Rentang poin yang memicu terbitnya rekomendasi tindakan otomatis |
| **Inval** | Guru pengganti untuk sesi tertentu |
| **HTE** | Hari Tidak Efektif; hari yang tidak dihitung sebagai hari pembelajaran |
| **Minggu efektif** | Minggu yang memuat sekurang-kurangnya tiga hari efektif |
| **Kapabilitas** | Wewenang tambahan di atas peran, yaitu Wali Kelas dan BK |
| **PWA** | *Progressive Web App*; aplikasi web yang dapat dipasang ke layar utama telepon |

## Ringkasan Aturan yang Sering Terlewat

1. **Semester menentukan segalanya.** Data yang "hilang" hampir selalu berarti Anda sedang berada
   di semester yang salah.
2. **Tanggal masa depan selalu ditolak** pada agenda, presensi, catatan, penanganan, dan refleksi.
   Tanggal masa lalu diperbolehkan.
3. **Batas waktu agenda hanya berlaku saat membuat**, tidak saat menyunting.
4. **Hanya pengajuan inval berstatus Disetujui yang memindahkan kewajiban** mengisi agenda.
5. **Sinkronisasi kalender tidak otomatis menandai hari tidak efektif.** Penandaan adalah
   tindakan sadar Admin.
6. **Hari efektif hanya dihitung di dalam rentang tanggal semester aktif.**
7. **Catatan BK privat secara bawaan.** Hanya resume penutup yang otomatis dibagikan.
8. **Nilai Karakter Manual menunggu persetujuan Admin; Nilai Tambah tidak.**
9. **TP dibagikan antar guru serumpun** pada mata pelajaran dan fase yang sama.
10. **Pengaturan cetak bersifat per akun**, bukan pengaturan global sekolah.

## Pemecahan Masalah

### Menu Wali Kelas atau Menu BK tidak muncul

Kedua menu itu adalah kapabilitas, bukan peran.

- *Menu Wali Kelas* muncul bila akun Anda ditetapkan sebagai wali kelas pada sebuah kelas
  **di tahun ajaran yang sedang aktif**. Minta Admin memeriksa tab **Kelas**.
- *Menu BK* muncul bila Admin menandai akun Anda sebagai guru BK pada tab **Guru**.

### Daftar siswa pada EWS Murid BK kosong

Guru BK hanya melihat siswa pada **kelas yang ia ampu**. Bila tidak ada penugasan kelas,
daftarnya kosong. Ini bukan kerusakan.

### Kelas yang saya ajar tidak muncul di menu Laporan

Daftar kelas diambil dari **Jadwal aktif**, bukan dari agenda yang telanjur Anda isi. Bila kelas
tidak muncul, jadwalnya belum terdaftar. Hubungi Admin.

### Agenda lama tidak bisa saya isi

Anda melewati batas waktu pengisian yang ditetapkan Admin. Batas ini hanya berlaku saat membuat
agenda baru. Hubungi Admin bila sesi itu perlu tetap diisi.

### Tanda tangan pada PDF tercetak tanpa gelar

Gelar diambil dari halaman **Profil**. Isi kolom gelar depan dan gelar belakang, lalu cetak ulang.

### Ekspor PDF gagal saat mencetak banyak kelas

Ekspor PDF Minggu Efektif dibatasi 40 lembar. Gunakan ekspor **Excel** untuk kebutuhan massal.

### Notifikasi push tidak pernah tiba

Periksa berurutan:

1. Menu **Notifikasi** — apakah sakelar push menyala dan jenis peristiwanya dicentang?
2. Apakah Anda sedang berada dalam rentang **jam tenang**?
3. Izin peramban — bila Anda pernah menekan **Blokir**, pulihkan dari pengaturan situs.
4. Hubungi Admin untuk memastikan kredensial Firebase terisi.

### Digit NIP atau NIS berubah setelah impor

Kolom Excel diformat sebagai angka. Format ulang sebagai **Teks**, lalu impor kembali. Baris yang
sudah ada akan diperbarui, bukan diduplikasi.

### Layar putih kosong

Muat ulang halaman. Bila menetap, berpindah menu biasanya memulihkan. Laporkan kepada Admin
disertai keterangan halaman mana yang Anda buka.

## Target Kinerja yang Menjadi Acuan

| Metrik | Target |
|---|---|
| Waktu pengisian agenda inti | ≤ 2 menit |
| Waktu pengisian absensi satu kelas | ≤ 90 detik |
| Waktu input satu poin karakter | ≤ 20 detik |
| Guru aktif mingguan | ≥ 90% |
| Uptime sistem | ≥ 99,5% |
| Kasus EWS yang ditindaklanjuti | ≥ 75% dari total pemicu |

## Perlindungan Data Pribadi

Aplikasi ini memuat data pribadi siswa dan guru. Seluruh pengguna terikat UU Pelindungan Data
Pribadi No. 27 Tahun 2022.

- Jangan mengunduh data siswa ke perangkat pribadi tanpa keperluan yang jelas.
- Jangan membagikan tangkapan layar berisi nama dan nilai siswa ke grup percakapan.
- Hapus berkas ekspor dari komputer bersama setelah selesai dipakai.
- Catatan konseling bersifat rahasia. Pikirkan masak-masak sebelum membagikannya.
