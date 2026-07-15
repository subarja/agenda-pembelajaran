const L = require('./lib.js');
const { P, H1, H2, H3, TITLE, TBL, BOX, LINES, SPACER, PB, save, AlignmentType, TextRun, CW, GOLD, LIGHT, ROSE, NAVY, BLUE } = L;

const c = [];
const push = (...x) => x.forEach(i => Array.isArray(i) ? c.push(...i) : c.push(i));
const GRN = 'E8F5E9', GRNA = '2E7D32';

function BANNER(txt, fill) {
  return TBL([9638], null, [[txt]], { headFill: fill, zebra: false, size: 24 });
}
function TUGAS(no, judul, instruksi) {
  push(TBL([1200, 8438], null, [['TUGAS ' + no, judul]], { headFill: BLUE, zebra: false, size: 21 }));
  if (instruksi) push(P(instruksi, { italics: true, size: 20, spaceBefore: 50, spaceAfter: 60 }));
}
function BLANK(cols, headers, n, opts = {}) {
  const rows = [];
  for (let i = 0; i < n; i++) rows.push(cols.map(() => ' '));
  return TBL(cols, headers, rows, { headFill: opts.headFill || BLUE, zebra: false, size: 19 });
}

// ===== COVER =====
push(P('SMK NEGERI 2 CIMAHI · KELAS XI · TAHUN PELAJARAN 2026/2027', { align: AlignmentType.CENTER, bold: true, size: 19, color: '595959', spaceAfter: 200 }));
push(TITLE('JURNAL WALUYA', 'Lembar Kerja Siswa · SAKOLA WALUYA · 15 – 21 Juli 2026'));
push(P('“Ngamimitian ti Diri, Mere Mangpaat pikeun Sakola”', { align: AlignmentType.CENTER, italics: true, size: 21, color: NAVY, spaceAfter: 240 }));

push(TBL([2400, 7238], null, [
  ['NAMA', ' '],
  ['KELAS / JURUSAN', ' '],
  ['NAMA TIM', ' '],
  ['ZONA AKSI KAMI', ' '],
  ['GELOMBANG KAMI (lingkari)', 'BIRU  (turun lapangan LEBIH DULU)          ·          JINGGA  (turun lapangan SETELAHNYA)'],
  ['SEKTOR KAMI (salin dari Kartu Sektor)', ' '],
  ['WALI KELAS', ' '],
], { headFill: NAVY, zebra: false, size: 22 }));

push(SPACER());
push(BOX('BUKU INI MILIKMU. TIDAK ADA JAWABAN BENAR ATAU SALAH.', [
  'Yang dinilai dari buku ini hanya satu: KEJUJURANMU.',
  '',
  'Lima hari ke depan kamu tidak akan duduk mendengarkan. Kamu akan berdiri, berjalan, mengukur, bertanya, membuat, dan memperbaiki. Gurumu tidak akan memberi jawaban — mereka hanya akan bertanya.',
  '',
  'Di akhir minggu, harus ada SESUATU yang benar-benar berubah di SMKN 2 Cimahi. Karena kamu yang mengubahnya.',
  '',
  'Bawa buku ini setiap hari. Isi setiap hari. Jangan diisi di rumah semalam sebelum dikumpulkan — itu bukan jurnal, itu karangan.',
], GRN, GRNA));

push(SPACER());
push(BOX('MINGGU INI, WALI KELASMU SENDIRIAN.', [
  'Tidak ada guru lain yang masuk ke kelasmu. Artinya: kalau kalian menunggu beliau mengatur segalanya, kalian tidak akan selesai.',
  '',
  'Jadi sebagian tugas guru sekarang jadi TUGAS KALIAN — dan itu bukan hukuman, itu kepercayaan. Setiap orang di kelas ini memegang SATU peran. Tidak ada penonton.',
  '',
  'KAPTEN TIM · TIM WAKTU · TIM PIKET DATA · TIM K3 · TIM DOKUMENTASI · TIM LOGISTIK',
], LIGHT, '2E74B5'));

push(SPACER());
push(BOX('KITA BUKAN SATU KELAS. KITA 16 KELAS.', [
  '576 murid. 96 tim. Kalau semua turun lapangan bersamaan, sekolah ini akan kacau — dan Pak Caraka akan diwawancarai puluhan kali dalam sehari.',
  '',
  'Karena itu ada dua aturan yang menjaga semuanya tetap waras:',
  '',
  '1. SEKTOR EKSKLUSIF — kelasmu punya wilayah & objek data SENDIRI. Kamu DILARANG mengukur objek di sektor kelas lain. Butuh datanya? MINTA ke kelas itu. (Itulah gotong royong yang sebenarnya.)',
  '',
  '2. GELOMBANG — kelasmu turun lapangan pada jam tertentu saja. Saat kelas lain di lapangan, kamu bekerja di kelas. Lalu bertukar.',
  '',
  'NARASUMBER TIDAK DIKUMPULKAN. Pak Caraka, satpam, ibu kantin tetap bekerja seperti biasa. KAMU yang MENGHAMPIRI mereka (NGAJUGJUG) — tapi hanya 3 orang delegasi, hanya 10 menit, hanya pada slot yang dijadwalkan.',
], GOLD, 'BF8F00'));

