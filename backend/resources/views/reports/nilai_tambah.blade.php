@extends('reports.layout')

@section('title', 'Laporan Nilai Tambah')

@section('meta')
  @if($guruNama ?? null)
  <span><strong>Guru:</strong> {{ $guruNama }}</span>
  <span><strong>NIP:</strong> {{ $guruNip }}</span>
  <br>
  @endif
  <span><strong>Kelas:</strong> {{ $kelas }}</span>
  <span><strong>Periode:</strong> {{ $periode }}</span>
  <span><strong>Total Entri:</strong> {{ $totalInput }}</span>
@endsection

@section('content')
<table>
  <thead>
    <tr>
      <th style="width:24px">No</th>
      <th>Nama Siswa</th>
      <th>NIS</th>
      <th class="text-center" style="width:50px">Nilai</th>
      <th>Deskripsi</th>
      <th style="width:70px">Tanggal</th>
      <th>Diberikan Oleh</th>
    </tr>
  </thead>
  <tbody>
    @forelse($rows as $i => $r)
    <tr>
      <td class="text-center">{{ $i + 1 }}</td>
      <td>{{ $r['nama'] }}</td>
      <td>{{ $r['nis'] }}</td>
      <td class="text-center {{ $r['nilai'] < 0 ? 'warn' : 'good' }}" style="font-weight:bold">
        {{ $r['nilai'] >= 0 ? '+' : '' }}{{ $r['nilai'] }}
      </td>
      <td>{{ $r['catatan'] }}</td>
      <td>{{ $r['tanggal'] }}</td>
      <td>{{ $r['guru'] }}</td>
    </tr>
    @empty
    <tr>
      <td colspan="7" class="text-center" style="color:#94a3b8; padding:16px">Belum ada nilai tambah untuk kelas ini.</td>
    </tr>
    @endforelse
  </tbody>
</table>
@endsection
