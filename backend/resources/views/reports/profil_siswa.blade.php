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
  $levelStyle = match($level) {
    'merah'  => 'background:#fee2e2; color:#991b1b;',
    'oranye' => 'background:#ffedd5; color:#9a3412;',
    'kuning' => 'background:#fef9c3; color:#854d0e;',
    default  => 'background:#dcfce7; color:#166534;',
  };
@endphp
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:Arial,sans-serif; font-size:10.5pt; color:#1a1a1a; margin:{{ $mTop }}cm {{ $mRight }}cm {{ $mBottom }}cm {{ $mLeft }}cm; }
.judul { text-align:center; margin:10px 0 8px; }
.judul h2 { font-size:12pt; font-weight:bold; text-transform:uppercase; }
.judul p  { font-size:9pt; color:#555; margin-top:2px; }
.profil { border:1px solid #ccc; border-radius:4px; padding:8px 12px; margin-bottom:10px; background:#f8fafc; }
.profil table { width:100%; border-collapse:collapse; font-size:9.5pt; }
.profil td { padding:2px 0; }
.profil td.k { width:110px; color:#666; }
.profil td.t { width:10px; }
.summary-box { background:#f0f7ff; border:1px solid #bfdbfe; border-radius:4px; padding:8px 12px; margin-bottom:10px; }
.summary-box table { width:100%; border-collapse:collapse; font-size:9.5pt; }
.summary-box td { padding:2px 0; }
.warn { color:#dc2626; font-weight:bold; }
.ok   { color:#16a34a; }
h3.seksi { font-size:10pt; color:#1f4e79; margin:10px 0 5px; border-bottom:1px solid #cbd5e1; padding-bottom:2px; }
table.data { width:100%; border-collapse:collapse; font-size:9pt; }
table.data th { background:#1f4e79; color:white; padding:4px 7px; text-align:left; font-size:8.5pt; }
table.data td { padding:3.5px 7px; border-bottom:1px solid #e2e8f0; }
table.data tr:nth-child(even) td { background:#f8fafc; }
.kosong { text-align:center; color:#94a3b8; font-style:italic; padding:8px; font-size:9pt; }
</style>
</head>
<body>

{{-- KOP SURAT --}}
<div style="text-align:{{ $kopAlign }}; margin-bottom:8px;">
  <img src="file://{{ public_path('images/kop_surat.jpg') }}" style="display:inline-block; width:{{ $kopWidth }}%; height:auto;" alt="Kop SMKN 2 Cimahi">
</div>
<div style="border-top:3px solid #000; border-bottom:1px solid #000; margin-bottom:10px;"></div>

<div class="judul">
  <h2>Profil Siswa</h2>
  <p>{{ $ayLabel }} &mdash; Bahan Konseling &amp; Pembinaan</p>
</div>

<div class="profil">
  <table>
    <tr>
      <td rowspan="5" style="width:23mm; vertical-align:top; padding-right:3mm;">
        <img src="{{ $fotoPath }}" style="width:20mm; height:auto; border:1px solid #ccc;">
      </td>
      <td class="k">Nama Siswa</td><td class="t">:</td><td><strong>{{ $student->user->nama }}</strong></td>
      <td style="width:16px"></td>
      <td class="k">Kelas</td><td class="t">:</td><td>{{ $kelas }}</td>
    </tr>
    <tr>
      <td class="k">NIS / NISN</td><td class="t">:</td><td>{{ $student->nis ?? '—' }} / {{ $student->nisn ?? '—' }}</td>
      <td></td>
      <td class="k">Jenis Kelamin</td><td class="t">:</td><td>{{ $student->jenis_kelamin === 'L' ? 'Laki-laki' : ($student->jenis_kelamin === 'P' ? 'Perempuan' : '—') }}</td>
    </tr>
    <tr>
      <td class="k">Nama Ayah</td><td class="t">:</td><td>{{ $student->nama_ayah ?? '—' }}</td>
      <td></td>
      <td class="k">Nama Ibu</td><td class="t">:</td><td>{{ $student->nama_ibu ?? '—' }}</td>
    </tr>
    <tr>
      <td class="k">Kontak Orang Tua</td><td class="t">:</td><td>{{ $student->hp_ortu ?? '—' }}</td>
      <td></td>
      <td class="k">Wali</td><td class="t">:</td><td>{{ $student->wali_nama ? "{$student->wali_nama} ({$student->wali_kontak})" : '—' }}</td>
    </tr>
    <tr>
      <td class="k">Tanggal Cetak</td><td class="t">:</td><td colspan="5">{{ $generated }} WIB</td>
    </tr>
  </table>
</div>

<div class="summary-box">
  <table>
    <tr>
      <td style="width:120px; color:#555;">Status EWS</td>
      <td>: <span style="display:inline-block; padding:1px 10px; border-radius:3px; font-weight:bold; font-size:9pt; {{ $levelStyle }}">{{ strtoupper($level) }}</span></td>
      <td style="width:16px"></td>
      <td style="width:130px; color:#555;">Kehadiran</td>
      <td>: <span class="{{ $kehadiran['warning'] ? 'warn' : 'ok' }}">{{ number_format($kehadiran['score'], 1) }}%</span> ({{ $kehadiran['hadir'] }}/{{ $kehadiran['total'] }} sesi, alpha {{ $kehadiran['alpha'] }})</td>
    </tr>
    <tr>
      <td style="color:#555;">Poin Karakter</td>
      <td>: <span class="{{ $karakter['warning'] ? 'warn' : 'ok' }}">{{ $karakter['score'] }}</span> ({{ $karakter['count'] }} catatan)</td>
      <td></td>
      <td style="color:#555;">Catatan Perilaku</td>
      <td>: <span class="{{ $catatan['warning'] ? 'warn' : '' }}">{{ $catatan['count'] }} catatan</span></td>
    </tr>
    <tr>
      <td style="color:#555;">Rata-rata Nilai</td>
      <td>: <span class="{{ $nilai['warning'] ? 'warn' : 'ok' }}">{{ $nilai['score'] !== null ? number_format($nilai['score'], 1) : '—' }}</span> ({{ $nilai['count'] }} penilaian)</td>
      <td></td>
      <td style="color:#555;">Rekomendasi Aktif</td>
      <td>: {{ $rekomendasi->count() }} tindakan</td>
    </tr>
  </table>
</div>

<h3 class="seksi">Riwayat Poin Karakter Terakhir</h3>
@if($riwayatKarakter->isEmpty())
  <p class="kosong">Belum ada catatan karakter pada tahun ajaran ini.</p>
@else
<table class="data">
  <thead>
    <tr>
      <th style="width:24px">No</th>
      <th style="width:70px">Tanggal</th>
      <th>Karakter</th>
      <th style="width:42px; text-align:center;">Poin</th>
      <th style="width:150px">Guru Pencatat</th>
    </tr>
  </thead>
  <tbody>
    @foreach($riwayatKarakter as $i => $r)
    <tr>
      <td style="text-align:center">{{ $i + 1 }}</td>
      <td>{{ $r['tanggal'] }}</td>
      <td>{{ $r['item'] }}</td>
      <td style="text-align:center;" class="{{ $r['poin'] < 0 ? 'warn' : 'ok' }}">{{ $r['poin'] > 0 ? '+' : '' }}{{ $r['poin'] }}</td>
      <td>{{ $r['guru'] }}</td>
    </tr>
    @endforeach
  </tbody>
</table>
@endif

<h3 class="seksi">Rekomendasi Tindakan Aktif</h3>
@if($rekomendasi->isEmpty())
  <p class="kosong">Tidak ada rekomendasi tindakan yang sedang berjalan.</p>
@else
<table class="data">
  <thead>
    <tr>
      <th style="width:24px">No</th>
      <th style="width:70px">Tanggal</th>
      <th>Rekomendasi</th>
      <th style="width:120px">Status</th>
    </tr>
  </thead>
  <tbody>
    @foreach($rekomendasi as $i => $r)
    <tr>
      <td style="text-align:center">{{ $i + 1 }}</td>
      <td>{{ $r['tanggal'] }}</td>
      <td>{{ $r['rekomendasi'] }}</td>
      <td>{{ $r['status'] }}</td>
    </tr>
    @endforeach
  </tbody>
</table>
@endif

{{-- TTD Wali Kelas (kiri) + Wakasek (kanan) --}}
@php $waliKelas = $student->schoolClass?->waliKelas; $waliTeacher = $waliKelas ? \App\Models\Teacher::where('user_id', $waliKelas->id)->first() : null; @endphp
<div style="margin-top:16px; border-top:2px solid #1f4e79; padding-top:12px;">
  <div style="font-size:10pt; font-weight:bold; color:#1f4e79; margin-bottom:12px;">Mengetahui</div>
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

{{-- Footer --}}
<table style="width:100%; border-collapse:collapse; margin-top:12px; border-top:1px solid #e2e8f0;">
  <tr>
    <td style="font-size:8pt; color:#aaa; padding-top:5px;">Profil Siswa &mdash; {{ $student->user->nama }}</td>
    <td style="font-size:8pt; color:#aaa; text-align:right; padding-top:5px;">Dicetak: {{ $generated }} WIB &nbsp;&middot;&nbsp; Sistem Agenda SMKN 2 Cimahi</td>
  </tr>
</table>

</body>
</html>
