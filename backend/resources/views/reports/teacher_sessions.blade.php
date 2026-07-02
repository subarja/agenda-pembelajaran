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
  $fotoPath = $teacher->user->foto ? \Illuminate\Support\Facades\Storage::disk('public')->path($teacher->user->foto) : public_path('images/default_avatar.jpg');
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

.identitas { margin-bottom: 10px; font-size: 9pt; }
.identitas td { padding: 1px 4px; }
.identitas td.label { font-weight: bold; width: 130px; }

table.rekap { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 8px; }
table.rekap th { background: #1f4e79; color: white; padding: 4px 6px; text-align: center;
  border: 1px solid #1f4e79; }
table.rekap td { padding: 3px 6px; border: 1px solid #d1d5db; vertical-align: middle; }
table.rekap tr:nth-child(even) td { background: #f8fafc; }

.badge { display: inline-block; padding: 1px 6px; border-radius: 20px; font-size: 8pt; font-weight: bold; }
.badge-submitted { background: #f0fdf4; color: #16a34a; }
.badge-draft     { background: #fefce8; color: #ca8a04; }
.badge-kosong    { background: #fef2f2; color: #dc2626; }

.text-center { text-align: center; }
.log-text { font-size: 7.5pt; color: #555; }

.legend { margin-top: 12px; font-size: 7.5pt; color: #555; border-top: 1px solid #e2e8f0; padding-top: 6px; }
.legend-title { font-weight: bold; margin-bottom: 3px; color: #333; }
.legend ul { list-style: none; }
.legend li { margin-bottom: 2px; }

.ttd-table { width: 100%; border-collapse: collapse; margin-top: 22px; font-size: 9.5pt; }
.ttd-cell { width: 50%; text-align: center; padding: 0 30px; vertical-align: top; }
.ttd-cell .ttd-role { font-weight: bold; margin-bottom: 48px; }
.ttd-cell .ttd-nama { display: inline-block; border-top: 1px solid #333; padding-top: 3px; min-width: 160px; font-weight: bold; }
.ttd-cell .ttd-nip { font-size: 9pt; color: #555; }

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
  <h2>Detail Pengisian Agenda Guru</h2>
  <div class="sub">Periode: {{ $periodeLabel }}</div>
</div>

<table class="identitas">
  <tr>
    <td rowspan="3" style="width:23mm; vertical-align:top; padding-right:3mm;">
      <img src="file://{{ $fotoPath }}" style="width:20mm; height:auto; border:1px solid #ccc;">
    </td>
    <td class="label">Nama Guru</td><td>: {{ $teacher->user->nama }}</td>
  </tr>
  <tr><td class="label">NIP</td><td>: {{ $teacher->nip ?? '—' }}</td></tr>
  <tr><td class="label">Mapel Utama</td><td>: {{ $teacher->mapel_utama ?? '—' }}</td></tr>
</table>

@if(count($rows) === 0)
  <p style="text-align:center;color:#aaa;padding:30px">Guru ini tidak memiliki jadwal aktif pada periode tersebut.</p>
@else
<table class="rekap">
  <thead>
    <tr>
      <th style="width:26px">No</th>
      <th style="width:75px">Tanggal</th>
      <th style="width:55px">Hari</th>
      <th style="width:70px">Jam</th>
      <th>Kelas</th>
      <th>Mata Pelajaran</th>
      <th style="width:55px">Status</th>
      <th style="width:170px">Diisi Pada</th>
    </tr>
  </thead>
  <tbody>
    @foreach($rows as $i => $r)
    <tr>
      <td class="text-center">{{ $i + 1 }}</td>
      <td class="text-center">{{ \Carbon\Carbon::parse($r['tanggal'])->locale('id')->isoFormat('DD/MM/YYYY') }}</td>
      <td class="text-center">{{ $r['hari'] }}</td>
      <td class="text-center">{{ $r['jam'] }}</td>
      <td>{{ $r['kelas'] }}</td>
      <td>{{ $r['mapel'] }}</td>
      <td class="text-center">
        <span class="badge badge-{{ $r['status'] }}">
          {{ $r['status'] === 'submitted' ? 'Terisi' : ($r['status'] === 'draft' ? 'Draft' : 'Kosong') }}
        </span>
      </td>
      <td class="log-text">
        @if($r['status'] === 'kosong')
          —
        @elseif(!$r['log'])
          Belum tercatat (sebelum fitur log aktif)
        @else
          {{ $r['log']['aksi'] }} {{ $r['log']['waktu'] }}<br>IP {{ $r['log']['ip'] }}
        @endif
      </td>
    </tr>
    @endforeach
  </tbody>
</table>
@endif

<div class="legend">
  <div class="legend-title">Keterangan Kolom</div>
  <ul>
    <li>Status Terisi/Draft/Kosong mengikuti status agenda yang guru simpan di halaman Agenda Pembelajaran.</li>
    <li>Kolom "Diisi Pada" diambil dari log audit yang mencatat waktu &amp; alamat IP setiap kali agenda dibuat/diubah — hanya tersedia untuk pengisian sejak fitur ini aktif (2026-07-02). Agenda lama tetap tampil statusnya tapi log-nya "Belum tercatat".</li>
  </ul>
</div>

{{-- Validasi: Mengetahui + Kepala Sekolah di kiri, Cimahi+tanggal + Wk. Kurikulum
     di kanan — sama seperti laporan EWS Guru (daftar). --}}
@if(!empty($signatures))
<table class="ttd-table">
  <tr>
    <td class="ttd-cell"></td>
    <td class="ttd-cell">Cimahi, {{ $tanggalCetak }}</td>
  </tr>
  <tr>
    <td class="ttd-cell">
      <div class="ttd-role">Mengetahui,<br>{{ $signatures['kepala_sekolah']['role'] }}</div>
      <span class="ttd-nama">{{ $signatures['kepala_sekolah']['nama_line'] }}</span>
      <div class="ttd-nip">{{ $signatures['kepala_sekolah']['nip_line'] }}</div>
    </td>
    <td class="ttd-cell">
      <div class="ttd-role">{{ $signatures['wk_kurikulum']['role'] }},</div>
      <span class="ttd-nama">{{ $signatures['wk_kurikulum']['nama_line'] }}</span>
      <div class="ttd-nip">{{ $signatures['wk_kurikulum']['nip_line'] }}</div>
    </td>
  </tr>
</table>
@endif

<div class="footer">Dicetak: {{ now('Asia/Jakarta')->format('d M Y H:i') }} WIB · Aplikasi Agenda Pembelajaran SMKN 2 Cimahi</div>

</body>
</html>
