const L = require('./lib.js');
const { P, H1, H2, H3, TITLE, TBL, BOX, SPACER, PB, save, AlignmentType, TextRun, CW, GOLD, LIGHT, ROSE, GREEN, NAVY, BLUE } = L;

const R = require('./rev.js');
const R2 = require('./rev2.js');
const R3 = require('./rev3.js');

const c = [];
const push = (...x) => x.forEach(i => Array.isArray(i) ? c.push(...i) : c.push(i));

// ============ COVER ============
push(P('PEMERINTAH DAERAH PROVINSI JAWA BARAT — DINAS PENDIDIKAN', { align: AlignmentType.CENTER, bold: true, size: 19, color: '595959', spaceAfter: 20 }));
push(P('SMK NEGERI 2 CIMAHI', { align: AlignmentType.CENTER, bold: true, size: 24, color: NAVY, spaceAfter: 300 }));
push(TITLE('SAKOLA WALUYA', 'Ngamimitian ti Diri, Mere Mangpaat pikeun Sakola'));
push(P('“Memulai dari diri, memberi manfaat untuk sekolah”', { align: AlignmentType.CENTER, italics: true, size: 20, color: '595959', spaceAfter: 240 }));
push(P('RANCANGAN KEGIATAN KOKURIKULER', { align: AlignmentType.CENTER, bold: true, size: 28, color: BLUE, spaceAfter: 40 }));
push(P('Kelas XI · Tahun Pelajaran 2026/2027 · Semester Ganjil', { align: AlignmentType.CENTER, bold: true, size: 22, spaceAfter: 30 }));
push(P('15 – 21 Juli 2026 (5 Hari Efektif) · Pukul 06.30 – 12.00 WIB', { align: AlignmentType.CENTER, size: 21, spaceAfter: 280 }));

push(TBL([2600, 7038], null, R.COVER_ROWS, { headFill: NAVY, zebra: true, size: 20 }));

push(SPACER());
push(P('Dokumen 1 dari 3 — Modul Induk & Rancangan', { align: AlignmentType.CENTER, italics: true, size: 18, color: '7F7F7F' }));
push(P('Dokumen pendamping: (2) Panduan Guru Fasilitator · (3) Lembar Kerja Siswa “Jurnal Waluya”', { align: AlignmentType.CENTER, italics: true, size: 18, color: '7F7F7F' }));
push(PB());

// ============ BAB I ============
push(H1('BAB I — MENGAPA KEGIATAN INI, MENGAPA SEKARANG'));

push(H2('A. Titik Berangkat: Rapor Pendidikan SMKN 2 Cimahi 2025'));
push(P('Kegiatan ini tidak dirancang dari selera, melainkan dari data. Panduan Kokurikuler 2025 menegaskan bahwa kegiatan kokurikuler “tidak dirancang secara acak atau sekadar tambahan kegiatan” dan “harus berangkat dari identifikasi dimensi profil lulusan yang ingin dikuatkan”. Berikut temuan Rapor Pendidikan SMKN 2 Cimahi tahun 2025 (data diperbarui 9 Mei 2026) yang menjadi dasar seluruh rancangan ini.'));

push(H3('1. Indikator D.19 — Tujuh Kebiasaan Anak Indonesia Hebat: 6,57 (SEDANG)'));
push(P('Ini adalah temuan paling telak. Lima dari tujuh kebiasaan berstatus KURANG.'));
push(TBL([3200, 1300, 1600, 3538], ['Kebiasaan (D.19)', 'Skor', 'Status', 'Makna Praktis'], [
  ['Gemar Belajar (D.19.5)', '5,50', 'KURANG', 'Terendah dari tujuh. Belajar belum menjadi kebutuhan, masih menjadi kewajiban.'],
  ['Berolahraga (D.19.3)', '5,92', 'KURANG', 'Aktivitas fisik harian sangat rendah.'],
  ['Bermasyarakat (D.19.6)', '6,41', 'KURANG', 'Kepedulian & keterlibatan sosial belum terbentuk.'],
  ['Tidur Cepat (D.19.7)', '6,41', 'KURANG', 'Ritme tidur berantakan — berdampak langsung pada fokus belajar pagi.'],
  ['Makan Sehat & Bergizi (D.19.4)', '6,44', 'KURANG', 'Relevan langsung dengan program MBG yang sedang berjalan.'],
  ['Beribadah (D.19.2)', '7,34', 'Sedang', 'Relatif lebih baik, tetap perlu penguatan.'],
  ['Bangun Pagi (D.19.1)', '7,93', 'Sedang', 'Tertinggi, namun belum “Baik”.'],
], { size: 19 }));

