const K = require('./kartu.js');
const { T, HARI, SESI, BOX, SP, PB, TBL, cell, AlignmentType, TableRow, Document, Packer } = K;
const fs = require('fs');

const NAVY='1F3864', GRN='2E7D32', GOLD='BF8F00', ROSE='AD1457', ORG='C55A11';
const c = [];
const p = (...x) => x.forEach(i => Array.isArray(i)?c.push(...i):c.push(i));

// ============ HAL 1: ATURAN EMAS ============
p(T('SAKOLA WALUYA', { b:true, s:52, c:NAVY, al:AlignmentType.CENTER, sa:20 }));
p(T('KARTU SAKU WALI KELAS', { b:true, s:30, c:'2E74B5', al:AlignmentType.CENTER, sa:20 }));
p(T('Tempel di meja Anda. Ini saja yang perlu dibaca.', { i:true, s:22, c:'595959', al:AlignmentType.CENTER, sa:200 }));

p(BOX('LIMA ATURAN. HAFALKAN.', [
  '1.  ANDA TIDAK MENGAJAR. Anda bertanya. Bicara maksimal 25% waktu.',
  '',
  '2.  TIGA KALIMAT ANDALAN:  "Menurut kamu kenapa?"  ·  "Apa buktinya?"  ·  "Kalau begitu, apa yang bisa kita lakukan?"',
  '',
  '3.  TIAP SESI HARUS ADA MURID BERDIRI / BERGERAK / BERPINDAH.',
  '',
  '4.  KEPUTUSAN DIAMBIL MURID. Bukan Anda.',
  '',
  '5.  ANDA SENDIRIAN — DAN ITU DISENGAJA. Tugas "guru kedua" sudah diberikan ke murid.',
], 'E8F5E9', GRN));

p(SP());
p(T('ENAM PERAN MURID — bentuk di Hari 1, rotasi tiap hari', { b:true, s:26, c:NAVY, sa:80 }));
p(TBL([2400, 7238], [
  new TableRow({ children:[ cell('KAPTEN TIM (6)', {w:2400,b:true,fill:'E8F0FA'}), cell('Jaga keutuhan & keselamatan timnya di lapangan.', {w:7238}) ]}),
  new TableRow({ children:[ cell('TIM WAKTU (2)', {w:2400,b:true,fill:'E8F0FA'}), cell('Pegang stopwatch. Umumkan sisa waktu. ANDA TIDAK LAGI MENGURUS WAKTU.', {w:7238}) ]}),
  new TableRow({ children:[ cell('TIM PIKET (2)', {w:2400,b:true,fill:'E8F0FA'}), cell('Jaga PAPAN KARTU. Lihat siapa masih di luar.', {w:7238}) ]}),
  new TableRow({ children:[ cell('TIM K3 (2)', {w:2400,b:true,fill:'FDE8EF'}), cell('Cek alat & APD. BERWENANG MENGHENTIKAN kerja yang tidak aman — semua wajib patuh, termasuk Anda.', {w:7238}) ]}),
  new TableRow({ children:[ cell('TIM DOKUMENTASI (2)', {w:2400,b:true,fill:'E8F0FA'}), cell('Foto & video. Foto BEFORE–AFTER Hari 5.', {w:7238}) ]}),
  new TableRow({ children:[ cell('TIM LOGISTIK (2)', {w:2400,b:true,fill:'E8F0FA'}), cell('Siapkan & bereskan alat. Kelas tak bubar sebelum mereka bilang beres.', {w:7238}) ]}),
]));

p(SP());
p(BOX('PAPAN KARTU — pengganti kartu izin. ANDA TIDAK TANDA TANGAN APA PUN.', [
  'Di dinding kelas: 6 SLOT + 6 KARTU TIM (warna berbeda) (satu per tim).',
  '',
  'TIM BERANGKAT  →  ambil kartunya, pakai.',
  'TIM PULANG        →  kembalikan kartu ke slot timnya.',
  '',
  'SLOT KOSONG = TIM ITU MASIH DI LUAR. Anda cukup MELIHAT papan. Tidak ada kertas, tidak ada tanda tangan, tidak ada jam yang perlu ditulis.',
  '',
  'Izin menjelajah sudah melekat pada SEKTOR yang ditetapkan Koordinator — bukan pada tanda tangan Anda.',
], 'FFF6E0', GOLD));

