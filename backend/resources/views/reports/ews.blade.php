@extends('reports.layout')

@section('title', 'Laporan Early Warning System (EWS)')

@section('meta')
  <span><strong>Kelas:</strong> {{ $kelas }}</span>
  <span><strong>Periode:</strong> {{ $periode }}</span>
  <span><strong>Total Siswa:</strong> {{ count($rows) }}</span>
@endsection

@section('content')
<table>
  <thead>
    <tr>
      <th style="width:24px">No</th>
      <th>Nama Siswa</th>
      <th>NIS</th>
      <th>L/P</th>
      <th class="text-center">Level</th>
      <th class="text-center">Kehadiran</th>
      <th class="text-center">Karakter</th>
      <th class="text-center">Catatan</th>
      <th class="text-center">Nilai</th>
    </tr>
  </thead>
  <tbody>
    @foreach($rows as $i => $r)
    <tr>
      <td class="text-center">{{ $i + 1 }}</td>
      <td>{{ $r['nama'] }}</td>
      <td>{{ $r['nis'] }}</td>
      <td style="text-align:center">{{ $r['jk'] }}</td>
      <td class="text-center">
        <span class="badge badge-{{ $r['level'] }}">{{ strtoupper($r['level']) }}</span>
      </td>
      <td class="text-center {{ $r['kehadiran'] < 80 ? 'warn' : 'good' }}">{{ $r['kehadiran'] }}%</td>
      <td class="text-center {{ $r['karakter'] < 0 ? 'warn' : 'good' }}">
        {{ $r['karakter'] >= 0 ? '+' : '' }}{{ $r['karakter'] }}
      </td>
      <td class="text-center {{ $r['catatan'] >= 3 ? 'warn' : '' }}">{{ $r['catatan'] }}</td>
      <td class="text-center {{ $r['nilai'] !== null && $r['nilai'] < 70 ? 'warn' : '' }}">
        {{ $r['nilai'] !== null ? $r['nilai'] : '—' }}
      </td>
    </tr>
    @endforeach
  </tbody>
</table>

<div style="margin-top:14px; display:flex; gap:12px; font-size:10px">
  @foreach(['hijau'=>'Normal','kuning'=>'Perhatian','oranye'=>'Waspada','merah'=>'Kritis'] as $lvl => $lbl)
    <span><span class="badge badge-{{ $lvl }}">{{ strtoupper($lvl) }}</span> {{ $lbl }}: {{ collect($rows)->where('level',$lvl)->count() }}</span>
  @endforeach
</div>
@endsection