push(SPACER());
push(H3('2. Indikator A.3 — Karakter: 57,46 (Baik, namun rapuh di dua titik)'));
push(TBL([3400, 1400, 1900, 2938], ['Sub-dimensi', 'Skor', 'Perubahan', 'Catatan'], [
  ['A.3.3 Kreativitas', '54,31', 'Naik 1,72', 'TERENDAH dari enam sub-dimensi karakter.'],
  ['A.3.2 Gotong Royong', '54,70', 'TURUN 3,09', 'Satu-satunya sub-dimensi karakter yang TURUN.'],
  ['A.3.4 Nalar Kritis', '56,75', 'Naik 0,23', 'Nyaris stagnan.'],
  ['A.3.5 Kebinekaan Global', '56,29', 'Naik 1,90', '—'],
  ['A.3.6 Kemandirian', '58,50', 'Naik 3,88', '—'],
  ['A.3.1 Beriman & Berakhlak Mulia', '59,72', 'Naik 2,09', 'Tertinggi.'],
], { size: 19 }));

push(SPACER());
push(H3('3. Akar Masalah Resmi: D.1.3 Metode Pembelajaran = 56,79 (TURUN 2,21)'));
push(BOX('Ini vonis paling penting dari Rapor', [
  'Dalam Lembar “Rekomendasi Prioritas PBD”, indikator D.1.3 Metode Pembelajaran muncul sebagai AKAR MASALAH untuk EMPAT indikator prioritas sekaligus: D.1 Kualitas Pembelajaran, A.3 Karakter, A.1 Literasi, dan A.2 Numerasi.',
  'Kutipan rekomendasi: “Praktik pembelajaran interaktif yang sesuai dengan tujuan pembelajaran dan karakteristik siswa oleh Guru dapat mendukung kemampuan siswa dalam aspek karakter.”',
  'Terjemahan bebasnya: rapor sendiri sedang mengatakan bahwa pembelajaran di SMKN 2 Cimahi masih kurang interaktif dan kurang adaptif. Karena itu, seluruh rancangan SAKOLA WALUYA dibangun di atas satu aturan tunggal: GURU TIDAK MENGAJAR — GURU MEMFASILITASI. Jika dalam satu sesi guru berbicara lebih dari 25% waktu, sesi itu gagal.',
], GOLD, 'BF8F00'));

push(SPACER());
push(H3('4. Sinyal Bahaya Lain yang Ikut Disasar'));
push(TBL([1500, 3600, 1500, 3038], ['Kode', 'Indikator', 'Angka', 'Implikasi untuk Kegiatan Ini'], [
  ['E.7.2', 'Indeks Sanitasi Satuan Pendidikan', '30 — KURANG', 'MASALAH FISIK NYATA & TERLIHAT. Ini menjadi kandidat utama Zona Aksi (air layak, toilet, wastafel).'],
  ['D.4.1', 'Kesejahteraan psikologis (wellbeing) murid', '59,30', 'Peringkat menengah BAWAH (61–80%). Siswa tidak merasa sejahtera di sekolah.'],
  ['D.4.10', 'Pengalaman murid terkait rokok, miras, narkoba', '70% (turun 19,47)', 'Sekitar 30% murid terpapar. Naik tajam dari tahun lalu.'],
  ['D.4.4', 'Pengalaman perundungan murid', '86,67% (turun 8,33)', 'Perundungan meningkat.'],
  ['A.2', 'Numerasi — proporsi “jauh di bawah kompetensi”', '0% → 4,44%', 'Muncul kelompok murid yang tertinggal jauh. Numerasi perlu latihan kontekstual.'],
  ['A.1.5', 'Literasi L3 (mengevaluasi & merefleksikan)', 'Turun 5,62', 'Kemampuan refleksi lemah → jurnal refleksi menjadi wajib, bukan tempelan.'],
  ['E.1.1', 'Partisipasi orang tua', '56,67 (turun 2,42)', 'Kontrak Kebiasaan ditandatangani orang tua sebagai jembatan.'],
  ['A.4.4', 'Keselarasan bidang kerja lulusan', '43,42% — KURANG', 'Projek harus berbasis kompetensi keahlian, bukan kegiatan generik.'],
], { size: 18 }));

push(PB());

// ============ BAB II ============
push(H1('BAB II — LANDASAN & PEMETAAN KERANGKA'));

