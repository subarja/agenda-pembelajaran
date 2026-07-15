const K = require('./kartu.js');
const { T, HARI, SESI, BOX, SP, PB, TBL, cell, AlignmentType, TableRow, Document, Packer } = K;
const fs = require('fs');
const NAVY='1F3864', GRN='2E7D32', GOLD='BF8F00', ROSE='AD1457', ORG='C55A11', BLUE='2E74B5';
const c=[]; const p=(...x)=>x.forEach(i=>Array.isArray(i)?c.push(...i):c.push(i));

function TUGAS(warna, rows) {
  return TBL([1900, 2400, 5339], [
    new TableRow({ children:[
      cell('KAPAN', {w:1900,b:true,s:19,c:'FFFFFF',fill:warna,al:AlignmentType.CENTER}),
      cell('DITULIS DI MANA', {w:2400,b:true,s:19,c:'FFFFFF',fill:warna,al:AlignmentType.CENTER}),
      cell('APA YANG KAMU KERJAKAN', {w:5339,b:true,s:19,c:'FFFFFF',fill:warna,al:AlignmentType.CENTER}),
    ]}),
    ...rows.map(([a,b,d]) => new TableRow({ children:[
      cell(a, {w:1900,b:true,s:18,c:warna,al:AlignmentType.CENTER}),
      cell(b, {w:2400,b:true,s:18,al:AlignmentType.CENTER, fill: b.includes('BUKU')?'FFF6E0':'E8F0FA'}),
      cell(d, {w:5339,s:18}),
    ]})),
  ], { border: warna });
}

// COVER
p(T('PAPAN INSTRUKSI MURID', { b:true, s:44, c:NAVY, al:AlignmentType.CENTER, sa:20 }));
p(T('SAKOLA WALUYA  ·  Kelas XI  ·  15–21 Juli 2026', { b:true, s:24, c:BLUE, al:AlignmentType.CENTER, sa:20 }));
p(T('Ditayangkan / ditempel guru setiap hari. Murid TIDAK menerima lembar kerja cetak.', { i:true, s:20, c:'595959', al:AlignmentType.CENTER, sa:160 }));

p(BOX('DUA TEMPAT MENULIS. JANGAN TERTUKAR.', [
  'BUKU TULIS  →  hanya DUA hal:',
  '     · JURNAL REFLEKSI harian (3 pertanyaan, setiap hari 11.45–12.00)',
  '     · KONTRAK KEBIASAAN WALUYA (Hari 5, ditandatangani orang tua di buku)',
  '',
  'GOOGLE SHEET TIM  →  SEMUA yang lain:',
  '     radar kebiasaan · data lapangan · grafik · pohon akar masalah · kutipan wawancara ·',
  '     peta empati · matriks prioritas · ide & rancangan · daftar bahan · silih asah · foto before-after',
  '',
  'SATU SHEET UNTUK SATU TIM. Tautannya dari wali kelas. Semua anggota bisa mengisi bersamaan dari HP.',
], 'FFF6E0', GOLD));

p(SP());
p(BOX('SEMUA MURID PUNYA PERAN. TIDAK ADA PENONTON.', [
  'KAPTEN TIM (6)  ·  TIM WAKTU (2)  ·  TIM PIKET DATA (2)  ·  TIM K3 (2)  ·  TIM DOKUMENTASI (2)  ·  TIM LOGISTIK (2)',
  '',
  'Wali kelas kita SENDIRIAN minggu ini. Tidak ada guru lain yang masuk. Sebagian tugas guru sekarang jadi tugas kita — itu bukan hukuman, itu KEPERCAYAAN.',
], 'E8F5E9', GRN));

p(SP());
p(BOX('PAPAN KARTU — cara kita keluar kelas', [
  'Di dinding ada 6 SLOT + 6 KARTU TIM (warna berbeda) (satu per tim).',
  '',
  'MAU BERANGKAT   →   ambil kartu timmu, PAKAI.',
  'SUDAH PULANG    →   KEMBALIKAN kartu ke SLOT timnya.',
  '',
  'Slot kosong = tim itu masih di luar. Guru cukup melihat papan.',
  '',
  'EMPAT ATURAN JELAJAH:',
  '1.  Tidak ada murid sendirian. Minimal berdua.',
  '2.  Tidak boleh keluar gerbang sekolah.',
  '3.  Hanya di SEKTOR kelas kita. Dilarang masuk ruang KBM, ruang guru, bengkel, dan area MPLS kelas X.',
  '4.  Pulang tepat waktu. Kembalikan kartunya ke papan.',
], 'FDE8EF', ROSE));

p(PB());