push(SPACER());
push(H3('Peta Perjalanan 5 Hari'));
push(TBL([1500, 1400, 3200, 3538], ['Hari', 'Nilai', 'Yang Kamu Kerjakan', 'Yang Kamu Hasilkan'], [
  ['RABU\n15 Juli', 'CAGEUR', 'Kenali diri: potret jujur 7 kebiasaanmu', 'Radar Kebiasaan + Zona Aksi kelas'],
  ['KAMIS\n16 Juli', 'BENER', 'Cari fakta: turun lapangan, kumpulkan DATA', 'Tabel data + grafik + akar masalah'],
  ['JUMAT\n17 Juli', 'BAGEUR', 'Rasakan: wawancarai warga sekolah', 'Peta Empati + 1 masalah prioritas'],
  ['SENIN\n20 Juli', 'PINTER', 'Rancang & buat: purwarupa dengan keahlianmu', 'Karya versi 1 + draf kampanye'],
  ['SELASA\n21 Juli', 'SINGER', 'Bertindak: pasang, pamerkan, publikasikan', 'Aksi nyata + Kontrak Kebiasaan'],
], { size: 19 }));

push(PB());

// ================= LK-1 =================
push(BANNER('LK-1 · HARI 1 · RABU, 15 JULI 2026 · CAGEUR — “KENALI DIRI”', '2E7D32'));
push(P('Hari ini kamu tidak mengerjakan apa-apa untuk sekolah. Hari ini kamu berhadapan dengan dirimu sendiri.', { italics: true, spaceBefore: 70, spaceAfter: 100 }));

TUGAS('1A', 'RADAR KEBIASAANKU', 'Beri skor 1–10 untuk dirimu sendiri (10 = sudah jadi kebiasaan otomatis, 1 = tidak pernah sama sekali). Jujur. Tidak ada yang akan menghukummu.');
push(TBL([3200, 1300, 5138], ['Kebiasaan (7 KAIH)', 'SKOR AKU\n(1–10)', 'Alasan jujurku memberi skor itu'], [
  ['1. Bangun Pagi', ' ', ' '],
  ['2. Beribadah', ' ', ' '],
  ['3. Berolahraga', ' ', ' '],
  ['4. Makan Sehat & Bergizi', ' ', ' '],
  ['5. Gemar Belajar', ' ', ' '],
  ['6. Bermasyarakat', ' ', ' '],
  ['7. Tidur Cepat', ' ', ' '],
], { headFill: BLUE, zebra: false, size: 20 }));

push(SPACER());
push(P('GAMBAR RADARMU. Buat jaring laba-laba dengan 7 sumbu (satu sumbu per kebiasaan, dari 0 di tengah sampai 10 di ujung). Tandai skormu di setiap sumbu, lalu hubungkan titik-titiknya. Bentuk apa yang muncul? Timpang di sebelah mana?', { bold: true, size: 20, spaceAfter: 80 }));
push(TBL([9638], null, [
  [' '], [' '], [' '], [' '], [' '], [' '], [' '], [' '], [' '], [' '], [' '], [' '],
], { headFill: 'FFFFFF', zebra: false, size: 20 }));

push(SPACER());
push(P('Bandingkan dengan skor SEKOLAH (dari Rapor Pendidikan SMKN 2 Cimahi 2025):', { bold: true, size: 20, spaceAfter: 50 }));
push(TBL([2400, 1500, 1500, 4238], ['Kebiasaan', 'Skor Sekolah', 'Skor Aku', 'Aku di atas / di bawah sekolah? Kenapa?'], [
  ['Gemar Belajar', '5,50 (KURANG)', ' ', ' '],
  ['Berolahraga', '5,92 (KURANG)', ' ', ' '],
  ['Bermasyarakat', '6,41 (KURANG)', ' ', ' '],
  ['Tidur Cepat', '6,41 (KURANG)', ' ', ' '],
  ['Makan Sehat', '6,44 (KURANG)', ' ', ' '],
  ['Beribadah', '7,34 (Sedang)', ' ', ' '],
  ['Bangun Pagi', '7,93 (Sedang)', ' ', ' '],
], { size: 19 }));