push(H2('A. Dasar Hukum & Rujukan'));
push(TBL([3000, 6638], ['Rujukan', 'Isi yang Dipakai'], [
  ['Panduan Kokurikuler 2025 (BSKAP, Kemendikdasmen)', 'Definisi kokurikuler; 4 kriteria kegiatan; 3 bentuk kokurikuler; alokasi 144 JP/tahun untuk kelas XI SMK; format modul A–H; rubrik SB/B/C/K; pelaporan di kolom Kokurikuler rapor.'],
  ['Panduan Implementasi Pancawaluya Jenjang SMK (Disdik Jabar)', 'Lima nilai inti (Cageur, Bageur, Bener, Pinter, Singer); profil Manusa Waluya; model internalisasi nilai; asesmen triangulasi; SIPALAWA.'],
  ['SE Gubernur Jawa Barat No. 45/PK.03.03/KESRA (6 Mei 2025)', '9 Langkah Pembangunan Pendidikan Jawa Barat Menuju Terwujudnya Gapura Panca Waluya. Catatan: kegiatan ini SUDAH SESUAI Langkah ke-3 (larangan piknik/study tour, diganti kegiatan berbasis inovasi & pengelolaan sampah/lingkungan mandiri) dan Langkah ke-5 (bekal & makan sehat / MBG).'],
  ['Surat Edaran Tiga Menteri, 16 Januari 2025', 'Gerakan 7 Kebiasaan Anak Indonesia Hebat (G7KAIH).'],
  ['Permendikdasmen No. 10 Tahun 2025', 'Standar Kompetensi Lulusan — 8 Dimensi Profil Lulusan.'],
  ['Visi SMKN 2 Cimahi', '“Menjadikan Lulusan SMK yang Mampu Berwirausaha, Inovatif di Bidang Teknologi, Religius, Santun, Handal dan Berkarakter Sesuai Budaya Bangsa Sampai Tahun 2029.”'],
], { size: 19 }));

push(SPACER());
push(BOX('Catatan penting agar tidak salah kutip', [
  'TIDAK ADA Peraturan Gubernur khusus tentang Pancawaluya. Payung kebijakannya adalah Surat Edaran Gubernur Jawa Barat No. 45/PK.03.03/KESRA tanggal 6 Mei 2025. Mohon tidak menulis “Pergub Pancawaluya No. sekian” dalam dokumen resmi sekolah.',
  'Panduan Implementasi Pancawaluya SMK (hlm. 55) menyatakan verbatim: “Pendidikan Karakter Pancawaluya merupakan implementasi pembelajaran kokurikuler dengan cara lainnya.” Inilah dasar sah kegiatan ini sebagai kokurikuler.',
], ROSE, 'AD1457'));

push(SPACER());
push(H2('B. Pemetaan: Pancawaluya × 7 KAIH × 8 Dimensi Profil Lulusan × Rapor'));
push(P('Tabel inilah jantung rancangan. Setiap hari kegiatan mengangkat satu nilai Pancawaluya, yang secara sengaja diikat pada kebiasaan 7 KAIH, dimensi profil lulusan, dan indikator rapor yang lemah.'));
push(TBL([1500, 1900, 1900, 1900, 2438], ['Nilai Pancawaluya', 'Aspek Manusa Waluya', 'Kebiasaan 7 KAIH', 'Dimensi Profil Lulusan', 'Indikator Rapor yang Disasar'], [
  ['CAGEUR\nSehat jasmani-rohani, mampu mengelola emosi', 'Waluya Raga', 'Bangun Pagi · Berolahraga · Makan Sehat · Tidur Cepat', 'Kesehatan · Kemandirian', 'D.19.1/3/4/7 (semua KURANG/Sedang); D.4.1 Wellbeing 59,30; D.4.10 rokok/miras 70%'],
  ['BENER\nJujur, disiplin, kritis, bertanggung jawab', 'Waluya Budhi', 'Gemar Belajar', 'Penalaran Kritis', 'D.1.3 Metode 56,79; A.2 Numerasi (4,44% jauh di bawah); A.1.5 Literasi L3 turun 5,62'],
  ['BAGEUR\nBerakhlak, peduli, empati, gotong royong', 'Waluya Rasa', 'Bermasyarakat · Beribadah', 'Kolaborasi · Keimanan & Ketakwaan', 'A.3.2 Gotong Royong 54,70 (TURUN); D.4.4 perundungan; D.19.6 Bermasyarakat 6,41'],
  ['PINTER\nCerdas komprehensif, pembelajar sepanjang hayat', 'Waluya Hirup', 'Gemar Belajar', 'Komunikasi · Kewargaan', 'D.19.5 Gemar Belajar 5,50 (TERENDAH); A.1 Literasi turun 8,89'],
  ['SINGER\nTangkas, kreatif, berani bertindak nyata', 'Waluya Karsa', '(pengikat semua kebiasaan menjadi aksi)', 'Kreativitas · Kemandirian', 'A.3.3 Kreativitas 54,31 (TERENDAH); A.4.4 Keselarasan kerja 43,42% KURANG'],
], { size: 18 }));

push(SPACER());
push(P([
  new TextRun({ text: 'Falsafah pengikat: ', bold: true, size: 21 }),
  new TextRun({ text: '“silih asih, silih asah, silih asuh” ', italics: true, bold: true, size: 21, color: NAVY }),
  new TextRun({ text: '— saling mengasihi, saling mencerdaskan, saling mengasuh. Prinsip inilah yang mengatur cara siswa bekerja dalam tim selama lima hari.', size: 21 }),
]));

push(PB());

// ============ BAB III ============
push(R.babSatuGuru());

push(R2.babParalel());

push(H1('BAB III — MODUL KOKURIKULER (Format A–H, Panduan Kokurikuler 2025)'));

