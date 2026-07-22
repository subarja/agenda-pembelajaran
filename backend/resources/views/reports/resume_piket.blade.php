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

<div class="judul"><h2>Resume Piket Harian</h2></div>

<div class="identitas">
  <table>
    <tr><td>Tanggal</td><td>:</td><td>{{ $tanggalLabel }}</td></tr>
    <tr><td>Petugas Piket</td><td>:</td><td>{{ count($petugas) ? implode(', ', $petugas) : '-' }}</td></tr>
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