// HARI 1
p(HARI(1, 'RABU, 15 JULI 2026', 'CAGEUR', 'KENALI DIRI', GRN));
p(SP());
p(TUGAS(GRN, [
  ['07.45–09.15', 'GOOGLE SHEET\n(H1 · RADAR)', 'Isi SKOR DIRIMU 1–10 untuk tiap kebiasaan (7 KAIH). Jujur. Grafik radar muncul otomatis. Lalu bandingkan dengan skor sekolah.'],
  ['', 'Papan tulis', 'Bantu hitung RATA-RATA KELAS. Kelas kita di atas atau di bawah skor sekolah? Kenapa?'],
  ['09.30–11.00', 'HP → Google Form', 'Isi "SUARA WALUYA" (ANONIM). Ada kotak "Saya ingin bicara dengan Guru BK" — hanya Guru BK yang melihatnya, bukan wali kelasmu.'],
  ['', 'Papan tulis', 'Maju ke papan. Kelompokkan jawaban yang mirip, beri judul, HITUNG jumlahnya. Lalu voting kaki: berdiri di depan kategori yang paling mendesak.'],
  ['11.00–11.45', 'GOOGLE SHEET\n(0 · IDENTITAS)', 'Isi identitas tim: kelas, nama tim, zona, sektor, gelombang, anggota, DAN PERAN masing-masing.'],
  ['', 'Kertas plano', 'Tulis 5 NORMA TIM kelas kita. Semua menandatangani. Tempel di dinding.'],
  ['11.45–12.00', 'BUKU TULIS', 'JURNAL HARI 1 — tulis tangan:\n1. Satu hal yang paling mengejutkanku hari ini.\n2. Satu hal tentang diriku yang baru kusadari.\n3. Perasaanku hari ini, dan kenapa.'],
]));

p(PB());

// HARI 2
p(HARI(2, 'KAMIS, 16 JULI 2026', 'BENER', 'CARI FAKTA', GOLD));
p(SP());
p(BOX('ATURAN HARI INI', ['Setiap kalimat yang kamu tulis HARUS punya BUKTI: angka, foto, atau kutipan. Tidak ada buktinya? CORET. Itulah arti BENER.'], 'FFF6E0', GOLD));
p(SP());
p(TUGAS(GOLD, [
  ['SESI LAPANGAN\n(sesuai gelombang)', 'Lapangan\n(sektor kita)', 'AMBIL KARTU dari papan. Turun ke SEKTOR KITA saja. Wajib pulang membawa: 10 baris data ANGKA · 5 foto · 1 hal yang mengejutkan. KEMBALIKAN KARTU saat pulang.'],
  ['', 'GOOGLE SHEET\n(H2 · DATA LAPANGAN)', 'Ketik semua data apa adanya. Belum dianalisis. Jangan lupa isi kolom satuan & nama file foto.'],
  ['SESI KELAS\n(sesuai gelombang)', 'GOOGLE SHEET\n(H2 · DATA LAPANGAN)', 'Kalau SUDAH lapangan: hitung TOTAL, RATA-RATA, PERSENTASE. Buat GRAFIK dari data kalian.\nKalau BELUM lapangan: pelajari peta sektor, susun cara mengukur, olah data dari Sarpras/MBG, susun dugaan awal.'],
  ['11.00–11.45', 'GOOGLE SHEET\n(H2 · POHON AKAR)', 'POHON AKAR MASALAH. BUAH = akibat terlihat. BATANG = masalahnya. AKAR = penyebab SEBENARNYA. Pakai 5x KENAPA sampai ketemu akar yang BISA DIKERJAKAN — bukan yang cuma menyalahkan orang.'],
  ['', '', 'Lalu tulis: "Masalah sebenarnya adalah ___, karena ___, dibuktikan dengan data ___."'],
  ['11.45–12.00', 'BUKU TULIS', 'JURNAL HARI 2 — tulis tangan:\n1. Satu data yang membuatku berpikir ulang tentang sekolahku.\n2. Hari ini aku jujur, atau aku menghindar? Jelaskan.\n3. Apa yang paling sulit hari ini?'],
]));

p(PB());

