// Membangun empat berkas paparan PowerPoint, satu untuk tiap jenjang pengguna.
//   node build-pptx.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PptxGenJS from 'pptxgenjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const IMG = path.join(ROOT, 'gambar')
const OUT_DIR = path.join(ROOT, 'keluaran')

const NAVY = '1E3A5F'
const BLUE = '2563EB'
const GREY = '5B6B7B'
const LIGHT = 'F4F6F8'
const WHITE = 'FFFFFF'

/** Baca lebar & tinggi PNG dari header IHDR. */
function pngSize(file) {
  const b = fs.readFileSync(file)
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
}

/** Muat gambar agar muat dalam kotak (boxW × boxH) inci, tetap menjaga rasio, lalu pusatkan. */
function fitImage(slide, rel, boxX, boxY, boxW, boxH) {
  const file = path.join(IMG, rel)
  if (!fs.existsSync(file)) {
    slide.addText(`[gambar hilang: ${rel}]`, { x: boxX, y: boxY, w: boxW, h: 0.4, fontSize: 11, color: 'CC0000' })
    return
  }
  const { w, h } = pngSize(file)
  const scale = Math.min(boxW / w, boxH / h)
  const dw = w * scale, dh = h * scale
  slide.addImage({
    path: file,
    x: boxX + (boxW - dw) / 2,
    y: boxY + (boxH - dh) / 2,
    w: dw, h: dh,
  })
}

// ── Kerangka slide ───────────────────────────────────────────────────────────

function titleSlide(pptx, deck) {
  const s = pptx.addSlide()
  s.background = { color: NAVY }
  s.addText('SMK NEGERI 2 CIMAHI', { x: 0.8, y: 1.5, w: 11.7, h: 0.4, fontSize: 14, color: '93B4D6', bold: true, charSpacing: 2 })
  s.addText(deck.title, { x: 0.8, y: 2.0, w: 11.7, h: 1.5, fontSize: 40, color: WHITE, bold: true })
  s.addText(deck.subtitle, { x: 0.8, y: 3.6, w: 11.7, h: 0.9, fontSize: 17, color: 'C7D8EA' })
  s.addShape(pptx.ShapeType.rect, { x: 0.8, y: 4.7, w: 1.6, h: 0.06, fill: { color: BLUE } })
  s.addText('Aplikasi Agenda Pembelajaran Kelas', { x: 0.8, y: 5.1, w: 11.7, h: 0.4, fontSize: 13, color: '93B4D6' })
  s.addText('Bahan Paparan · Versi 1.0', { x: 0.8, y: 6.4, w: 11.7, h: 0.3, fontSize: 11, color: '6E90B4' })
}

function sectionSlide(pptx, text, sub) {
  const s = pptx.addSlide()
  s.background = { color: LIGHT }
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.28, h: 7.5, fill: { color: NAVY } })
  s.addText(text, { x: 1.0, y: 2.9, w: 11.4, h: 1.0, fontSize: 32, color: NAVY, bold: true })
  if (sub) s.addText(sub, { x: 1.0, y: 3.9, w: 11.4, h: 0.6, fontSize: 15, color: GREY })
}

/** Slide isi: judul, poin-poin di kiri, tangkapan layar di kanan. */
function contentSlide(pptx, { title, bullets, image, note }) {
  const s = pptx.addSlide()
  s.addText(title, { x: 0.55, y: 0.35, w: 12.2, h: 0.6, fontSize: 24, color: NAVY, bold: true })
  s.addShape(pptx.ShapeType.rect, { x: 0.55, y: 1.0, w: 1.1, h: 0.045, fill: { color: BLUE } })

  const hasImg = Boolean(image)
  const textW = hasImg ? 5.1 : 12.2

  s.addText(
    bullets.map((b) => ({
      text: typeof b === 'string' ? b : b.text,
      options: {
        bullet: { code: '2022' },
        fontSize: typeof b === 'string' ? 14 : (b.small ? 12 : 14),
        color: typeof b === 'string' ? '2B3A4A' : (b.dim ? GREY : '2B3A4A'),
        bold: typeof b !== 'string' && b.bold,
        paraSpaceAfter: 8,
      },
    })),
    { x: 0.6, y: 1.35, w: textW, h: 4.9, valign: 'top' },
  )

  if (hasImg) fitImage(s, image, 6.1, 1.3, 6.7, 5.0)
  if (note) {
    s.addShape(pptx.ShapeType.rect, { x: 0.55, y: 6.45, w: 12.2, h: 0.62, fill: { color: 'FFF7E6' }, line: { color: 'F0C36D', width: 1 } })
    s.addText(note, { x: 0.75, y: 6.5, w: 11.8, h: 0.5, fontSize: 11.5, color: '7A5B15', italic: true, valign: 'middle' })
  }
}