push(TBL([2400, 7238], null, [
  ['Satuan Pendidikan', 'SMK Negeri 2 Cimahi'],
  ['Kelas / Fase', 'XI (seluruh program keahlian) / Fase F'],
  ['Tema Kegiatan', 'SAKOLA WALUYA — Ngamimitian ti Diri, Mere Mangpaat pikeun Sakola'],
  ['Alokasi Waktu', '28 JP (@45 menit) + 5 sesi Pembiasaan Pagi (5 × 60 menit)'],
  ['Waktu Pelaksanaan', 'Rabu 15 Juli – Selasa 21 Juli 2026'],
  ['Lokasi', 'RUANG KELAS ASAL (basis seluruh kegiatan termasuk produksi karya) + lingkungan sekolah nyata (toilet, wastafel, kantin, lapangan, taman, lorong) + aula/lorong untuk Gelar Karya. BENGKEL & LAB PRAKTIK TIDAK DIGUNAKAN.'],
], { headFill: NAVY, zebra: true, size: 20 }));

push(SPACER());
push(H2('A. Dimensi Profil Lulusan'));
push(P('Kegiatan ini MENGUATKAN empat dimensi berikut. Namun yang DIASESMEN FORMAL hanya TIGA \u2014 kreativitas, kolaborasi, dan kesehatan \u2014 dipilih dari titik terlemah Rapor Pendidikan. Penalaran kritis tetap dilatih intensif (Hari 2) tetapi tidak dinilai; disimpan untuk projek kokurikuler berikutnya. Rinciannya di BAB H \u2014 Asesmen.', { spaceAfter: 60 }));
push(TBL([2100, 7538], ['Dimensi Utama', 'Rumusan (Permendikdasmen No. 10/2025)'], [
  ['Kesehatan', '“Menjalankan pola hidup bersih dan sehat berdasarkan pemahaman tentang kebugaran, kesehatan fisik dan mental, dan berkontribusi secara positif terhadap lingkungannya.”'],
  ['Kolaborasi', '“Membiasakan diri untuk peduli dan berbagi, serta membangun kerja sama dengan berbagai kalangan di lingkungan sekitar.”'],
  ['Kreativitas', '“Mampu berperilaku produktif, menciptakan inovasi, dan merumuskan solusi bagi permasalahan di sekitarnya.”'],
  ['Penalaran Kritis', '“Memiliki rasa ingin tahu, mampu berpikir logis dan analitis, serta mampu menganalisis dan menyelesaikan permasalahan, berargumentasi logis, dan memanfaatkan literasi dan numerasi untuk memecahkan masalah.”'],
], { size: 19 }));
push(P('Dimensi penyerta (tersentuh, tidak diasesmen formal): Komunikasi, Kemandirian, Keimanan & Ketakwaan.', { italics: true, size: 19, spaceBefore: 60 }));

push(SPACER());
push(H2('B. Tujuan Pembelajaran'));
push(P('Setelah mengikuti kegiatan ini, murid mampu:', { spaceAfter: 60 }));
[
  ['TP-1', 'Memetakan kondisi kebiasaan dirinya (7 KAIH) secara jujur menggunakan skor diri dan data kelas. [Penalaran Kritis · Kesehatan · BENER-CAGEUR]'],
  ['TP-2', 'Mengumpulkan dan mengolah data kuantitatif sederhana tentang satu masalah nyata di lingkungan SMKN 2 Cimahi, serta merumuskan akar masalahnya. [Penalaran Kritis · BENER]'],
  ['TP-3', 'Menggali perspektif warga sekolah melalui wawancara empatik dan menyepakati satu masalah prioritas secara demokratis. [Kolaborasi · BAGEUR]'],
  ['TP-4', 'Merancang dan mewujudkan satu solusi nyata sesuai kompetensi program keahliannya, bekerja sama dalam tim. [Kreativitas · Kolaborasi · PINTER-SINGER]'],
  ['TP-5', 'Mengomunikasikan gagasan dan hasil karyanya kepada warga sekolah melalui gelar karya dan kampanye digital. [Komunikasi · PINTER]'],
  ['TP-6', 'Menyusun Kontrak Kebiasaan Waluya bersama orang tua dan menjalankannya sebagai komitmen pembiasaan 7 KAIH. [Kemandirian · Kesehatan · CAGEUR]'],
].forEach(([k, v]) => push(TBL([900, 8738], null, [[k, v]], { headFill: NAVY, zebra: false, size: 19 })));

