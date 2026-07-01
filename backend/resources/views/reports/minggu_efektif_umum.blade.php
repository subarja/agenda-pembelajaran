<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
@php
  $ps = $printSettings ?? null;
  $mTop = $ps->margin_top ?? 1.5; $mBottom = $ps->margin_bottom ?? 1.5;
  $mLeft = $ps->margin_left ?? 2.0; $mRight = $ps->margin_right ?? 2.0;
  $kopWidth = $ps->kop_width_percent ?? 100;
  $kopAlign = $ps->kop_position ?? 'center';
@endphp
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; font-size: 10pt; color: #1a1a1a; margin: {{ $mTop }}cm {{ $mRight }}cm {{ $mBottom }}cm {{ $mLeft }}cm; }

.kop { text-align: {{ $kopAlign }}; margin-bottom: 6px; }
.kop img { display: inline-block; width: {{ $kopWidth }}%; height: auto; }
.kop-garis { border-top: 3px solid #000; border-bottom: 1px solid #000; margin-bottom: 10px; }

.judul { text-align: center; margin-bottom: 14px; }
.judul h2 { font-size: 12pt; font-weight: bold; text-transform: uppercase; }
.judul .sub { font-size: 10pt; margin-top: 2px; }

.note { font-size: 9pt; color: #555; margin-bottom: 10px;
  background: #f0f9ff; border: 1px solid #bae6fd; padding: 6px 10px; border-radius: 4px; }

table.rekap { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 6px; }
table.rekap th { background: #1f4e79; color: white; padding: 5px 7px; text-align: center;
  border: 1px solid #1f4e79; }
table.rekap td { padding: 4px 7px; border: 1px solid #d1d5db; vertical-align: top; }
table.rekap tr:nth-child(even) td { background: #f8fafc; }
table.rekap tfoot td { font-weight: bold; background: #e8f0fe; }
.text-center { text-align: center; }
.text-red   { color: #dc2626; font-weight: 600; }
.text-green { color: #16a34a; font-weight: 600; }

.ttd-table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 9.5pt; }
.ttd-cell { text-align: center; padding: 0 10px; vertical-align: top; }
.ttd-cell .ttd-role { font-weight: bold; margin-bottom: 48px; }
.ttd-cell .ttd-nama { display: inline-block; border-top: 1px solid #333; padding-top: 3px; min-width: 140px; font-weight: bold; }
.ttd-cell .ttd-nip { font-size: 9pt; color: #555; }

.footer { margin-top: 12px; font-size: 8pt; color: #aaa;
  border-top: 1px solid #e2e8f0; padding-top: 5px; text-align: right; }
</style>
</head>
<body>

<div class="kop">
  <img src="file://{{ public_path('images/kop_surat.jpg') }}" alt="Kop SMKN 2 Cimahi">
</div>
<div class="kop-garis"></div>
<div class="judul">
  <h2>Analisis Minggu Efektif Umum Sekolah</h2>
  <div class="sub">{{ $ayLabel }}</div>
</div>

<div class="note">
  Catatan: Minggu dihitung <strong>Tidak Efektif</strong> apabila lebih dari 3 (tiga) hari sekolah (Senin–Jumat)
  dalam minggu tersebut jatuh pada hari yang ditetapkan sebagai Hari Tidak Efektif.
</div>

@if(count($bulan) === 0)
  <p style="text-align:center;color:#aaa;padding:30px">Tidak ada data untuk semester ini.</p>
@else
<table class="rekap">
  <thead>
    <tr>
      <th style="width:28px">No</th>
      <th>Bulan</th>
      <th style="width:60px">Minggu</th>
      <th style="width:60px">Efektif</th>
      <th style="width:70px">Tidak Efektif</th>
      <th>Keterangan</th>
    </tr>
  </thead>
  <tbody>
    @foreach($bulan as $b)
    <tr>
      <td class="text-center">{{ $b['no'] }}</td>
      <td><strong>{{ $b['bulan'] }}</strong></td>
      <td class="text-center">{{ $b['jumlah_minggu'] }}</td>
      <td class="text-center text-green">{{ $b['efektif'] }}</td>
      <td class="text-center {{ $b['tidak_efektif'] > 0 ? 'text-red' : '' }}">
        {{ $b['tidak_efektif'] > 0 ? $b['tidak_efektif'] : '—' }}
      </td>
      <td style="font-size:9pt; white-space:pre-line">{{ $b['keterangan'] !== '-' ? $b['keterangan'] : '' }}</td>
    </tr>
    @endforeach
  </tbody>
  <tfoot>
    <tr>
      <td class="text-center" colspan="2">Jumlah</td>
      <td class="text-center">{{ $total['total_minggu'] }}</td>
      <td class="text-center text-green">{{ $total['total_efektif'] }}</td>
      <td class="text-center text-red">{{ $total['total_tidak_efektif'] ?: '—' }}</td>
      <td></td>
    </tr>
  </tfoot>
</table>

{{-- TTD 2 penanda tangan berjajar: Wk. Kurikulum + Kepala Sekolah --}}
<table class="ttd-table">
  <tr>
    <td style="width:15%"></td>
    <td class="ttd-cell" colspan="{{ count($signatures) }}">Cimahi, {{ $tanggalCetak }}</td>
  </tr>
  <tr>
    <td></td>
    @foreach($signatures as $sig)
    <td class="ttd-cell">
      <div class="ttd-role">{{ $sig['role'] }},</div>
      <span class="ttd-nama">{{ $sig['nama_line'] }}</span>
      <div class="ttd-nip">{{ $sig['nip_line'] }}</div>
    </td>
    @endforeach
  </tr>
</table>
@endif

<div class="footer">Dicetak: {{ now('Asia/Jakarta')->format('d M Y H:i') }} WIB · Aplikasi Agenda Pembelajaran SMKN 2 Cimahi</div>

</body>
</html>
