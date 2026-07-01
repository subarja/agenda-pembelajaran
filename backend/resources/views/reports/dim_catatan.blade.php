<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8">
@php
  $ps = $printSettings ?? null;
  $mTop = $ps->margin_top ?? 1; $mBottom = $ps->margin_bottom ?? 1;
  $mLeft = $ps->margin_left ?? 2; $mRight = $ps->margin_right ?? 2;
  $kopWidth = $ps->kop_width_percent ?? 100;
  $kopAlign = $ps->kop_position ?? 'center';
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
.summary-box { background:#fefce8; border:1px solid #fde68a; border-radius:4px; padding:10px 14px; margin-bottom:14px; font-size:10.5pt; }
.warn { color:#dc2626; font-weight:bold; }
.ok   { color:#16a34a; }
.note-card { border:1px solid #e2e8f0; border-radius:4px; margin-bottom:10px; overflow:hidden; }
.note-header { background:#1f4e79; color:white; padding:6px 10px; font-size:9.5pt; }
.note-body { padding:8px 10px; font-size:10pt; }
.note-meta { font-size:8.5pt; color:#666; margin-bottom:4px; }
.note-isi { line-height:1.5; margin-bottom:4px; }
.note-tl { background:#f0fdf4; border-left:3px solid #16a34a; padding:4px 8px; font-size:9.5pt; margin-top:6px; }
.note-tl .label { font-size:8pt; color:#16a34a; font-weight:bold; }
.kat-badge { display:inline-block; padding:1px 8px; border-radius:3px; font-size:8pt; background:#dbeafe; color:#1e40af; }
</style>
</head>
<body>

{{-- KOP SURAT --}}
<div style="text-align:{{ $kopAlign }}; margin-bottom:8px;">
  <img src="file://{{ public_path('images/kop_surat.jpg') }}" style="display:inline-block; width:{{ $kopWidth }}%; height:auto;" alt="Kop SMKN 2 Cimahi">
</div>
<div style="border-top:3px solid #000; border-bottom:1px solid #000; margin-bottom:12px;"></div>

<div class="judul">
  <h2>Riwayat Catatan KBM Siswa</h2>
  <p>Rekap Catatan dari Guru &mdash; Early Warning System</p>
</div>

<div class="profil">
  <table>
    <tr>
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
  Total catatan:
  <strong class="{{ $catatanStat['count'] >= 3 ? 'warn' : 'ok' }}">{{ $catatanStat['count'] }} catatan</strong>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  Status EWS:
  <span class="{{ $catatanStat['warning'] ? 'warn' : 'ok' }}">
    {{ $catatanStat['warning'] ? 'Peringatan: melebihi batas (>= 3 catatan)' : 'Baik' }}
  </span>
</div>

@if($rows->isEmpty())
  <p style="text-align:center; color:#94a3b8; font-style:italic; padding:20px;">Belum ada catatan KBM.</p>
@else
  @foreach($rows as $i => $r)
  <div class="note-card">
    <div class="note-header">
      <table style="width:100%; border-collapse:collapse;">
        <tr>
          <td>Catatan #{{ $i+1 }} &nbsp;&middot;&nbsp; {{ $r['tanggal'] }}</td>
          <td style="text-align:right;">
            <span class="kat-badge" style="background:rgba(255,255,255,0.25); color:white;">{{ ucfirst($r['kategori']) }}</span>
          </td>
        </tr>
      </table>
    </div>
    <div class="note-body">
      <div class="note-meta">Dicatat oleh: {{ $r['oleh'] }}</div>
      <div class="note-isi">{{ $r['isi'] }}</div>
      @if($r['tindak_lanjut'])
      <div class="note-tl">
        <div class="label">Tindak Lanjut:</div>
        <div>{{ $r['tindak_lanjut'] }}</div>
      </div>
      @endif
    </div>
  </div>
  @endforeach
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
    <td style="font-size:8pt; color:#aaa; padding-top:5px;">Catatan KBM &mdash; {{ $student->user->nama }}</td>
    <td style="font-size:8pt; color:#aaa; text-align:right; padding-top:5px;">Dicetak: {{ $generated }} WIB &nbsp;&middot;&nbsp; Sistem Agenda SMKN 2 Cimahi</td>
  </tr>
</table>

</body>
</html>
