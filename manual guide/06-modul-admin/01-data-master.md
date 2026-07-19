# Panel Admin — Data Master

**Siapa yang memakai:** Admin, Wakasek
**Menu:** Panel Admin

![Panel Admin](../gambar/admin/panel-admin.png)

Panel Admin terdiri dari 20 tab. Bab ini membahas lima tab data master yang menjadi fondasi
seluruh aplikasi. Isi tab-tab ini **dengan urutan yang benar**, karena satu bergantung pada
lainnya.

## Urutan Pengisian yang Benar

```
1. Tahun Ajaran   →  wadah bagi semua data lain
2. Mapel          →  mata pelajaran
3. Guru           →  siapa yang mengajar
4. Kelas          →  rombongan belajar + penetapan wali kelas
5. Siswa          →  siapa yang belajar, di kelas mana
6. Jadwal         →  guru × mapel × kelas × hari × jam
```

⚠️ Membuat jadwal sebelum guru, mapel, dan kelas tersedia akan gagal. Membuat siswa sebelum kelas
tersedia juga gagal.

## Tab Guru

![Tab Guru](../gambar/admin/tab/guru.png)

Menampilkan seluruh guru beserta NIP, mata pelajaran utama, peran, dan status.

- **Tambah Guru** — membuat akun guru satuan.
- **Import Excel** — memasukkan banyak guru sekaligus (lihat bab *Import Data*).
- Ikon pensil untuk menyunting, ikon tempat sampah untuk menghapus.
- Kotak pencarian menerima nama, NIP, atau mata pelajaran.

Di sini pula Admin menandai seorang guru sebagai **guru BK**. Penandaan itulah yang memunculkan
*Menu BK* di sidebar guru bersangkutan.

## Tab Siswa

![Tab Siswa](../gambar/admin/tab/siswa.png)

Daftar siswa dengan NIS, NISN, kelas, dan angkatan.

⚠️ NIS, NISN, dan NIP adalah **deretan angka panjang**, bukan bilangan. Ketika menyiapkan berkas
Excel, format kolomnya sebagai **teks**. Bila diformat sebagai angka, angka nol di depan akan
hilang dan digit terakhir dapat berubah karena pembulatan.

## Tab Kelas

![Tab Kelas](../gambar/admin/tab/kelas.png)

Kelas dibentuk dari **tingkat** (X, XI, XII), **jurusan**, dan **rombel** (A, B, …).

Di tab inilah **wali kelas ditetapkan**. Menetapkan seorang guru sebagai wali kelas pada kelas di
tahun ajaran yang sedang aktif akan langsung memunculkan *Menu Wali Kelas* pada sidebar guru itu.

Tersedia pula **Import/Export Wali Kelas** untuk penetapan massal.

## Tab Mapel

![Tab Mapel](../gambar/admin/tab/mapel.png)

Daftar mata pelajaran. Mata pelajaran adalah acuan bagi Tujuan Pembelajaran dan jadwal.

## Tab Jadwal

![Tab Jadwal](../gambar/admin/tab/jadwal.png)

Jadwal menghubungkan guru, mata pelajaran, kelas, hari, dan jam. Jadwal adalah **sumber
kebenaran** bagi banyak hal:

- Blok *Agenda Perlu Diisi* pada dashboard guru
- Daftar kelas yang boleh dipilih guru pada menu Laporan
- Perhitungan *Kosong* dan *Terisi* pada EWS Guru
- Daftar calon guru pengganti pada modul Guru Inval

⚠️ Jadwal yang salah menyebabkan guru dituduh tidak mengisi agenda untuk sesi yang sebenarnya
bukan miliknya. Periksa jadwal terlebih dahulu bila ada keluhan semacam itu.

## Tab Pengguna

![Tab Pengguna](../gambar/admin/tab/pengguna.png)

Tab **Pengguna** memiliki tiga sub-tab: **Administrator** (akun admin/wakasek/orang tua),
**Guru / Staf**, dan **Siswa**. Akun orang tua ditautkan ke satu siswa.

Pada daftar Guru/Staf dan Siswa terdapat kolom **Nama Pengguna** — yaitu kredensial yang dipakai
untuk login (NIP untuk guru, NISN untuk siswa, atau email bila keduanya tidak ada). Jadi seorang
guru yang belum memiliki NIP tetap terlihat nama penggunanya.

### Generate Akun & Reset Kata Sandi

- **Generate Akun** (sub-tab Guru/Siswa) menyetel kata sandi default untuk seluruh akun guru atau
  siswa sekaligus (nilainya diatur di berkas `.env` server).
- **Reset Kata Sandi** (ikon kunci pada satu baris) menyetel ulang kata sandi satu akun. Bila
  kolom dikosongkan, sistem memakai **kata sandi default** sesuai peran.

Setiap kali Anda menekan Generate atau Reset, muncul **kotak pemberitahuan** yang menampilkan
**untuk siapa**, **nama pengguna**, dan **kata sandi**-nya, lengkap dengan tombol **Salin Username
& Password**. Kotak ini baru tertutup setelah Anda menekan **OK, Sudah Dicatat**. Semua akun
tersebut **wajib mengganti kata sandi saat login pertama**.

💡 Catat/salin kredensial itu sebelum menutup kotak, karena kata sandi tidak ditampilkan lagi
setelahnya.

## Paginasi dan Pencarian

Seluruh tab data master menyediakan pencarian, pengurutan kolom, dan paginasi dengan pilihan
25 / 50 / 100 / Semua baris per halaman.