push(SPACER());
push(H2('C. Praktik Pedagogis'));
push(P('Problem-Based Learning + Project-Based Learning, dengan siklus pengalaman belajar mendalam: MEMAHAMI (Hari 1–2) → MENGAPLIKASI (Hari 3–4) → MEREFLEKSI (Hari 5 + jurnal harian).', { spaceAfter: 60 }));
push(BOX('ATURAN EMAS FASILITASI (wajib dipatuhi semua guru)', [
  '1. Guru berbicara maksimal 25% waktu sesi. Sisanya milik murid.',
  '2. Guru tidak memberi jawaban. Guru memberi pertanyaan. Kalimat andalan: “Menurut kamu kenapa?”, “Apa buktinya?”, “Kalau begitu, apa yang bisa kita lakukan?”',
  '3. Setiap sesi HARUS memiliki minimal satu aktivitas di mana murid berdiri, bergerak, atau berpindah tempat.',
  '4. Tidak ada slide lebih dari 1 halaman per sesi.',
  '5. Semua keputusan diambil murid. Guru hanya menjaga keselamatan, waktu, dan kejujuran data.',
], GREEN === GREEN ? 'E8F5E9' : 'E8F5E9', '2E7D32'));

push(SPACER());
push(H2('D. Lingkungan Pembelajaran'));
push(TBL([2100, 7538], null, [
  ['Fisik', 'RUANG KELAS ASAL adalah basis utama seluruh kegiatan, TERMASUK produksi karya. Lingkungan sekolah nyata: toilet, wastafel, kantin, tempat sampah, lapangan, taman, lorong. Lab komputer dipakai HANYA jika tersedia & bisa dibuka wali kelas (RPL/DKV/Animasi) — jika tidak, laptop & HP murid sudah cukup. BENGKEL/LAB PRAKTIK TIDAK DIGUNAKAN. Puncak: aula / lapangan / lorong untuk Gelar Karya.'],
  ['Sosial', 'Kelas dibagi 6 tim + 6 peran kelas (Kapten Tim, Tim Waktu, Tim Piket Data, Tim K3, Tim Dokumentasi, Tim Logistik). Norma kelas disusun murid di Hari 1 berdasarkan falsafah silih asih–silih asah–silih asuh. Perundungan dan sindiran dilarang total.'],
  ['Akademik', 'Data nyata, bukan data karangan. Setiap klaim harus punya bukti (foto, angka, kutipan wawancara).'],
  ['Spiritual', 'Doa bersama pada Apel Pagi. Hari Jumat: Jumat Berkah — refleksi keagamaan & berbagi.'],
  ['Digital', 'Google Form \u201cSUARA WALUYA\u201d (survei anonim, disiapkan sekali oleh Tim ICT \u2014 guru cukup menayangkan QR); Google Sheet (rekap otomatis + grafik); kamera HP; Canva & CapCut (DKV/Animasi); Tinkercad Circuits atau Wokwi (simulasi rangkaian, gratis & daring, untuk Mekatronika); kanal IG & YouTube sekolah; SIPALAWA (sipalawa.jabarprov.go.id).'],
], { headFill: NAVY, zebra: true, size: 19 }));

push(SPACER());
push(H2('E. Kemitraan Pembelajaran'));
push(P('PENTING: seluruh mitra di bawah ini berperan DI LUAR JAM FASILITASI KELAS, atau sebagai NARASUMBER/PENERIMA. Tidak satu pun dari mereka masuk ke kelas untuk ikut memfasilitasi.', { italics: true, bold: true, size: 19, spaceAfter: 60 }));
push(TBL([2400, 7238], ['Mitra', 'Peran Konkret (di luar fasilitasi kelas)'], [
  ['Koordinator Kokurikuler', 'SEBELUM: memetakan 16 sektor ke denah nyata, mencetak Kartu Sektor & Kartu Saku Guru & Papan Instruksi, menyiapkan Papan Kartu (6 slot + 6 kartu tim per kelas), membuat Google Form \u201cSuara Waluya\u201d, dan menyalin Template Digital Tim ke Drive. SELAMA: berkeliling sekolah sebagai PENGAWAS UMUM (bukan fasilitator kelas) \u2014 memastikan tidak ada tim yang tersesat atau melanggar aturan jelajah.'],
  ['Wakasek Sarpras & Petugas Kebersihan (Caraka)', 'Menyediakan data sanitasi sebelum kegiatan; menjadi NARASUMBER wawancara Hari 3 (di tempat kerjanya, bukan di kelas); memberi IZIN TITIK AKSI Hari 5; menerima gambar kerja untuk difabrikasi kemudian.'],
  ['Penanggung Jawab MBG / SPPG', 'Menyediakan data menu, porsi, dan sisa makanan (food waste) untuk Zona \u201cDahar Sehat\u201d.'],
  ['Kepala Program Keahlian (Kaprog)', 'TIDAK masuk kelas, TIDAK membuka bengkel selama kegiatan. Perannya: (a) menerima gambar kerja & purwarupa yang butuh fabrikasi mesin, untuk dikerjakan SETELAH kegiatan; (b) menjadi penilai teknis TAMU pada Gelar Karya Hari 5 (60\u201390 menit saja).'],
  ['Guru BK', 'TIDAK berkeliling, TIDAK standby di kelas. Perannya: menerima REKAP Google Form \u201cSuara Waluya\u201d, dan menindaklanjuti murid yang secara sukarela mencentang \u201csaya ingin bicara dengan Guru BK\u201d.'],
  ['OSIS & MPK', 'Menjadi responden survei dan pengunjung/penilai pendamping Gelar Karya.'],
  ['Orang Tua', 'Menandatangani Kontrak Kebiasaan Waluya (Hari 5) dan mengisi kolom pemantauan mingguan. Sasaran: menaikkan E.1.1 Partisipasi Orang Tua (56,67, turun).'],
  ['Tim ICT Sekolah', 'Membuat Google Form \u201cSuara Waluya\u201d SEKALI (1 tautan + 1 QR untuk seluruh kelas XI). Menayangkan kampanye digital hasil murid di kanal resmi sekolah.'],
], { size: 18 }));
push(P('Catatan Panduan Kokurikuler 2025: \u201cperlu dipastikan mitra tetap mendapatkan umpan balik atau manfaat dari kegiatan kokurikuler.\u201d Karena itu setiap tim WAJIB menyerahkan salinan temuan & karyanya kepada mitra yang diwawancarai.', { italics: true, size: 19, spaceBefore: 60 }));

