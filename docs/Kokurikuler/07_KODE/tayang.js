/* PAPARAN TAYANG UNTUK MURID — 5 hari */
const L = require('./tayang_lib.js');
const { deck, sampul, big, angka, tugas, aturan, dua, gambar, jeda, jurnal, tutup, T } = L;
const { HIJAU, HIJAU2, KUNING, KUNING2, BIRU, BIRU2, KORAL, KORAL2, ORANYE, ORANYE2, UNGU, UNGU2, fs } = T;

const OUT = '/sessions/vibrant-inspiring-einstein/mnt/Ko Kurikuler/SAKOLA_WALUYA_XI_2026/02_UNTUK_MURID/PAPARAN_TAYANG';
const IMG = '/sessions/vibrant-inspiring-einstein/mnt/Ko Kurikuler/SAKOLA_WALUYA_XI_2026/05_GAMBAR';
fs.mkdirSync(OUT, { recursive: true });

// ══════════════════════════════════════════ HARI 1 ══════════════════════════════════════════
{
  const p = deck(), A = HIJAU, TT = HIJAU2;
  sampul(p, { hari: 'HARI 1  ·  RABU, 15 JULI 2026', nilai: 'CAGEUR', fokus: 'KENALI DIRI', A, TT,
    arti: 'Sehat jasmani dan rohani, serta mampu mengelola emosi.\nHari ini kamu tidak mengerjakan apa-apa untuk sekolah. Hari ini kamu berhadapan dengan dirimu sendiri.' });

  big(p, { kicker: 'AGENDA HARI INI', judul: 'Yang akan kita lakukan', A, TT,
    isi: '07.45   Barometer Kebiasaan — berdiri & jujur\n09.30   Suara Waluya — isi formulir anonim\n11.00   Bentuk tim, bagi peran, pilih Zona Aksi\n11.45   Jurnal di buku tulis',
    tanda: 'Yang dinilai hari ini cuma SATU: KEJUJURAN kalian.' });

  angka(p, { kicker: 'RAPOR PENDIDIKAN SMKN 2 CIMAHI 2025', num: '5,50', cap: 'SKOR GEMAR BELAJAR\nseluruh murid SMKN 2 Cimahi', A: KORAL, TT: KORAL2,
    isi: 'Dari skala 10.\n\nDan itu skor TERENDAH dari tujuh kebiasaan kita.\n\nKalian setuju, atau tidak?' });

  gambar(p, { judul: 'Tujuh Kebiasaan kita — apa adanya', img: `${IMG}/TAYANG/T_01_Skor_7KAIH.png`, A: KORAL,
    catatan: 'Lima dari tujuh kebiasaan kita berstatus KURANG.' });

  aturan(p, { kicker: 'AKTIVITAS 1  ·  25 MENIT', judul: 'BAROMETER KEBIASAAN', A, TT,
    items: [
      'BERDIRI. Guru akan membacakan 7 pernyataan.',
      'Setiap pernyataan, PINDAH POSISI:  KIRI = "ini aku banget"  ·  TENGAH = "kadang-kadang"  ·  KANAN = "jauh dari aku"',
      'Kalau ditanya "kenapa kamu berdiri di situ?" — jawab JUJUR. Tidak ada yang salah, tidak ada yang dihukum.',
    ] });

  tugas(p, { menit: "25'", judul: 'RADAR KEBIASAANKU', A, TT, dimana: 'Google Sheet tim — lembar "H1 · RADAR KEBIASAAN"',
    langkah: [
      'Beri SKOR DIRIMU 1–10 untuk setiap kebiasaan. 10 = sudah jadi kebiasaan otomatis. 1 = tidak pernah sama sekali.',
      'Grafik radar akan muncul OTOMATIS di Sheet.',
      'Bandingkan dengan skor sekolah. Kamu di atas atau di bawah?',
    ] });

  tugas(p, { menit: "20'", judul: 'HITUNG RATA-RATA KELAS', A, TT, dimana: 'Papan tulis',
    langkah: [
      'Tujuh murid jadi PENCATAT — masing-masing memegang satu kebiasaan.',
      'Seluruh kelas menyebut skornya. Pencatat menulis di papan, lalu HITUNG RATA-RATANYA.',
      'Bandingkan dengan skor sekolah: kelas kita di atas atau di bawah? KENAPA?',
    ] });

  jeda(p);

  big(p, { kicker: 'AKTIVITAS 3  ·  ANONIM', judul: 'SUARA WALUYA', A: UNGU, TT: UNGU2,
    isi: 'Formulir ini ANONIM. Gurumu tidak tahu siapa menulis apa.\n\nAda satu kotak di bawah:  "Saya ingin berbicara dengan Guru BK."\nKalau kamu mencentangnya, HANYA Guru BK yang melihatnya — bukan wali kelasmu.\n\nKamu boleh menulis nama, boleh juga tidak.',
    tanda: 'Kalau ada sesuatu yang berat — kamu tidak sendirian.' });

  tugas(p, { menit: "12'", judul: 'ISI FORMULIRNYA', A: UNGU, TT: UNGU2, dimana: 'HP masing-masing — pindai QR di layar',
    langkah: [
      'Satu hal yang membuat saya BETAH di sekolah ini.',
      'Satu hal yang membuat saya TIDAK NYAMAN.',
      'Satu hal yang membuat saya merasa TIDAK AMAN.  (boleh dikosongkan)',
      'Seberapa aman kamu merasa di sekolah ini? (skala 1–5)',
    ] });

  tugas(p, { menit: "30'", judul: 'KELOMPOKKAN & HITUNG', A: UNGU, TT: UNGU2, dimana: 'Papan tulis, lalu salin ke Google Sheet',
    langkah: [
      'Hasil formulir akan ditayangkan di layar — TANPA NAMA siapa pun.',
      'MAJU ke papan. Kelompokkan jawaban yang mirip. Beri JUDUL tiap kelompok.',
      'HITUNG jumlah tiap kelompok. Mana yang paling banyak?',
      'VOTING KAKI: berdiri di depan kelompok yang menurutmu PALING MENDESAK.',
    ] });

  big(p, { kicker: 'AKTIVITAS 4', judul: 'Minggu ini, wali kelas kita\nSENDIRIAN.', A, TT,
    isi: 'Tidak ada guru lain yang akan masuk ke kelas ini.\n\nArtinya: kalau kita menunggu beliau mengatur segalanya, kita tidak akan selesai.\n\nJadi sebagian tugas guru sekarang jadi TUGAS KITA.\nItu bukan hukuman. Itu KEPERCAYAAN.',
    tanda: 'Setiap orang di kelas ini memegang SATU peran. Tidak ada penonton.' });

  gambar(p, { judul: 'Enam peran — pilih satu', img: `${IMG}/TAYANG/T_02_Enam_Peran.png`, A,
    catatan: 'Peran ini DIROTASI setiap hari. Semua akan merasakan semuanya.' });

  gambar(p, { judul: 'PAPAN KARTU — cara kita keluar kelas', img: `${IMG}/TAYANG/T_03_Papan_Kartu.png`, A,
    catatan: 'Ambil kartu = berangkat. Kembalikan kartu = pulang. Guru cukup melihat papan.' });

  aturan(p, { kicker: 'WAJIB DIHAFAL', judul: 'EMPAT ATURAN JELAJAH', A: KORAL, TT: KORAL2,
    items: [
      'TIDAK ADA MURID SENDIRIAN. Minimal berdua, selalu.',
      'TIDAK BOLEH keluar gerbang sekolah.',
      'Hanya di SEKTOR kelas kita. Dilarang masuk ruang KBM, ruang guru, bengkel, dan area MPLS kelas X.',
      'Pulang tepat waktu. KEMBALIKAN kartunya ke papan.',
    ] });

  tugas(p, { menit: "15'", judul: 'NORMA TIM KITA', A, TT, dimana: 'Kertas plano — ditempel di dinding kelas',
    langkah: [
      'Tulis 5 ATURAN MAIN yang kita sepakati sendiri.',
      'Pancingan: "Tidak ada yang jadi penonton."  ·  "Boleh salah, tidak boleh diam."  ·  "Kritik idenya, jangan orangnya."',
      'SEMUA menandatangani. Tempel di dinding sampai akhir semester.',
    ] });

  jurnal(p, { A, TT, pertanyaan: [
    'Satu hal yang paling MENGEJUTKAN aku hari ini.',
    'Satu hal tentang DIRIKU yang baru kusadari hari ini.',
    'Perasaanku hari ini — dan kenapa.',
  ] });

  tutup(p, { A, TT, teks: 'Besok kita tidak duduk di kelas.\nBesok kita turun ke lapangan\nmencari BUKTI.',
    sub: 'Bawa HP. Bawa alat tulis. Pakai sepatu yang nyaman.' });

  p.writeFile({ fileName: `${OUT}/TAYANG_HARI_1_CAGEUR.pptx` }).then(() => console.log('OK Hari 1'));
}

