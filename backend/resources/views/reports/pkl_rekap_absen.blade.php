@extends('reports.layout')

@section('title', 'Rekap Absen PKL')

@section('meta')
  <span><strong>Periode:</strong> {{ $periode }}</span>
  <span><strong>Jumlah Kelas:</strong> {{ count($sections) }}</span>
@endsection

@section('content')
@foreach($sections as $sec)
<div style="margin-bottom:14px">
  <div style="font-weight:bold; margin:6px 0; font-size:11px">{{ $sec['kelas'] }}</div>
  <table>
    <thead>
      <tr>
        <th style="width:24px">No</th>
        <th style="width:170px">Nama Siswa</th>
        <th style="width:90px">NISN</th>
        <th class="text-center" style="width:44px">Hadir</th>
        <th class="text-center" style="width:44px">Sakit</th>
        <th class="text-center" style="width:44px">Izin</th>
        <th class="text-center" style="width:44px">Alpha</th>
        <th class="text-center" style="width:44px">Total</th>
        <th class="text-center" style="width:64px">% Hadir</th>
      </tr>
    </thead>
    <tbody>
      @forelse($sec['rows'] as $i => $r)
      <tr>
        <td class="text-center">{{ $i + 1 }}</td>
        <td>{{ $r['nama'] }}</td>
        <td>{{ $r['nisn'] }}</td>
        <td class="text-center">{{ $r['hadir'] }}</td>
        <td class="text-center">{{ $r['sakit'] }}</td>
        <td class="text-center">{{ $r['izin'] }}</td>
        <td class="text-center {{ $r['alpha'] > 0 ? 'warn' : '' }}">{{ $r['alpha'] }}</td>
        <td class="text-center">{{ $r['total'] }}</td>
        <td class="text-center {{ $r['pct'] < 75 ? 'warn' : 'good' }}" style="font-weight:bold">{{ $r['pct'] }}%</td>
      </tr>
      @empty
      <tr>
        <td colspan="9" class="text-center" style="color:#94a3b8; padding:12px">Belum ada presensi PKL.</td>
      </tr>
      @endforelse
    </tbody>
  </table>
</div>
@endforeach
@endsection
