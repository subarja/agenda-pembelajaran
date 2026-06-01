<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; font-size: 11pt; color: #1a1a1a; }

.kop { display: flex; align-items: center; border-bottom: 3px double #1f4e79; padding-bottom: 10px; margin-bottom: 12px; }
.kop-logo { width: 65px; height: 65px; background: #1f4e79; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.kop-logo span { color: white; font-size: 18pt; font-weight: bold; }
.kop-text { margin-left: 14px; }
.kop-text .sekolah { font-size: 15pt; font-weight: bold; color: #1f4e79; }
.kop-text .alamat  { font-size: 8pt; color: #555; margin-top: 2px; }

.judul { text-align: center; margin: 12px 0 10px; }
.judul h2 { font-size: 13pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
.judul p  { font-size: 9.5pt; color: #555; margin-top: 3px; }

.profil-siswa { border: 1px solid #ccc; border-radius: 4px; padding: 10px 14px; margin-bottom: 14px; background: #f8fafc; }
.profil-siswa table { width: 100%; font-size: 10.5pt; }
.profil-siswa td { padding: 2px 0; }
.profil-siswa td:first-child { width: 140px; color: #666; }
.profil-siswa td:nth-child(2) { width: 10px; }

/* === Timeline rekomendasi === */
.rek-block { margin-bottom: 20px; }
.rek-header { background: #1f4e79; color: white; padding: 7px 12px; border-radius: 4px 4px 0 0; font-size: 10pt; font-weight: bold; }
.rek-header .level { font-weight: normal; font-size: 9pt; opacity: 0.85; }
.rek-body { border: 1px solid #c8d5e3; border-top: none; border-radius: 0 0 4px 4px; padding: 10px 12px; }

.rek-info { display: flex; gap: 20px; flex-wrap: wrap; font-size: 9.5pt; color: #555; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
.rek-info span strong { color: #1a1a1a; }

.rek-teks { font-size: 10pt; font-weight: bold; color: #1f4e79; margin-bottom: 8px; }

.catatan-admin { background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 8px 10px; margin-bottom: 8px; font-size: 9.5pt; }
.catatan-admin .label { font-weight: bold; color: #92400e; font-size: 8.5pt; }

.handlers { margin-bottom: 8px; font-size: 9.5pt; }
.handlers .label { font-weight: bold; color: #555; }

/* Sesi penanganan */
.sesi-list { margin-top: 8px; }
.sesi-item { border-left: 3px solid #1f4e79; padding: 7px 10px; margin-bottom: 8px; background: #f8fafc; border-radius: 0 4px 4px 0; }
.sesi-meta { font-size: 8.5pt; color: #666; margin-bottom: 4px; }
.sesi-meta strong { color: #1a1a1a; }
.sesi-catatan { font-size: 9.5pt; line-height: 1.5; }
.sesi-links { margin-top: 4px; font-size: 8.5pt; color: #2563eb; }

.status-badge {
    display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 8.5pt; font-weight: bold;
}
.status-pending  { background: #fee2e2; color: #991b1b; }
.status-proses   { background: #fef9c3; color: #854d0e; }
.status-menunggu { background: #dbeafe; color: #1e40af; }
.status-selesai  { background: #dcfce7; color: #166534; }

.no-data { text-align: center; color: #94a3b8; font-style: italic; padding: 16px; font-size: 9.5pt; }

/* TTD */
.ttd-section { margin-top: 24px; border-top: 2px solid #1f4e79; padding-top: 14px; }
.ttd-title { font-size: 10pt; font-weight: bold; color: #1f4e79; margin-bottom: 12px; }
.ttd-grid { display: flex; gap: 0; }
.ttd-box { flex: 1; text-align: center; padding: 0 8px; }
.ttd-box .role { font-size: 9pt; color: #555; margin-bottom: 4px; }
.ttd-box .jabatan { font-size: 9.5pt; font-weight: bold; margin-bottom: 50px; }
.ttd-box .line { border-top: 1px solid #333; padding-top: 4px; font-size: 9pt; }
.ttd-box .nip { font-size: 8.5pt; color: #777; }

.footer { margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 8pt; color: #aaa; display: flex; justify-content: space-between; }
</style>
</head>
<body>

<div class="kop">
  <div class="kop-logo"><span>S2</span></div>
  <div class="kop-text">
    <div class="sekolah">SMK NEGERI 2 CIMAHI</div>
    <div class="alamat">Jl. Kamarung No. 69, Cimahi Utara &nbsp;·&nbsp; (022) 6629812 &nbsp;·&nbsp; smkn2cimahi.sch.id</div>
  </div>
</div>

<div class="judul">
  <h2>Riwayat Penanganan Siswa Bermasalah</h2>
  <p>Dokumen Tindak Lanjut Early Warning System (EWS)</p>
</div>

{{-- Profil Siswa --}}
<div class="profil-siswa">
  <table>
    <tr>
      <td>Nama Siswa</td><td>:</td>
      <td><strong>{{ $student->user->nama }}</strong></td>
      <td style="width:20px"></td>
      <td style="width:80px; color:#666">NIS</td><td style="width:10px">:</td>
      <td>{{ $student->nis }}</td>
    </tr>
    <tr>
      <td>Kelas</td><td>:</td>
      <td>{{ $student->schoolClass ? $student->schoolClass->tingkat->value . ' ' . $student->schoolClass->jurusan . ' - ' . $student->schoolClass->rombel : '—' }}</td>
      <td></td>
      <td style="color:#666">Wali Kelas</td><td>:</td>
      <td>{{ $wali?->nama ?? '—' }}</td>
    </tr>
    <tr>
      <td>Tanggal Cetak</td><td>:</td>
      <td colspan="5">{{ $generated }}</td>
    </tr>
  </table>
</div>

{{-- Timeline rekomendasi --}}
@forelse($recs as $i => $rek)
<div class="rek-block">
  {{-- Header --}}
  <div class="rek-header">
    Rekomendasi #{{ $i + 1 }}
    &nbsp;·&nbsp; Dibuat: {{ $rek->created_at->format('d M Y') }}
    &nbsp;·&nbsp;
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
    {{-- Info poin --}}
    <div class="rek-info">
      <span>Akumulasi poin saat trigger: <strong>{{ $rek->akumulasi_saat_trigger }}</strong></span>
      @if($rek->verifiedBy)
        <span>Diverifikasi oleh: <strong>{{ $rek->verifiedBy->nama }}</strong> ({{ $rek->verified_at?->format('d M Y') }})</span>
      @endif
    </div>

    {{-- Rekomendasi sistem --}}
    <div class="rek-teks">{{ $rek->threshold->rekomendasi }}</div>

    {{-- Penangan yang disarankan --}}
    @if($rek->suggestedHandlers->count() > 0)
    <div class="handlers">
      <span class="label">Penangan yang disarankan:</span>
      {{ $rek->suggestedHandlers->pluck('nama')->join(', ') }}
    </div>
    @endif

    {{-- Catatan admin --}}
    @if($rek->catatan_admin)
    <div class="catatan-admin">
      <div class="label">Catatan dari Admin/Wakasek:</div>
      <div style="margin-top:3px">{{ $rek->catatan_admin }}</div>
    </div>
    @endif

    {{-- Sesi penanganan --}}
    <div class="sesi-list">
      @if($rek->handlingSessions->count() > 0)
        <div style="font-size:9.5pt; font-weight:bold; color:#1f4e79; margin-bottom:6px;">
          Riwayat Penanganan ({{ $rek->handlingSessions->count() }} sesi):
        </div>
        @foreach($rek->handlingSessions as $j => $sesi)
        <div class="sesi-item">
          <div class="sesi-meta">
            Sesi {{ $j + 1 }} &nbsp;·&nbsp;
            <strong>{{ $sesi->tanggal->format('d M Y') }}</strong> &nbsp;·&nbsp;
            Oleh: <strong>{{ $sesi->handler->nama }}</strong>
          </div>
          <div class="sesi-catatan">{{ $sesi->catatan }}</div>
          @if($sesi->link_dokumen || $sesi->link_foto)
          <div class="sesi-links">
            @if($sesi->link_dokumen)<span>📄 Dokumen: {{ $sesi->link_dokumen }}</span><br>@endif
            @if($sesi->link_foto)<span>🖼 Foto: {{ $sesi->link_foto }}</span>@endif
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

{{-- Blok TTD --}}
<div class="ttd-section">
  <div class="ttd-title">Pengesahan Dokumen</div>
  <div class="ttd-grid">
    <div class="ttd-box">
      <div class="role">Wali Kelas</div>
      <div class="jabatan">Wali Kelas</div>
      <div class="line">{{ $wali?->nama ?? '................................' }}</div>
      @php $waliTeacher = $wali ? App\Models\Teacher::where('user_id', $wali->id)->first() : null; @endphp
      <div class="nip">NIP. {{ $waliTeacher?->nip ?? '................................' }}</div>
    </div>
    <div class="ttd-box">
      <div class="role">Orang Tua / Wali Murid</div>
      <div class="jabatan">Orang Tua/Wali</div>
      <div class="line">{{ $student->wali_nama ?? '................................' }}</div>
      <div class="nip">No. HP: {{ $student->wali_kontak ?? '................................' }}</div>
    </div>
    <div class="ttd-box">
      <div class="role">Guru BK</div>
      <div class="jabatan">Koordinator BK</div>
      <div class="line">................................</div>
      <div class="nip">NIP. ................................</div>
    </div>
    <div class="ttd-box">
      <div class="role">Mengetahui</div>
      <div class="jabatan">Wakil Kepala Sekolah Bid. Kurikulum</div>
      <div class="line">Kusman Subarja, S.Pd., M.T.</div>
      <div class="nip">NIP. 197501012005011001</div>
    </div>
  </div>
</div>

<div class="footer">
  <span>ID Laporan: {{ $report_id }}</span>
  <span>Dicetak: {{ $generated }} WIB &nbsp;·&nbsp; Sistem Agenda Pembelajaran SMKN 2 Cimahi</span>
</div>

</body>
</html>
