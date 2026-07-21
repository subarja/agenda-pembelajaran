@extends('reports.layout')

@section('title', 'Data & Rekap Kehadiran PKL')

@section('meta')
  @if($pembimbing ?? null)
  <span><strong>Guru Pembimbing:</strong> {{ $pembimbing }}</span>
  <br>
  @endif
  <span><strong>Kelas:</strong> {{ $kelas }}</span>
  <span><strong>Jumlah Baris:</strong> {{ count($rows) }}</span>
  <br>
  <span style="color:#64748b">% Hadir = hadir / hari kerja (Senin–Jumat di luar libur nasional) yang sudah berlalu.</span>
@endsection

@section('content')
<table>
  <thead>
    <tr>
      <th style="width:20px">No</th>
      <th style="width:120px">Nama</th>
      <th style="width:66px">Kelas</th>
      <th style="width:66px">NIS</th>
      <th style="width:66px">NISN</th>
      <th style="width:78px">No. WA</th>
      <th>Industri</th>
      <th>Alamat Industri</th>
      <th style="width:58px">Awal</th>
      <th style="width:58px">Akhir</th>
      <th style="width:18px">H</th>
      <th style="width:18px">S</th>
      <th style="width:18px">I</th>
      <th style="width:18px">A</th>
      <th style="width:38px">Hari Kerja</th>
      <th style="width:46px">% Hadir</th>
    </tr>
  </thead>
  <tbody>
    @forelse($rows as $i => $r)
    <tr>
      <td class="text-center">{{ $i + 1 }}</td>
      <td>{{ $r['nama'] }}</td>
      <td class="text-center">{{ $r['kelas'] }}</td>
      <td class="text-center">{{ $r['nis'] }}</td>
      <td class="text-center">{{ $r['nisn'] }}</td>
      <td class="text-center" style="white-space:nowrap">{{ $r['telpon'] ?? '—' }}</td>
      <td>{{ $r['tempat_pkl'] }}</td>
      <td>{{ $r['alamat_pkl'] }}</td>
      <td class="text-center" style="white-space:nowrap">{{ $r['mulai'] }}</td>
      <td class="text-center" style="white-space:nowrap">{{ $r['selesai'] }}</td>
      <td class="text-center">{{ $r['hadir'] }}</td>
      <td class="text-center">{{ $r['sakit'] }}</td>
      <td class="text-center">{{ $r['izin'] }}</td>
      <td class="text-center">{{ $r['alpha'] }}</td>
      <td class="text-center">{{ $r['hari_kerja'] }}</td>
      <td class="text-center">{{ $r['pct_hadir'] }}%</td>
    </tr>
    @empty
    <tr>
      <td colspan="16" class="text-center" style="color:#94a3b8; padding:16px">Belum ada siswa bimbingan PKL.</td>
    </tr>
    @endforelse
  </tbody>
</table>
@endsection
