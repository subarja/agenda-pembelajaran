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

.judul { text-align: center; margin-bottom: 10px; }
.judul h2 { font-size: 12pt; font-weight: bold; text-transform: uppercase; }
.judul .sub { font-size: 10pt; margin-top: 2px; }

.identitas { margin-bottom: 10px; }
.identitas table { font-size: 10pt; border-collapse: collapse; }
.identitas td { padding: 1px 0; vertical-align: top; }
.identitas td:first-child { width: 140px; }
.identitas td:nth-child(2) { width: 10px; }

.sheet-title { font-size: 10.5pt; font-weight: bold; margin: 14px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }

table.rekap { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 6px; }
table.rekap th { background: #1f4e79; color: white; padding: 5px 7px; text-align: center; border: 1px solid #1f4e79; }
table.rekap td { padding: 4px 7px; border: 1px solid #d1d5db; vertical-align: top; }
table.rekap tr:nth-child(even) td { background: #f8fafc; }
table.rekap tfoot td { font-weight: bold; background: #e8f0fe; }
.text-center { text-align: center; }
.text-red { color: #dc2626; font-weight: 600; }
.text-green { color: #16a34a; font-weight: 600; }

.ttd-table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 9.5pt; }
.ttd-cell { text-align: center; padding: 0 10px; vertical-align: top; }
.ttd-cell .ttd-role { font-weight: bold; margin-bottom: 48px; }
.ttd-cell .ttd-nama { display: inline-block; border-top: 1px solid #333; padding-top: 3px; min-width: 140px; font-weight: bold; }
.ttd-cell .ttd-nip { font-size: 9pt; color: #555; }

.page-break { page-break-before: always; }
.footer { margin-top: 10px; font-size: 8pt; color: #aaa; border-top: 1px solid #e2e8f0; padding-top: 5px; text-align: right; }
</style>
</head>
<body>

{{-- KOP & Judul --}}
<div class="kop">
  <img src="file://{{ public_path('images/kop_surat.jpg') }}" alt="Kop SMKN 2 Cimahi">
</div>
<div class="kop-garis"></div>
<div class="judul">
  <h2>Analisis Minggu Efektif</h2>
  <div class="sub">{{ $ayLabel }}</div>
</div>

@forelse($sheets as $idx => $sheet)
  {{-- Penanda tangan: kalau $signatures dikirim global (export kelas/umum, 2 penanda
       tangan Wk. Kurikulum + Kepala Sekolah), pakai itu. Kalau tidak, ini export guru
       sendiri — 1 penanda tangan pakai identitas guru di sheet ybs. --}}
  @php
    $sigs = $signatures ?? [[
      'role' => 'Guru Mata Pelajaran',
      'nama_line' => $sheet['nama_guru'] ?? '-',
      'nip_line' => 'NIP. ' . ($sheet['nip_guru'] ?? '-'),
    ]];
  @endphp

  @if($idx > 0)
  <div class="page-break"></div>
  @endif

  @if(isset($sheet['nama_guru']))
  <div class="identitas" style="margin-top:12px">
    <table>
      <tr><td>Nama Guru</td><td>:</td><td><strong>{{ $sheet['nama_guru'] }}</strong></td></tr>
      <tr><td>NIP</td><td>:</td><td>{{ $sheet['nip_guru'] }}</td></tr>
    </table>
  </div>
  @endif

  <div class="sheet-title">{{ $sheet['class_label'] }} — {{ $sheet['mapel'] }}</div>

  <table class="rekap">
    <thead>
      <tr>
        <th style="width:28px">No</th>
        <th>Bulan</th>
        <th style="width:60px">Jml Minggu</th>
        <th style="width:60px">Efektif</th>
        <th style="width:70px">Tdk Efektif</th>
        <th>Keterangan</th>
      </tr>
    </thead>
    <tbody>
      @foreach($sheet['bulan'] as $b)
      <tr>
        <td class="text-center">{{ $b['no'] }}</td>
        <td>{{ $b['bulan'] }}</td>
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
        <td class="text-center">{{ $sheet['total_minggu'] }}</td>
        <td class="text-center text-green">{{ $sheet['total_efektif'] }}</td>
        <td class="text-center text-red">{{ $sheet['total_tidak_efektif'] ?: '—' }}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  {{-- TTD per sheet — kalau >1 penanda tangan, berjajar horizontal (bukan ke bawah) --}}
  <table class="ttd-table">
    <tr>
      <td style="width:{{ count($sigs) > 1 ? 15 : 60 }}%"></td>
      <td class="ttd-cell" colspan="{{ count($sigs) }}">Cimahi, {{ $tanggalCetak }}</td>
    </tr>
    <tr>
      <td></td>
      @foreach($sigs as $sig)
      <td class="ttd-cell">
        <div class="ttd-role">{{ $sig['role'] }},</div>
        <span class="ttd-nama">{{ $sig['nama_line'] }}</span>
        <div class="ttd-nip">{{ $sig['nip_line'] }}</div>
      </td>
      @endforeach
    </tr>
  </table>

  <div class="footer">Dicetak: {{ now('Asia/Jakarta')->format('d M Y H:i') }} WIB · Aplikasi Agenda Pembelajaran SMKN 2 Cimahi</div>

@empty
  <p style="text-align:center; color:#aaa; padding:30px">Tidak ada data jadwal aktif.</p>
@endforelse

</body>
</html>