// HARI 3
p(HARI(3, 'JUMAT, 17 JULI 2026', 'BAGEUR', 'RASAKAN & PILIH', ROSE));
p(SP());
p(BOX('ETIKA NGAJUGJUG — hafalkan sebelum berangkat', [
  'Narasumber TIDAK dikumpulkan. Pak Caraka, satpam, ibu kantin TETAP BEKERJA. KAMU yang MENGHAMPIRI mereka.',
  '',
  '1.  Beri salam, minta izin: "Bapak/Ibu, boleh minta waktu 10 menit? Kalau sedang sibuk, kami bisa kembali nanti."',
  '2.  MAKSIMAL 10 MENIT. Lewat itu — PAMIT. Beliau sedang bekerja.',
  '3.  Mau merekam? TANYA DULU.',
  '4.  BELIAU MENOLAK atau SIBUK?  →  JANGAN DIPAKSA. Kembali ke kelas, lapor. Menerima penolakan dengan sopan juga BAGEUR.',
  '5.  TIDAK KETEMU orangnya?  →  Cari maksimal 5 menit, lalu KEMBALI. Jangan berkeliaran.',
  '6.  Sebelum pamit: "Hari Selasa kami akan tunjukkan hasilnya ke Bapak/Ibu." — DAN TEPATI.',
  '',
  'Yang menghampiri narasumber kunci HANYA 3 ORANG: Kapten + pencatat + dokumentasi.',
], 'FDE8EF', ROSE));
p(SP());
p(TUGAS(ROSE, [
  ['SESI LAPANGAN\n(sesuai gelombang)', 'Lapangan\n(sektor kita)', 'Wawancarai minimal 3 orang. Pulang membawa 3 KUTIPAN LANGSUNG — kalimat PERSIS mereka, dalam tanda kutip.'],
  ['', 'GOOGLE SHEET\n(H3 · WAWANCARA)', 'Ketik kutipannya PERSIS. Jangan diringkas jadi kalimatmu sendiri.'],
  ['SESI KELAS\n(sesuai gelombang)', 'GOOGLE SHEET\n(H3 · PETA EMPATI)', 'Pilih SATU narasumber utama. Isi 4 kuadran: APA YANG DIA KATAKAN · DIA LAKUKAN · DIA PIKIRKAN · DIA RASAKAN.'],
  ['', 'GOOGLE SHEET\n(H3 · MATRIKS)', 'Petakan semua masalah: DAMPAK × BISA KAMI KERJAKAN. Lalu VOTING KAKI (3 stiker per murid). Tulis hasilnya: MASALAH KAMI / ORANG YANG KAMI BANTU / TARGET SELASA.'],
  ['10.45–11.00', 'Kertas', 'JUMAT BERKAH: tulis UCAPAN TERIMA KASIH untuk narasumbermu, lalu SERAHKAN langsung ke beliau.'],
  ['', 'BUKU TULIS', 'JURNAL HARI 3 — tulis tangan:\n1. Hari ini aku mendengar sesuatu yang tak pernah kupikirkan, yaitu...\n2. Siapa orang di sekolah ini yang selama ini tak pernah kuperhatikan, tapi ternyata penting?\n3. Apa yang paling sulit hari ini?'],
]));

p(PB());

// HARI 4
p(HARI(4, 'SENIN, 20 JULI 2026', 'PINTER', 'RANCANG & BUAT', NAVY));
p(SP());
p(BOX('JELEK DULUAN, BAGUS BELAKANGAN.', [
  'Jangan habiskan waktu menggambar rancangan indah. Buat SESUATU yang bisa DISENTUH hari ini — walaupun jelek.',
  '',
  'SEMUA DIKERJAKAN DI KELAS INI. Kita TIDAK masuk bengkel — wali kelas kita sendirian, tidak ada toolman.',
  '',
  'BOLEH:  gunting · cutter · gergaji tangan kecil · obeng · tang · palu kecil · amplas · lem · double tape · cable ties · kardus · pipa PVC · kayu ringan · botol bekas · laptop & HP.',
  '',
  'DILARANG MUTLAK:  mesin bubut/frais/gerinda · las · bor listrik · menyolder · listrik 220V · NaOH & asam kuat · api & pemanasan · naik ketinggian lebih dari 1 meter.',
  '',
  'Karyamu butuh mesin?  →  Buat PURWARUPA 1:1 dari kardus/PVC + GAMBAR KERJA LENGKAP. Hari Selasa kamu SERAHKAN RESMI ke Wakasek Sarpras untuk difabrikasi. Itu TETAP dihitung sebagai AKSI NYATA.',
], 'FDE8EF', ROSE));
p(SP());
p(TUGAS(NAVY, [
  ['07.45–09.15', 'GOOGLE SHEET\n(H4 · IDE & RANCANGAN)', 'BADAI IDE 6-3-5: tulis 3 ide dalam 5 menit, lalu geser lembar ke kanan. Teman MENGEMBANGKAN idemu, bukan mengkritik. 3 putaran.'],
  ['', '', 'Pilih 1 ide yang lolos 4 SYARAT: pakai kompetensi jurusan · bisa tanpa mesin · selesai 2 hari · benar-benar menolong orang yang kami wawancarai. Tidak lolos? BUANG.'],
  ['', '', 'RANCANGAN TEKNIS sesuai jurusan. Boleh FOTO sketsa tanganmu lalu tempel di Sheet. Lalu tulis DAFTAR BAHAN — dan AMBIL SENDIRI dari kotak kelas.'],
  ['09.30–11.00', 'Meja kelas', 'PRODUKSI PURWARUPA v1. TIM K3 memeriksa alat & APD lebih dulu. Kalau TIM K3 bilang berhenti — SEMUA BERHENTI, termasuk guru.'],
  ['', '', 'Selesai: TIM LOGISTIK memimpin pembersihan. TIM K3 MENGHITUNG ULANG alat (jangan sampai ada cutter hilang).'],
  ['11.00–11.45', 'GOOGLE SHEET\n(H4 · SILIH ASAH)', 'Nilai 3 tim lain: "Yang SUDAH JALAN ___ · Yang BELUM JALAN ___ · Satu SARAN ___". DILARANG menulis "bagus" tanpa alasan. Kritik idenya, jangan orangnya.'],
  ['11.45–12.00', 'BUKU TULIS', 'JURNAL HARI 4 — tulis tangan:\n1. Apa yang paling SULIT hari ini?\n2. SIAPA yang menolongku melewatinya? Apa yang dia lakukan?\n3. Aku jadi orang yang menolong, atau yang ditolong? Jujur.'],
]));

