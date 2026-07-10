@extends('reports.layout')

@section('title', 'Data PKL Siswa')

@section('meta')
  @if($pembimbing ?? null)
  <span><strong>Guru Pembimbing:</strong> {{ $pembimbing }}</span>
  <br>
  @endif
  <span><strong>Kelas:</strong> {{ $kelas }}</span>
  <span><strong>Jumlah Siswa:</strong> {{ count($rows) }}</span>
@endsection

@section('content')
<table>
  <thead>
    <tr>
      <th style="width:24px">No</th>
      <th style="width:150px">Nama Siswa</th>
      <th style="width:80px">NISN</th>
      <th>Tempat PKL</th>
      <th>Alamat PKL</th>
      <th style="width:70px">Awal</th>
      <th style="width:70px">Akhir</th>
    </tr>
  </thead>
  <tbody>
    @forelse($rows as $i => $r)
    <tr>
      <td class="text-center">{{ $i + 1 }}</td>
      <td>{{ $r['nama'] }}</td>
      <td>{{ $r['nisn'] }}</td>
      <td>{{ $r['tempat_pkl'] }}</td>
      <td>{{ $r['alamat_pkl'] }}</td>
      <td class="text-center" style="white-space:nowrap">{{ $r['mulai'] }}</td>
      <td class="text-center" style="white-space:nowrap">{{ $r['selesai'] }}</td>
    </tr>
    @empty
    <tr>
      <td colspan="7" class="text-center" style="color:#94a3b8; padding:16px">Belum ada data PKL untuk kelas ini.</td>
    </tr>
    @endforelse
  </tbody>
</table>
@endsection