push(SPACER());
push(H2('F. Pemanfaatan Teknologi Digital'));
push(P('Google Form \u201cSUARA WALUYA\u201d (survei anonim wellbeing & rasa aman \u2014 MENGGANTIKAN sticky note fisik) \u00b7 Google Sheet (rekap otomatis + grafik data kelas) \u00b7 Kamera HP (foto before\u2013after) \u00b7 Canva (DKV) \u00b7 Canva/CapCut (Animasi) \u00b7 Google Sheet / AppSheet / web sederhana (RPL) \u00b7 Tinkercad Circuits atau Wokwi \u2014 simulasi rangkaian daring & gratis (Mekatronika) \u00b7 SIPALAWA (unggah bukti & Narasi Perubahan).', { spaceAfter: 80 }));

push(PB());

// G. Kegiatan
push(H2('G. Kegiatan — Alur 5 Hari'));
push(P('Tantangan Besar (Driving Question) yang dipajang di setiap kelas:', { spaceAfter: 60 }));
push(BOX('TANTANGAN BESAR', [
  '“Bagaimana kami, murid kelas XI SMKN 2 Cimahi, bisa membuat sekolah ini lebih CAGEUR — lebih bersih, lebih sehat, dan lebih menyenangkan untuk belajar — dengan keahlian yang kami punya?”',
], LIGHT, '2E74B5'));

push(SPACER());
push(H3('Jadwal Harian Baku (Hari 1, 2, 4, 5)'));
push(TBL([1800, 1100, 3300, 3438], ['Waktu', 'Durasi', 'Agenda', 'Kaitan 7 KAIH / Pancawaluya'], [
  ['06.30 – 06.45', "15'", 'APEL PENGONDISIAN (lapangan)', 'Bangun Pagi · Beribadah (doa) — CAGEUR'],
  ['06.45 – 07.30', "45'", 'MBG BERSAMA + “NGARIUNG” (obrolan terarah 5 menit di akhir)', 'Makan Sehat & Bergizi · Bermasyarakat — CAGEUR & BAGEUR'],
  ['07.30 – 07.45', "15'", 'PEMANTIK / ENERGIZER (di kelas)', 'Pembuka fokus'],
  ['07.45 – 09.15', "90' (2 JP)", 'SESI 1', 'Inti kegiatan hari itu'],
  ['09.15 – 09.30', "15'", 'JEDA GERAK & SNACK (wajib bergerak, tidak boleh duduk)', 'Berolahraga — CAGEUR'],
  ['09.30 – 11.00', "90' (2 JP)", 'SESI 2', 'Inti kegiatan hari itu'],
  ['11.00 – 11.45', "45' (1 JP)", 'SESI 3', 'Konsolidasi / produksi'],
  ['11.45 – 12.00', "15'", 'REFLEKSI & JURNAL WALUYA', 'Gemar Belajar (refleksi) — BENER'],
], { size: 19 }));
push(P('Total per hari: 6 JP terjadwal (07.30–12.00 = 270 menit) + 60 menit Pembiasaan Pagi.', { italics: true, size: 19, spaceBefore: 50 }));