// ══════════════════════════════════════════ HARI 2 ══════════════════════════════════════════
{
  const p = deck(), A = KUNING, TT = KUNING2;
  sampul(p, { hari: 'HARI 2  ·  KAMIS, 16 JULI 2026', nilai: 'BENER', fokus: 'CARI FAKTA', A, TT,
    arti: 'Jujur, disiplin, bertanggung jawab, dan mampu berpikir kritis.\nHari ini setiap kalimat yang kalian tulis HARUS punya bukti.' });

  big(p, { kicker: 'ATURAN HARI INI', judul: '"Toilet sekolah kita kotor."', A, TT,
    isi: 'Ini FAKTA — atau OPINI?\n\nBagaimana caranya kalimat ini jadi FAKTA?',
    tanda: 'Setiap kalimat HARUS punya BUKTI: angka, foto, atau kutipan. Tidak ada buktinya? CORET.' });

  gambar(p, { judul: 'Kelas kita turun lapangan jam berapa?', img: `${IMG}/TAYANG/T_07_Sektor_Gelombang.png`, A: BIRU,
    catatan: 'Kita hanya mengukur di SEKTOR kita sendiri. Butuh data sektor lain? MINTA ke kelas itu.' });

  aturan(p, { kicker: 'SEBELUM BERANGKAT', judul: 'SIAPKAN DIRI', A: KORAL, TT: KORAL2,
    items: [
      'TIM K3 memeriksa APD: sarung tangan & masker untuk area kotor.',
      'AMBIL KARTU timmu dari Papan Kartu. Pakai.',
      'Ingat 4 Aturan Jelajah. Tidak ada murid sendirian.',
      'Gurumu MENETAP di POS. Kalau ada apa-apa — kembali ke POS dan lapor.',
    ] });

  tugas(p, { menit: "55'", judul: 'BERBURU DATA', A, TT, dimana: 'Google Sheet tim — lembar "H2 · DATA LAPANGAN"',
    langkah: [
      'Setiap tim WAJIB pulang membawa: 10 BARIS DATA ANGKA.',
      'Plus 5 FOTO.',
      'Plus 1 HAL YANG MENGEJUTKAN kalian.',
      'Etika: jangan ganggu KBM kelas lain. Minta izin sebelum memotret orang.',
    ] });

  jeda(p);

  tugas(p, { menit: "50'", judul: 'DATA JADI CERITA', A, TT, dimana: 'Google Sheet tim — kolom hitungan otomatis',
    langkah: [
      'Hitung TOTAL, RATA-RATA, dan PERSENTASE dari datamu.',
      'Buat GRAFIK. Batang, lingkaran, atau garis — kalian yang pilih.',
      'Tanyakan pada diri sendiri: "Angka ini artinya apa?"',
    ] });

  gambar(p, { judul: 'Cari AKARnya — bukan buahnya', img: `${IMG}/04_Pohon_Akar_Masalah.png`, A,
    catatan: 'BUAH = akibat yang terlihat. BATANG = masalahnya. AKAR = penyebab SEBENARNYA.' });

  aturan(p, { kicker: 'TEKNIK 5x KENAPA', judul: 'Gali sampai ke akarnya', A, TT, warnaKotak: 'FFFFFF',
    items: [
      '"Toilet bau."  →  kenapa?',
      '"Airnya tidak jalan."  →  kenapa?',
      '"Kerannya rusak."  →  kenapa?',
      '"Tidak ada yang lapor."  →  kenapa?',
      '"Tidak tahu harus lapor ke mana."',
    ] });

  big(p, { kicker: 'NAH — ITU AKARNYA', judul: 'Akarnya bukan kerannya.\nAkarnya: tidak ada kanal lapor.', A, TT,
    isi: 'Dan itu bisa dikerjakan anak RPL.',
    tanda: 'Akar yang BAIK bisa DIKERJAKAN. Akar yang BURUK cuma MENYALAHKAN ORANG.' });

  tugas(p, { menit: "45'", judul: 'RUMUSKAN MASALAHNYA', A, TT, dimana: 'Google Sheet tim — lembar "H2 · POHON AKAR MASALAH"',
    langkah: [
      'Gambar pohonnya: BUAH → BATANG → AKAR.',
      'Pakai 5x KENAPA sampai ketemu akar yang BISA DIKERJAKAN.',
      'Lalu tulis: "Masalah sebenarnya adalah ___, karena ___, dibuktikan dengan data ___."',
    ] });

  jurnal(p, { A, TT, pertanyaan: [
    'Satu data yang membuatku BERPIKIR ULANG tentang sekolahku.',
    'Hari ini aku JUJUR, atau aku MENGHINDAR? Jelaskan.',
    'Apa yang paling sulit hari ini?',
  ] });

  tutup(p, { A, TT, teks: 'Data tidak tahu rasanya.\nManusia tahu.',
    sub: 'Besok kita berhenti mengukur.\nBesok kita MENDENGARKAN.' });

  p.writeFile({ fileName: `${OUT}/TAYANG_HARI_2_BENER.pptx` }).then(() => console.log('OK Hari 2'));
}