p(SP());
p(T('KALAU ADA APA-APA — HUBUNGI KOORDINATOR. Itu memang gunanya beliau berkeliling.', { b:true, s:24, c:ROSE, al:AlignmentType.CENTER }));
p(T('Nomor Koordinator: ..................................    UKS: ..................................    Satpam: ..................................', { s:22, al:AlignmentType.CENTER, sb:60 }));

p(PB());

// ============ HAL 2: KARTU RUJUKAN ============
p(T('KARTU RUJUKAN', { b:true, s:36, c:NAVY, al:AlignmentType.CENTER, sa:30 }));
p(T('Empat hal yang harus Anda ucapkan / tunjukkan persis. Simpan di halaman ini.', { i:true, s:20, c:'595959', al:AlignmentType.CENTER, sa:120 }));

p(BOX('1 · KALIMAT BAKU — HARI 1, sebelum Google Form. Ucapkan PERSIS.', [
  '"Formulir ini ANONIM. Saya tidak tahu siapa menulis apa, dan saya memang tidak ingin tahu.',
  'Ada satu kotak di bawah: \u2018Saya ingin berbicara dengan Guru BK.\u2019 Kalau kalian mencentangnya, hanya Guru BK yang melihatnya — bukan saya. Kalian boleh menulis nama, boleh juga tidak.',
  'Kalau ada sesuatu yang berat, kalian tidak sendirian. Guru BK ada, dan beliau akan menghubungi kalian."',
], 'FFF6E0', GOLD));
p(SP());

p(BOX('2 · EMPAT ATURAN JELAJAH — bacakan Hari 1, ingatkan Hari 2 & 3.', [
  '1.  Tidak ada murid sendirian. Minimal berdua.',
  '2.  Tidak boleh keluar gerbang sekolah.',
  '3.  Hanya di SEKTOR kelas kita. Dilarang masuk ruang KBM, ruang guru, bengkel, dan area MPLS kelas X.',
  '4.  Pulang tepat waktu. Kembalikan kartunya ke papan.',
], 'FDE8EF', ROSE));
p(SP());

p(BOX('3 · ETIKA NGAJUGJUG — bacakan Hari 3, sebelum murid berangkat.', [
  '1.  Minta izin: "Bapak/Ibu, boleh minta waktu 10 menit? Kalau sedang sibuk, kami bisa kembali nanti."',
  '2.  MAKSIMAL 10 MENIT. Lewat itu — PAMIT. Beliau sedang bekerja.',
  '3.  Mau merekam? TANYA DULU.',
  '4.  BELIAU MENOLAK atau SIBUK? JANGAN DIPAKSA. Catat "tidak tersedia", kembali ke POS, lapor. Menerima penolakan dengan sopan juga BAGEUR.',
  '5.  TIDAK KETEMU orangnya? Cari maksimal 5 menit, lalu KEMBALI. Jangan berkeliaran.',
  '6.  Sebelum pamit: "Hari Selasa kami akan tunjukkan hasilnya ke Bapak/Ibu." — DAN TEPATI.',
], 'FDE8EF', ROSE));
p(SP());

p(BOX('4 · ALAT: BOLEH vs DILARANG — tunjukkan Hari 4.', [
  'BOLEH (diawasi Tim K3):  gunting · cutter · gergaji tangan kecil · obeng · tang · palu kecil · amplas · lem · double tape · cable ties · kardus · pipa PVC · kayu ringan · botol bekas · laptop & HP.',
  '',
  'DILARANG MUTLAK:  mesin bubut/frais/gerinda · las · bor listrik · kompresor · menyolder · listrik 220V · NaOH & asam kuat · api & pemanasan · naik ketinggian lebih dari 1 meter.',
  '',
  'BUTUH MESIN?  Buat purwarupa 1:1 dari kardus/PVC + GAMBAR KERJA. Hari Selasa diserahkan RESMI ke Wakasek Sarpras untuk difabrikasi. Itu TETAP dihitung sebagai aksi nyata.',
], 'E8F5E9', GRN));
p(SP());

