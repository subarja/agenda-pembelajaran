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
  $fotoPath = $student->foto ? \Illuminate\Support\Facades\Storage::disk('public')->path($student->foto) : public_path('images/default_avatar.jpg');
@endphp
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; font-size: 11pt; color: #1a1a1a; margin: {{ $mTop }}cm {{ $mRight }}cm {{ $mBottom }}cm {{ $mLeft }}cm; }

.judul { text-align: center; margin: 12px 0 10px; }
.judul h2 { font-size: 13pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
.judul p  { font-size: 9.5pt; color: #555; margin-top: 3px; }

.profil-siswa { border: 1px solid #ccc; border-radius: 4px; padding: 10px 14px; margin-bottom: 14px; background: #f8fafc; }
.profil-siswa table { width: 100%; font-size: 10.5pt; border-collapse: collapse; }
.profil-siswa td { padding: 2px 0; }
.profil-siswa td:first-child { width: 140px; color: #666; }
.profil-siswa td:nth-child(2) { width: 10px; }

.rek-block { margin-bottom: 20px; }
.rek-header { background: #1f4e79; color: white; padding: 7px 12px; border-radius: 4px 4px 0 0; font-size: 10pt; font-weight: bold; }
.rek-header .level { font-weight: normal; font-size: 9pt; opacity: 0.85; }
.rek-body { border: 1px solid #c8d5e3; border-top: none; border-radius: 0 0 4px 4px; padding: 10px 12px; }
.rek-info { font-size: 9.5pt; color: #555; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
.rek-info span { margin-right: 20px; }
.rek-teks { font-size: 10pt; font-weight: bold; color: #1f4e79; margin-bottom: 8px; }
.catatan-admin { background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 8px 10px; margin-bottom: 8px; font-size: 9.5pt; }
.catatan-admin .label { font-weight: bold; color: #92400e; font-size: 8.5pt; }
.handlers { margin-bottom: 8px; font-size: 9.5pt; }
.handlers .label { font-weight: bold; color: #555; }
.sesi-list { margin-top: 8px; }
.sesi-item { border-left: 3px solid #1f4e79; padding: 7px 10px; margin-bottom: 8px; background: #f8fafc; border-radius: 0 4px 4px 0; }
.sesi-meta { font-size: 8.5pt; color: #666; margin-bottom: 4px; }
.sesi-meta strong { color: #1a1a1a; }
.sesi-catatan { font-size: 9.5pt; line-height: 1.5; }
.sesi-links { margin-top: 4px; font-size: 8.5pt; color: #2563eb; }
.status-badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 8.5pt; font-weight: bold; }
.status-pending  { background: #fee2e2; color: #991b1b; }
.status-proses   { background: #fef9c3; color: #854d0e; }
.status-menunggu { background: #dbeafe; color: #1e40af; }
.status-selesai  { background: #dcfce7; color: #166534; }
.no-data { text-align: center; color: #94a3b8; font-style: italic; padding: 16px; font-size: 9.5pt; }
.warn-txt { color: #dc2626; font-size: 8pt; }
.ok-txt   { color: #16a34a; font-size: 8pt; }
</style>
</head>
<body>

{{-- KOP SURAT --}}
<div style="text-align:{{ $kopAlign }}; margin-bottom:8px;">
  <img src="file://{{ public_path('images/kop_surat.jpg') }}" style="display:inline-block; width:{{ $kopWidth }}%; height:auto;" alt="Kop SMKN 2 Cimahi">
</div>
<div style="border-top:3px solid #000; border-bottom:1px solid #000; margin-bottom:12px;"></div>

<div class="judul">
  <h2>Riwayat Penanganan Siswa Bermasalah</h2>
  <p>Dokumen Tindak Lanjut Early Warning System (EWS)</p>
</div>

{{-- Profil Siswa --}}
<div class="profil-siswa">
  <table>
    <tr>
      <td rowspan="3" style="width:23mm; vertical-align:top; padding-right:3mm;">
        <img src="file://{{ $fotoPath }}" style="width:20mm; height:auto; border:1px solid #ccc;">
      </td>
      <td>Nama Siswa</td><td>:</td>
      <td><strong>{{ $student->user->nama }}</strong></td>
      <td style="width:20px"></td>
      <td style="width:80px; color:#666">NIS</td><td style="width:10px">:</td>
      <td>{{ $student->nis }}</td>
    </tr>
    <tr>
      <td>Kelas</td><td>:</td>
      <td>{{ $student->schoolClass ? $student->schoolClass->tingkat->value . ' ' . $student->schoolClass->jurusan . ' - ' . $student->schoolClass->rombel : '-' }}</td>
      <td></td>
      <td style="color:#666">Wali Kelas</td><td>:</td>
      <td>{{ $wali?->nama ?? '-' }}</td>
    </tr>
    <tr>
      <td>Tanggal Cetak</td><td>:</td>
      <td colspan="5">{{ $generated }} WIB</td>
    </tr>
  </table>
</div>

{{-- Rekap EWS 4 Dimensi (table layout, DomPDF safe) --}}
@if(isset($ews))
@php
  $levelColor = match($ews['level']) { 'merah'=>'#dc2626','oranye'=>'#ea580c','kuning'=>'#ca8a04',default=>'#16a34a' };
  $levelLabel = match($ews['level']) { 'merah'=>'Kritis','oranye'=>'Waspada','kuning'=>'Perhatian',default=>'Normal' };
@endphp
<div style="margin-bottom: 16px; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden;">
  <table style="width: 100%; border-collapse: collapse; background: #f8fafc;">
    <tr>
      <td colspan="4" style="padding: 7px 12px; border-bottom: 1px solid #cbd5e1;">
        <span style="font-size: 10pt; font-weight: bold; color: #1f4e79;">Rekap Early Warning System</span>
        &nbsp;&nbsp;
        <span style="background: {{ $levelColor }}; color: white; font-size: 8.5pt; font-weight: bold; padding: 2px 9px; border-radius: 3px;">
          {{ strtoupper($ews['level']) }} &mdash; {{ $levelLabel }}
        </span>
      </td>
    </tr>
    <tr style="background: white;">
      <td style="width: 25%; text-align: center; padding: 10px 6px; border-right: 1px solid #e2e8f0;">
        <div style="font-size: 17pt; font-weight: bold; color: {{ $ews['kehadiran'] < 80 ? '#dc2626' : '#16a34a' }};">
          {{ $ews['kehadiran'] }}%
        </div>
        <div style="font-size: 8.5pt; color: #64748b; margin-top: 2px;">Kehadiran</div>
        @if($ews['kehadiran'] < 80)
          <div class="warn-txt">Peringatan: &lt; 80%</div>
        @else
          <div class="ok-txt">Baik</div>
        @endif
      </td>
      <td style="width: 25%; text-align: center; padding: 10px 6px; border-right: 1px solid #e2e8f0;">
        <div style="font-size: 17pt; font-weight: bold; color: {{ $ews['karakter'] < 0 ? '#dc2626' : '#16a34a' }};">
          {{ $ews['karakter'] >= 0 ? '+' : '' }}{{ $ews['karakter'] }}
        </div>
        <div style="font-size: 8.5pt; color: #64748b; margin-top: 2px;">Poin Karakter</div>
        @if($ews['karakter'] < 0)
          <div class="warn-txt">Peringatan: negatif</div>
        @else
          <div class="ok-txt">Baik</div>
        @endif
      </td>
      <td style="width: 25%; text-align: center; padding: 10px 6px; border-right: 1px solid #e2e8f0;">
        <div style="font-size: 17pt; font-weight: bold; color: {{ $ews['catatan'] >= 3 ? '#dc2626' : '#1a1a1a' }};">
          {{ $ews['catatan'] }}x
        </div>
        <div style="font-size: 8.5pt; color: #64748b; margin-top: 2px;">Catatan KBM</div>
        @if($ews['catatan'] >= 3)
          <div class="warn-txt">Peringatan: &gt;= 3 catatan</div>
        @else
          <div class="ok-txt">Baik</div>
        @endif
      </td>
      <td style="width: 25%; text-align: center; padding: 10px 6px;">
        <div style="font-size: 17pt; font-weight: bold; color: {{ $ews['nilai'] !== null && $ews['nilai'] < 70 ? '#dc2626' : '#1a1a1a' }};">
          {{ $ews['nilai'] !== null ? $ews['nilai'] : '-' }}
        </div>
        <div style="font-size: 8.5pt; color: #64748b; margin-top: 2px;">Rata-rata Nilai</div>
        @if($ews['nilai'] !== null && $ews['nilai'] < 70)
          <div class="warn-txt">Peringatan: &lt; 70</div>
        @elseif($ews['nilai'] !== null)
          <div class="ok-txt">Baik</div>
        @else
          <div style="font-size: 8pt; color: #94a3b8;">Belum ada data</div>
        @endif
      </td>
    </tr>
  </table>
</div>
@endif

{{-- Timeline rekomendasi --}}
@forelse($recs as $i => $rek)
<div class="rek-block">
  <div class="rek-header">
    Rekomendasi #{{ $i + 1 }}
    &nbsp;&middot;&nbsp; Dibuat: {{ $rek->created_at->format('d M Y') }}
    &nbsp;&middot;&nbsp;
    @php
      $statusLabel = match($rek->status->value) {
        'pending'             => 'Belum Ditangani',
        'proses'              => 'Sedang Diproses',
        'menunggu_verifikasi' => 'Menunggu Verifikasi',
        'selesai'             => 'Selesai',
        'diabaikan'           => 'Diabaikan',
      };
    @endphp
    <span class="level">{{ $statusLabel }}</span>
  </div>

  <div class="rek-body">
    <div class="rek-info">
      <span>Akumulasi poin saat trigger: <strong>{{ $rek->akumulasi_saat_trigger ?? '—' }}</strong></span>
      @if($rek->verifiedBy)
        <span>Diverifikasi oleh: <strong>{{ $rek->verifiedBy->nama }}</strong> ({{ $rek->verified_at?->format('d M Y') }})</span>
      @endif
    </div>

    <div class="rek-teks">{{ $rek->threshold->rekomendasi ?? $rek->alasan_manual ?? 'Kasus manual (tanpa ambang otomatis)' }}</div>

    @if($rek->suggestedHandlers->count() > 0)
    <div class="handlers">
      <span class="label">Penangan yang disarankan:</span>
      {{ $rek->suggestedHandlers->pluck('nama')->join(', ') }}
    </div>
    @endif

    @if($rek->catatan_admin)
    <div class="catatan-admin">
      <div class="label">Catatan dari Admin/Wakasek:</div>
      <div style="margin-top:3px">{{ $rek->catatan_admin }}</div>
    </div>
    @endif

    <div class="sesi-list">
      @if($rek->handlingSessions->count() > 0)
        <div style="font-size:9.5pt; font-weight:bold; color:#1f4e79; margin-bottom:6px;">
          Riwayat Penanganan ({{ $rek->handlingSessions->count() }} sesi):
        </div>
        @foreach($rek->handlingSessions as $j => $sesi)
        <div class="sesi-item">
          <div class="sesi-meta">
            Sesi {{ $j + 1 }}
            @if($sesi->is_resume)
              &nbsp;&middot;&nbsp; <strong style="color:#1f4e79">[Resume BK]</strong>
            @elseif($sesi->jenis->value === 'bk')
              &nbsp;&middot;&nbsp; <strong>[BK]</strong>
            @endif
            &nbsp;&middot;&nbsp;
            <strong>{{ $sesi->tanggal->format('d M Y') }}</strong> &nbsp;&middot;&nbsp;
            Oleh: <strong>{{ $sesi->handler->nama }}</strong>
          </div>
          <div class="sesi-catatan">{{ $sesi->catatan }}</div>
          @php
            $allLinks = collect();
            if($sesi->link_foto)    $allLinks->push(['url'=>$sesi->link_foto,    'keterangan'=>'Foto']);
            if($sesi->link_dokumen) $allLinks->push(['url'=>$sesi->link_dokumen, 'keterangan'=>'Dokumen']);
            foreach(($sesi->links ?? []) as $lnk) { $allLinks->push($lnk); }
          @endphp
          @if($allLinks->count() > 0)
          <div class="sesi-links">
            @foreach($allLinks as $lnk)
              <span>[Link] {{ $lnk['keterangan'] }}: {{ $lnk['url'] }}</span><br>
            @endforeach
          </div>
          @endif
        </div>
        @endforeach
      @else
        <div class="no-data">Belum ada catatan penanganan untuk rekomendasi ini.</div>
      @endif
    </div>
  </div>
</div>
@empty
<div class="no-data" style="padding: 30px; border: 1px dashed #ccc; border-radius: 4px;">
  Tidak ada rekomendasi tindakan yang tercatat untuk siswa ini.
</div>
@endforelse

{{-- TTD Wali Kelas (kiri, table-based) --}}
@php $waliTeacher = $wali ? \App\Models\Teacher::where('user_id', $wali->id)->first() : null; @endphp
<div style="margin-top: 24px; border-top: 2px solid #1f4e79; padding-top: 14px;">
  <div style="font-size: 10pt; font-weight: bold; color: #1f4e79; margin-bottom: 14px;">Validasi Dokumen</div>
  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="width: 220px; text-align: center; vertical-align: top;">
        <div style="font-size: 9pt; color: #555; margin-bottom: 2px;">Wali Kelas</div>
        <div style="font-size: 9.5pt; font-weight: bold; margin-bottom: 50px;">Wali Kelas</div>
        <div style="border-top: 1px solid #333; padding-top: 4px; font-size: 9pt;">
          {{ $wali?->nama ?? '................................' }}
        </div>
        <div style="font-size: 8.5pt; color: #777;">NIP. {{ $waliTeacher?->nip ?? '................................' }}</div>
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

{{-- Footer (table-based) --}}
<table style="width: 100%; border-collapse: collapse; margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
  <tr>
    <td style="font-size: 8pt; color: #aaa; padding-top: 6px;">ID Laporan: {{ $report_id }}</td>
    <td style="font-size: 8pt; color: #aaa; text-align: right; padding-top: 6px;">
      Dicetak: {{ $generated }} WIB &nbsp;&middot;&nbsp; Sistem Agenda Pembelajaran SMKN 2 Cimahi
    </td>
  </tr>
</table>

</body>
</html>
