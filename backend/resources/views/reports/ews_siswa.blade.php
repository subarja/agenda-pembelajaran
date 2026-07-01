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

.kop { text-align: {{ $kopAlign }}; margin-bottom: 6px; }
.kop img { display: inline-block; width: {{ $kopWidth }}%; height: auto; }
.kop-garis { border-top: 3px solid #000; border-bottom: 1px solid #000; margin-bottom: 10px; }

.judul { text-align: center; margin-bottom: 10px; }
.judul h2 { font-size: 12pt; font-weight: bold; text-transform: uppercase; }
.judul .sub { font-size: 9.5pt; margin-top: 2px; }

.section-title { font-size: 10pt; font-weight: bold; margin: 12px 0 5px;
  border-bottom: 1px solid #ccc; padding-bottom: 2px; }

table.rekap { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 4px; }
table.rekap th { background: #1f4e79; color: white; padding: 4px 6px; text-align: center;
  border: 1px solid #1f4e79; }
table.rekap td { padding: 3px 6px; border: 1px solid #d1d5db; vertical-align: middle; }
table.rekap tr:nth-child(even) td { background: #f8fafc; }

.badge { display: inline-block; padding: 1px 6px; border-radius: 20px; font-size: 8pt; font-weight: bold; }
.badge-merah  { background: #fef2f2; color: #dc2626; }
.badge-oranye { background: #fff7ed; color: #ea580c; }
.badge-kuning { background: #fefce8; color: #ca8a04; }
.badge-hijau  { background: #f0fdf4; color: #16a34a; }

.text-center { text-align: center; }
.text-red   { color: #dc2626; }
.text-green { color: #16a34a; }

.footer { margin-top: 10px; font-size: 7.5pt; color: #aaa;
  border-top: 1px solid #e2e8f0; padding-top: 4px; text-align: right; }
.page-break { page-break-before: always; }
</style>
</head>
<body>

<div class="kop">
  <img src="file://{{ public_path('images/kop_surat.jpg') }}" alt="Kop SMKN 2 Cimahi">
</div>
<div class="kop-garis"></div>
<div class="judul">
  <h2>Laporan Early Warning System (EWS) Siswa</h2>
  <div class="sub">{{ $ayLabel }}</div>
</div>

@if(count($byJurusan) === 0)
  <p style="text-align:center;color:#aaa;padding:30px">Tidak ada data EWS.</p>
@else

@php $firstSection = true; @endphp
@foreach($byJurusan as $jurusan => $siswa)
  @if(!$firstSection)<div class="page-break"></div>@endif
  @php $firstSection = false; @endphp

  <div class="section-title">{{ $jurusan }}</div>

  <table class="rekap">
    <thead>
      <tr>
        <th style="width:28px">No</th>
        <th>Nama Siswa</th>
        <th style="width:70px">NIS</th>
        <th style="width:90px">Kelas</th>
        <th style="width:60px">Level</th>
        <th style="width:65px">Kehadiran</th>
        <th style="width:60px">Karakter</th>
        <th style="width:50px">Catatan</th>
        <th style="width:55px">Nilai</th>
      </tr>
    </thead>
    <tbody>
      @foreach($siswa as $i => $s)
      <tr>
        <td class="text-center">{{ $i + 1 }}</td>
        <td>{{ $s['nama'] }}</td>
        <td class="text-center">{{ $s['nis'] }}</td>
        <td>{{ $s['kelas'] ?? '—' }}</td>
        <td class="text-center">
          <span class="badge badge-{{ $s['level'] }}">{{ ucfirst($s['level']) }}</span>
        </td>
        <td class="text-center {{ $s['kehadiran_score'] < 80 ? 'text-red' : 'text-green' }}">
          {{ $s['kehadiran_score'] }}%
        </td>
        <td class="text-center {{ $s['karakter_score'] < 0 ? 'text-red' : '' }}">
          {{ $s['karakter_score'] >= 0 ? '+' : '' }}{{ $s['karakter_score'] }}
        </td>
        <td class="text-center {{ $s['catatan_count'] >= 3 ? 'text-red' : '' }}">
          {{ $s['catatan_count'] > 0 ? $s['catatan_count'].'x' : '—' }}
        </td>
        <td class="text-center {{ $s['nilai_score'] !== null && $s['nilai_score'] < 70 ? 'text-red' : '' }}">
          {{ $s['nilai_score'] ?? '—' }}
        </td>
      </tr>
      @endforeach
    </tbody>
  </table>
@endforeach

@endif

<div class="footer">Dicetak: {{ now('Asia/Jakarta')->format('d M Y H:i') }} WIB · Aplikasi Agenda Pembelajaran SMKN 2 Cimahi</div>

</body>
</html>
