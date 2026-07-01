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

table.rekap { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 8px; }
table.rekap th { background: #1f4e79; color: white; padding: 4px 6px; text-align: center;
  border: 1px solid #1f4e79; }
table.rekap td { padding: 3px 6px; border: 1px solid #d1d5db; vertical-align: middle; }
table.rekap tr:nth-child(even) td { background: #f8fafc; }

.badge { display: inline-block; padding: 1px 6px; border-radius: 20px; font-size: 8pt; font-weight: bold; }
.badge-merah  { background: #fef2f2; color: #dc2626; }
.badge-oranye { background: #fff7ed; color: #ea580c; }
.badge-kuning { background: #fefce8; color: #ca8a04; }
.badge-hijau  { background: #f0fdf4; color: #16a34a; }
.badge-na     { background: #f3f4f6; color: #6b7280; }

.text-center { text-align: center; }
.text-red    { color: #dc2626; }
.text-green  { color: #16a34a; }

.footer { margin-top: 10px; font-size: 7.5pt; color: #aaa;
  border-top: 1px solid #e2e8f0; padding-top: 4px; text-align: right; }
</style>
</head>
<body>

<div class="kop">
  <img src="file://{{ public_path('images/kop_surat.jpg') }}" alt="Kop SMKN 2 Cimahi">
</div>
<div class="kop-garis"></div>
<div class="judul">
  <h2>Laporan EWS Kepatuhan Guru</h2>
  <div class="sub">Periode: {{ $periodeLabel }}</div>
</div>

@if(count($rows) === 0)
  <p style="text-align:center;color:#aaa;padding:30px">Tidak ada data.</p>
@else
<table class="rekap">
  <thead>
    <tr>
      <th style="width:28px">No</th>
      <th>Nama Guru</th>
      <th style="width:90px">NIP</th>
      <th style="width:80px">Mapel Utama</th>
      <th style="width:60px">Level</th>
      <th style="width:50px">Jadwal</th>
      <th style="width:50px">Terisi</th>
      <th style="width:45px">Draft</th>
      <th style="width:45px">Kosong</th>
      <th style="width:50px">%</th>
      <th>Terakhir Login</th>
    </tr>
  </thead>
  <tbody>
    @foreach($rows as $i => $r)
    <tr>
      <td class="text-center">{{ $i + 1 }}</td>
      <td>{{ $r['nama'] }}</td>
      <td>{{ $r['nip'] }}</td>
      <td>{{ $r['mapel_utama'] }}</td>
      <td class="text-center">
        <span class="badge badge-{{ in_array($r['level'], ['merah','oranye','kuning','hijau']) ? $r['level'] : 'na' }}">
          {{ ucfirst($r['level']) }}
        </span>
      </td>
      <td class="text-center">{{ $r['total_jadwal'] }}</td>
      <td class="text-center text-green">{{ $r['total_tersubmit'] }}</td>
      <td class="text-center {{ $r['total_draft'] > 0 ? 'text-red' : '' }}">
        {{ $r['total_draft'] > 0 ? $r['total_draft'] : '—' }}
      </td>
      <td class="text-center {{ $r['total_kosong'] > 0 ? 'text-red' : '' }}">
        {{ $r['total_kosong'] > 0 ? $r['total_kosong'] : '—' }}
      </td>
      <td class="text-center {{ ($r['pct_terisi'] ?? 100) < 75 ? 'text-red' : 'text-green' }}">
        {{ $r['pct_terisi'] !== null ? $r['pct_terisi'].'%' : '—' }}
      </td>
      <td style="font-size:8pt">{{ $r['last_login_date'] ?? 'Belum pernah' }}</td>
    </tr>
    @endforeach
  </tbody>
</table>
@endif

<div class="footer">Dicetak: {{ now('Asia/Jakarta')->format('d M Y H:i') }} WIB · Aplikasi Agenda Pembelajaran SMKN 2 Cimahi</div>

</body>
</html>