p(PB());

// HARI 5
p(HARI(5, 'SELASA, 21 JULI 2026', 'SINGER', 'BERTINDAK & BERBAGI', ORG));
p(SP());
p(BOX('HARI INI SESUATU HARUS BENAR-BENAR BERUBAH DI SEKOLAH INI.', [
  'Bukan dipamerkan. BERUBAH.',
  'Kalau hari ini tidak ada satu pun hal yang berbeda di SMKN 2 Cimahi, berarti lima hari kita gagal.',
], 'FCE4D6', ORG));
p(SP());
p(TUGAS(ORG, [
  ['SESI AKSI\n(sesuai gelombang)', 'Titik sasaran', 'FOTO "BEFORE" DULU — wajib. Lalu pasang / jalankan / uji karyamu. TANPA BOR: cable ties · double tape · gantungan tempel · tali · benda berdiri bebas.'],
  ['', '', 'FOTO "AFTER" dari SUDUT YANG SAMA. Lalu TEMUI NARASUMBERMU, tunjukkan hasilnya, minta 1 kalimat tanggapan.'],
  ['', 'GOOGLE SHEET\n(H5 · AKSI)', 'Isi bukti aksi: lokasi · apa yang dipasang · berapa orang terbantu (angka!) · nama file foto before & after · kata mitra.'],
  ['09.30–10.45', 'Lorong depan kelas', 'GELAR KARYA LORONG. Pajang: karya · grafik data · foto BEFORE–AFTER · kutipan narasumber · peta empati.'],
  ['', '', 'PRESENTASI 60 DETIK: "Kami MENEMUKAN [angka]. Kami MENDENGAR [kutipan]. Kami MEMBUAT [karya]. Sekarang [perubahan]." MURID yang bicara, bukan guru.'],
  ['11.00–11.45', 'GOOGLE SHEET\n(H5 · RADAR ULANG)', 'Isi ULANG radar kebiasaanmu. Bandingkan dengan Hari 1. Apa yang berubah? Apa yang TIDAK berubah? Kenapa?'],
  ['', 'BUKU TULIS', 'KONTRAK KEBIASAAN WALUYA — tulis tangan:\nSatu kebiasaan (7 KAIH) yang akan kujalankan sampai akhir semester · KAPAN tepatnya (jam berapa) · BAGAIMANA mengukurnya · SIAPA yang mengingatkan · apa yang mungkin MENGGAGALKANKU.\nTanda tangani. Bawa pulang untuk ditandatangani ORANG TUA. Kembalikan paling lambat Jumat 24 Juli.'],
  ['11.45–12.00', 'BUKU TULIS', 'JURNAL PENUTUP — tulis tangan:\n1. Apa yang KAMI ubah di sekolah ini minggu ini?\n2. Apa yang berubah DI DALAM DIRIKU?\n3. Kalau bisa bicara pada diriku di hari Rabu lalu, aku akan bilang: ...'],
]));
p(SP());
p(BOX('MULAI DARI YANG KECIL', [
  'Kontrak yang KECIL dan BERHASIL jauh lebih baik daripada kontrak BESAR yang GAGAL.',
  'Jangan tulis "tidur jam 9 setiap hari mulai besok". Tulis "tidur 30 menit lebih awal dari biasanya".',
  'Kalau berhasil — baru naikkan.',
], 'E8F5E9', GRN));

const doc = new Document({
  styles: { default: { document: { run: { font: 'Calibri', size: 20 } } } },
  sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 680, right: 680, bottom: 620, left: 680 } } }, children: c }],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync(process.argv[2], b); console.log('WROTE', process.argv[2]); });