push(SPACER());
push(P('RATA-RATA KELAS KAMI (hasil hitungan bersama di papan tulis):', { bold: true, size: 20, spaceAfter: 50 }));
push(TBL([1300, 1300, 1300, 1300, 1300, 1300, 1300, 1538], ['Bangun Pagi', 'Ibadah', 'Olahraga', 'Makan Sehat', 'Gemar Belajar', 'Bermasyarakat', 'Tidur Cepat', 'RATA-RATA'], [[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ']], { size: 18 }));

push(SPACER());
TUGAS('1B', 'SATU YANG MAU KUPERBAIKI', 'Setelah diskusi 4–2–1 dengan kelompokmu.');
push(TBL([3400, 6238], null, [
  ['Kebiasaan yang PALING bermasalah di kelompok kami', ' '],
  ['Kebiasaan yang PALING ingin AKU perbaiki (boleh beda dari kelompok)', ' '],
  ['Kenapa itu penting buatku?', ' '],
  ['Apa yang selama ini MENGHALANGI aku memperbaikinya?', ' '],
], { headFill: BLUE, zebra: false, size: 20 }));

push(PB());
TUGAS('1C', 'SUARA WALUYA — Sekolahku: Betah, Tidak Nyaman, Tidak Aman', 'Kamu sudah mengisi formulir ANONIM lewat HP. Sekarang salin hasil pengelompokan KELAS dari papan tulis ke sini. Tidak ada nama siapa pun di sini.');
push(TBL([3200, 1300, 5138], ['Kelompok Temuan (judul dari kelas kita)', 'Berapa\nJawaban', 'Contoh jawaban (tanpa nama)'], [
  ['BETAH — yang membuat kami betah', ' ', ' '],
  ['BETAH —', ' ', ' '],
  ['TIDAK NYAMAN —', ' ', ' '],
  ['TIDAK NYAMAN —', ' ', ' '],
  ['TIDAK AMAN —', ' ', ' '],
  ['TIDAK AMAN —', ' ', ' '],
], { size: 19 }));
push(P('Kelompok mana yang paling banyak? Menurutmu kenapa?', { bold: true, size: 20, spaceBefore: 60, spaceAfter: 40 }));
push(LINES(3));
push(SPACER());
push(BOX('Kalau ada sesuatu yang berat', [
  'Di formulir tadi ada kotak: “Saya ingin berbicara dengan Guru BK.”',
  'Kalau kamu mencentangnya, HANYA Guru BK yang melihatnya — bukan wali kelasmu. Kamu boleh menulis nama, boleh juga tidak.',
  'Kamu tidak sendirian. Kalau kamu belum sempat mencentangnya, kamu masih bisa menemui Guru BK kapan saja.',
], ROSE, 'AD1457'));

push(SPACER());
TUGAS('1D', 'ZONA AKSI, PERANKU & NORMA TIM', null);
push(TBL([3200, 6438], null, [
  ['ZONA AKSI kelas kami (lingkari)', 'Z1 Cai & Kabersihan   ·   Z2 Dahar Sehat   ·   Z3 Betah Diajar   ·   Z4 Awak Bugar   ·   Z5 Sakola Aman'],
  ['Kenapa kami memilih zona itu?', ' '],
  ['Nama TIM-ku', ' '],
  ['PERANKU DI KELAS (lingkari satu)', 'KAPTEN TIM   ·   TIM WAKTU   ·   TIM PIKET DATA   ·   TIM K3   ·   TIM DOKUMENTASI   ·   TIM LOGISTIK'],
  ['Apa PERSISNYA tugasku dengan peran itu? (tulis sendiri, jangan menyalin)', ' \n '],
  ['5 NORMA TIM kami (silih asih–silih asah–silih asuh)', '1. \n2. \n3. \n4. \n5. '],
], { headFill: BLUE, zebra: false, size: 20 }));

push(SPACER());
push(P('LIMA ATURAN JELAJAH — hafalkan. Ini yang menjaga kita selamat, karena wali kelas kita sendirian.', { bold: true, size: 20, spaceAfter: 50 }));
push(TBL([700, 8938], null, [
  ['1', 'TIDAK ADA MURID SENDIRIAN. Minimal berdua, selalu.'],
  ['2', 'TIDAK BOLEH keluar gerbang sekolah.'],
  ['3', 'TIDAK BOLEH masuk ruangan yang sedang dipakai KBM, ruang guru, atau ruangan terkunci.'],
  ['4', 'TIDAK BOLEH pindah lokasi tanpa lapor balik ke POS lebih dulu.'],
  ['5', 'LAPOR BALIK ke POS setiap 20 menit. TELAT KEMBALI = kartu ditahan, timmu tidak turun lapangan lagi hari itu.'],
], { headFill: 'AD1457', zebra: true, size: 19 }));
push(P('Tanda tanganku, tanda aku paham dan sanggup: ..............................................', { bold: true, size: 20, spaceBefore: 60 }));

push(SPACER());
push(BANNER('JURNAL WALUYA — HARI 1', '2E7D32'));
push(P('Satu hal yang paling mengejutkanku hari ini:', { bold: true, size: 20, spaceBefore: 60, spaceAfter: 30 }));
push(LINES(2));
push(P('Satu hal tentang diriku yang baru kusadari hari ini:', { bold: true, size: 20, spaceAfter: 30 }));
push(LINES(2));
push(P('Perasaanku hari ini (lingkari & jelaskan):   😀 semangat   ·   🙂 biasa   ·   😐 bingung   ·   😟 berat', { bold: true, size: 20, spaceAfter: 30 }));
push(LINES(2));
push(TBL([9638], ['Balasan Wali Kelas (satu kalimat)'], [[' '], [' ']], { headFill: '7F7F7F', zebra: false, size: 19 }));

push(PB());

// ================= LK-2 =================
push(BANNER('LK-2 · HARI 2 · KAMIS, 16 JULI 2026 · BENER — “CARI FAKTA”', 'BF8F00'));
push(BOX('ATURAN HARI INI', ['Setiap kalimat yang kamu tulis hari ini HARUS punya bukti: angka, foto, atau kutipan. Kalau tidak ada buktinya — CORET. Itulah arti BENER.'], GOLD, 'BF8F00'));

push(TBL([9638], ['KARTU IZIN JELAJAH — isi bersama Kapten Tim, lalu minta tanda tangan wali kelas SEBELUM berangkat'], [[' ']], { headFill: 'AD1457', zebra: false, size: 19 }));
push(TBL([2600, 2200, 2200, 2638], ['Tujuan lokasi (spesifik)', 'Jam berangkat', 'JAM WAJIB KEMBALI', 'TTD Wali Kelas'], [[' \n ', ' ', ' ', ' ']], { size: 19 }));
push(P('Lapor balik ke POS jam: ............   ............   ............   (setiap 20 menit)', { bold: true, size: 19, spaceBefore: 50, spaceAfter: 80 }));

TUGAS('2A', 'TABEL DATA LAPANGAN', 'Isi minimal 10 baris. Angka, bukan perasaan. Lihat panduan data zonamu dari gurumu.');
push(TBL([600, 3200, 1800, 1600, 2438], ['No', 'Apa yang kami ukur / hitung', 'Di mana', 'ANGKA', 'Catatan / kejanggalan'],
  Array.from({ length: 11 }, (_, i) => [String(i + 1), ' ', ' ', ' ', ' ']), { size: 19 }));

push(SPACER());
push(TBL([4800, 4838], null, [
  ['📸 Jumlah foto yang kami ambil:', ' '],
  ['😮 SATU hal yang paling MENGEJUTKAN kami di lapangan:', ' '],
], { headFill: BLUE, zebra: false, size: 20 }));

push(PB());
TUGAS('2B', 'DATA JADI GRAFIK', 'Gambar SATU grafik dari datamu. Batang, lingkaran, atau garis — kamu yang pilih. Gambar tangan. Beri judul, beri satuan, beri angka.');
push(TBL([9638], null, [[' '], [' '], [' '], [' '], [' '], [' '], [' '], [' '], [' '], [' '], [' ']], { headFill: 'FFFFFF', zebra: false, size: 20 }));
push(P('Grafik ini menunjukkan apa? Tulis dalam 1 kalimat:', { bold: true, size: 20, spaceBefore: 60, spaceAfter: 30 }));
push(LINES(2));

push(SPACER());
TUGAS('2C', 'POHON AKAR MASALAH', 'BUAH = akibat yang terlihat. BATANG = masalahnya. AKAR = penyebab SEBENARNYA. Gunakan teknik 5x KENAPA sampai kamu menemukan akar yang BISA DIKERJAKAN — bukan akar yang cuma menyalahkan orang.');
push(TBL([2400, 7238], ['Bagian Pohon', 'Isi'], [
  ['🍎 BUAH (akibat yang terlihat & dirasakan orang)', ' '],
  ['🪵 BATANG (masalahnya apa)', ' '],
  ['🌱 AKAR 1 (kenapa? → kenapa? → kenapa?)', ' '],
  ['🌱 AKAR 2', ' '],
  ['🌱 AKAR 3', ' '],
], { size: 20 }));

push(SPACER());
push(P('Contoh 5x KENAPA (jangan disalin — buat versimu sendiri):', { bold: true, size: 19, spaceAfter: 40 }));
push(BOX('Contoh', [
  '“Toiletnya bau.” → Kenapa? → “Airnya tidak mengalir.” → Kenapa? → “Kerannya rusak.” → Kenapa? → “Tidak ada yang melapor.” → Kenapa? → “Tidak ada yang tahu harus lapor ke mana.”',
  '👉 AKARNYA: TIDAK ADA SALURAN PELAPORAN KERUSAKAN. Dan itu bisa dikerjakan anak RPL.',
], LIGHT, '2E74B5'));

push(SPACER());
push(P('RUMUSAN MASALAH KAMI — lengkapi kalimat ini:', { bold: true, size: 21, spaceBefore: 60, spaceAfter: 50 }));
push(TBL([9638], null, [
  ['“Masalah sebenarnya adalah ________________________________________________________'],
  [' '],
  ['karena ______________________________________________________________________________'],
  [' '],
  ['dibuktikan dengan data ______________________________________________________________.”'],
  [' '],
], { headFill: 'FFFFFF', zebra: false, size: 20 }));

push(SPACER());
push(BANNER('JURNAL WALUYA — HARI 2', 'BF8F00'));
push(P('Satu data yang membuatku berpikir ulang tentang sekolahku:', { bold: true, size: 20, spaceBefore: 60, spaceAfter: 30 }));
push(LINES(2));
push(P('Hari ini aku jujur atau aku menghindar? Jelaskan.', { bold: true, size: 20, spaceAfter: 30 }));
push(LINES(2));
push(TBL([9638], ['Balasan Wali Kelas (satu kalimat)'], [[' '], [' ']], { headFill: '7F7F7F', zebra: false, size: 19 }));

push(PB());

// ================= LK-3 =================
push(BANNER('LK-3 · HARI 3 · JUMAT, 17 JULI 2026 · BAGEUR — “RASAKAN & PILIH”', 'AD1457'));
push(BOX('ATURAN HARI INI', [
  'Data tidak tahu rasanya. Manusia tahu.',
  'Hari ini kamu tidak mengukur apa-apa. Kamu MENDENGARKAN.',
  'Aturan wawancara: TANYA → DENGAR → JANGAN MEMOTONG → TANYA LAGI “KENAPA”.',
  'Jangan bertanya “Toiletnya kotor ya, Pak?” (itu menggiring). Bertanyalah: “Bapak, boleh cerita, bagian mana dari pekerjaan Bapak yang paling melelahkan?” (itu membuka).',
], ROSE, 'AD1457'));

push(TBL([9638], ['KARTU TEMU NARASUMBER — bawa ini saat NGAJUGJUG. Tunjukkan bersama Kartu Izin Jelajah.'], [[' ']], { headFill: 'AD1457', zebra: false, size: 19 }));
push(TBL([2600, 3400, 1900, 1738], ['Narasumber kami', 'Di mana dia biasanya berada', 'SLOT KAMI (jam)', 'Berhasil ditemui?'], [[' ', ' ', ' ', 'YA / TIDAK']], { size: 19 }));
push(P('DELEGASI KAMI (hanya 3 orang!): 1. .................................... (Kapten)   2. .................................... (pencatat)   3. .................................... (dokumentasi)', { bold: true, size: 19, spaceBefore: 50 }));
push(SPACER());
push(BOX('ETIKA NGAJUGJUG — hafalkan sebelum berangkat', [
  '1. HAMPIRI, beri salam, TUNJUKKAN Kartu Izin Jelajah + Kartu Temu ini.',
  '2. MINTA IZIN: "Bapak/Ibu, boleh minta waktu 10 menit? Kalau sedang sibuk, kami bisa kembali nanti."',
  '3. MAKSIMAL 10 MENIT. Lewat itu — PAMIT, apa pun kondisinya. Beliau sedang bekerja.',
  '4. Mau merekam? TANYA DULU: "Boleh kami rekam suaranya, Pak/Bu?"',
  '5. TANYA - DENGAR - JANGAN MEMOTONG - TANYA LAGI "kenapa".',
  '6. BELIAU MENOLAK atau SEDANG SIBUK? JANGAN DIPAKSA. Tulis "tidak tersedia", kembali ke POS, lapor ke wali kelas. Menerima penolakan dengan sopan juga BAGEUR.',
  '7. TIDAK KETEMU orangnya? Cari maksimal 5 menit, lalu KEMBALI KE POS. Jangan berkeliaran.',
  '8. SEBELUM PAMIT: ucapkan terima kasih, lalu katakan: "Hari Selasa kami akan tunjukkan hasilnya ke Bapak/Ibu." — DAN TEPATI. Undang beliau ke Gelar Karya.',
], ROSE, 'AD1457'));
push(SPACER());

TUGAS('3A', 'KUTIPAN LANGSUNG DARI WARGA SEKOLAH', 'Minimal 3 narasumber. Tulis kalimat mereka PERSIS, dalam tanda kutip. Jangan diringkas jadi kalimatmu sendiri.');
push(TBL([2000, 1800, 5838], ['Nama Narasumber', 'Perannya', 'Kutipan LANGSUNG (“...”)'], [
  [' ', ' ', ' '], [' ', ' ', ' '], [' ', ' ', ' '], [' ', ' ', ' '],
], { headFill: 'AD1457', zebra: false, size: 20 }));
push(P('Kutipan mana yang paling menusuk perasaanmu? Kenapa?', { bold: true, size: 20, spaceBefore: 60, spaceAfter: 30 }));
push(LINES(3));

push(PB());
TUGAS('3B', 'PETA EMPATI', 'Pilih SATU narasumber utama. Isi 4 kuadran berdasarkan apa yang benar-benar kamu lihat & dengar — bukan tebakan.');
push(P('Narasumber utama kami: _______________________________  Perannya: _______________________________', { bold: true, size: 20, spaceAfter: 60 }));
push(TBL([4819, 4819], null, [
  [{ v: 1 } && '💬 APA YANG DIA KATAKAN\n(kutipan persisnya)', '🏃 APA YANG DIA LAKUKAN\n(yang kamu lihat dengan matamu)'],
  [' \n \n \n ', ' \n \n \n '],
  ['🧠 APA YANG DIA PIKIRKAN\n(dari nada bicara & ekspresinya)', '❤️ APA YANG DIA RASAKAN\n(lelah? kesal? pasrah? bangga?)'],
  [' \n \n \n ', ' \n \n \n '],
], { headFill: 'AD1457', zebra: false, size: 20 }));

push(SPACER());
TUGAS('3C', 'MATRIKS PRIORITAS', 'Letakkan setiap masalah kelas ke dalam kotak yang tepat. Yang masuk kotak KANAN-ATAS adalah calon terkuat.');
push(TBL([2000, 3819, 3819], null, [
  [' ', 'BISA KAMI KERJAKAN\n(dengan keahlian & waktu 2 hari)', 'SULIT KAMI KERJAKAN'],
  ['DAMPAK BESAR\n(banyak orang terbantu)', '✅ KANDIDAT UTAMA\n \n \n ', '⏳ Butuh waktu lebih lama\n \n \n '],
  ['DAMPAK KECIL', '🤏 Boleh, tapi kurang berarti\n \n \n ', '❌ Jangan diambil\n \n \n '],
], { headFill: 'AD1457', zebra: false, size: 19 }));

push(SPACER());
push(P('HASIL VOTING KELAS — tulis besar-besar:', { bold: true, size: 21, spaceBefore: 60, spaceAfter: 50 }));
push(TBL([2800, 6838], null, [
  ['🎯 MASALAH KAMI', ' '],
  ['🙋 ORANG YANG KAMI BANTU (sebut orangnya, bukan “semua orang”)', ' '],
  ['📅 TARGET SELESAI: Selasa, 21 Juli 2026 — bentuknya apa?', ' '],
], { headFill: NAVY, zebra: false, size: 21 }));

push(SPACER());
push(BANNER('JURNAL WALUYA — HARI 3', 'AD1457'));
push(P('Hari ini aku mendengar sesuatu yang tidak pernah kupikirkan sebelumnya, yaitu:', { bold: true, size: 20, spaceBefore: 60, spaceAfter: 30 }));
push(LINES(2));
push(P('Siapa orang di sekolah ini yang selama ini tidak pernah kuperhatikan, tapi ternyata penting?', { bold: true, size: 20, spaceAfter: 30 }));
push(LINES(2));
push(TBL([9638], ['Balasan Wali Kelas (satu kalimat)'], [[' '], [' ']], { headFill: '7F7F7F', zebra: false, size: 19 }));

push(PB());

// ================= LK-4 =================
push(BANNER('LK-4 · HARI 4 · SENIN, 20 JULI 2026 · PINTER — “RANCANG & BUAT”', '1F3864'));
push(BOX('ATURAN HARI INI: JELEK DULUAN, BAGUS BELAKANGAN.', [
  'Jangan habiskan waktu menggambar rancangan yang indah. Buat sesuatu yang bisa DISENTUH hari ini, walaupun jelek.',
  'Purwarupa jelek yang bisa diuji jauh lebih berharga daripada rancangan cantik yang tidak pernah jadi.',
], GRN, GRNA));

TUGAS('4A', 'BADAI IDE 6–3–5', 'Tulis 3 ide dalam 5 menit. Lalu geser lembar ini ke teman di kanan. Dia akan MENGEMBANGKAN idemu, bukan mengkritiknya. Ulangi 3 putaran.');
push(TBL([1500, 2700, 2700, 2738], ['Putaran', 'IDE 1', 'IDE 2', 'IDE 3'], [
  ['Putaran 1\n(aku)', ' \n \n ', ' \n \n ', ' \n \n '],
  ['Putaran 2\n(teman)', ' \n \n ', ' \n \n ', ' \n \n '],
  ['Putaran 3\n(teman)', ' \n \n ', ' \n \n ', ' \n \n '],
], { size: 19 }));

push(SPACER());
push(P('IDE YANG KAMI PILIH — harus lolos 3 syarat ini. Beri tanda ✓:', { bold: true, size: 20, spaceAfter: 50 }));
push(TBL([7000, 2638], null, [
  ['Ide kami: ', ' '],
  ['☐ Syarat 1 — MEMAKAI kompetensi keahlian kelas kami (bukan kerja bakti biasa)', ' '],
  ['☐ Syarat 2 — BISA SELESAI dalam 2 hari', ' '],
  ['☐ Syarat 3 — Benar-benar MENOLONG orang yang kami wawancarai kemarin', ' '],
], { headFill: NAVY, zebra: false, size: 20 }));
push(P('Kalau ada satu saja yang tidak tercentang — BUANG IDENYA, pilih yang lain.', { italics: true, bold: true, size: 19, color: 'C00000', spaceBefore: 40 }));

push(PB());
push(BOX('BATASAN ALAT — baca sebelum memilih ide', [
  'Minggu ini kita TIDAK masuk bengkel. Wali kelas kita sendirian, dan tidak ada toolman. Semua dikerjakan DI KELAS INI.',
  '',
  'BOLEH: gunting · cutter · gergaji tangan kecil · obeng · tang · palu kecil · amplas · lem · double tape · cable ties · kardus · pipa PVC · kayu ringan · botol bekas · laptop & HP.',
  '',
  'DILARANG MUTLAK: mesin bubut/frais/gerinda · las · bor listrik · menyolder · listrik 220V · NaOH & asam kuat · api & pemanasan · naik ke ketinggian lebih dari 1 meter.',
  '',
  'Kalau karyamu memang butuh mesin: buat PURWARUPA SKALA 1:1 dari kardus/PVC + GAMBAR KERJA LENGKAP. Hari Selasa, kamu akan MENYERAHKANNYA SECARA RESMI kepada Wakasek Sarpras untuk difabrikasi. Itu tetap dihitung sebagai AKSI NYATA.',
], ROSE, 'AD1457'));
push(SPACER());
TUGAS('4B', 'RANCANGAN TEKNIS', 'Isi sesuai JURUSAN kelasmu. Ini bagian di mana kamu membuktikan bahwa kamu anak SMK, bukan sekadar panitia acara. Semua bisa dikerjakan tanpa mesin.');
push(TBL([2400, 7238], ['Jurusan', 'Yang HARUS ada di rancanganmu'], [
  ['Teknik Mekatronika', 'Diagram blok · daftar komponen · cara kerja MEKANIS (tuas/pegas/gravitasi) ATAU tautan SIMULASI di tinkercad.com / wokwi.com (gratis, cukup HP). Tenaga: baterai/USB saja — TANPA listrik 220V, TANPA solder.'],
  ['Rekayasa Perangkat Lunak', 'Alur pengguna (user flow) · sketsa layar (min. 3 layar) · data apa yang disimpan · siapa penggunanya. Cukup laptop atau HP.'],
  ['Desain Komunikasi Visual', 'Sketsa layout · palet warna · hierarki informasi · ukuran cetak & titik pasang. Cara memasang TANPA bor: double tape / cable ties / lem.'],
  ['Animasi', 'Storyboard 6 panel · naskah 30 detik · gaya visual · musik/suara · platform (IG Reels / YouTube sekolah).'],
  ['Teknik Kimia Industri', 'Prosedur uji dengan INDIKATOR ALAMI (air kubis ungu / kunyit) + pH strip, ATAU resep ECO-ENZYME dari sisa kulit buah MBG · daftar bahan & takaran · LEMBAR K3. TANPA NaOH, TANPA asam kuat, TANPA api & pemanasan.'],
  ['Teknik Pemesinan', 'GAMBAR KERJA + UKURAN LENGKAP · daftar bahan untuk PURWARUPA (kardus tebal / PVC / kayu ringan) · langkah pengerjaan dengan ALAT TANGAN · titik pemasangan. Gambar kerja diserahkan resmi ke Sarpras hari Selasa.'],
], { size: 19 }));

push(SPACER());
push(P('RANCANGAN KAMI (gambar / tulis di sini):', { bold: true, size: 21, spaceBefore: 60, spaceAfter: 50 }));
push(TBL([9638], null, [[' '], [' '], [' '], [' '], [' '], [' '], [' '], [' '], [' '], [' '], [' '], [' '], [' '], [' ']], { headFill: 'FFFFFF', zebra: false, size: 20 }));

push(SPACER());
push(P('DAFTAR BAHAN — dan KAMU sendiri yang meminta ke Kaprog/toolman, bukan gurumu.', { bold: true, size: 20, spaceAfter: 50 }));
push(TBL([600, 3400, 1600, 2000, 2038], ['No', 'Bahan / Alat', 'Jumlah', 'Dari mana', 'Sudah dapat? ✓'],
  Array.from({ length: 6 }, (_, i) => [String(i + 1), ' ', ' ', ' ', ' ']), { size: 19 }));

push(PB());
TUGAS('4C', 'LEMBAR SILIH ASAH — Umpan Balik untuk Tim Lain', 'Isi untuk 3 tim lain. DILARANG menulis “bagus” tanpa alasan. DILARANG menyerang orangnya — kritik idenya. Umpan balik yang jujur adalah bentuk kasih sayang.');
push(TBL([1800, 2600, 2600, 2638], ['Tim yang kunilai', '✅ Yang SUDAH JALAN', '⚠️ Yang BELUM JALAN', '💡 SATU saran dariku'], [
  [' ', ' \n \n ', ' \n \n ', ' \n \n '],
  [' ', ' \n \n ', ' \n \n ', ' \n \n '],
  [' ', ' \n \n ', ' \n \n ', ' \n \n '],
], { headFill: NAVY, zebra: false, size: 19 }));

push(SPACER());
push(P('UMPAN BALIK YANG KAMI TERIMA — dan apa yang akan kami perbaiki BESOK PAGI:', { bold: true, size: 20, spaceBefore: 60, spaceAfter: 50 }));
push(TBL([4819, 4819], ['Masukan yang paling menohok', 'SATU perbaikan yang akan kami kerjakan besok'], [[' \n \n ', ' \n \n ']], { size: 20 }));

push(SPACER());
push(BANNER('JURNAL WALUYA — HARI 4', '1F3864'));
push(P('Apa yang paling SULIT hari ini?', { bold: true, size: 20, spaceBefore: 60, spaceAfter: 30 }));
push(LINES(2));
push(P('SIAPA yang menolongku melewatinya? Apa yang dia lakukan?', { bold: true, size: 20, spaceAfter: 30 }));
push(LINES(2));
push(P('Apakah aku menjadi orang yang menolong, atau yang ditolong? Jujur.', { bold: true, size: 20, spaceAfter: 30 }));
push(LINES(2));
push(TBL([9638], ['Balasan Wali Kelas (satu kalimat)'], [[' '], [' ']], { headFill: '7F7F7F', zebra: false, size: 19 }));

push(PB());

// ================= LK-5 =================
push(BANNER('LK-5 · HARI 5 · SELASA, 21 JULI 2026 · SINGER — “BERTINDAK & BERBAGI”', 'C55A11'));
push(BOX('HARI INI SESUATU HARUS BENAR-BENAR BERUBAH DI SEKOLAH INI.', [
  'Bukan dipamerkan. BERUBAH.',
  'Kalau hari ini tidak ada satu pun hal yang berbeda di SMKN 2 Cimahi, berarti lima hari kita gagal.',
  'Nilai SINGER: “tidak hanya berpikir dan berbicara, tetapi juga BERANI MELAKUKAN TINDAKAN yang membawa manfaat.”',
], GOLD, 'BF8F00'));

TUGAS('5A', 'BUKTI AKSI NYATA — BEFORE & AFTER', 'Foto dari SUDUT YANG SAMA. Tempel di sini atau tulis nomor filenya.');
push(TBL([4819, 4819], ['📷 BEFORE (sebelum kami bertindak)', '📷 AFTER (setelah kami bertindak)'], [
  [' \n \n \n \n \n ', ' \n \n \n \n \n '],
], { size: 20 }));
push(TBL([2800, 6838], null, [
  ['Lokasi titik aksi kami', ' '],
  ['Apa PERSISNYA yang kami pasang / jalankan / perbaiki', ' '],
  ['Berapa orang yang akan terbantu? (angka, bukan “banyak”)', ' '],
  ['Kata MITRA kami (Caraka / Satpam / Ibu Kantin / murid) setelah melihat hasilnya:', '“ ”'],
], { headFill: 'C55A11', zebra: false, size: 20 }));

push(SPACER());
push(P('PRESENTASI 60 DETIK — hafalkan formula ini untuk Gelar Karya:', { bold: true, size: 20, spaceAfter: 50 }));
push(TBL([2200, 7438], null, [
  ['Kami MENEMUKAN', '(sebut 1 ANGKA) ' ],
  ['Kami MENDENGAR', '(sebut 1 KUTIPAN narasumber) '],
  ['Kami MEMBUAT', '(sebut KARYA-nya) '],
  ['Sekarang', '(sebut PERUBAHAN-nya) '],
], { headFill: 'C55A11', zebra: false, size: 20 }));

push(PB());
TUGAS('5B', 'RADAR KEBIASAANKU — MINGGU INI', 'Isi ULANG skormu. Bandingkan dengan Hari 1. Jujur — kalau tidak berubah, tulis tidak berubah.');
push(TBL([2800, 1600, 1600, 3638], ['Kebiasaan', 'Skor HARI 1', 'Skor HARI 5', 'Apa yang berubah / kenapa tidak berubah?'], [
  ['Bangun Pagi', ' ', ' ', ' '],
  ['Beribadah', ' ', ' ', ' '],
  ['Berolahraga', ' ', ' ', ' '],
  ['Makan Sehat & Bergizi', ' ', ' ', ' '],
  ['Gemar Belajar', ' ', ' ', ' '],
  ['Bermasyarakat', ' ', ' ', ' '],
  ['Tidur Cepat', ' ', ' ', ' '],
], { size: 20 }));
push(P('Lima hari terlalu singkat untuk mengubah kebiasaan. Yang berubah biasanya bukan kebiasaannya — tapi KESADARANNYA. Itu sudah cukup untuk memulai.', { italics: true, size: 19, color: '595959', spaceBefore: 50 }));

push(PB());

// KONTRAK
push(TBL([9638], null, [['KONTRAK KEBIASAAN WALUYA']], { headFill: NAVY, zebra: false, size: 30 }));
push(P('Ini bukan tugas. Ini janji pada dirimu sendiri.', { align: AlignmentType.CENTER, italics: true, size: 21, spaceBefore: 60, spaceAfter: 100 }));

push(TBL([2900, 6738], null, [
  ['Aku,', ' '],
  ['Kelas / Jurusan', ' '],
  ['Memilih SATU kebiasaan (dari 7 KAIH) untuk kujalankan sampai akhir semester:', ' '],
], { headFill: NAVY, zebra: false, size: 21 }));

push(SPACER());
push(P('Supaya ini tidak sekadar niat, aku menuliskannya SPESIFIK:', { bold: true, size: 20, spaceAfter: 50 }));
push(TBL([3400, 6238], null, [
  ['📌 APA yang akan kulakukan\n(sekecil mungkin, supaya BERHASIL)', 'Contoh: “Tidur 30 menit lebih awal dari biasanya.” Bukan: “Tidur jam 9 setiap hari.”\n \n '],
  ['🕐 KAPAN tepatnya\n(jam berapa, hari apa)', ' \n '],
  ['📏 BAGAIMANA aku mengukurnya\n(supaya aku tahu aku berhasil atau tidak)', ' \n '],
  ['🙋 SIAPA yang akan mengingatkanku\n(nama orang, bukan “diri sendiri”)', ' \n '],
  ['🚧 Apa yang mungkin MENGGAGALKANKU\n(dan apa rencanaku kalau itu terjadi)', ' \n '],
], { headFill: BLUE, zebra: false, size: 20 }));

push(SPACER());
push(P('Aku tahu aku mungkin gagal di minggu pertama. Itu tidak apa-apa. Yang penting aku mulai lagi.', { align: AlignmentType.CENTER, italics: true, size: 20, spaceBefore: 60, spaceAfter: 120 }));

push(TBL([3212, 3213, 3213], null, [
  ['MURID', 'ORANG TUA / WALI', 'WALI KELAS'],
  [' \n \n \n \n(...........................)', ' \n \n \n \n(...........................)', ' \n \n \n \n(...........................)'],
  ['Tanggal: 21 Juli 2026', 'Tanggal: ......................', 'Tanggal: ......................'],
], { headFill: NAVY, zebra: false, size: 20 }));

push(SPACER());
push(BOX('UNTUK ORANG TUA / WALI', [
  'Bapak/Ibu yang kami hormati,',
  '',
  'Rapor Pendidikan SMKN 2 Cimahi menunjukkan bahwa 5 dari 7 Kebiasaan Anak Indonesia Hebat masih berstatus KURANG — terutama Gemar Belajar (5,50), Berolahraga (5,92), dan Tidur Cepat (6,41). Kebiasaan ini tidak bisa dibentuk di sekolah saja.',
  '',
  'Yang kami mohon dari Bapak/Ibu hanya satu: tanda tangani kontrak ini bersama putra/putri Bapak/Ibu, dan sesekali TANYAKAN — bukan menagih, bukan memarahi. Cukup bertanya: “Bagaimana kontrakmu minggu ini?”',
  '',
  'Kembalikan lembar ini kepada wali kelas paling lambat Jumat, 24 Juli 2026.',
  '',
  'Terima kasih. — Tim Kokurikuler SAKOLA WALUYA, SMK Negeri 2 Cimahi',
], LIGHT, '2E74B5'));

push(SPACER());
push(P('PEMANTAUAN MINGGUAN (diisi bersama wali kelas setiap Senin)', { bold: true, size: 20, spaceBefore: 60, spaceAfter: 50 }));
push(TBL([1400, 1400, 1400, 1400, 1400, 1400, 1238], ['Minggu 1', 'Minggu 2', 'Minggu 3', 'Minggu 4', 'Minggu 5', 'Minggu 6', 'Minggu 7'],
  [[' \n ', ' \n ', ' \n ', ' \n ', ' \n ', ' \n ', ' \n ']], { size: 19 }));
push(P('Isi dengan: ✅ berhasil · ⚠️ sebagian · ❌ belum. Tidak ada hukuman untuk ❌ — hanya satu pertanyaan: “Apa yang menghalangi?”', { italics: true, size: 19, spaceBefore: 40 }));

push(PB());
push(BANNER('JURNAL WALUYA — HARI 5 (PENUTUP)', 'C55A11'));
push(P('Apa yang KAMI ubah di sekolah ini minggu ini? (Sebut hal yang konkret.)', { bold: true, size: 20, spaceBefore: 60, spaceAfter: 30 }));
push(LINES(2));
push(P('Apa yang berubah DI DALAM DIRIKU minggu ini?', { bold: true, size: 20, spaceAfter: 30 }));
push(LINES(2));
push(P('Kalau aku bisa mengatakan SATU hal pada diriku di hari Rabu lalu, aku akan bilang:', { bold: true, size: 20, spaceAfter: 30 }));
push(LINES(3));
push(P('“Minggu depan saya akan ______________________________________________________________.”', { bold: true, size: 21, color: NAVY, spaceBefore: 60, spaceAfter: 100 }));
push(TBL([9638], ['Balasan Wali Kelas (satu kalimat)'], [[' '], [' ']], { headFill: '7F7F7F', zebra: false, size: 19 }));

push(SPACER());
push(P('CAGEUR · BAGEUR · BENER · PINTER · SINGER', { align: AlignmentType.CENTER, bold: true, size: 24, color: NAVY, spaceBefore: 160, spaceAfter: 40 }));
push(P('“Jadi pendidikan teh kudu nyiptakeun manusa anu sawawa.”', { align: AlignmentType.CENTER, italics: true, size: 20, color: '595959', spaceAfter: 20 }));
push(P('— Pendidikan itu harus menciptakan manusia yang paripurna —', { align: AlignmentType.CENTER, italics: true, size: 19, color: '7F7F7F' }));

save(c, '/sessions/vibrant-inspiring-einstein/mnt/Ko Kurikuler/SAKOLA_WALUYA_XI_2026/01_Output_Word/03_LK_Siswa_JURNAL_WALUYA.docx');