// ══════════════════════════════════════════ HARI 3 ══════════════════════════════════════════
{
  const p = deck(), A = KORAL, TT = KORAL2;
  sampul(p, { hari: 'HARI 3  ·  JUMAT, 17 JULI 2026', nilai: 'BAGEUR', fokus: 'RASAKAN & PILIH', A, TT,
    arti: 'Berakhlak mulia, peduli terhadap sesama dan lingkungan.\nHari ini kita tidak mengukur apa-apa. Hari ini kita MENDENGARKAN.' });

  big(p, { kicker: 'PERTANYAAN PEMBUKA', judul: 'Dari semua masalah kemarin —\nSIAPA yang paling menderita?', A, TT,
    isi: 'Sebut ORANGNYA. Bukan kelompoknya.\n\n"Semua orang" artinya TIDAK ADA ORANG.',
    tanda: 'Hari ini berakhir pukul 11.00 — dilanjutkan Shalat Jumat.' });

  big(p, { kicker: 'NGAJUGJUG', judul: 'Kita yang MENGHAMPIRI mereka.', A, TT,
    isi: 'Pak Caraka, satpam, ibu kantin — mereka TIDAK dikumpulkan.\nMereka tetap bekerja seperti biasa, di tempatnya.\n\nKITA yang datang. Dan kita melihat langsung bagaimana mereka bekerja.',
    tanda: 'Yang menghampiri narasumber kunci HANYA 3 orang: Kapten + pencatat + dokumentasi.' });

  aturan(p, { kicker: 'HAFALKAN  ·  1 dari 2', judul: 'ETIKA NGAJUGJUG', A, TT,
    items: [
      'Beri salam. Minta izin: "Bapak/Ibu, boleh minta waktu 10 menit? Kalau sedang sibuk, kami bisa kembali nanti."',
      'MAKSIMAL 10 MENIT. Lewat itu — PAMIT. Beliau sedang bekerja.',
      'Mau merekam suaranya? TANYA DULU.',
    ] });

  aturan(p, { kicker: 'HAFALKAN  ·  2 dari 2', judul: 'ETIKA NGAJUGJUG', A, TT,
    items: [
      'Beliau MENOLAK atau SIBUK? JANGAN DIPAKSA. Kembali ke kelas, lapor.',
      'Menerima penolakan dengan sopan — itu juga BAGEUR.',
      'Sebelum pamit: "Hari Selasa kami akan tunjukkan hasilnya ke Bapak/Ibu." — DAN TEPATI.',
    ] });

  dua(p, { judul: 'Cara bertanya yang benar', A,
    kiriJudul: 'BUKA CERITANYA',
    kiri: '"Bapak, boleh cerita — bagian mana dari pekerjaan Bapak yang paling melelahkan?"\n\n"Kalau Bapak boleh mengubah satu hal di sekolah ini, apa?"\n\nlalu:  DENGAR.  JANGAN MEMOTONG.  TANYA LAGI "kenapa".',
    kananJudul: 'JANGAN MENGGIRING',
    kanan: '"Toiletnya kotor ya, Pak?"\n\n"Capek ya Pak kerjanya?"\n\nPertanyaan seperti ini sudah menyiapkan jawabannya. Kita jadi tidak mendengar apa-apa yang baru.' });

  tugas(p, { menit: "55'", judul: 'WAWANCARA', A, TT, dimana: 'Google Sheet tim — lembar "H3 · WAWANCARA"',
    langkah: [
      'Wawancarai MINIMAL 3 orang.',
      'Pulang membawa 3 KUTIPAN LANGSUNG — kalimat PERSIS mereka, dalam tanda kutip.',
      'Jangan diringkas jadi kalimatmu sendiri. Tulis apa adanya.',
    ] });

  jeda(p);

  gambar(p, { judul: 'PETA EMPATI', img: `${IMG}/TAYANG/T_05_Peta_Empati.png`, A,
    catatan: 'Isi berdasarkan apa yang benar-benar kalian LIHAT & DENGAR — bukan tebakan.' });

  gambar(p, { judul: 'MATRIKS PRIORITAS', img: `${IMG}/TAYANG/T_06_Matriks_Prioritas.png`, A,
    catatan: 'Yang masuk kotak KANAN-ATAS = kandidat terkuat.' });

  tugas(p, { menit: "60'", judul: 'PILIH SATU MASALAH', A, TT, dimana: 'Google Sheet tim — lembar "H3 · PETA EMPATI" & "H3 · MATRIKS"',
    langkah: [
      'Isi PETA EMPATI untuk satu narasumber utama.',
      'Petakan semua masalah pada MATRIKS: DAMPAK × BISA KAMI KERJAKAN (2 hari, tanpa mesin).',
      'VOTING KAKI — 3 stiker per murid. Yang terbanyak MENANG.',
      'Tulis besar-besar: MASALAH KAMI  ·  ORANG YANG KAMI BANTU  ·  TARGET SELESAI SELASA.',
    ] });

  big(p, { kicker: 'JUMAT BERKAH', judul: 'Terima kasih untuk yang tidak terlihat.', A, TT,
    isi: 'Tulis UCAPAN TERIMA KASIH untuk narasumbermu.\nLalu SERAHKAN langsung ke beliau.\n\nBukan lewat guru. Kalian sendiri.',
    tanda: 'Dan hari Selasa nanti — TEPATI janji kalian. Undang beliau ke Gelar Karya.' });

  jurnal(p, { A, TT, pertanyaan: [
    'Hari ini aku mendengar sesuatu yang tak pernah kupikirkan, yaitu...',
    'Siapa orang di sekolah ini yang selama ini tak pernah kuperhatikan, tapi ternyata penting?',
    'Apa yang paling sulit hari ini?',
  ] });

  tutup(p, { A, TT, teks: 'Senin, kita mulai membuat.', sub: 'Bawa ide. Bawa keberanian untuk gagal.' });

  p.writeFile({ fileName: `${OUT}/TAYANG_HARI_3_BAGEUR.pptx` }).then(() => console.log('OK Hari 3'));
}

