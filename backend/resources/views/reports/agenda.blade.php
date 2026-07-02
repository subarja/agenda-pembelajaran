<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
@php
  $ps = $printSettings ?? null;
  $mTop = $ps->margin_top ?? 1; $mBottom = $ps->margin_bottom ?? 1;
  $mLeft = $ps->margin_left ?? 2; $mRight = $ps->margin_right ?? 2;
  $kopWidth = $ps->kop_width_percent ?? 100;
  $kopAlign = $ps->kop_position ?? 'center';
@endphp
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: Arial, sans-serif;
    font-size: 11pt;
    color: #1a1a1a;
    margin: {{ $mTop }}cm {{ $mRight }}cm {{ $mBottom }}cm {{ $mLeft }}cm;
}

/* KOP SURAT */
.kop { margin-bottom: 10px; text-align: {{ $kopAlign }}; }
.kop img { display: inline-block; width: {{ $kopWidth }}%; height: auto; }
.kop-garis { border-top: 3px solid #000; border-bottom: 1px solid #000; margin-top: 4px; }

/* JUDUL */
.judul { margin: 14px 0 12px; }
.judul h2 { font-size: 12pt; font-weight: bold; text-transform: uppercase; }
.judul h3 { font-size: 11pt; font-weight: bold; text-transform: uppercase; }

/* IDENTITAS GURU */
.identitas { margin-bottom: 14px; }
.identitas table { font-size: 10.5pt; border-collapse: collapse; }
.identitas td { padding: 1px 0; vertical-align: top; }
.identitas td:first-child { width: 155px; }
.identitas td:nth-child(2) { width: 12px; }

/* TABEL AGENDA */
.tabel-agenda { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 14px; }
.tabel-agenda th {
    background: #fff;
    color: #000;
    padding: 5px 6px;
    text-align: center;
    font-size: 10pt;
    font-weight: bold;
    border: 1px solid #000;
}
.tabel-agenda td {
    padding: 4px 6px;
    border: 1px solid #000;
    vertical-align: top;
}
.tabel-agenda .no   { text-align: center; width: 24px; }
.tabel-agenda .tgl  { width: 110px; }
.tabel-agenda .jam  { width: 56px; text-align: center; }
.tabel-agenda .kls  { width: 100px; }
.tabel-agenda .ket  { width: 60px; }

/* RINGKASAN MINGGUAN — GK31: ruang di sebelah kiri TTD dulu kosong, sekarang diisi
   kotak info singkat (pertemuan & JP terlaksana/minggu vs seharusnya). Lebar dibatasi
   supaya tidak pernah menabrak blok TTD di kanan. */
.ringkasan-box { font-size: 9pt; color: #333; vertical-align: top; padding-right: 12px; }
.ringkasan-box .judul { font-weight: bold; font-size: 9.5pt; margin-bottom: 3px; text-transform: uppercase; }
.ringkasan-box .baris { margin-bottom: 2px; line-height: 1.4; }

/* TTD — gunakan table agar DomPDF render benar */
.ttd-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 10.5pt; }
.ttd-spacer { }
/* Setiap sel = 1 penanda tangan; berjajar otomatis jika >1 */
.ttd-cell { text-align: center; padding: 0 8px; vertical-align: top; }
.ttd-cell .ttd-nama {
    display: inline-block;
    font-weight: bold;
    border-top: 1px solid #000;
    padding-top: 3px;
    margin-top: 55px;
    min-width: 160px;
}
.ttd-cell .ttd-nip { font-size: 10pt; }

/* FOOTER */
.footer-table { width: 100%; border-collapse: collapse; margin-top: 10px; border-top: 1px solid #ccc; padding-top: 6px; }
.footer-waktu { font-size: 9pt; color: #555; padding-top: 6px; }
</style>
</head>
<body>

{{-- KOP SURAT --}}
<div class="kop">
  <img src="{{ $kopSuratPath }}" alt="Kop Surat SMKN 2 Cimahi">
  <div class="kop-garis"></div>
</div>

{{-- JUDUL --}}
<div class="judul">
  <h2>Kegiatan Belajar Mengajar Bulan {{ $bulan }}</h2>
  <h3>Tahun Pelajaran {{ $tahun_pelajaran }}</h3>
</div>

{{-- IDENTITAS GURU --}}
<div class="identitas">
  <table>
    <tr>
      <td rowspan="7" style="width:23mm; vertical-align:top; padding-right:3mm;">
        <img src="file://{{ $fotoGuruPath }}" style="width:20mm; height:auto; border:1px solid #ccc;">
      </td>
      <td style="width:155px">Nama Guru</td><td style="width:12px">:</td>
      <td>{{ $guru }}</td>
    </tr>
    <tr>
      <td>NIP</td><td>:</td>
      <td>{{ $nip }}</td>
    </tr>
    <tr>
      <td>Kompetensi Keahlian</td><td>:</td>
      <td>{{ $kompetensi_keahlian }}</td>
    </tr>
    <tr>
      <td>Mata Pelajaran</td><td>:</td>
      <td>{{ $mata_pelajaran }}</td>
    </tr>
    <tr>
      <td>Kelas Diampu</td><td>:</td>
      <td>{{ $kelas_diampu }}</td>
    </tr>
    <tr>
      <td>Semester</td><td>:</td>
      <td>{{ $semester }}</td>
    </tr>
    <tr>
      <td>Periode Laporan</td><td>:</td>
      <td>{{ $periode }}</td>
    </tr>
  </table>
</div>

{{-- TABEL AGENDA --}}
<table class="tabel-agenda">
  <thead>
    <tr>
      <th class="no">No</th>
      <th class="tgl">Hari / Tanggal</th>
      <th class="jam">Jam Ke</th>
      <th class="kls">Kelas</th>
      <th>Tujuan Pembelajaran</th>
      <th>Kegiatan Pembelajaran</th>
      <th class="ket">Keterangan</th>
    </tr>
  </thead>
  <tbody>
    @forelse($rows as $i => $r)
    <tr>
      <td class="no">{{ $i + 1 }}</td>
      <td class="tgl">{{ $r['hari_tanggal'] }}</td>
      <td class="jam">{{ $r['jam'] }}</td>
      <td class="kls" style="font-size:9.5pt">{{ $r['kelas'] }}</td>
      <td style="font-size:9.5pt">{{ $r['tujuan_pembelajaran'] ?: '—' }}</td>
      <td style="font-size:9.5pt">{{ $r['kegiatan_pembelajaran'] ?: '—' }}</td>
      <td class="ket">{{ $r['keterangan'] ?? '' }}</td>
    </tr>
    @empty
    <tr>
      <td colspan="7" style="text-align:center; color:#aaa; padding:20px">
        Tidak ada agenda dalam periode ini.
      </td>
    </tr>
    @endforelse
  </tbody>
</table>

{{-- TANDA TANGAN
     Pola: 1 baris tabel — kolom kosong (spacer, sekarang berisi ringkasan mingguan
     GK31) + kolom-kolom penanda tangan berjajar.
     Tambah <td class="ttd-cell"> baru jika ada >1 penanda tangan. --}}
<table class="ttd-table">
  <tr>
    <td class="ttd-spacer ringkasan-box" style="width:55%">
      @if(!empty($ringkasan_mingguan))
        <div class="judul">Ringkasan Mingguan</div>
        <div class="baris">
          Pertemuan: {{ $ringkasan_mingguan['pertemuan_per_minggu'] }}/minggu dari
          {{ $ringkasan_mingguan['pertemuan_seharusnya_per_minggu'] }} seharusnya
          ({{ $ringkasan_mingguan['pct_pertemuan'] }}%)
        </div>
        <div class="baris">
          Jam Pelajaran: {{ $ringkasan_mingguan['jp_per_minggu'] }} JP/minggu dari
          {{ $ringkasan_mingguan['jp_seharusnya_per_minggu'] }} JP seharusnya
          ({{ $ringkasan_mingguan['pct_jp'] }}%)
        </div>
      @endif
    </td>
    {{-- Penanda tangan 1: Guru Mata Pelajaran --}}
    <td class="ttd-cell">
      <div>Cimahi, {{ $tanggal_ttd }}</div>
      <div>Guru Mata Pelajaran</div>
      <span class="ttd-nama">{{ $guru }}</span>
      <div class="ttd-nip">NIP. {{ $nip }}</div>
    </td>
    {{-- Tambahkan <td class="ttd-cell"> di sini jika ada penanda tangan tambahan --}}
  </tr>
</table>

{{-- FOOTER --}}
<table class="footer-table">
  <tr>
    <td class="footer-waktu">Waktu Cetak: {{ now('Asia/Jakarta')->isoFormat('D MMMM YYYY, [Pkl.] HH.mm') }} WIB</td>
  </tr>
</table>

</body>
</html>
