<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
@php
  $ps = $printSettings ?? null;
  $mTop = $ps->margin_top ?? 1; $mBottom = $ps->margin_bottom ?? 1;
  $mLeft = $ps->margin_left ?? 1.5; $mRight = $ps->margin_right ?? 1.5;
  $kopWidth = $ps->kop_width_percent ?? 100;
  $kopAlign = $ps->kop_position ?? 'center';
@endphp
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; font-size: 9pt; color: #1a1a1a; margin: {{ $mTop }}cm {{ $mRight }}cm {{ $mBottom }}cm {{ $mLeft }}cm; }
.kop { margin-bottom: 8px; text-align: {{ $kopAlign }}; }
.kop img { display: inline-block; width: {{ $kopWidth }}%; height: auto; }
.kop-garis { border-top: 3px solid #000; border-bottom: 1px solid #000; margin-top: 4px; }
.judul { margin: 12px 0 4px; text-align: center; }
.judul h2 { font-size: 12pt; font-weight: bold; text-transform: uppercase; }
.periode { text-align: center; font-size: 9.5pt; margin-bottom: 8px; }
.ringkasan { font-size: 9pt; margin-bottom: 8px; }
table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
th, td { border: 1px solid #000; padding: 3px 5px; vertical-align: top; }
th { background: #eee; text-align: center; }
td.center { text-align: center; white-space: nowrap; }
</style>
</head>
<body>

<div class="kop">
  <img src="{{ $kopSuratPath }}" alt="Kop Surat SMKN 2 Cimahi">
  <div class="kop-garis"></div>
</div>

<div class="judul"><h2>Rekap Izin Keluar Siswa</h2></div>
<div class="periode">Periode: {{ $periode }}</div>
<div class="ringkasan">
  Total <strong>{{ $ringkasan['total'] }}</strong> izin ·
  Kembali via sekuriti: <strong>{{ $ringkasan['sekuriti'] }}</strong> ·
  via piket (manual): <strong>{{ $ringkasan['piket'] }}</strong> ·
  Belum kembali: <strong>{{ $ringkasan['belum_kembali'] }}</strong>
</div>

<table>
  <thead>
    <tr>
      <th style="width:26px;">No</th>
      <th style="width:70px;">Tanggal</th>
      <th>Nama</th>
      <th style="width:80px;">Kelas</th>
      <th>Keperluan</th>
      <th style="width:40px;">Keluar</th>
      <th style="width:40px;">Masuk</th>
      <th style="width:90px;">Validasi Kembali</th>
      <th style="width:110px;">Petugas Piket</th>
      <th>Keterangan</th>
    </tr>
  </thead>
  <tbody>
    @forelse($rows as $i => $r)
    <tr>
      <td class="center">{{ $i + 1 }}</td>
      <td class="center">{{ $r['tanggal'] }}</td>
      <td>{{ $r['nama'] }}</td>
      <td class="center">{{ $r['kelas'] }}</td>
      <td>{{ $r['keperluan'] }}</td>
      <td class="center">{{ $r['keluar'] }}</td>
      <td class="center">{{ $r['masuk'] }}</td>
      <td class="center">{{ $r['validasi'] }}</td>
      <td>{{ $r['petugas'] }}</td>
      <td>{{ $r['keterangan'] }}</td>
    </tr>
    @empty
    <tr><td colspan="10" class="center">Tidak ada data pada periode ini.</td></tr>
    @endforelse
  </tbody>
</table>

</body>
</html>