// ══════════════════════════════════════════ HARI 4 ══════════════════════════════════════════
{
  const p = deck(), A = BIRU, TT = BIRU2;
  sampul(p, { hari: 'HARI 4  ·  SENIN, 20 JULI 2026', nilai: 'PINTER', fokus: 'RANCANG & BUAT', A, TT,
    arti: 'Cerdas, komunikatif, adaptif, dan berwawasan kebangsaan.\nHari ini kalian membuat sesuatu dengan tangan dan keahlian kalian sendiri.' });

  big(p, { kicker: 'PRINSIP HARI INI', judul: 'JELEK DULUAN,\nBAGUS BELAKANGAN.', A, TT,
    isi: 'Jangan habiskan waktu menggambar rancangan yang indah.\n\nBuat SESUATU yang bisa DISENTUH hari ini — walaupun jelek.\n\nPurwarupa jelek yang bisa diuji jauh lebih berharga daripada rancangan cantik yang tidak pernah jadi.',
    tanda: 'Dalam 90 menit pertama, harus sudah ada BENDA / LAYAR / GAMBAR yang bisa disentuh.' });

  big(p, { kicker: 'BACA BAIK-BAIK', judul: 'Kita TIDAK masuk bengkel.', A: KORAL, TT: KORAL2,
    isi: 'Wali kelas kita sendirian. Tidak ada toolman.\n\nSemua dikerjakan DI KELAS INI — dengan tangan kalian, kardus, dan HP/laptop kalian.\n\nJustru itu tantangannya:\nbisa tidak kalian bikin sesuatu yang BENAR-BENAR DIPAKAI, hanya dengan kardus dan otak kalian?' });

  dua(p, { judul: 'ALAT: yang boleh & yang dilarang', A,
    kiriJudul: 'BOLEH',
    kiri: 'Gunting · cutter · gergaji tangan kecil · obeng · tang · palu kecil · amplas\n\nLem · double tape · cable ties\n\nKardus · pipa PVC · kayu ringan · botol bekas\n\nLaptop & HP',
    kananJudul: 'DILARANG MUTLAK',
    kanan: 'Mesin bubut · frais · gerinda · las · bor listrik · kompresor\n\nMenyolder · listrik 220V\n\nNaOH · asam kuat · api & pemanasan\n\nNaik ke ketinggian lebih dari 1 meter' });

  big(p, { kicker: 'KARYAMU BUTUH MESIN?', judul: 'Buat purwarupa 1:1 dari kardus.', A, TT,
    isi: 'Plus GAMBAR KERJA lengkap — dengan ukuran dan bahan.\n\nHari Selasa, kalian akan MENYERAHKANNYA SECARA RESMI kepada Wakasek Sarpras, di depan semua pengunjung Gelar Karya.\n\nKaprog yang akan memfabrikasinya setelah kegiatan ini.',
    tanda: 'Penyerahan resmi itu TETAP dihitung sebagai AKSI NYATA.' });

  tugas(p, { menit: "20'", judul: 'BADAI IDE  6–3–5', A, TT, dimana: 'Google Sheet tim — lembar "H4 · IDE & RANCANGAN"',
    langkah: [
      'Enam orang per meja. Tulis 3 IDE dalam 5 MENIT. SENYAP — tidak boleh bicara.',
      'GESER lembarmu ke kanan. Teman akan MENGEMBANGKAN idemu — bukan mengkritiknya.',
      'Ulangi 3 putaran. Hasilnya: puluhan ide dalam 15 menit, tanpa ada yang mendominasi.',
    ] });

  aturan(p, { kicker: 'PILIH SATU IDE', judul: 'HARUS LOLOS 4 SYARAT', A, TT,
    items: [
      'MEMAKAI kompetensi keahlian kelas kita.',
      'BISA dikerjakan TANPA mesin & TANPA bahan berbahaya.',
      'SELESAI dalam 2 hari.',
      'Benar-benar MENOLONG orang yang kita wawancarai hari Jumat.',
    ] });

  big(p, { kicker: 'PERINGATAN', judul: 'Ada satu saja yang tidak tercentang?\nBUANG IDENYA.', A: KORAL, TT: KORAL2,
    isi: 'Lebih baik SATU ide sederhana\nyang benar-benar jadi dan benar-benar DIPAKAI —\n\ndaripada satu ide hebat\nyang tidak pernah keluar dari kertas.',
    tanda: 'Kalian punya 2 hari. Pilih yang bisa SELESAI.' });

  jeda(p);

  tugas(p, { menit: "70'", judul: 'BUAT PURWARUPANYA', A, TT, dimana: 'Meja kelas — geser mejanya',
    langkah: [
      'TIM K3 memeriksa alat & APD lebih dulu. Kalau TIM K3 bilang BERHENTI — semua berhenti, TERMASUK GURU.',
      'Kerjakan. Boleh jelek. Yang penting ADA WUJUDNYA.',
      'Selesai: TIM LOGISTIK memimpin pembersihan. TIM K3 menghitung ulang alat — jangan sampai ada cutter yang hilang.',
    ] });

  tugas(p, { menit: "35'", judul: 'SILIH ASAH — nilai tim lain', A, TT, dimana: 'Google Sheet tim — lembar "H4 · SILIH ASAH"',
    langkah: [
      'Untuk 3 tim lain, tulis:  Yang SUDAH JALAN ___  ·  Yang BELUM JALAN ___  ·  Satu SARAN saya ___',
      'DILARANG menulis "bagus" tanpa alasan. Itu tidak menolong siapa pun.',
      'KRITIK IDENYA, JANGAN ORANGNYA. Kritik yang jujur adalah bentuk kasih sayang.',
    ] });

  jurnal(p, { A, TT, pertanyaan: [
    'Apa yang paling SULIT hari ini?',
    'SIAPA yang menolongku melewatinya? Apa yang dia lakukan?',
    'Hari ini aku jadi orang yang MENOLONG, atau yang DITOLONG? Jujur.',
  ] });

  tutup(p, { A, TT, teks: 'Besok, sesuatu harus\nBENAR-BENAR BERUBAH\ndi sekolah ini.',
    sub: 'Bukan dipamerkan. BERUBAH.' });

  p.writeFile({ fileName: `${OUT}/TAYANG_HARI_4_PINTER.pptx` }).then(() => console.log('OK Hari 4'));
}