p(BOX('DI MANA MURID MENULIS?', [
  'BUKU TULIS  →  JURNAL REFLEKSI harian (3 pertanyaan) + KONTRAK KEBIASAAN (Hari 5, ditandatangani orang tua di buku).',
  '',
  'GOOGLE SHEET TIM  →  semua yang lain: radar kebiasaan · data lapangan · grafik · pohon akar · kutipan wawancara · peta empati · matriks prioritas · ide & rancangan · foto before-after.',
  '',
  'TIDAK ADA LEMBAR KERJA YANG DICETAK. Satu Sheet per tim, sudah disiapkan Koordinator. Anda cukup membuka tautannya.',
], 'E8F0FA', '2E74B5'));


p(PB());

// ============ HARI 1 ============
p(HARI(1, 'RABU, 15 JULI 2026', 'CAGEUR', 'KENALI DIRI', GRN));
p(SP());
p(T('HASIL AKHIR HARI INI:  potret jujur 7 kebiasaan tiap murid  +  kelas punya ZONA, 6 TIM, dan 6 PERAN.', { b:true, s:21, c:GRN, sa:70 }));

p(SESI('07.30–07.45', 'PEMANTIK — Tulis "5,50" di papan. Lalu DIAM.', [
  ["2 mnt", 'Tulis SATU angka besar di papan: 5,50. Jangan jelaskan apa pun. Biarkan murid bertanya-tanya.'],
  ["5 mnt", '"Menurut kalian ini angka apa?" — Tampung semua tebakan. Jangan dikoreksi.'],
  ["5 mnt", 'Buka: "Ini skor GEMAR BELAJAR seluruh murid SMKN 2 Cimahi. Dari 10. Dan itu TERENDAH dari 7 kebiasaan." Tayangkan grafik (paparan slide TAYANG).'],
  ["3 mnt", '"Kalian setuju atau tidak?" — lalu DIAM. Jangan dibahas. Biarkan menggantung.'],
], GRN));
p(SP());
p(SESI('07.45–09.15', 'SESI 1 — Barometer Kebiasaan (murid BERDIRI & BERPINDAH)', [
  ["5 mnt", 'Ucapkan: "Hari ini tidak ada benar atau salah. Yang saya nilai cuma satu: KEJUJURAN kalian."'],
  ["25 mnt", 'BAROMETER. Bacakan 7 pernyataan. Murid pindah: KIRI = "aku banget" · TENGAH = "kadang" · KANAN = "jauh dari aku". Tunjuk 1–2 murid: "Kenapa kamu berdiri di situ?" Dengarkan. Ucapkan terima kasih. JANGAN dinasihati.'],
  ["25 mnt", 'Murid isi RADAR KEBIASAAN di Google Sheet tim (skor 1–10). Sheet otomatis membuat grafiknya.'],
  ["20 mnt", 'DATA KELAS: rekap skor di papan, HITUNG RATA-RATA, bandingkan dengan skor sekolah. "Kelas kita di atas atau di bawah? Kenapa?"'],
  ["15 mnt", 'DISKUSI 4–2–1: berempat, pilih 2 kebiasaan paling bermasalah → sepakati 1 yang mau diperbaiki.'],
], GRN));
p(SP());
p(SESI('09.30–11.00', 'SESI 2 — SUARA WALUYA (Google Form anonim)', [
  ["5 mnt", 'UCAPKAN KALIMAT BAKU (lihat kotak bawah). Persis. Jangan diimprovisasi.'],
  ["3 mnt", 'Tayangkan QR CODE dari koordinator. Murid memindai dengan HP.'],
  ["12 mnt", 'Murid mengisi Form. ANONIM. ANDA DUDUK — jangan berkeliling melihat layar murid.'],
  ["25 mnt", 'Buka Google Sheet, TAYANGKAN hasil kelas Anda. Murid membaca dalam diam. Anda tidak berkomentar.'],
  ["30 mnt", 'MURID maju ke papan: kelompokkan jawaban yang mirip, beri judul, HITUNG jumlahnya.'],
  ["15 mnt", 'VOTING KAKI. Murid berdiri di depan kategori paling mendesak. "Kategori mana paling banyak? Kenapa?" JANGAN membela sekolah. JANGAN berjanji apa pun.'],
], GRN));
p(SP());
p(SESI('11.00–11.45', 'SESI 3 — Zona, 6 Tim, 6 Peran, Papan Kartu', [
  ["8 mnt", 'Tempel 5 poster Zona. Murid berjalan, membaca, BERDIRI di depan zona pilihannya. (Kalau sekolah sudah menetapkan zona kelas Anda — sampaikan, lalu murid memilih SUB-FOKUS.)'],
  ["12 mnt", 'Bentuk 6 TIM + bagi 6 PERAN. Ucapkan: "Minggu ini saya sendirian. Kalau kalian menunggu saya mengatur segalanya, kita tidak akan selesai. Saya tidak sedang malas — saya sedang mempercayai kalian."'],
  ["5 mnt", 'BERI WEWENANG TIM K3 DI DEPAN KELAS: "Kalau Tim K3 bilang berhenti, semua berhenti. Termasuk saya."'],
  ["8 mnt", 'Pasang PAPAN KARTU di dinding. Tim Piket menjelaskan cara kerjanya. Bacakan 4 aturan jelajah (kotak bawah).'],
  ["12 mnt", 'NORMA TIM: kelas menulis 5 aturan main sendiri di plano. SEMUA menandatangani. Tempel sampai akhir semester.'],
], GRN));
p(SP());
p(T('11.45–12.00  ·  JURNAL DI BUKU TULIS. 3 pertanyaan (lihat Papan Instruksi). Baca malam ini. Balas SATU kalimat di tiap buku.', { b:true, s:24, c:NAVY, sa:100 }));

