<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8">
@php
  $ps = $printSettings ?? null;
  $mTop = $ps->margin_top ?? 1; $mBottom = $ps->margin_bottom ?? 1;
  $mLeft = $ps->margin_left ?? 2; $mRight = $ps->margin_right ?? 2;
  $kopWidth = $ps->kop_width_percent ?? 100;
  $kopAlign = $ps->kop_position ?? 'center';
  $fotoPath = \App\Support\ImageDataUri::forPublicDisk($student->foto, public_path('images/default_avatar.jpg'));
@endphp
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:Arial,sans-serif; font-size:11pt; color:#1a1a1a; margin:{{ $mTop }}cm {{ $mRight }}cm {{ $mBottom }}cm {{ $mLeft }}cm; }
.judul { text-align:center; margin:10px 0 8px; }
.judul h2 { font-size:12pt; font-weight:bold; text-transform:uppercase; }
.judul p  { font-size:9pt; color:#555; margin-top:2px; }
.profil { border:1px solid #ccc; border-radius:4px; padding:8px 12px; margin-bottom:12px; background:#f8fafc; }
.profil table { width:100%; border-collapse:collapse; font-size:10pt; }
.profil td { padding:2px 0; }
.profil td:first-child { width:130px; color:#666; }
.profil td:nth-child(2) { width:10px; }
.summary-box { background:#f0f7ff; border:1px solid #bfdbfe; border-radius:4px; padding:10px 14px; margin-bottom:14px; font-size:10.5pt; }
.warn { color:#dc2626; font-weight:bold; }
.ok   { color:#16a34a; }
table.data { width:100%; border-collapse:collapse; font-size:10pt; }
table.data th { background:#1f4e79; color:white; padding:6px 8px; text-align:left; font-size:9.5pt; }
table.data td { padding:5px 8px; border-bottom:1px solid #e2e8f0; }
table.data tr:nth-child(even) td { background:#f8fafc; }
</style>
</head>
<body>

{{-- KOP SURAT --}}
<div style="text-align:{{ $kopAlign }}; margin-bottom:8px;">
  <img src="file://{{ public_path('images/kop_surat.jpg') }}" style="display:inline-block; width:{{ $kopWidth }}%; height:auto;" alt="Kop SMKN 2 Cimahi">
</div>
<div style="border-top:3px solid #000; border-bottom:1px solid #000; margin-bottom:12px;"></div>

<div class="judul">
  <h2>Rekap Nilai Aktivitas Siswa</h2>
  <p>Penilaian per Sesi KBM &mdash; Early Warning System</p>
</div>

<div class="profil">
  <table>
    <tr>
      <td rowspan="3" style="width:23mm; vertical-align:top; padding-right:3mm;">
        <img src="{{ $fotoPath }}" style="width:20mm; height:auto; border:1px solid #ccc;">
      </td>
      <td>Nama Siswa</td><td>:</td><td><strong>{{ $student->user->nama }}</strong></td>
      <td style="width:20px"></td>
      <td style="width:40px; color:#666">NIS</td><td style="width:10px">:</td>
      <td>{{ $student->nis }}</td>
    </tr>
    <tr><td>Kelas</td><td>:</td><td colspan="5">{{ $kelas }}</td></tr>
    <tr><td>Tanggal Cetak</td><td>:</td><td colspan="5">{{ $generated }} WIB</td></tr>
  </table>
</div>

<div class="summary-box">
  Total sesi dinilai: <strong>{{ $nilaiStat['count'] }} sesi</strong>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  Rata-rata:
  <strong class="{{ $nilaiStat['score'] !== null && $nilaiStat['score'] < 70 ? 'warn' : 'ok' }}">
    {{ $nilaiStat['score'] !== null ? number_format($nilaiStat['score'],1) : '(belum ada)' }}
  </strong>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  Status EWS:
  <span class="{{ $nilaiStat['warning'] ? 'warn' : 'ok' }}">
    {{ $nilaiStat['warning'] ? 'Peringatan: rata-rata di bawah 70' : 'Baik' }}
  </span>
</div>

@if($rows->isEmpty())
  <p style="text-align:center; color:#94a3b8; font-style:italic; padding:20px;">Belum ada data penilaian.</p>
@else
<table class="data">
  <thead>
    <tr>
      <th style="width:30px">No</th>
      <th style="width:90px">Tanggal</th>
      <th>Mata Pelajaran</th>
      <th style="width:80px; text-align:center">Nilai</th>
      <th style="width:120px; text-align:center">Keterangan</th>
    </tr>
  </thead>
  <tbody>
    @foreach($rows as $i => $r)
    <tr>
      <td style="text-align:center">{{ $i+1 }}</td>
      <td>{{ $r['tanggal'] }}</td>
      <td>{{ $r['mapel'] }}</td>
      <td style="text-align:center; font-weight:bold; color:{{ $r['nilai'] < 70 ? '#dc2626' : '#16a34a' }}">
        {{ $r['nilai'] }}
      </td>
      <td style="text-align:center; font-size:8.5pt; color:{{ $r['nilai'] < 70 ? '#dc2626' : '#64748b' }}">
        {{ $r['nilai'] < 70 ? 'Perlu perhatian' : 'Baik' }}
      </td>
    </tr>
    @endforeach
  </tbody>
</table>
@endif

{{-- TTD Wali Kelas (kiri) --}}
@php $waliKelas = $student->schoolClass?->waliKelas; $waliTeacher = $waliKelas ? \App\Models\Teacher::where('user_id',$waliKelas->id)->first() : null; @endphp
<div style="margin-top:20px; border-top:2px solid #1f4e79; padding-top:14px;">
  <div style="font-size:10pt; font-weight:bold; color:#1f4e79; margin-bottom:14px;">Mengetahui</div>
  <table style="width:100%; border-collapse:collapse;">
    <tr>
      <td style="width:220px; text-align:center; vertical-align:top;">
        <div style="font-size:9pt; color:#555; margin-bottom:2px;">Wali Kelas</div>
        <div style="font-size:9.5pt; font-weight:bold; margin-bottom:50px;">Wali Kelas</div>
        <div style="border-top:1px solid #333; padding-top:4px; font-size:9pt;">{{ $waliKelas?->nama ?? '................................' }}</div>
        <div style="font-size:8.5pt; color:#777;">NIP. {{ $waliTeacher?->nip ?? '................................' }}</div>
      </td>
      <td style="text-align:center; vertical-align:top; padding:0 8px;">
        <div style="font-size:9pt; color:#555; margin-bottom:2px;">Wakasek Bid. Kurikulum</div>
        <div style="font-size:9.5pt; font-weight:bold; margin-bottom:50px;">Wakasek Bid. Kurikulum</div>
        <div style="border-top:1px solid #333; padding-top:4px; font-size:9pt; display:inline-block; min-width:140px;">Kusman Subarja, S.Pd., M.T.</div>
        <div style="font-size:8.5pt; color:#777;">NIP. 197501012005011001</div>
      </td>
    </tr>
  </table>
</div>

<table style="width:100%; border-collapse:collapse; margin-top:14px; border-top:1px solid #e2e8f0;">
  <tr>
    <td style="font-size:8pt; color:#aaa; padding-top:5px;">Rekap Nilai &mdash; {{ $student->user->nama }}</td>
    <td style="font-size:8pt; color:#aaa; text-align:right; padding-top:5px;">Dicetak: {{ $generated }} WIB &nbsp;&middot;&nbsp; Sistem Agenda SMKN 2 Cimahi</td>
  </tr>
</table>

</body>
</html>