// ══════════════════════════════════════════ HARI 5 ══════════════════════════════════════════
{
  const p = deck(), A = ORANYE, TT = ORANYE2;
  sampul(p, { hari: 'HARI 5  ·  SELASA, 21 JULI 2026', nilai: 'SINGER', fokus: 'BERTINDAK & BERBAGI', A, TT,
    arti: 'Tangkas, kreatif, dan BERANI MENGAMBIL TINDAKAN.\n"Tidak hanya berpikir dan berbicara — tetapi juga berani melakukan tindakan yang membawa manfaat."' });

  tutup(p, { A: KORAL, TT: KORAL2,
    teks: 'Kalau hari ini tidak ada satu pun hal yang berubah di sekolah ini — lima hari kita GAGAL.',
    sub: 'Bukan dipamerkan.\nBERUBAH.' });

  tugas(p, { menit: "10'", judul: 'FOTO "BEFORE" DULU', A, TT, dimana: 'Google Sheet tim — lembar "H5 · AKSI & GELAR KARYA"',
    langkah: [
      'TIM DOKUMENTASI: ambil foto titik sasaran SEBELUM kita sentuh apa pun.',
      'Ingat sudut pengambilannya. Nanti foto "AFTER" harus dari SUDUT YANG SAMA.',
      'Tanpa foto BEFORE — tidak ada bukti perubahan.',
    ] });

  aturan(p, { kicker: 'PEMASANGAN', judul: 'TANPA BOR LISTRIK', A, TT,
    items: [
      'BOLEH: cable ties ke pagar/teralis/tiang  ·  double tape busa kuat  ·  gantungan tempel  ·  tali  ·  benda berdiri bebas',
      'BOLEH: memanfaatkan paku atau kait YANG SUDAH ADA.',
      'HARUS MENGEBOR? JANGAN. Tulis SURAT PERMOHONAN PEMASANGAN — kalian sendiri yang menulis, bukan guru.',
      'Serahkan suratnya langsung ke Wakasek Sarpras di Gelar Karya nanti.',
    ] });

  tugas(p, { menit: "45'", judul: 'AKSI NYATA', A, TT, dimana: 'Titik sasaran di sektor kita',
    langkah: [
      'Pasang. Jalankan. Uji. Perbaiki.',
      'Lalu FOTO "AFTER" dari SUDUT YANG SAMA.',
      'TEMUI NARASUMBERMU. Tunjukkan hasilnya. Minta 1 kalimat tanggapan dari beliau.',
    ] });

  jeda(p);

  big(p, { kicker: 'GELAR KARYA LORONG', judul: 'Stan kalian di depan kelas sendiri.', A, TT,
    isi: 'WAJIB dipajang:\n\n·  Karya kalian\n·  Grafik data & plano\n·  Foto BEFORE – AFTER\n·  Kutipan narasumber\n·  Peta Empati',
    tanda: 'RONDE 1: Gelombang BIRU tuan rumah, JINGGA berkunjung.  ·  RONDE 2: bertukar.' });

  aturan(p, { kicker: 'HAFALKAN', judul: 'PRESENTASI 60 DETIK', A, TT, warnaKotak: 'FFFFFF',
    items: [
      'Kami MENEMUKAN ______     (sebut 1 ANGKA)',
      'Kami MENDENGAR ______     (sebut 1 KUTIPAN narasumber)',
      'Kami MEMBUAT ______        (sebut KARYANYA)',
      'Sekarang ______              (sebut PERUBAHANNYA)',
    ] });

  big(p, { kicker: 'INGAT', judul: 'KALIAN yang bicara.\nBukan guru.', A, TT,
    isi: 'Kepala Sekolah akan datang. Kaprog akan datang.\nDan Pak Caraka, satpam, ibu kantin yang kalian wawancarai — mereka juga DIUNDANG.\n\nKalian sudah berjanji akan menunjukkan hasilnya kepada mereka.\nHari ini kalian menepatinya.' });

  tugas(p, { menit: "25'", judul: 'RADAR KEBIASAANKU — MINGGU INI', A, TT, dimana: 'Google Sheet tim — lembar "H5 · RADAR ULANG"',
    langkah: [
      'Isi ULANG skor 7 kebiasaanmu. Bandingkan dengan Hari 1.',
      'Apa yang BERUBAH? Apa yang TIDAK berubah? Kenapa?',
      'Lima hari terlalu singkat untuk mengubah kebiasaan. Yang berubah biasanya bukan kebiasaannya — tapi KESADARANNYA. Itu sudah cukup untuk memulai.',
    ] });

  big(p, { kicker: 'DI BUKU TULISMU  ·  15 MENIT', judul: 'KONTRAK KEBIASAAN WALUYA', A, TT,
    isi: 'Pilih SATU kebiasaan dari 7 KAIH\nyang akan kamu jalankan sampai akhir semester.',
    tanda: 'Tanda tangani. Bawa pulang untuk ditandatangani ORANG TUA. Kembalikan Jumat 24 Juli.' });

  aturan(p, { kicker: 'TULIS LIMA HAL INI', judul: 'Kontrakmu harus SPESIFIK', A, TT, warnaKotak: 'FFFFFF',
    items: [
      'APA yang akan kulakukan — sekecil mungkin, supaya BERHASIL.',
      'KAPAN tepatnya. Jam berapa.',
      'BAGAIMANA aku mengukurnya.',
      'SIAPA yang akan mengingatkanku. Sebut NAMA ORANG — bukan "diri sendiri".',
      'Apa yang mungkin MENGGAGALKANKU — dan rencanaku kalau itu terjadi.',
    ] });

  big(p, { kicker: 'PERINGATAN', judul: 'Mulai dari yang KECIL.', A: KORAL, TT: KORAL2,
    isi: 'Jangan tulis:  "Tidur jam 9 setiap hari, mulai besok."\nKamu akan gagal di hari ketiga, lalu menyerah.\n\nTulis:  "Tidur 30 menit lebih awal dari biasanya."\nKalau berhasil — baru naikkan.',
    tanda: 'Kontrak KECIL yang BERHASIL jauh lebih baik daripada kontrak BESAR yang GAGAL.' });

  jurnal(p, { A, TT, pertanyaan: [
    'Apa yang KAMI ubah di sekolah ini minggu ini?',
    'Apa yang berubah DI DALAM DIRIKU?',
    'Kalau aku bisa bicara pada diriku di hari Rabu lalu, aku akan bilang: ...',
  ] });

  tutup(p, { A, TT, teks: '"Minggu depan saya akan ______."',
    sub: 'Satu kalimat. Dari setiap orang.\n\nCAGEUR · BAGEUR · BENER · PINTER · SINGER' });

  p.writeFile({ fileName: `${OUT}/TAYANG_HARI_5_SINGER.pptx` }).then(() => console.log('OK Hari 5'));
}