p(PB());

// ============ HARI 2 ============
p(HARI(2, 'KAMIS, 16 JULI 2026', 'BENER', 'CARI FAKTA', GOLD));
p(SP());
p(T('HASIL AKHIR HARI INI:  kelas punya DATA NYATA (angka + foto) tentang masalah di SEKTOR-nya. Bukan opini.', { b:true, s:21, c:GOLD, sa:70 }));
p(BOX('CEK DULU: GELOMBANG KELAS ANDA (lihat Kartu Sektor dari Koordinator)', [
  'BIRU → lapangan 07.45–09.15, di kelas 09.30–11.00.        JINGGA → di kelas 07.45–09.15, lapangan 09.30–11.00.',
], 'E8F0FA', '2E74B5'));
p(SP());
p(SESI('07.30–07.45', 'PEMANTIK — "Katanya vs Buktinya"', [
  ["5 mnt", 'Tulis di papan: "Toilet sekolah kita kotor." Tanya: "Ini FAKTA atau OPINI?" Biarkan mereka berdebat.'],
  ["5 mnt", '"Bagaimana caranya ini jadi FAKTA?" Pancing sampai MURID sendiri menyebut: dihitung, diukur, difoto, ditanya.'],
  ["5 mnt", 'Tutup: "Hari ini setiap kalimat yang kalian tulis HARUS punya BUKTI. Kalau tidak ada buktinya — CORET."'],
], GOLD));
p(SP());
p(SESI('SESI LAPANGAN\n(90 mnt, sesuai\ngelombang)', 'TURUN LAPANGAN — ANDA MENETAP DI POS', [
  ["Awal", 'Tim K3 cek APD. Tim ambil KARTU dari papan. Tim Piket mencatat. TIDAK ADA TANDA TANGAN.'],
  ["Inti", 'ANDA TETAP DI POS. JANGAN ikut satu tim — 5 tim lain akan tanpa pengawasan. Anda boleh berkeliling maksimal 5 menit, hanya ke tempat yang MASIH TERLIHAT dari Pos.'],
  ["Target", 'Tiap tim WAJIB pulang membawa: (a) 10 baris data ANGKA, (b) 5 foto, (c) 1 hal yang mengejutkan. Semuanya diketik di Google Sheet tim.'],
  ["Pulang", 'Tim Waktu bunyikan tanda. Kartu DIKEMBALIKAN KE PAPAN. Papan penuh = semua kembali.'],
], GOLD));
p(SP());
p(SESI('SESI KELAS\n(90 mnt, sesuai\ngelombang)', 'OLAH DATA (kalau sudah lapangan) / SIAPKAN (kalau belum)', [
  ["Sudah\nlapangan", 'Hitung total, rata-rata, persentase di Sheet. Buat GRAFIK. Anda hanya bertanya: "Angka ini artinya apa?"'],
  ["Belum\nlapangan", 'Pelajari peta sektor · susun instrumen ukur · olah DATA SEKUNDER dari Sarpras & PJ MBG (ini numerasi sungguhan) · susun HIPOTESIS yang akan diuji.'],
], GOLD));
p(SP());
p(SESI('11.00–11.45', 'SESI 3 — POHON AKAR MASALAH (5x KENAPA)', [
  ["30 mnt", 'BUAH = akibat terlihat. BATANG = masalahnya. AKAR = penyebab sebenarnya. Tantang dengan 5x KENAPA.'],
  ["", 'Contoh: "Toilet bau" → kenapa? → "air tak jalan" → kenapa? → "keran rusak" → kenapa? → "tak ada yang lapor" → kenapa? → "tak tahu lapor ke mana". NAH ITU AKARNYA — dan itu bisa dikerjakan anak RPL.'],
  ["15 mnt", 'Tiap tim menulis: "Masalah sebenarnya adalah ___, karena ___, dibuktikan dengan data ___."'],
], GOLD));
p(SP());
p(BOX('KALAU MACET', [
  'Tim pulang tangan kosong?  →  Kirim balik dengan tugas SANGAT spesifik: "Hitung berapa detik air mengisi 1 gelas. Di 5 keran. Kembali dengan angka."',
  'Akar masalahnya dangkal ("murid malas")?  →  "Itu menyalahkan orang, bukan menemukan akar. Kalau malas, KENAPA malas? Sistem apa yang bikin dia malas?"',
  'Tim telat kembali?  →  Ingatkan sekali. Kalau berulang: tim itu tidak turun lapangan lagi hari itu.',
], 'F5F7FA', '2E74B5'));

