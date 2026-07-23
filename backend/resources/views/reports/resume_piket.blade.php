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
  $petugas = $petugas ?? [];
  $rekap = $rekap ?? [];
  $shiftLabel = $shiftLabel ?? '-';
  $kehadiranKelas = $rekap['kehadiran_kelas'] ?? [];
  $agendaRekap = $rekap['agenda'] ?? [];
  $presensiRekap = $rekap['presensi'] ?? [];
@endphp
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; font-size: 11pt; color: #1a1a1a; margin: {{ $mTop }}cm {{ $mRight }}cm {{ $mBottom }}cm {{ $mLeft }}cm; }
.kop { margin-bottom: 10px; text-align: {{ $kopAlign }}; }
.kop img { display: inline-block; width: {{ $kopWidth }}%; height: auto; }
.kop-garis { border-top: 3px solid #000; border-bottom: 1px solid #000; margin-top: 4px; }
.judul { margin: 14px 0 12px; text-align: center; }
.judul h2 { font-size: 12pt; font-weight: bold; text-transform: uppercase; }
.identitas { margin-bottom: 14px; }
.identitas table { font-size: 10.5pt; border-collapse: collapse; }
.identitas td { padding: 1px 0; vertical-align: top; }
.identitas td:first-child { width: 140px; }
.identitas td:nth-child(2) { width: 12px; }
.blok { margin-bottom: 14px; }
.blok h3 { font-size: 10.5pt; font-weight: bold; margin-bottom: 4px; }
.blok .isi { font-size: 10.5pt; border: 1px solid #000; padding: 8px; white-space: pre-wrap; min-height: 40px; }
.rekap-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
.rekap-table th, .rekap-table td { border: 1px solid #000; padding: 3px 6px; }
.rekap-table th { background: #eee; text-align: center; }
.rekap-table td.center { text-align: center; }
.rekap-list { font-size: 10pt; }
.rekap-list li { margin-left: 16px; }
.ttd-table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 10.5pt; }
.ttd-cell { text-align: center; padding: 0 8px; vertical-align: top; }
.ttd-cell .ttd-nama { display: inline-block; font-weight: bold; border-top: 1px solid #000; padding-top: 3px; margin-top: 55px; min-width: 150px; }
</style>
</head>
<body>

<div class="kop">
  <img src="{{ $kopSuratPath }}" alt="Kop Surat SMKN 2 Cimahi">
  <div class="kop-garis"></div>
</div>

<div class="judul"><h2>Resume Piket</h2></div>

<div class="identitas">
  <table>
    <tr><td>Tanggal</td><td>:</td><td>{{ $tanggalLabel }}</td></tr>
    <tr><td>Shift</td><td>:</td><td>{{ $shiftLabel }}</td></tr>
    <tr><td>Petugas Piket</td><td>:</td><td>{{ count($petugas) ? implode(', ', $petugas) : '-' }}</td></tr>
    <tr><td>Rekap s.d. pukul</td><td>:</td><td>{{ $rekap['waktu'] ?? '-' }}</td></tr>
  </table>
</div>

<div class="blok">
  <h3>Ringkasan Kegiatan</h3>
  <div class="isi">{{ $ringkasan }}</div>
</div>

@if($kejadianPenting)
<div class="blok">
  <h3>Kejadian Penting</h3>
  <div class="isi">{{ $kejadianPenting }}</div>
</div>
@endif

<div class="blok">
  <h3>Rekap Pengisian (s.d. pukul {{ $rekap['waktu'] ?? '-' }})</h3>
  <ul class="rekap-list">
    <li>Agenda guru terisi: <strong>{{ $agendaRekap['terisi'] ?? 0 }}</strong> dari {{ $agendaRekap['berlangsung'] ?? 0 }} sesi yang sudah berlangsung
        ({{ $agendaRekap['belum'] ?? 0 }} belum).</li>
    <li>Presensi siswa terisi: <strong>{{ $presensiRekap['terisi'] ?? 0 }}</strong> dari {{ $presensiRekap['berlangsung'] ?? 0 }} sesi
        ({{ $presensiRekap['belum'] ?? 0 }} belum).</li>
  </ul>
</div>

<div class="blok">
  <h3>Rekap Kehadiran per Kelas</h3>
  @if(count($kehadiranKelas))
  <table class="rekap-table">
    <thead>
      <tr><th style="text-align:left;">Kelas</th><th>Hadir</th><th>Sakit</th><th>Izin</th><th>Alpha</th><th>Total</th></tr>
    </thead>
    <tbody>
      @foreach($kehadiranKelas as $k)
      <tr>
        <td>{{ $k['kelas'] ?? '-' }}</td>
        <td class="center">{{ $k['hadir'] ?? 0 }}</td>
        <td class="center">{{ $k['sakit'] ?? 0 }}</td>
        <td class="center">{{ $k['izin'] ?? 0 }}</td>
        <td class="center">{{ $k['alpha'] ?? 0 }}</td>
        <td class="center">{{ $k['total'] ?? 0 }}</td>
      </tr>
      @endforeach
    </tbody>
  </table>
  @else
  <div class="isi" style="min-height:0;">Belum ada absensi harian tercatat sampai waktu ini.</div>
  @endif
</div>

<table class="ttd-table">
  <tr>
    @php $ttd = count($petugas) ? $petugas : ['Petugas Piket']; @endphp
    @foreach($ttd as $nama)
      <td class="ttd-cell" style="width: {{ 100 / max(1, count($ttd)) }}%;">
        @if($loop->first)
          Cimahi, {{ $tanggalTtd }}<br>
        @else
          &nbsp;<br>
        @endif
        Petugas Piket,
        <div class="ttd-nama">{{ $nama }}</div>
      </td>
    @endforeach
  </tr>
</table>

</body>
</html>
