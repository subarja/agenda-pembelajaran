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

.kop { margin-bottom: 10px; text-align: {{ $kopAlign }}; }
.kop img { display: inline-block; width: {{ $kopWidth }}%; height: auto; }
.kop-garis { border-top: 3px solid #000; border-bottom: 1px solid #000; margin-top: 4px; }

.judul { margin: 14px 0 12px; }
.judul h2 { font-size: 12pt; font-weight: bold; text-transform: uppercase; }

.identitas { margin-bottom: 14px; }
.identitas table { font-size: 10.5pt; border-collapse: collapse; }
.identitas td { padding: 1px 0; vertical-align: top; }
.identitas td:first-child { width: 155px; }
.identitas td:nth-child(2) { width: 12px; }

.tabel-refleksi { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 14px; }
.tabel-refleksi th {
    background: #fff; color: #000; padding: 5px 6px; text-align: center;
    font-size: 10pt; font-weight: bold; border: 1px solid #000;
}
.tabel-refleksi td { padding: 5px 6px; border: 1px solid #000; vertical-align: top; }
.tabel-refleksi .no { text-align: center; width: 24px; }
.tabel-refleksi .minggu { width: 110px; text-align: center; }

.ttd-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 10.5pt; }
.ttd-cell { text-align: center; padding: 0 8px; vertical-align: top; }
.ttd-cell .ttd-nama {
    display: inline-block; font-weight: bold; border-top: 1px solid #000;
    padding-top: 3px; margin-top: 55px; min-width: 160px;
}
.ttd-cell .ttd-nip { font-size: 10pt; }

.footer-table { width: 100%; border-collapse: collapse; margin-top: 10px; border-top: 1px solid #ccc; padding-top: 6px; }
.footer-waktu { font-size: 9pt; color: #555; padding-top: 6px; }
</style>
</head>
<body>

<div class="kop">
  <img src="{{ $kopSuratPath }}" alt="Kop Surat SMKN 2 Cimahi">
  <div class="kop-garis"></div>
</div>

<div class="judul">
  <h2>Refleksi Mingguan Wali Kelas</h2>
</div>

<div class="identitas">
  <table>
    <tr>
      <td rowspan="4" style="width:23mm; vertical-align:top; padding-right:3mm;">
        <img src="file://{{ $fotoGuruPath }}" style="width:20mm; height:auto; border:1px solid #ccc;">
      </td>
      <td style="width:155px">Wali Kelas</td><td style="width:12px">:</td>
      <td>{{ $guru }}</td>
    </tr>
    <tr>
      <td>NIP</td><td>:</td>
      <td>{{ $nip }}</td>
    </tr>
    <tr>
      <td>Kelas</td><td>:</td>
      <td>{{ $kelas }}</td>
    </tr>
    <tr>
      <td>Periode Laporan</td><td>:</td>
      <td>{{ $periode }}</td>
    </tr>
  </table>
</div>

<table class="tabel-refleksi">
  <thead>
    <tr>
      <th class="no">No</th>
      <th class="minggu">Minggu Mulai</th>
      <th>Catatan Refleksi</th>
    </tr>
  </thead>
  <tbody>
    @forelse($rows as $i => $r)
    <tr>
      <td class="no">{{ $i + 1 }}</td>
      <td class="minggu">{{ $r->minggu_mulai->locale('id')->isoFormat('D MMMM YYYY') }}</td>
      <td>{{ $r->catatan }}</td>
    </tr>
    @empty
    <tr>
      <td colspan="3" style="text-align:center; color:#aaa; padding:20px">
        Tidak ada refleksi dalam periode ini.
      </td>
    </tr>
    @endforelse
  </tbody>
</table>

<table class="ttd-table">
  <tr>
    <td class="ttd-spacer" style="width:55%"></td>
    <td class="ttd-cell">
      <div>Cimahi, {{ $tanggal_ttd }}</div>
      <div>Wali Kelas</div>
      <span class="ttd-nama">{{ $guru }}</span>
      <div class="ttd-nip">NIP. {{ $nip }}</div>
    </td>
  </tr>
</table>

<table class="footer-table">
  <tr>
    <td class="footer-waktu">Waktu Cetak: {{ now('Asia/Jakarta')->isoFormat('D MMMM YYYY, [Pkl.] HH.mm') }} WIB</td>
  </tr>
</table>

</body>
</html>