p(PB());

// ============ HARI 3 ============
p(HARI(3, 'JUMAT, 17 JULI 2026', 'BAGEUR', 'RASAKAN & PILIH', ROSE));
p(SP());
p(T('HASIL AKHIR HARI INI:  kelas memilih SATU masalah prioritas — berdasarkan siapa yang paling terdampak.', { b:true, s:21, c:ROSE, sa:70 }));
p(BOX('HARI INI PENDEK — SELESAI 11.00 (Shalat Jumat). Sesi 3 DITIADAKAN.', [
  'Jangan memaksakan produksi hari ini. Itu jatah Hari 4.',
], 'FDE8EF', ROSE));
p(SP());
p(SESI('07.30–07.45', 'PEMANTIK — "Siapa yang Paling Merasakan?"', [
  ["5 mnt", 'Tanya, lalu DIAM LAMA: "Dari semua masalah kemarin — SIAPA yang paling menderita? Sebut ORANGNYA, bukan kelompoknya."'],
  ["7 mnt", 'Dorong sampai murid menyebut orang konkret: adik kelas X, Pak Caraka, ibu kantin, satpam.'],
  ["3 mnt", 'Tutup: "Hari ini kita tidak mengukur apa-apa. Hari ini kita MENDENGARKAN."'],
], ROSE));
p(SP());
p(SESI('07.45–08.00', 'LATIHAN BERTANYA + bagi jadwal NGAJUGJUG', [
  ["8 mnt", 'Tunjukkan bedanya. BURUK: "Toiletnya kotor ya, Pak?" (menggiring). BAIK: "Bapak, boleh cerita, bagian mana dari pekerjaan Bapak yang paling melelahkan?" (membuka).'],
  ["7 mnt", 'Bagikan jadwal NGAJUGJUG kelas Anda (dari Koordinator). Bacakan ETIKA (kotak bawah).'],
], ROSE));
p(SP());
p(SESI('SESI LAPANGAN\n(60 mnt, sesuai\ngelombang)', 'NGAJUGJUG — murid MENGHAMPIRI narasumber di tempat kerjanya', [
  ["Delegasi", 'HANYA 3 MURID yang menghampiri narasumber kunci: 1 Kapten + 1 pencatat + 1 dokumentasi. MAKSIMAL 10 MENIT.'],
  ["Tim lain", 'Mewawancarai warga sekolah "biasa" di SEKTOR: murid kelas X (hanya saat istirahat MPLS!), murid kelas lain, guru piket.'],
  ["Target", 'Tiap tim pulang membawa 3 KUTIPAN LANGSUNG (kalimat PERSIS, dalam tanda kutip) + nama & peran narasumber. Diketik di Sheet.'],
  ["ANDA", 'TETAP DI POS. Papan Kartu yang bicara.'],
], ROSE));
p(SP());
p(SESI('SESI KELAS\n(60 mnt, sesuai\ngelombang)', 'PETA EMPATI + MATRIKS PRIORITAS + VOTING', [
  ["20 mnt", 'PETA EMPATI (di Sheet). Pilih SATU narasumber utama. 4 kuadran: APA YANG DIA KATAKAN · DIA LAKUKAN · DIA PIKIRKAN · DIA RASAKAN.'],
  ["20 mnt", 'MATRIKS PRIORITAS. Petakan masalah pada 2 sumbu: DAMPAK × BISA KAMI KERJAKAN (2 hari, tanpa mesin).'],
  ["20 mnt", 'VOTING KAKI. 3 stiker per murid. Terbanyak MENANG. Tulis plano besar: "MASALAH KAMI / ORANG YANG KAMI BANTU / TARGET SELESAI SELASA".'],
  ["10.45\n11.00", 'JUMAT BERKAH. Murid MENYERAHKAN ucapan terima kasih tertulis ke narasumber. Jurnal di buku. Dilepas ke Shalat Jumat.'],
], ROSE));
p(SP());
p(BOX('KALAU MACET', [
  'Murid jawab "semua orang menderita"?  →  TOLAK. "Semua orang artinya tidak ada orang. Sebut SATU nama atau SATU peran."',
  'Kelas pilih masalah MUSTAHIL?  →  Jangan dilarang. Tanya: "Bagian MANA yang bisa benar-benar selesai hari Selasa?"',
  'ZONA Z5:  DILARANG mewawancarai korban perundungan. Hanya boleh menanya PENGETAHUAN soal sistem: "Kalau ada yang dirundung, dia lapor ke mana?"',
], 'F5F7FA', '2E74B5'));