/** Slide layar penuh untuk satu tangkapan layar besar. */
function screenshotSlide(pptx, { title, image, caption }) {
  const s = pptx.addSlide()
  s.addText(title, { x: 0.55, y: 0.3, w: 12.2, h: 0.5, fontSize: 20, color: NAVY, bold: true })
  fitImage(s, image, 0.8, 1.0, 11.7, 5.4)
  if (caption) s.addText(caption, { x: 0.55, y: 6.6, w: 12.2, h: 0.4, fontSize: 11.5, color: GREY, italic: true, align: 'center' })
}

/** Slide tabel sederhana. */
function tableSlide(pptx, { title, header, rows, note }) {
  const s = pptx.addSlide()
  s.addText(title, { x: 0.55, y: 0.35, w: 12.2, h: 0.6, fontSize: 24, color: NAVY, bold: true })
  s.addShape(pptx.ShapeType.rect, { x: 0.55, y: 1.0, w: 1.1, h: 0.045, fill: { color: BLUE } })
  s.addTable(
    [
      header.map((h) => ({ text: h, options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 13 } })),
      ...rows.map((r) => r.map((c) => ({ text: c, options: { fontSize: 12.5, color: '2B3A4A' } }))),
    ],
    { x: 0.6, y: 1.4, w: 12.1, border: { pt: 0.5, color: 'C7D0DA' }, rowH: 0.42, valign: 'middle', margin: 6 },
  )
  if (note) s.addText(note, { x: 0.6, y: 6.6, w: 12.1, h: 0.4, fontSize: 11.5, color: GREY, italic: true })
}

function closingSlide(pptx, lines) {
  const s = pptx.addSlide()
  s.background = { color: NAVY }
  s.addText('Terima kasih', { x: 0.9, y: 2.3, w: 11.5, h: 0.9, fontSize: 36, color: WHITE, bold: true })
  s.addShape(pptx.ShapeType.rect, { x: 0.9, y: 3.3, w: 1.6, h: 0.06, fill: { color: BLUE } })
  s.addText(
    lines.map((l) => ({ text: l, options: { bullet: { code: '2022' }, fontSize: 14, color: 'C7D8EA', paraSpaceAfter: 8 } })),
    { x: 0.95, y: 3.7, w: 11.4, h: 2.2, valign: 'top' },
  )
  s.addText('Panduan lengkap: dokumen "Panduan Pengguna Agenda Pembelajaran"', { x: 0.9, y: 6.4, w: 11.5, h: 0.3, fontSize: 11, color: '6E90B4' })
}

const FILOSOFI = 'Setiap detik administratif yang dihemat dari guru adalah investasi untuk kualitas pembelajaran.'

// ── Definisi keempat dek ─────────────────────────────────────────────────────

