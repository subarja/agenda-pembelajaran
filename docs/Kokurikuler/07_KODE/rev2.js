// BAB Manajemen 16 Kelas Paralel
const L = require('./lib.js');
const { P, H1, H2, H3, TBL, BOX, SPACER, PB, NAVY, BLUE, GOLD, ROSE, LIGHT } = L;

function babParalel() {
  const c = [];
  const push = (...x) => x.forEach(i => Array.isArray(i) ? c.push(...i) : c.push(i));

  push(H1('BAB III-B — MANAJEMEN 16 KELAS PARALEL'));
  push(BOX('SKALA YANG SEBENARNYA', [
    'Kelas XI SMKN 2 Cimahi berjumlah 16 rombel. Artinya: ±576 murid dan 96 tim.',
    '',
    'Tanpa pengaturan, seluruh 96 tim akan turun lapangan serentak, berebut mengukur toilet dan wastafel yang jumlahnya tetap, dan menyerbu Pak Caraka yang hanya beberapa orang. Kegiatan akan berubah menjadi kekacauan, dan mitra sekolah akan menolak dilibatkan lagi tahun depan.',
    '',
    'Dua lapis pengaman dipakai: SEKTOR EKSKLUSIF dan SISTEM GELOMBANG.',
  ], ROSE, 'AD1457'));

  push(SPACER());
  push(H2('A. Lapis 1 — SEKTOR EKSKLUSIF'));
  push(P('Setiap kelas mendapat SATU sektor: sekumpulan objek data yang HANYA boleh diukur dan dijelajahi oleh kelas itu. Tidak ada dua kelas yang mengukur benda yang sama.', { spaceAfter: 60 }));
  push(TBL([2400, 7238], null, [
    ['Prinsip', 'Sektor bersifat EKSKLUSIF. Tim dilarang keras mengukur atau menjelajah objek di sektor kelas lain.'],
    ['Kalau butuh data sektor lain?', 'MINTA kepada kelas yang memegang sektor itu. Ini gotong royong nyata — dan menjawab langsung A.3.2 Gotong Royong (54,70, TURUN 3,09).'],
    ['Contoh Zona Z1 (4 kelas)', 'XI MEKATRONIKA-A → toilet & wastafel Blok A. XI KIMIA-A → Blok B. XI KIMIA-B → Blok C + sumber air/tandon. XI PEMESINAN-A → Blok D + saluran air.'],
    ['Kartu Sektor', 'Setiap kelas menerima KARTU SEKTOR (A4) berisi: peta wilayahnya, daftar objek eksklusifnya, batas wilayah, dan daftar apa yang TIDAK BOLEH disentuh.'],
    ['PR Koordinator', 'Penanda "Gedung/Blok A–D" dalam matriks masih SEMENTARA. Koordinator WAJIB memetakannya ke denah nyata SMKN 2 Cimahi paling lambat H-5, lalu mencetak Kartu Sektor.'],
  ], { headFill: NAVY, zebra: true, size: 19 }));

  push(SPACER());
  push(H2('B. Lapis 2 — SISTEM GELOMBANG'));
  push(P('16 kelas dibagi dua gelombang. Saat gelombang satu turun lapangan, gelombang lain bekerja di kelas. Lalu bertukar.', { spaceAfter: 60 }));
  push(TBL([2300, 3600, 3738], ['Gelombang', 'Kelas', 'Waktu Lapangan'], [
    ['BIRU (8 kelas)', 'XI MEKATRONIKA-A · XI MEKATRONIKA-B · XI MEKATRONIKA-D · XI DKV-A · XI ANIMASI-A · XI ANIMASI-B · XI KIMIA INDUSTRI-A · XI KIMIA INDUSTRI-C', 'Hari 2: 07.45–09.15\nHari 3: 08.00–09.00\nHari 5: 07.45–08.30'],
    ['JINGGA (8 kelas)', 'XI MEKATRONIKA-C · XI DKV-B · XI DKV-C · XI RPL-A · XI RPL-B · XI KIMIA INDUSTRI-B · XI TEKNIK PEMESINAN-A · XI TEKNIK PEMESINAN-B', 'Hari 2: 09.30–11.00\nHari 3: 09.15–10.15\nHari 5: 08.30–09.15'],
  ], { size: 19 }));
  push(P('Hasilnya: maksimal 8 kelas (48 tim) di lapangan pada satu waktu — bukan 16 kelas (96 tim). Dan karena setiap kelas punya sektor eksklusif, 48 tim itu tersebar di 8 wilayah berbeda.', { bold: true, spaceBefore: 60 }));
  push(BOX('Blok "di kelas" BUKAN waktu kosong', [
    'Gelombang yang sedang tidak di lapangan mengerjakan pekerjaan nyata:',
    'HARI 2 — mempelajari denah sektor · menyusun instrumen ukur · MENGOLAH DATA SEKUNDER dari Wakasek Sarpras & PJ MBG (ini latihan numerasi yang sungguhan) · menyusun hipotesis yang akan diuji di lapangan.',
    'HARI 3 — menyusun daftar pertanyaan wawancara · Peta Empati awal · menyelesaikan olahan data yang tertunda.',
    'HARI 5 — menyiapkan stan Gelar Karya Lorong · finalisasi karya · latihan presentasi 60 detik.',
  ], 'E8F5E9', '2E7D32'));

  push(PB());
  push(H2('C. NGAJUGJUG — Menghampiri Narasumber (Hari 3)'));
  push(BOX('NARASUMBER TIDAK DIKUMPULKAN.', [
    'Pak Caraka, satpam, ibu kantin, dan petugas MBG TETAP BEKERJA SEPERTI BIASA di tempatnya. Tidak ada panel, tidak ada podium, tidak ada acara.',
    '',
    'MURID yang MENGHAMPIRI mereka — di tempat kerjanya, di tengah pekerjaannya. Itu justru intinya: murid melihat langsung bagaimana orang itu bekerja, bukan mendengarnya bercerita di atas panggung.',
    '',
    'Tapi tanpa jadwal, 96 tim akan menyerbu 8 orang. Karena itu: KUOTA KERAS.',
  ], GOLD, 'BF8F00'));

  push(SPACER());
  push(TBL([2300, 7338], null, [
    ['Siapa yang menghampiri', 'HANYA DELEGASI KELAS: 3 murid (1 Kapten Tim + 1 pencatat + 1 dokumentasi). BUKAN seluruh tim, BUKAN seluruh kelas. Hasilnya dibagikan ke seluruh kelas setelah kembali.'],
    ['Berapa lama', 'MAKSIMAL 10 MENIT. Tim Waktu kelas yang mengingatkan. Lewat 10 menit = pamit, apa pun kondisinya.'],
    ['Berapa beban narasumber', '8 narasumber, masing-masing didatangi 2 kelas (1 Gelombang Biru + 1 Gelombang Jingga). Total beban tiap narasumber: 2 x 10 menit = 20 MENIT SEHARI. Itu manusiawi.'],
    ['Kalau narasumber sibuk / menolak', 'JANGAN DIPAKSA. Catat "tidak tersedia", kembali ke POS, lapor ke wali kelas. Wali kelas menghubungi Koordinator untuk penjadwalan ulang atau narasumber cadangan. Belajar menerima penolakan dengan sopan juga BAGEUR.'],
    ['Kalau narasumber tidak ditemukan', 'Cari maksimal 5 menit, lalu KEMBALI KE POS. JANGAN berkeliaran mencari. Lapor.'],
    ['Tim yang tidak kebagian', 'Tetap mewawancarai warga sekolah "biasa" di SEKTORNYA: murid kelas X (hanya saat istirahat MPLS!), murid kelas lain, guru piket, petugas lain. Tidak perlu jadwal khusus.'],
    ['KEWAJIBAN H-1', 'KOORDINATOR MENEMUI SETIAP NARASUMBER pada Kamis 16 Juli. Memberi tahu mereka akan didatangi 2 kelas (10 menit masing-masing) pada Jumat, jam berapa. MENEMPELKAN KARTU JADWAL kecil di tempat kerjanya. TANPA INI, narasumber akan merasa diserbu dan menolak — dan kegiatan ini kehilangan jantungnya.'],
  ], { headFill: NAVY, zebra: true, size: 19 }));

  push(SPACER());
  push(H3('Etika Ngajugjug — dibacakan guru sebelum murid berangkat'));
  push(TBL([700, 8938], null, [
    ['1', 'HAMPIRI, beri salam, TUNJUKKAN Kartu Temu.'],
    ['2', 'MINTA IZIN: "Bapak/Ibu, boleh minta waktu 10 menit? Kalau sedang sibuk, kami bisa kembali nanti."'],
    ['3', 'JANGAN merekam tanpa izin lisan. Tanyakan dulu: "Boleh kami rekam suaranya, Pak/Bu?"'],
    ['4', 'TANYA – DENGAR – JANGAN MEMOTONG – TANYA LAGI "kenapa".'],
    ['5', 'Pulang membawa minimal 3 KUTIPAN LANGSUNG (kalimat PERSIS narasumber, dalam tanda kutip) + nama & perannya.'],
    ['6', 'SEBELUM PAMIT: ucapkan terima kasih, dan katakan: "Hari Selasa kami akan tunjukkan hasilnya ke Bapak/Ibu." — LALU TEPATI di Gelar Karya. Undang mereka.'],
  ], { headFill: 'AD1457', zebra: true, size: 19 }));

  push(PB());
  push(H2('D. Pengawasan Lapangan — MARSHAL WALUYA'));
  push(P('Koordinator seorang diri tidak mungkin mengawasi 48 tim yang tersebar. Karena tidak ada guru tambahan, pengawasan titik simpul diserahkan kepada MURID OSIS/MPK yang diberi rompi/pita lengan: MARSHAL WALUYA.', { spaceAfter: 60 }));
  push(TBL([2900, 2900, 3838], ['Titik Simpul', 'Penjaga', 'Tugas'], [
    ['Tangga utama (tiap lantai)', 'Marshal Waluya (OSIS) — 4–6 orang', 'Mengarahkan arus naik/turun. Memastikan tidak ada murid sendirian. Mencatat tim yang terlihat keluar dari sektornya.'],
    ['Koridor penghubung antargedung', 'Marshal Waluya — 2–4 orang', 'Titik lapor cepat. Memegang daftar sektor 16 kelas — kalau ada tim di sektor yang salah, ingatkan & catat.'],
    ['Depan area MPLS kelas X (ZONA MERAH)', 'Marshal Waluya + panitia MPLS — 2 orang', 'MENAHAN tim XI yang mencoba masuk. Kelas XI hanya boleh masuk pada slot wawancara adik kelas X yang sudah dikoordinasikan.'],
    ['Gerbang & area parkir', 'SATPAM SEKOLAH — 2–3 orang', 'Memastikan TIDAK ADA MURID KELUAR GERBANG. Ini garis merah mutlak.'],
    ['Kantin & titik distribusi MBG', 'Marshal Waluya — 2 orang', 'Mengatur antrean tim yang mengambil data. Hanya kelas ber-sektor kantin/MBG yang boleh mengukur di sini.'],
    ['Keliling seluruh sekolah', 'KOORDINATOR + WAKASEK KESISWAAN', 'Pengawas umum. Menerima laporan marshal. Menangani tim tersesat/telat. Tempat bertanya wali kelas yang kewalahan.'],
    ['POS UKS', 'Petugas UKS', 'Siaga menerima murid cedera. Kotak P3K juga tersedia di tiap POS kelas.'],
  ], { size: 18 }));

  push(SPACER());
  push(H3('ZONA MERAH — tidak boleh dimasuki tim kelas XI'));
  push(TBL([700, 8938], null, [
    ['1', 'AREA MPLS KELAS X — kecuali pada slot wawancara yang sudah dikoordinasikan dengan panitia MPLS, maksimal 2 kelas XI per slot, HANYA saat jam istirahat MPLS. (Kelas X justru narasumber berharga — mereka "mata baru" yang melihat sekolah apa adanya. Tapi jangan sampai MPLS mereka terganggu.)'],
    ['2', 'Ruang yang sedang dipakai KBM, ruang guru, ruang kepala sekolah, ruang TU (kecuali slot ngajugjug ke petugas TU).'],
    ['3', 'BENGKEL & LABORATORIUM PRAKTIK — semua, tanpa kecuali. Tidak ada toolman yang mendampingi.'],
    ['4', 'DI LUAR GERBANG SEKOLAH — garis merah mutlak.'],
    ['5', 'Atap, tangga darurat, ruang panel listrik, bagian atas tandon air — semua yang menuntut naik ketinggian lebih dari 1 meter.'],
  ], { headFill: 'C00000', zebra: true, size: 19 }));

  push(SPACER());
  push(H2('E. GELAR KARYA LORONG (Hari 5)'));
  push(P('16 stan tidak muat di aula, dan memindahkan karya 16 kelas ke aula memakan waktu yang tidak ada. Karena itu: GELAR KARYA LORONG.', { spaceAfter: 60 }));
  push(TBL([2000, 7638], null, [
    ['Tempat', 'Setiap kelas memajang karyanya DI DEPAN RUANG KELASNYA SENDIRI. Tidak ada pemindahan barang, tidak ada bongkar-pasang.'],
    ['Ronde 1 (09.45–10.15)', 'GELOMBANG BIRU = TUAN RUMAH (menjaga stan, presentasi 60 detik ke setiap pengunjung). GELOMBANG JINGGA = BERKUNJUNG, mengikuti rute searah yang sudah ditempel di lorong.'],
    ['Ronde 2 (10.15–10.45)', 'BERTUKAR. Jingga tuan rumah, Biru berkunjung.'],
    ['Penilai', 'Wali kelas menilai timnya sendiri saat presentasi. 6 Kaprog berkeliling menilai kelas jurusannya (Mekatronika 4, DKV 3, Kimia 3, RPL 2, Animasi 2, Pemesinan 2). Kepala Sekolah, Wakasek, Komite, OSIS berkeliling.'],
    ['MITRA WAJIB DIUNDANG', 'Caraka, Satpam, Ibu/Bapak Kantin, PJ MBG. Murid sudah menjanjikan ini pada Hari 3 — tepati. Ini yang membuat mitra bersedia dilibatkan lagi tahun depan.'],
    ['Penutup (10.45–11.00)', 'PENYERAHAN RESMI gambar kerja & surat permohonan pemasangan kepada Wakasek Sarpras / Kaprog, di depan pengunjung. Lalu apresiasi (bukan juara).'],
  ], { headFill: NAVY, zebra: true, size: 19 }));

  push(SPACER());
  push(BOX('DOKUMEN PENDAMPING WAJIB', [
    'Seluruh pembagian 16 kelas — gelombang, zona, sektor, narasumber, slot ngajugjug, jadwal harian per gelombang, marshal, dan ceklis koordinator — tertuang dalam berkas terpisah:',
    '',
    '04_MATRIKS_OPERASIONAL_16_KELAS.xlsx  (7 lembar kerja)',
    '',
    'Itulah dokumen yang dipegang Koordinator selama lima hari.',
  ], LIGHT, '2E74B5'));

  push(PB());
  return c;
}
module.exports = { babParalel };
