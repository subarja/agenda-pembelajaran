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
body { font-family: Arial, sans-serif; font-size: 11pt; color: #1a1a1a; margin: {{ $mTop }}cm {{ $mRight }}cm {{ $mBottom }}cm {{ $mLeft }}cm; }

/* KOP SURAT */
.kop { text-align: {{ $kopAlign }}; margin-bottom: 8px; }
.kop img { display: inline-block; width: {{ $kopWidth }}%; height: auto; }
.kop-garis { border-top: 3px solid #000; border-bottom: 1px solid #000; margin-bottom: 12px; }

/* JUDUL */
.judul { text-align: center; margin: 14px 0 10px; }
.judul h2 { font-size: 14pt; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
.judul .periode { font-size: 10pt; margin-top: 3px; }

/* IDENTITAS GURU */
.identitas { border: 1px solid #ccc; border-radius: 4px; padding: 10px 14px; margin-bottom: 14px; }
.identitas table { width: 100%; font-size: 10.5pt; }
.identitas td { padding: 2px 0; }
.identitas td:first-child { width: 160px; color: #555; }
.identitas td:nth-child(2) { width: 10px; color: #555; }

/* TABEL JURNAL */
.tabel-jurnal { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 14px; }
.tabel-jurnal th { background: #1f4e79; color: white; padding: 6px 8px; text-align: center; font-size: 9.5pt; border: 1px solid #1f4e79; }
.tabel-jurnal td { padding: 5px 8px; border: 1px solid #d1d5db; vertical-align: top; }
.tabel-jurnal tr:nth-child(even) td { background: #f8fafc; }
.tabel-jurnal .no { text-align: center; width: 28px; }
.tabel-jurnal .tgl { width: 72px; text-align: center; }
.tabel-jurnal .hari { width: 56px; text-align: center; }
.tabel-jurnal .kelas { width: 80px; }

/* RINGKASAN */
.ringkasan { border: 1px solid #1f4e79; border-radius: 4px; padding: 10px 14px; margin-bottom: 18px; background: #f0f7ff; }
.ringkasan h3 { font-size: 10.5pt; color: #1f4e79; margin-bottom: 8px; font-weight: bold; }
.ringkasan table { width: 100%; font-size: 10pt; }
.ringkasan td { padding: 3px 0; }
.ringkasan td:first-child { width: 240px; color: #555; }
.ringkasan td:nth-child(2) { width: 10px; }
.ringkasan td:last-child { font-weight: bold; }

/* TTD — table-based agar berjajar di DomPDF */
.ttd { margin-top: 10px; }
.ttd-lokasi { font-size: 10pt; color: #555; margin-bottom: 12px; font-style: italic; }
.ttd-cell { text-align: center; padding: 0 12px; vertical-align: top; }
.ttd-cell .label { font-size: 9.5pt; color: #555; margin-bottom: 4px; }
.ttd-cell .role { font-size: 10pt; font-weight: bold; margin-bottom: 55px; }
.ttd-cell .nama { display: inline-block; border-top: 1px solid #333; padding-top: 4px; font-size: 9.5pt; min-width: 140px; }
.ttd-cell .nip { font-size: 9pt; color: #777; }

/* FOOTER */
.footer-table { width: 100%; border-collapse: collapse; margin-top: 14px; border-top: 1px solid #e2e8f0; }
.footer-table td { font-size: 8.5pt; color: #aaa; padding-top: 6px; }
</style>
</head>
<body>

{{-- KOP SURAT --}}
<div class="kop">
  <img src="file://{{ public_path('images/kop_surat.jpg') }}" alt="Kop SMKN 2 Cimahi">
</div>
<div class="kop-garis"></div>

{{-- JUDUL --}}
<div class="judul">
  <h2>Laporan Jurnal Mengajar</h2>
  <div class="periode">Periode: {{ $periode }}</div>
</div>

{{-- IDENTITAS GURU --}}
<div class="identitas">
  <table>
    <tr>
      <td>Nama Guru</td><td>:</td>
      <td><strong>{{ $guru }}</strong></td>
      <td style="width:30px"></td>
      <td style="width:120px; color:#555">NIP</td><td style="width:10px">:</td>
      <td>{{ $nip }}</td>
    </tr>
    <tr>
      <td>Mata Pelajaran</td><td>:</td>
      <td>{{ $mapel }}</td>
      <td></td>
      <td style="color:#555">Kelas yang Diampu</td><td>:</td>
      <td>{{ $kelas_label }}</td>
    </tr>
    <tr>
      <td>Tahun Ajaran</td><td>:</td>
      <td colspan="5">{{ $tahun_ajaran }}</td>
    </tr>
  </table>
</div>

{{-- TABEL PERTEMUAN --}}
<table class="tabel-jurnal">
  <thead>
    <tr>
      <th class="no">No</th>
      <th class="tgl">Tanggal</th>
      <th class="hari">Hari</th>
      <th class="kelas">Kelas</th>
      <th>Materi / Tujuan Pembelajaran</th>
      <th style="width:30%">Catatan Kegiatan KBM</th>
    </tr>
  </thead>
  <tbody>
    @forelse($rows as $i => $r)
    <tr>
      <td class="no">{{ $i + 1 }}</td>
      <td class="tgl">{{ $r['tanggal'] }}</td>
      <td class="hari">{{ $r['hari'] }}</td>
      <td class="kelas" style="font-size:9pt">{{ $r['kelas'] }}</td>
      <td style="font-size:9.5pt">
        @if($r['tp'])
          <strong>{{ $r['tp_kode'] }}</strong> — {{ $r['tp'] }}
        @else
          <span style="color:#aaa">—</span>
        @endif
      </td>
      <td style="font-size:9.5pt; color:{{ $r['resume'] ? '#1a1a1a' : '#aaa' }}">
        {{ $r['resume'] ?: '(belum diisi)' }}
      </td>
    </tr>
    @empty
    <tr>
      <td colspan="6" style="text-align:center; color:#aaa; padding:20px">
        Tidak ada agenda dalam periode ini.
      </td>
    </tr>
    @endforelse
  </tbody>
</table>

{{-- RINGKASAN OTOMATIS --}}
<div class="ringkasan">
  <h3>Ringkasan Periode</h3>
  <table>
    <tr>
      <td>Total Pertemuan dalam Periode</td><td>:</td>
      <td>{{ $ringkasan['total_pertemuan'] }} pertemuan</td>
    </tr>
    <tr>
      <td>Total Jam Mengajar</td><td>:</td>
      <td>{{ $ringkasan['total_jam'] }} jam pelajaran ({{ $ringkasan['total_jam'] }} × 45 menit)</td>
    </tr>
    <tr>
      <td>Jumlah TP yang Direncanakan (Semester)</td><td>:</td>
      <td>{{ $ringkasan['tp_direncanakan'] }} TP</td>
    </tr>
    <tr>
      <td>Jumlah TP yang Sudah Dibahas</td><td>:</td>
      <td>{{ $ringkasan['tp_dibahas'] }} TP
        @if($ringkasan['tp_direncanakan'] > 0)
          ({{ round($ringkasan['tp_dibahas'] / $ringkasan['tp_direncanakan'] * 100) }}%)
        @endif
      </td>
    </tr>
    <tr>
      <td>Pertemuan Tidak Terlaksana (Izin/Sakit/Dinas)</td><td>:</td>
      <td>{{ $ringkasan['tidak_terlaksana'] }} pertemuan</td>
    </tr>
    <tr>
      <td>Persentase Kehadiran Mengajar</td><td>:</td>
      <td>{{ $ringkasan['pct_kehadiran'] }}%</td>
    </tr>
  </table>
</div>

{{-- BLOK TTD — 3 penanda tangan berjajar --}}
<div class="ttd">
  <div class="ttd-lokasi">Cimahi, {{ now('Asia/Jakarta')->isoFormat('D MMMM YYYY') }}</div>
  <table style="width:100%; border-collapse:collapse;">
    <tr>
      <td class="ttd-cell">
        <div class="label">Dibuat oleh,</div>
        <div class="role">Guru Mata Pelajaran</div>
        <span class="nama">{{ $guru }}</span>
        <div class="nip">NIP. {{ $nip }}</div>
      </td>
      <td class="ttd-cell">
        <div class="label">Mengetahui,</div>
        <div class="role">Wakasek Bid. Kurikulum</div>
        <span class="nama">Kusman Subarja, S.Pd., M.T.</span>
        <div class="nip">NIP. 197501012005011001</div>
      </td>
      <td class="ttd-cell">
        <div class="label">Disetujui,</div>
        <div class="role">Kepala SMK Negeri 2 Cimahi</div>
        <span class="nama">................................</span>
        <div class="nip">NIP. ................................</div>
      </td>
    </tr>
  </table>
</div>

{{-- FOOTER --}}
<table class="footer-table">
  <tr>
    <td>ID Laporan: {{ $report_id }}</td>
    <td style="text-align:right;">Dicetak: {{ now('Asia/Jakarta')->format('d M Y H:i') }} WIB &nbsp;·&nbsp; Aplikasi Agenda Pembelajaran SMKN 2 Cimahi</td>
  </tr>
</table>

</body>
</html>
