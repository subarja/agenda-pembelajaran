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
body { font-family: Arial, sans-serif; font-size: 10.5pt; color: #1a1a1a; margin: {{ $mTop }}cm {{ $mRight }}cm {{ $mBottom }}cm {{ $mLeft }}cm; }
.kop { margin-bottom: 10px; text-align: {{ $kopAlign }}; }
.kop img { display: inline-block; width: {{ $kopWidth }}%; height: auto; }
.kop-garis { border-top: 3px solid #000; border-bottom: 1px solid #000; margin-top: 4px; }
.judul { margin: 14px 0 12px; text-align: center; }
.judul h2 { font-size: 13pt; font-weight: bold; text-transform: uppercase; }
.judul p { font-size: 11pt; margin-top: 2px; }
.hari { margin-bottom: 12px; }
.hari h3 { font-size: 11pt; font-weight: bold; margin-bottom: 4px; background: #eee; padding: 3px 6px; border: 1px solid #000; border-bottom: none; }
table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
th, td { border: 1px solid #000; padding: 3px 6px; vertical-align: top; }
th { background: #f5f5f5; text-align: left; }
td.center { text-align: center; white-space: nowrap; }
.kosong { border: 1px solid #000; border-top: none; padding: 6px; font-size: 9.5pt; color: #555; }
</style>
</head>
<body>

<div class="kop">
  <img src="{{ $kopSuratPath }}" alt="Kop Surat SMKN 2 Cimahi">
  <div class="kop-garis"></div>
</div>

<div class="judul">
  <h2>Jadwal Pelajaran</h2>
  <p>{{ $subjudul }}</p>
</div>

@foreach($hariUrut as $h)
  @php $rows = $grouped[$h] ?? []; @endphp
  @if(count($rows))
  <div class="hari">
    <h3>{{ $hariLabel[$h] ?? $h }}</h3>
    <table>
      <thead>
        <tr>
          <th style="width:70px;">Jam</th>
          <th style="width:55px;">Jam ke</th>
          <th>Mata Pelajaran</th>
          <th style="width:32%;">{{ $kolomLabel }}</th>
          <th style="width:80px;">Ruangan</th>
        </tr>
      </thead>
      <tbody>
        @foreach($rows as $r)
        <tr>
          <td class="center">{{ substr($r['jam_mulai'], 0, 5) }}–{{ substr($r['jam_selesai'], 0, 5) }}</td>
          <td class="center">
            {{ $r['jam_ke_mulai'] }}@if($r['jam_ke_selesai'] && $r['jam_ke_selesai'] != $r['jam_ke_mulai'])–{{ $r['jam_ke_selesai'] }}@endif
          </td>
          <td>{{ $r['subject']['nama'] ?? '-' }}</td>
          <td>{{ $forSiswa ? ($r['guru'] ?? '-') : ($r['kelas'] ?? '-') }}</td>
          <td>{{ $r['ruangan'] ?? '-' }}</td>
        </tr>
        @endforeach
      </tbody>
    </table>
  </div>
  @endif
@endforeach

</body>
</html>