p(PB());

// ============ HARI 4 ============
p(HARI(4, 'SENIN, 20 JULI 2026', 'PINTER', 'RANCANG & BUAT', NAVY));
p(SP());
p(T('HASIL AKHIR HARI INI:  purwarupa v1 SUDAH ADA WUJUDNYA (walau jelek). HARI TERSIBUK.', { b:true, s:21, c:NAVY, sa:70 }));
p(BOX('PRINSIP HARI INI: JELEK DULUAN, BAGUS BELAKANGAN.', [
  'Dalam 90 menit pertama harus sudah ada BENDA / LAYAR / GAMBAR yang bisa disentuh — walau jelek. SEMUA DI KELAS. Tidak masuk bengkel, tidak ada mesin.',
], 'E8F5E9', GRN));
p(SP());
p(SESI('07.30–07.45', 'PEMANTIK — "Bikin dalam 5 Menit"', [
  ["3 mnt", 'Bagikan kertas HVS, gunting, lakban. "Kalian punya 5 menit. Buat SESUATU yang bisa menyelesaikan masalah kalian. Boleh jelek. Boleh konyol. Yang penting ADA WUJUDNYA."'],
  ["5 mnt", 'Hitung mundur DENGAN KERAS.'],
  ["7 mnt", 'Tiap tim angkat karyanya 30 detik. Tidak ada penilaian. Tutup: "Kalian baru saja membuat sesuatu dalam 5 menit. Bayangkan kalau punya 3 jam."'],
], NAVY));
p(SP());
p(SESI('07.45–09.15', 'SESI 1 — Badai Ide & Rancangan Teknis', [
  ["20 mnt", 'BADAI IDE 6-3-5 (SENYAP). 6 orang/meja. Tulis 3 IDE dalam 5 MENIT, lalu GESER ke kanan. Penerima MENGEMBANGKAN, bukan mengkritik. 3 putaran.'],
  ["8 mnt", 'TAYANGKAN BATASAN ALAT. Jujur: "Kita tidak masuk bengkel. Justru itu tantangannya — bisa tidak kalian bikin sesuatu yang BENAR-BENAR DIPAKAI, hanya dengan kardus dan otak kalian?"'],
  ["12 mnt", 'Pilih 1 ide dengan 4 SYARAT: (a) pakai kompetensi keahlian kelas, (b) BISA tanpa mesin, (c) selesai 2 hari, (d) menolong orang yang kami wawancarai.'],
  ["30 mnt", 'RANCANGAN TEKNIS di Sheet (sesuai jurusan). Boleh foto sketsa tangan lalu ditempel.'],
  ["20 mnt", 'Ambil bahan sendiri dari kotak kelas. Utamakan KARDUS & BARANG BEKAS.'],
], NAVY));
p(SP());
p(SESI('09.30–11.00', 'SESI 2 — PRODUKSI (di kelas, meja digeser)', [
  ["8 mnt", 'BRIEFING K3 oleh TIM K3 (MURID), bukan Anda. Anda hanya menegaskan: "Kalau Tim K3 bilang berhenti, semua berhenti. Termasuk saya."'],
  ["70 mnt", 'ANDA BERJALAN, tidak duduk. Tugas Anda TIGA: (1) awasi cutter & gergaji bersama Tim K3, (2) tanya "apa kendalanya?" — BUKAN "kenapa belum selesai?", (3) catat 3 catatan anekdotal.'],
  ["", 'JANGAN MENGERJAKAN KARYA MURID. Sekali Anda memegang gunting "supaya cepat", karya itu bukan milik mereka lagi — dan mereka tidak akan merawatnya.'],
  ["12 mnt", 'Tim Logistik pimpin pembersihan. Tim K3 HITUNG ULANG alat (pastikan tidak ada cutter hilang).'],
], NAVY));
p(SP());
p(SESI('11.00–11.45', 'SESI 3 — SILIH ASAH (umpan balik antartim)', [
  ["10 mnt", 'Purwarupa dipajang. Separuh kelas menjaga, separuh berkeliling sebagai penguji.'],
  ["20 mnt", 'Penguji menulis untuk 3 tim lain: "Yang SUDAH JALAN: ___ · Yang BELUM JALAN: ___ · Satu SARAN saya: ___". DILARANG menulis "bagus" tanpa alasan. Lalu bertukar peran.'],
  ["15 mnt", 'Tiap tim menulis SATU perbaikan yang akan dikerjakan besok pagi.'],
], NAVY));
p(SP());
p(SP());
p(BOX('KALAU MACET', [
  'Bahan kurang?  →  JANGAN batalkan. UBAH SKALA. Boleh kardus, boleh seluruhnya digital. Yang dinilai IDE & PROSES.',
  'Semua tim usul ide sama?  →  BAGUS. Tiap tim kerjakan BAGIAN berbeda dari solusi yang sama.',
  'Protes "kok nggak boleh ke bengkel?"  →  "Karena saya sendirian, dan saya tidak mau ada yang celaka di tangan saya. Gambar kerja kalian tetap akan difabrikasi Kaprog nanti."',
  'Main-main dengan cutter?  →  TIM K3 menegur dulu. Kalau tak digubris, tarik alatnya. Sekali. Tanpa negosiasi.',
], 'F5F7FA', '2E74B5'));

