@extends('reports.layout')

@section('title', 'Rekap Agenda Pembelajaran')

@section('meta')
  <span><strong>Guru:</strong> {{ $guru }}</span>
  <span><strong>Periode:</strong> {{ $periode }}</span>
  <span><strong>Total Sesi:</strong> {{ count($rows) }}</span>
@endsection

@section('content')
<table>
  <thead>
    <tr>
      <th style="width:20px">No</th>
      <th>Tanggal</th>
      <th>Hari</th>
      <th>Kelas</th>
      <th>Mata Pelajaran</th>
      <th>TP Dicapai</th>
      <th>Resume KBM</th>
      <th class="text-center">Status</th>
    </tr>
  </thead>
  <tbody>
    @foreach($rows as $i => $r)
    <tr>
      <td class="text-center">{{ $i + 1 }}</td>
      <td>{{ $r['tanggal'] }}</td>
      <td>{{ $r['hari'] }}</td>
      <td>{{ $r['kelas'] }}</td>
      <td>{{ $r['mapel'] }}</td>
      <td style="font-size:9px">{{ $r['tp'] ?: '—' }}</td>
      <td style="font-size:9px; max-width:180px">{{ $r['resume'] ?: '—' }}</td>
      <td class="text-center">
        <span style="background:{{ $r['status'] === 'submitted' ? '#dcfce7' : '#fef9c3' }};
              color:{{ $r['status'] === 'submitted' ? '#166534' : '#854d0e' }};
              padding:1px 6px; border-radius:9999px; font-size:9px; font-weight:600">
          {{ $r['status'] === 'submitted' ? 'Selesai' : 'Draft' }}
        </span>
      </td>
    </tr>
    @endforeach
  </tbody>
</table>
@endsection
