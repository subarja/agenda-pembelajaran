# Panduan Menyusun Dokumen Word Final

Dokumen ini menjelaskan bagaimana berkas
`keluaran/Panduan-Pengguna-Agenda-Pembelajaran.docx` dihasilkan, bagaimana membangunnya ulang
setelah panduan diperbarui, dan apa saja yang perlu dirapikan secara manual sesudahnya.

## Prinsip

Markdown adalah **sumber tunggal**. Dokumen Word tidak pernah disunting sebagai titik awal —
ia selalu dibangun ulang dari Markdown. Menyunting `.docx` secara langsung berarti perubahan itu
hilang pada pembangunan berikutnya.

Alasannya sederhana: panduan ini punya lima keluaran (Markdown, Word, dan empat PowerPoint).
Menjaga lima berkas tetap selaras secara manual mustahil.

## Rantai Pembangunan

```
berkas .md  ──►  skrip/md.mjs  ──►  skrip/build-docx.mjs  ──►  keluaran/*.docx
   │              (pengurai)          (perakit dokumen)
   └────────────────────────────────► skrip/build-pptx.mjs ──►  keluaran/*.pptx
gambar/*.png ─────────────────────────────────┘
```

## Cara Membangun Ulang

```bash
cd "manual guide/skrip"
npm install        # sekali saja
npm run all        # membangun Word + 4 PowerPoint
```

Atau satu per satu:

```bash
npm run docx
npm run pptx
```

## Urutan Bab

Urutan bab ditentukan larik `CHAPTERS` di dalam `skrip/build-docx.mjs`. Untuk menambah bab baru:

1. Buat berkas `.md` di tempat yang sesuai.
2. Tambahkan lintasannya ke `CHAPTERS` pada posisi yang dikehendaki.
3. Bangun ulang.

Berkas yang tidak terdaftar di `CHAPTERS` **tidak** ikut masuk ke dokumen Word, meski ada di folder.

## Anatomi Dokumen yang Dihasilkan

| Bagian | Asal |
|---|---|
| Halaman sampul | Fungsi `coverPage()` di `build-docx.mjs` |
| Daftar isi | Bidang TOC Word, terisi dari Heading 1–2 |
| Isi | Tiap berkas `.md`, dipisahkan pemutus halaman |
| Catatan kaki halaman | Nomor halaman otomatis |

Tata letak: kertas A4, margin 2 cm di keempat sisi, huruf Calibri.

## Subset Markdown yang Didukung

Pengurai di `skrip/md.mjs` sengaja dibuat terbatas agar keluaran Word dapat dikendalikan persis.
Yang dikenali:

| Sintaks | Hasil di Word |
|---|---|
| `# `, `## `, `### ` | Heading 1, 2, 3 — masuk ke daftar isi (level 1–2) |
| Paragraf biasa | Paragraf, spasi baris 1,25 |
| `- ` atau `* ` | Daftar berpoin |
| `1. ` | Daftar bernomor |
| `\| a \| b \|` + baris pemisah | Tabel berbingkai, baris judul berlatar abu-abu |
| `![alt](path.png)` | Gambar terpusat + keterangan miring di bawahnya |
| `> ` | Kutipan dengan garis tepi kiri |
| ```` ``` ```` | Blok kode berlatar abu-abu, huruf Consolas |
| `**tebal**`, `` `kode` ``, `*miring*` | Penekanan inline |
| `---` | Diabaikan (garis pemisah tidak dicetak) |

⚠️ Sintaks lain — daftar bersarang, tautan, tabel HTML, catatan kaki — **tidak** dikenali dan akan
tercetak apa adanya sebagai teks biasa. Bila memerlukannya, perluas `md.mjs` lebih dahulu.

## Aturan Gambar

- Format **PNG** saja. Ukurannya dibaca langsung dari header berkas.
- Lebar maksimal 600 piksel (≈ 15,9 cm) — pas untuk A4 bermargin 2 cm. Gambar yang lebih kecil
  tidak diperbesar.
- Lintasan gambar bersifat **relatif terhadap berkas `.md` yang merujuknya**. Dari dalam
  `03-modul-guru/`, tulis `../gambar/guru/dashboard.png`.
- Teks `alt` menjadi keterangan gambar. Tulislah kalimat yang bermakna, bukan "screenshot 1".
- Gambar yang tidak ditemukan tidak menggagalkan pembangunan — ia dicetak sebagai teks merah
  `[gambar hilang: ...]`. Periksa keluaran konsol setelah membangun.

## Yang Harus Dikerjakan Manual di Word

Ada satu hal yang tidak dapat dilakukan skrip:

**Perbarui daftar isi.** Word menyimpan bidang TOC, tetapi nomor halaman baru terisi ketika
dokumen dibuka dan bidangnya dimutakhirkan.

1. Buka dokumen di Microsoft Word.
2. Klik di area Daftar Isi.
3. Tekan **F9**.
4. Pilih **Update entire table**, lalu simpan.

Di LibreOffice Writer: menu **Tools → Update → Update All**.

## Memeriksa Hasil Sebelum Dibagikan

```bash
# Jumlah gambar yang benar-benar tertanam
unzip -l keluaran/Panduan-Pengguna-Agenda-Pembelajaran.docx | grep -c "word/media/"

# Pastikan tidak ada gambar yang gagal ditemukan
unzip -p keluaran/Panduan-Pengguna-Agenda-Pembelajaran.docx word/document.xml | grep -c "gambar hilang"
```

Perintah kedua harus menghasilkan `0`.

## Memperbarui Tangkapan Layar

Seluruh tangkapan layar diambil dari basis data demo berisi **nama fiktif**, bukan data siswa
sebenarnya. Ini bukan kehati-hatian yang berlebihan: dokumen ini dibagikan, dan basis data
produksi memuat data pribadi ribuan siswa yang dilindungi UU No. 27 Tahun 2022.

Bila antarmuka aplikasi berubah dan tangkapan layar perlu diperbarui:

1. Siapkan basis data terpisah, lalu jalankan seeder demo (`FullDemoSeeder`) yang menghasilkan
   guru, kelas, dan siswa fiktif.
2. Arahkan satu salinan aplikasi ke basis data itu.
3. Ambil tangkapan layar dan simpan ke `gambar/<peran>/` dengan nama yang sudah ada, agar seluruh
   rujukan Markdown tetap sah.
4. Bangun ulang keluaran.

⚠️ Jangan pernah mengambil tangkapan layar dari basis data produksi.

## Paparan PowerPoint

`skrip/build-pptx.mjs` tidak membaca Markdown. Isi tiap dek didefinisikan langsung dalam objek
`DECKS` di dalam skrip itu, karena paparan menuntut penyuntingan yang jauh lebih ketat daripada
dokumen: satu slide memuat lima poin, bukan lima paragraf.

Empat dek dihasilkan: `Paparan-Guru`, `Paparan-Wali-Kelas`, `Paparan-BK`, dan `Paparan-Admin`.

Tersedia empat jenis slide siap pakai: `contentSlide` (poin + tangkapan layar),
`screenshotSlide` (gambar besar), `tableSlide`, dan `sectionSlide` (pemisah bab). Bila menambah
slide, gunakan salah satunya agar tampilan seluruh dek tetap seragam.