const DECKS = {
  guru: {
    file: 'Paparan-Guru.pptx',
    title: 'Panduan Guru',
    subtitle: 'Agenda, Presensi, Karakter, dan Guru Inval',
    build(pptx) {
      titleSlide(pptx, this)
      contentSlide(pptx, {
        title: 'Mengapa Aplikasi Ini Ada',
        bullets: [
          { text: FILOSOFI, bold: true },
          'Agenda inti selesai ≤ 2 menit — tanpa upload foto, tanpa isian berulang.',
          'Absensi satu kelas ≤ 90 detik karena bawaannya sudah Hadir.',
          'Satu poin karakter ≤ 20 detik — pilih butir, bukan menulis narasi.',
          'Data yang Anda isi otomatis menjadi peringatan dini bagi wali kelas dan BK.',
        ],
        image: 'guru/dashboard.png',
      })
      sectionSlide(pptx, 'Memulai', 'Masuk, memilih semester, membaca dashboard')
      contentSlide(pptx, {
        title: 'Masuk ke Aplikasi',
        bullets: [
          'Identitas: alamat surel atau NIP.',
          'Pilih semester yang akan Anda kerjakan.',
          'Semester menentukan seluruh data yang Anda lihat sesudahnya.',
          'Lupa password? Gunakan tautan pada halaman masuk.',
        ],
        image: 'umum/login.png',
        note: 'Data terasa "hilang"? Periksa lebih dulu apakah Anda berada di semester yang benar.',
      })
      contentSlide(pptx, {
        title: 'Dashboard: Mulai dari yang Mendesak',
        bullets: [
          { text: 'Agenda Perlu Diisi', bold: true },
          'Termasuk jadwal minggu-minggu lalu yang belum diisi, bukan hanya hari ini.',
          'Lencana merah menandai sesi yang sudah lewat batas.',
          { text: 'Jadwal Minggu Ini', bold: true },
          'Seluruh jadwal mengajar dikelompokkan per hari.',
        ],
        image: 'guru/dashboard.png',
      })
      sectionSlide(pptx, 'Alur Kerja Harian', 'Tujuan Pembelajaran → Agenda → Presensi → Karakter')
      contentSlide(pptx, {
        title: '1. Tujuan Pembelajaran: Ketik Sekali, Pakai Berulang',
        bullets: [
          'Cakupan TP: Mata Pelajaran × Fase × Semester × Tahun Ajaran.',
          'Fase E untuk kelas X; Fase F untuk kelas XI dan XII.',
          'TP dibagikan antar guru serumpun — perubahan Anda dilihat rekan.',
          'Import Excel untuk memasukkan puluhan TP sekaligus.',
          'Setiap perubahan tercatat pada log dan dapat dikembalikan Admin.',
        ],
        image: 'guru/tujuan-pembelajaran.png',
      })
      contentSlide(pptx, {
        title: '2. Agenda: Presensi Sudah Menyatu di Dalamnya',
        bullets: [
          'Pilih sesi — daftar lain otomatis disembunyikan agar Anda fokus.',
          'Centang TP yang tercapai; tidak perlu mengetik ulang materi.',
          'Tulis resume KBM singkat.',
          'Ketuk nama siswa yang tidak hadir. Sisanya sudah Hadir.',
          'Satu kali Simpan menyelesaikan agenda dan presensi sekaligus.',
        ],
        image: 'guru/agenda-form.png',
        note: 'Batas waktu hanya berlaku saat MEMBUAT agenda baru. Menyunting agenda lama selalu boleh.',
      })
      screenshotSlide(pptx, {
        title: 'Detail Agenda',
        image: 'guru/agenda-detail.png',
        caption: 'TP yang dicentang, resume KBM, rekap presensi — semuanya dalam satu layar.',
      })
      contentSlide(pptx, {
        title: '3. Penilaian Karakter: Tiga Langkah',
        bullets: [
          { text: 'Langkah 1 — pilih kelas', bold: true },
          { text: 'Langkah 2 — ketuk kartu siswa (berfoto & bernomor absen)', bold: true },
          { text: 'Langkah 3 — pilih butir sub-karakter', bold: true },
          'Bobot sudah ditetapkan sekolah: apresiasi (+) atau pelanggaran (−).',
          'Seluruh guru yang mengajar adalah observer karakter, bukan hanya wali kelas.',
        ],
        image: 'guru/karakter-3-input-poin.png',
      })
      tableSlide(pptx, {
        title: 'Contoh Butir dan Bobot',
        header: ['Kategori', 'Butir', 'Bobot'],
        rows: [
          ['Kedisiplinan', 'Tepat waktu masuk kelas', '+5'],
          ['Kedisiplinan', 'Membawa / menggunakan HP tanpa izin', '−10'],
          ['Sopan Santun', 'Membantu teman yang kesulitan', '+5'],
          ['Sopan Santun', 'Berkata tidak sopan / kasar', '−10'],
          ['Keaktifan & Prestasi', 'Aktif berdiskusi / bertanya', '+5'],
          ['Keaktifan & Prestasi', 'Juara lomba tingkat kota/provinsi', '+25'],
        ],
        note: 'Daftar lengkap dikelola Admin. Poin bersih siswa memicu rekomendasi tindakan otomatis.',
      })
      tableSlide(pptx, {
        title: 'Karakter Manual vs Nilai Tambah',
        header: ['', 'Nilai Karakter Manual', 'Nilai Tambah'],
        rows: [
          ['Rentang poin', 'Mengikuti bobot disetujui Admin', '−20 sampai +20'],
          ['Perlu persetujuan Admin', 'Ya — poin belum dihitung', 'Tidak — langsung final'],
          ['Cocok untuk', 'Perilaku menonjol', 'Apresiasi/koreksi ringan harian'],
        ],
        note: 'Karena Nilai Tambah langsung final, rentangnya sengaja dibatasi.',
      })
      sectionSlide(pptx, 'Guru Inval', 'Mengalihkan kewajiban mengajar saat berhalangan')
      contentSlide(pptx, {
        title: 'Mengajukan Guru Pengganti',
        bullets: [
          'Centang 1 sampai 12 sesi sekaligus.',
          'Pilih guru pengganti dari daftar calon yang tidak bentrok jamnya.',
          'Isi alasan (wajib), pesan dan link tugas (opsional).',
          'Guru pengganti menerima notifikasi, lalu Setujui atau Tolak.',
        ],
        image: 'guru/inval.png',
        note: 'Hanya status DISETUJUI yang memindahkan kewajiban agenda. Pengajuan yang menggantung tidak memindahkan apa pun.',
      })
      sectionSlide(pptx, 'Laporan & Kalender', 'Mencetak, menandatangani, mengarsipkan')
      contentSlide(pptx, {
        title: 'Laporan',
        bullets: [
          'Rekap Agenda Saya — agenda yang telah diisi.',
          'Rekap Kehadiran Siswa — H / S / I / A per siswa.',
          'Rekap Karakter Siswa — akumulasi poin per kategori.',
          'Laporan Nilai Tambah.',
          'Semua tersedia dalam PDF (untuk ditandatangani) dan Excel (untuk diolah).',
        ],
        image: 'guru/laporan.png',
        note: 'Nama dan gelar pada tanda tangan diambil dari halaman Profil. Isi gelar Anda di sana.',
      })
      contentSlide(pptx, {
        title: 'Minggu Efektif',
        bullets: [
          'Hanya dihitung di dalam rentang tanggal semester aktif.',
          'Sabtu dan Minggu tidak pernah efektif.',
          'Satu minggu efektif bila memuat ≥ 3 hari efektif.',
          'Hari yang ditandai tidak efektif dikurangkan.',
          'PDF dibatasi 40 lembar; gunakan Excel untuk rekap massal.',
        ],
        image: 'guru/minggu-efektif.png',
      })
      closingSlide(pptx, [
        'Isi agenda pada hari yang sama — dashboard mengingatkan yang tertunda.',
        'Beri poin karakter sedikit tapi rutin, bukan menumpuk di akhir semester.',
        'Ajukan guru inval sebelum berhalangan, dan pastikan disetujui.',
        'Lengkapi gelar di halaman Profil agar tanda tangan laporan benar.',
      ])
    },
  },

  wali_kelas: {
    file: 'Paparan-Wali-Kelas.pptx',
    title: 'Panduan Wali Kelas',
    subtitle: 'Presensi Harian, EWS Siswa, Penanganan, dan Refleksi',
    build(pptx) {
      titleSlide(pptx, this)
      contentSlide(pptx, {
        title: 'Wali Kelas = Guru + Kapabilitas Tambahan',
        bullets: [
          'Wali Kelas bukan peran terpisah, melainkan kapabilitas di atas peran Guru.',
          'Aktif otomatis ketika Admin menetapkan Anda sebagai wali kelas pada tahun ajaran aktif.',
          'Anda tetap memiliki seluruh menu guru: agenda, presensi, karakter, laporan.',
          'Tambahannya muncul di bagian "Menu Wali Kelas" pada sidebar.',
        ],
        image: 'wali_kelas/dashboard.png',
        note: 'Menu Wali Kelas tidak muncul? Minta Admin memeriksa penetapan wali kelas di tab Kelas.',
      })
      contentSlide(pptx, {
        title: 'Dashboard: Siswa Sedang Ditangani',
        bullets: [
          'Daftar siswa yang penanganannya belum ditutup.',
          { text: 'Umur kasus', bold: true },
          'Menunjukkan berapa lama kasus dibiarkan terbuka — mencegah kasus mengendap.',
          'Ringkasan sebaran EWS kelas perwalian Anda.',
        ],
        image: 'wali_kelas/dashboard.png',
      })
      sectionSlide(pptx, 'Presensi Harian', 'Kehadiran administratif kelas, per hari')
      contentSlide(pptx, {
        title: 'Presensi Harian ≠ Presensi Sesi',
        bullets: [
          'Presensi sesi diisi guru mata pelajaran, per jam pelajaran.',
          'Presensi harian diisi wali kelas, satu hari penuh.',
          'Keduanya berdiri sendiri dan tidak saling menimpa.',
          'Rekap bulanan tersedia di bagian bawah halaman.',
        ],
        image: 'wali_kelas/presensi-harian.png',
      })
      sectionSlide(pptx, 'Sistem Peringatan Dini', 'Data berbicara sebelum masalah membesar')
      tableSlide(pptx, {
        title: 'Empat Dimensi EWS',
        header: ['Dimensi', 'Batas aman', 'Berisiko bila'],
        rows: [
          ['Kehadiran', '≥ 80%', 'Kehadiran di bawah 80%'],
          ['Poin Karakter', '≥ 0', 'Poin bersih negatif'],
          ['Catatan KBM', '≤ 2 catatan', 'Terdapat 3 catatan atau lebih'],
          ['Rata-rata Nilai', '≥ 70', 'Rata-rata di bawah 70'],
        ],
        note: 'Tidak ada input tambahan dari guru — EWS adalah hasil sampingan agenda, presensi, dan poin karakter.',
      })
      tableSlide(pptx, {
        title: 'Cara Tingkat Peringatan Ditentukan',
        header: ['Jumlah dimensi berisiko', 'Tingkat EWS'],
        rows: [
          ['0', 'Hijau — Normal'],
          ['1', 'Kuning'],
          ['2', 'Oranye'],
          ['3 atau lebih', 'Merah'],
        ],
        note: 'Setiap kenaikan tingkat mengirim notifikasi eskalasi. Alpa 3× berturut-turut memicu peringatan tersendiri.',
      })
      screenshotSlide(pptx, {
        title: 'Detail EWS Siswa',
        image: 'wali_kelas/ews-detail-siswa.png',
        caption: 'Empat kartu dimensi, rekomendasi otomatis, dan riwayat karakter beserta nama guru pemberinya.',
      })
      sectionSlide(pptx, 'Penanganan & Koordinasi dengan BK', 'Mencatat, menutup, mengeskalasi')
      contentSlide(pptx, {
        title: 'Sesi Penanganan',
        bullets: [
          'Judul: ringkasan kasus dalam satu kalimat.',
          'Uraian: maksimal sekitar 200 kata; catatan panjang otomatis diringkas.',
          'Dokumen: lampiran gambar atau PDF, dikompresi otomatis.',
          'Tutup sesi dengan resume penutup — otomatis dibagikan kepada BK.',
          'Eskalasikan ke BK bila penanganan wali kelas tidak memadai.',
        ],
        image: 'wali_kelas/ews-siswa.png',
        note: 'Catatan BK privat secara bawaan. Anda hanya membacanya bila BK sengaja membagikannya.',
      })
      contentSlide(pptx, {
        title: 'Data Siswa & Refleksi Mingguan',
        bullets: [
          { text: 'Menu Siswa', bold: true },
          'Kelola foto dan profil siswa; buka rekam akademik lengkapnya.',
          'Lengkapi nama dan kontak orang tua — dipakai saat rekomendasi meminta menghubungi mereka.',
          { text: 'Refleksi Mingguan', bold: true },
          'Satu catatan reflektif per minggu tentang kelas perwalian Anda.',
        ],
        image: 'wali_kelas/rekap-siswa.png',
      })
      closingSlide(pptx, [
        'Tutup kasus yang sudah selesai — papan "Siswa Sedang Ditangani" mengukur umur kasus.',
        'Periksa EWS sekali seminggu, bukan menunggu notifikasi merah.',
        'Lengkapi kontak orang tua sebelum kasus muncul, bukan sesudahnya.',
        'Tulis refleksi mingguan selagi ingatannya masih segar.',
      ])
    },
  },

  bk: {
    file: 'Paparan-BK.pptx',
    title: 'Panduan Guru BK',
    subtitle: 'EWS Murid, Konseling, dan Kerahasiaan Catatan',
    build(pptx) {
      titleSlide(pptx, this)
      contentSlide(pptx, {
        title: 'BK = Guru + Kapabilitas BK',
        bullets: [
          'Kapabilitas BK aktif ketika Admin menandai akun Anda sebagai guru BK.',
          'Menu BK muncul sebagai kelompok tersendiri pada sidebar.',
          'Bila Anda sekaligus wali kelas, Anda mendapat DUA menu EWS terpisah.',
          '"EWS Siswa" berisi kelas perwalian; "EWS Murid BK" berisi kelas yang Anda ampu.',
        ],
        image: 'bk/dashboard.png',
        note: 'Pemisahan ini disengaja agar jelas dalam kapasitas apa Anda sedang bekerja.',
      })
      contentSlide(pptx, {
        title: 'Ruang Lingkup Akses',
        bullets: [
          'Guru BK melihat siswa pada kelas yang ia ampu — bukan seluruh siswa sekolah.',
          'Pembatasan ini ditentukan oleh penugasan kelas, bukan oleh status BK semata.',
          'Daftar kosong? Hubungi Admin untuk memeriksa penugasan kelas Anda.',
        ],
        image: 'bk/ews-murid-bk.png',
        note: 'Daftar siswa yang kosong bukan kerusakan sistem — itu berarti belum ada penugasan kelas.',
      })
      tableSlide(pptx, {
        title: 'Membaca Tingkat EWS',
        header: ['Dimensi berisiko', 'Tingkat', 'Tindakan yang lazim'],
        rows: [
          ['0', 'Hijau', 'Pantau rutin'],
          ['1', 'Kuning', 'Pembinaan wali kelas'],
          ['2', 'Oranye', 'Libatkan orang tua'],
          ['3+', 'Merah', 'Konseling bersama BK; pertimbangkan surat peringatan'],
        ],
        note: 'Dimensi: kehadiran <80%, poin karakter negatif, catatan KBM ≥3, rata-rata nilai <70.',
      })
      sectionSlide(pptx, 'Konseling', 'Bekerja per kasus, bukan menelusuri daftar')
      contentSlide(pptx, {
        title: 'Alur Konseling',
        bullets: [
          'Halaman dibuka kosong: hanya kotak pencarian. Ini disengaja.',
          'Ketik nama atau NIS siswa, minimal dua karakter.',
          'Layar kasus menampilkan riwayat lengkap: EWS, poin karakter, penanganan wali kelas.',
          'Tambahkan sesi konseling: judul, catatan, dokumen, sakelar berbagi.',
        ],
        image: 'bk/konseling-detail-siswa.png',
      })
      contentSlide(pptx, {
        title: 'Kerahasiaan Catatan Konseling',
        bullets: [
          { text: 'Catatan konseling PRIVAT secara bawaan.', bold: true },
          'Wali kelas tidak dapat membacanya kecuali Anda menyalakan sakelar bagikan.',
          { text: 'Satu pengecualian: resume penutup.', bold: true },
          'Resume penutup sesi otomatis dibagikan — wali kelas berhak tahu kasus telah selesai.',
          'Pertimbangkan masak-masak: sekali dibagikan, catatan dapat dibaca wali kelas.',
        ],
        image: 'bk/konseling-cari-siswa.png',
        note: 'UU Pelindungan Data Pribadi No. 27/2022 mengikat seluruh pengguna aplikasi ini.',
      })
      contentSlide(pptx, {
        title: 'Riwayat Dokumen Penanganan',
        bullets: [
          'Seluruh lampiran dari sesi penanganan dan konseling terkumpul di satu halaman.',
          'Saring berdasarkan kelas.',
          'Unduh satuan, atau seluruhnya sekaligus sebagai berkas ZIP.',
          'Gambar dan PDF dikompresi otomatis saat diunggah.',
        ],
        image: 'bk/riwayat-dokumen.png',
      })
      closingSlide(pptx, [
        'Eskalasi dari wali kelas muncul di dashboard — tanggapi sebelum kasus menua.',
        'Bagikan hanya yang perlu; resume penutup sudah cukup untuk koordinasi.',
        'Tutup sesi yang selesai agar wali kelas tahu kasus tidak menggantung.',
        'Jangan membagikan tangkapan layar berisi data siswa ke grup percakapan.',
      ])
    },
  },

  admin: {
    file: 'Paparan-Admin.pptx',
    title: 'Panduan Admin & Wakasek',
    subtitle: 'Data Master, Integrasi, Pemantauan, dan Pemeliharaan',
    build(pptx) {
      titleSlide(pptx, this)
      contentSlide(pptx, {
        title: 'Panel Admin: 20 Tab',
        bullets: [
          'Data master: Guru, Siswa, Kelas, Mapel, Jadwal, Pengguna.',
          'Karakter: butir penilaian, Ambang rekomendasi, Nilai Manual.',
          'Operasional: Tahun Ajaran, Import Data, Kalender, Pengaturan Agenda.',
          'Integrasi: Penyimpanan (R2), Notifikasi Push, Foto, Jadwal PDF.',
          'Pemeliharaan: Backup & Restore, Deploy & Maintenance, Guru Inval.',
        ],
        image: 'admin/panel-admin.png',
      })
      sectionSlide(pptx, 'Data Master', 'Fondasi yang harus benar sejak awal')
      contentSlide(pptx, {
        title: 'Urutan Pengisian yang Benar',
        bullets: [
          '1. Tahun Ajaran — wadah bagi semua data lain.',
          '2. Mapel — mata pelajaran.',
          '3. Guru — siapa yang mengajar (di sini pula guru BK ditandai).',
          '4. Kelas — rombel + penetapan wali kelas.',
          '5. Siswa — siapa yang belajar, di kelas mana.',
          '6. Jadwal — guru × mapel × kelas × hari × jam.',
        ],
        image: 'admin/tab/jadwal.png',
        note: 'Jadwal adalah sumber kebenaran: dashboard guru, pilihan kelas di Laporan, dan hitungan Kosong di EWS Guru.',
      })
      contentSlide(pptx, {
        title: 'Kapabilitas Ditetapkan dari Sini',
        bullets: [
          { text: 'Menu Wali Kelas', bold: true },
          'Muncul ketika guru ditetapkan sebagai wali kelas pada kelas di tahun ajaran AKTIF.',
          { text: 'Menu BK', bold: true },
          'Muncul ketika guru ditandai sebagai guru BK pada tab Guru.',
          'Guru dapat memegang keduanya sekaligus.',
        ],
        image: 'admin/tab/kelas.png',
        note: 'Keluhan "menu saya hilang" hampir selalu berujung pada dua penetapan ini.',
      })
      contentSlide(pptx, {
        title: 'Import Data: Tiga Jebakan',
        bullets: [
          { text: 'Digit NIP / NIS / NISN rusak', bold: true },
          'Excel memperlakukannya sebagai bilangan: nol di depan hilang, digit akhir dibulatkan. Format kolom sebagai TEKS.',
          { text: 'Akun guru terduplikasi', bold: true },
          'Nama yang ditulis sedikit berbeda antar berkas membuat akun ganda. Samakan penulisan lebih dulu.',
          { text: 'Kode program keahlian tidak dikenali', bold: true },
          'Kelas gagal terbentuk. Gunakan kode yang dipakai sekolah.',
        ],
        image: 'admin/tab/import-data.png',
        note: 'Urutan impor: Excel guru → XML jadwal → siswa. Baris yang gagal tidak membatalkan yang berhasil.',
      })
      sectionSlide(pptx, 'Karakter & Ambang', 'Menjaga skala poin tetap setara antar guru')
      tableSlide(pptx, {
        title: 'Ambang Rekomendasi Otomatis',
        header: ['Rentang poin bersih', 'Rekomendasi yang terbit'],
        rows: [
          ['≥ +30', 'Apresiasi formal; kandidat siswa berprestasi'],
          ['+15 s.d. +29', 'Pujian dan motivasi; catat sebagai siswa teladan'],
          ['−10 s.d. −19', 'Pembinaan langsung oleh wali kelas; catat dalam buku kasus'],
          ['−20 s.d. −49', 'Hubungi orang tua; pembinaan intensif'],
          ['≤ −50', 'Konseling bersama BK; pertimbangkan surat peringatan formal'],
        ],
        note: 'Mengubah bobot butir TIDAK menghitung ulang poin yang telanjur diberikan. Ubah di awal semester.',
      })
      contentSlide(pptx, {
        title: 'Antrian Nilai Manual',
        bullets: [
          'Guru mengajukan perilaku yang tidak tercakup butir baku.',
          'Admin dapat Setujui, Sesuaikan nilai finalnya, atau Tolak.',
          'Selama belum ditinjau, poin belum memengaruhi siswa sama sekali.',
          'Catatan: "Nilai Tambah" (−20…+20) TIDAK melewati antrian ini — langsung final.',
        ],
        image: 'admin/tab/nilai-manual.png',
      })
      sectionSlide(pptx, 'Pemantauan', 'EWS Guru dan Rekap Lintas Semester')
      contentSlide(pptx, {
        title: 'EWS Guru: Kepatuhan Pengisian Agenda',
        bullets: [
          'Menampilkan Terisi / Draft / Kosong per guru untuk rentang tanggal tertentu.',
          'Klik nama guru untuk melihat rincian sesi dan waktu pengisiannya.',
          'Kolom "Diisi Pada" berasal dari log audit (waktu dan alamat IP).',
        ],
        image: 'admin/ews-guru-detail.png',
        note: 'Sebelum menyimpulkan guru lalai: periksa jadwal, status guru inval, dan hari tidak efektif.',
      })
      contentSlide(pptx, {
        title: 'Kalender dan Minggu Efektif',
        bullets: [
          'Tiga cara mengisi kalender: Google API Key, berkas ICS, atau import Excel.',
          { text: 'Sinkronisasi kalender TIDAK otomatis menandai hari tidak efektif.', bold: true },
          'Penandaan tetap tindakan sadar Admin — tidak semua acara meniadakan pembelajaran.',
          'Hari efektif hanya dihitung di dalam rentang tanggal semester aktif.',
          'Ekspor PDF dibatasi 40 lembar; arahkan kebutuhan massal ke Excel.',
        ],
        image: 'admin/kalender.png',
      })
      sectionSlide(pptx, 'Pemeliharaan', 'Merawat aplikasi tanpa akses Terminal')
      contentSlide(pptx, {
        title: 'Deploy & Maintenance',
        bullets: [
          'Peladen produksi berjalan di cPanel — tanpa akses Terminal.',
          'Tab ini memindahkan perintah pemeliharaan ke antarmuka web.',
          'Tersedia: migrasi basis data, bersihkan cache, tautkan penyimpanan, periksa kesehatan.',
          { text: 'Urutan setelah pembaruan: Backup → Migrasi → Bersihkan cache → Periksa kesehatan.', bold: true },
        ],
        image: 'admin/tab/deploy-dan-maintenance.png',
        note: 'Jangan pernah menjalankan migrasi tanpa backup. Restore menimpa seluruh data dan tidak dapat dibatalkan.',
      })
      contentSlide(pptx, {
        title: 'Integrasi Opsional',
        bullets: [
          { text: 'Penyimpanan Cloudflare R2', bold: true },
          'Kredensial terenkripsi. Tekan Tes Koneksi sebelum menyalakan. Kolom kosong = jangan ubah.',
          { text: 'Notifikasi Push (Firebase)', bold: true },
          'Setelah dikonfigurasi, tiap pengguna mengatur sendiri jenis notifikasinya.',
          'Izin notifikasi diberikan peramban pengguna — Admin tidak dapat memaksanya.',
        ],
        image: 'admin/tab/penyimpanan.png',
      })
      closingSlide(pptx, [
        'Backup sebelum setiap tindakan berisiko: impor massal, migrasi, pergantian tahun ajaran.',
        'Periksa jadwal lebih dulu ketika ada keluhan tentang EWS Guru.',
        'Format kolom NIP/NIS sebagai Teks sebelum mengimpor.',
        'Tinjau antrian Nilai Manual secara rutin agar poin siswa tidak menggantung.',
      ])
    },
  },
}

// ── Bangun ───────────────────────────────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true })

for (const [key, deck] of Object.entries(DECKS)) {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'
  pptx.author = 'SMK Negeri 2 Cimahi'
  pptx.company = 'SMK Negeri 2 Cimahi'
  pptx.title = deck.title
  pptx.subject = 'Panduan Aplikasi Agenda Pembelajaran'

  deck.build(pptx)

  const target = path.join(OUT_DIR, deck.file)
  await pptx.writeFile({ fileName: target })
  const kb = (fs.statSync(target).size / 1024 / 1024).toFixed(2)
  console.log(`  ✓ ${deck.file} (${kb} MB)`)
}

console.log('\nSelesai — 4 berkas paparan dibuat.')