p(PB());

// ============ HARI 5 ============
p(HARI(5, 'SELASA, 21 JULI 2026', 'SINGER', 'BERTINDAK & BERBAGI', ORG));
p(SP());
p(T('HASIL AKHIR HARI INI:  SESUATU BENAR-BENAR BERUBAH DI SEKOLAH INI. Bukan dipamerkan — BERUBAH.', { b:true, s:21, c:ORG, sa:70 }));
p(SESI('07.30–07.45', 'PEMANTIK — Perbaikan Kilat', [
  ["15 mnt", 'Tim langsung mengerjakan SATU perbaikan yang mereka tulis kemarin sore. ANDA TIDAK BICARA. Hanya menghitung waktu.'],
], ORG));
p(SP());
p(SESI('SESI AKSI\n(45 mnt, sesuai\ngelombang)', 'AKSI NYATA di titik sasaran', [
  ["Awal", 'Tim Dokumentasi ambil FOTO "BEFORE". WAJIB. Tanpa foto before, tidak ada bukti perubahan.'],
  ["Inti", 'Pasang / jalankan / uji karya di sektor sendiri. PEMASANGAN TANPA BOR: cable ties · double tape busa · gantungan tempel · tali · benda berdiri bebas · paku/kait YANG SUDAH ADA.'],
  ["Akhir", 'FOTO "AFTER" dari SUDUT YANG SAMA. Lalu tiap tim MENEMUI narasumbernya dan MENUNJUKKAN hasilnya. Minta 1 kalimat tanggapan.'],
  ["ANDA", 'Menetap di POS yang dipindahkan ke dekat titik aksi.'],
], ORG));
p(SP());
p(SESI('09.30–10.45', 'GELAR KARYA LORONG — di depan kelas Anda sendiri', [
  ["09.30", 'Tata stan di depan ruang kelas. Pajang: karya · grafik data · foto BEFORE–AFTER · kutipan narasumber · Peta Empati.'],
  ["09.45", 'RONDE 1 — Gelombang BIRU jadi TUAN RUMAH, JINGGA berkunjung.'],
  ["10.15", 'RONDE 2 — BERTUKAR.'],
  ["Formula", 'MURID yang bicara, bukan Anda. 60 detik: "Kami menemukan [ANGKA]. Kami mendengar [KUTIPAN]. Kami membuat [KARYA]. Sekarang [PERUBAHAN]."'],
  ["10.45", 'PENYERAHAN RESMI gambar kerja & surat permohonan ke Wakasek Sarpras / Kaprog, di depan pengunjung. Lalu APRESIASI (bukan juara).'],
], ORG));
p(SP());
p(SESI('11.00–11.45', 'PENUTUP — Kontrak Kebiasaan Waluya', [
  ["15 mnt", 'Serahkan konten kampanye ke Tim ICT (DKV & Animasi). Kelas lain: 1 foto + 1 caption.'],
  ["10 mnt", 'RADAR KEBIASAAN ULANG di Sheet. Bandingkan dengan Hari 1. "Apa yang berubah? Apa yang TIDAK berubah? Kenapa?"'],
  ["15 mnt", 'KONTRAK KEBIASAAN WALUYA — DITULIS TANGAN DI BUKU TULIS. Satu kebiasaan · kapan tepatnya · cara mengukurnya · siapa yang mengingatkan. Ditandatangani murid. Dibawa pulang untuk TTD ORANG TUA. Dikembalikan paling lambat Jumat 24 Juli.'],
  ["5 mnt", 'LINGKARAN PENUTUP. Tiap murid satu kalimat: "Minggu depan saya akan ______." TIDAK ADA PIDATO GURU.'],
], ORG));
p(SP());
p(BOX('KALAU MACET', [
  'Purwarupa GAGAL TOTAL?  →  Itu DATA, bukan aib. Minta mereka presentasi: "Apa yang kami pelajari dari kegagalan ini."',
  'Izin pemasangan belum turun?  →  Jangan memasang diam-diam. Pasang, foto, lepas. Lalu serahkan RESMI ke Wakasek Sarpras + surat permohonan yang ditulis MURID.',
  'Kontrak terlalu muluk?  →  "Realistis nggak? Mulai dari yang kecil: tidur 30 menit lebih awal. Kalau berhasil, baru naikkan."',
], 'F5F7FA', '2E74B5'));
p(SP());
p(BOX('SETELAH 21 JULI — jangan berhenti di sini', [
  'SETIAP SENIN, 5 menit di jam perwalian: "Angkat tangan yang minggu ini berhasil menjalankan kontraknya." Tidak ada hukuman bagi yang gagal — hanya satu pertanyaan: "Apa yang menghalangi?"  ·  Karya yang terpasang DIRAWAT kelas pembuatnya sampai akhir semester.',
], 'E8F5E9', GRN));

// ============ SAVE ============
const doc = new Document({
  styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 680, right: 680, bottom: 620, left: 680 } } },
    children: c,
  }],
});
Packer.toBuffer(doc).then(b => {
  fs.writeFileSync(process.argv[2] || '/tmp/KARTU_SAKU_GURU.docx', b);
  console.log('WROTE', process.argv[2]);
});
