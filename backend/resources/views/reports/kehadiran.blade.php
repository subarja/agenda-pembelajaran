@extends('reports.layout')

@section('title', 'Rekap Kehadiran Siswa')

@section('meta')
  <span><strong>Kelas:</strong> {{ $kelas }}</span>
  <span><strong>Periode:</strong> {{ $periode }}</span>
  <span><strong>Total Sesi:</strong> {{ $totalSesi }}</span>
@endsection

@section('content')
<table>
  <thead>
    <tr>
      <th style="width:20px">No</th>
      <th>Nama Siswa</th>
      <th>NIS</th>
      <th class="text-center">Hadir</th>
      <th class="text-center">Sakit</th>
      <th class="text-center">Izin</th>
      <th class="text-center">Alpha</th>
      <th class="text-center">% Hadir</th>
      <th>Tanggal Tidak Hadir</th>
    </tr>
  </thead>
  <tbody>
    @foreach($rows as $i => $r)
    <tr>
      <td class="text-center">{{ $i + 1 }}</td>
      <td>{{ $r['nama'] }}</td>
      <td>{{ $r['nis'] }}</td>
      <td class="text-center good">{{ $r['hadir'] }}</td>
      <td class="text-center">{{ $r['sakit'] }}</td>
      <td class="text-center">{{ $r['izin'] }}</td>
      <td class="text-center {{ $r['alpha'] > 0 ? 'warn' : '' }}">{{ $r['alpha'] }}</td>
      <td class="text-center {{ $r['pct'] < 80 ? 'warn' : 'good' }}">{{ $r['pct'] }}%</td>
      <td style="font-size:9px; color:#475569">
        @if(count($r['absences']) > 0)
          {{ implode(' · ', $r['absences']) }}
        @else
          <span style="color:#94a3b8">—</span>
        @endif
      </td>
    </tr>
    @endforeach
  </tbody>
</table>
@endsection