push(SPACER());
push(H3('Jadwal Khusus Hari 3 — Jumat, 17 Juli 2026 (Selesai 11.00)'));
push(TBL([1800, 1100, 3300, 3438], ['Waktu', 'Durasi', 'Agenda', 'Keterangan'], [
  ['06.30 – 06.45', "15'", 'APEL PENGONDISIAN', 'Sama seperti hari lain'],
  ['06.45 – 07.30', "45'", 'MBG BERSAMA + NGARIUNG', 'Sama seperti hari lain'],
  ['07.30 – 07.45', "15'", 'PEMANTIK', '—'],
  ['07.45 – 09.15', "90' (2 JP)", 'SESI 1 — Turun Lapangan: Wawancara Empati', 'Murid mewawancarai warga sekolah'],
  ['09.15 – 09.30', "15'", 'JEDA GERAK & SNACK', '—'],
  ['09.30 – 10.30', "60' (1,5 JP)", 'SESI 2 — Peta Empati & Voting Masalah Prioritas', 'Keputusan tim diambil di sini'],
  ['10.30 – 11.00', "30'", 'JUMAT BERKAH + REFLEKSI & JURNAL', 'Kegiatan keagamaan singkat + berbagi. Murid dipulangkan/dilepas ke Shalat Jumat pukul 11.00.'],
], { size: 19 }));
push(P('Total Hari 3: 4 JP terjadwal (07.30–11.00 = 210 menit) + 60 menit Pembiasaan Pagi.', { italics: true, size: 19, spaceBefore: 50 }));

push(SPACER());
push(H3('Alur Besar Lima Hari'));
push(TBL([1450, 1300, 1450, 2600, 2838], ['Hari & Tanggal', 'Nilai', 'Aspek Waluya', 'Fokus Hari', 'Produk Hari Itu (masuk LK)'], [
  ['HARI 1\nRabu, 15 Juli', 'CAGEUR', 'Waluya Raga', 'KENALI DIRI — Potret jujur 7 kebiasaanku & rasa amanku di sekolah', 'LK-1: Radar Kebiasaan · Skor Kelas · 1 kebiasaan yang mau diperbaiki'],
  ['HARI 2\nKamis, 16 Juli', 'BENER', 'Waluya Budhi', 'CARI FAKTA — Turun ke lapangan, kumpulkan DATA masalah nyata sekolah', 'LK-2: Tabel Data Lapangan · Grafik · Pohon Akar Masalah'],
  ['HARI 3\nJumat, 17 Juli', 'BAGEUR', 'Waluya Rasa', 'RASAKAN & PILIH — Wawancara empati warga sekolah, pilih 1 masalah prioritas', 'LK-3: Peta Empati · Matriks Prioritas · Masalah terpilih'],
  ['HARI 4\nSenin, 20 Juli', 'PINTER', 'Waluya Hirup', 'RANCANG & BUAT — Ideasi, purwarupa sesuai keahlian, draf kampanye', 'LK-4: Lembar Ide · Sketsa/Rancangan · Purwarupa v1 · Storyboard kampanye'],
  ['HARI 5\nSelasa, 21 Juli', 'SINGER', 'Waluya Karsa', 'BERTINDAK & BERBAGI — Aksi nyata di titik sasaran + Gelar Karya + publikasi', 'LK-5: Bukti Aksi (before–after) · Gelar Karya · Kontrak Kebiasaan Waluya'],
], { size: 18 }));

push(SPACER());
push(H3('Lima Zona Aksi Waluya (setiap kelas memilih SATU)'));
push(TBL([1900, 3600, 4138], ['Zona', 'Masalah Nyata di SMKN 2 Cimahi', 'Dasar dari Rapor'], [
  ['Z1 — CAI & KABERSIHAN\n(Air & Sanitasi)', 'Ketersediaan air layak, kondisi toilet, wastafel, sabun, saluran air.', 'E.7.2 Indeks Sanitasi = 30 (KURANG). Zona paling kuat justifikasinya.'],
  ['Z2 — DAHAR SEHAT\n(MBG, Gizi, Sampah Makanan)', 'Kualitas & keterserapan MBG, sisa makanan (food waste), jajanan kantin, kebiasaan sarapan.', 'D.19.4 Makan Sehat = 6,44 (KURANG). Terhubung langsung dengan program MBG harian.'],
  ['Z3 — BETAH DIAJAR\n(Gemar Belajar & Tidur Cepat)', 'Ritme tidur, penggunaan gawai malam hari, kantuk di kelas, tidak ada ruang/pojok belajar nyaman.', 'D.19.5 Gemar Belajar = 5,50 (TERENDAH); D.19.7 Tidur Cepat = 6,41 (KURANG).'],
  ['Z4 — AWAK BUGAR\n(Bergerak & Bugar)', 'Nyaris tidak ada aktivitas fisik harian; duduk berjam-jam; lapangan/fasilitas olahraga kurang dimanfaatkan.', 'D.19.3 Berolahraga = 5,92 (KURANG).'],
  ['Z5 — SAKOLA AMAN & SOMEAH\n(Aman & Ramah)', 'Perundungan, sindiran, rokok/vape, rasa tidak aman, kesetaraan gender.', 'D.4.4 perundungan (turun 8,33); D.4.10 rokok/miras 70% (turun 19,47); D.4.1 wellbeing 59,30.'],
], { size: 18 }));
push(BOX('Aturan pemilihan zona', [
  'Koordinator memastikan kelima zona terisi. Jika ada zona kosong, koordinator menugaskan satu kelas. Jika satu zona diperebutkan lebih dari 3 kelas, lakukan undian.',
  'ZONA Z5 (Sakola Aman) \u2014 karena Guru BK TIDAK berada di kelas, kelas yang memilih zona ini wajib mengikuti dua batasan: (1) seluruh data digali lewat Google Form ANONIM, bukan wawancara tatap muka tentang pengalaman pribadi; (2) murid TIDAK BOLEH mewawancarai korban perundungan. Yang boleh diwawancarai: OSIS, satpam, guru piket, dan murid kelas X \u2014 tentang PENGETAHUAN mereka soal kanal pelaporan, bukan soal pengalaman disakiti. Karya kelas ini diarahkan pada SISTEM (kanal lapor, papan informasi, kampanye), bukan pada kasus.',
], ROSE, 'AD1457'));

push(SPACER());
push(H3('Bentuk Karya per Program Keahlian \u2014 TANPA BENGKEL'));
push(P('Karena pengelompokan homogen per kelas/jurusan, bentuk karya WAJIB memakai kompetensi keahlian kelas tersebut. Inilah yang membedakan kegiatan ini dari \u201ckerja bakti biasa\u201d, sekaligus menjawab A.4.4 Keselarasan bidang kerja (43,42% \u2014 KURANG). Namun seluruhnya dikerjakan HANYA dengan alat tangan & perangkat digital, DI DALAM KELAS.', { spaceAfter: 60 }));
push(TBL([1900, 3500, 4238], ['Program Keahlian', 'Bentuk Karya (alat tangan & digital)', 'Contoh Konkret'], R.KARYA_ROWS, { size: 17 }));
push(SPACER());
push(R.boxPasang());
push(PB());

// H. Asesmen
push(R3.asesmen());

push(H2('I. Evaluasi Program & Tindak Lanjut'));
push(TBL([1600, 4000, 4038], ['Tahap', 'Yang Diukur', 'Cara'], [
  ['Input', 'Kesiapan guru, bahan, tempat, mitra', 'Ceklis kesiapan H-3 (Lampiran 1 Panduan Guru)'],
  ['Process', 'Keterlibatan murid; kepatuhan Aturan Emas Fasilitasi', 'Observasi silang antarguru TIDAK MUNGKIN (guru sendirian di kelas). Diganti: (a) SWA-CEK GURU \u2014 3 pertanyaan diisi guru sendiri tiap akhir hari: \u201cBerapa menit tadi saya bicara? Berapa kali murid berdiri/bergerak? Berapa keputusan yang saya ambil, yang seharusnya diambil murid?\u201d (b) UMPAN BALIK MURID \u2014 1 pertanyaan anonim di Form Hari 5: \u201cApakah gurumu lebih banyak menerangkan, atau lebih banyak bertanya?\u201d'],
  ['Output', 'Jumlah karya jadi, jumlah aksi terpasang, jumlah konten terpublikasi, kelengkapan LK', 'Rekap koordinator'],
  ['Outcome', 'Perubahan skor Radar Kebiasaan murid (H1 vs H5); keberlanjutan Kontrak Kebiasaan', 'Perbandingan data; pemantauan mingguan oleh wali kelas hingga akhir semester'],
], { size: 19 }));
push(P('Metodologi Pancawaluya mengharuskan penyusunan “NARASI PERUBAHAN” (Outcome Harvesting): siapa melakukan apa, di mana, kapan, dan bagaimana program berkontribusi. Narasi ini diunggah ke SIPALAWA (sipalawa.jabarprov.go.id) oleh Guru Koordinator Gapura Pancawaluya.', { size: 20, spaceBefore: 60 }));

push(BOX('KEBERLANJUTAN — bagian yang paling sering dilupakan', [
  'Panduan Kokurikuler 2025 menegaskan: pembiasaan 7 KAIH “tetap perlu dilakukan secara rutin” walaupun tema sudah berganti.',
  'Karena itu SAKOLA WALUYA bukan acara 5 hari. Setelah 21 Juli 2026:',
  '• Kontrak Kebiasaan Waluya dipantau wali kelas setiap Senin (5 menit di jam perwalian) sampai akhir semester.',
  '• Karya yang terpasang di sekolah (tempat sampah pilah, signage, dispenser sabun, aplikasi) menjadi tanggung jawab kelas pembuatnya untuk dirawat — inilah “kulturalisasi” dalam model internalisasi nilai Pancawaluya.',
  '• Sisa kuota kokurikuler kelas XI (144 − 28 = 116 JP) digunakan untuk melanjutkan dimensi yang belum tercapai.',
], 'E8F5E9', '2E7D32'));

save(c, '/sessions/vibrant-inspiring-einstein/mnt/Ko Kurikuler/SAKOLA_WALUYA_XI_2026/03_UNTUK_KOORDINATOR/RANCANGAN_KOKURIKULER_resmi.docx');
