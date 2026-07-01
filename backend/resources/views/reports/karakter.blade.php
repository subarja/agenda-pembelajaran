@extends('reports.layout')

@section('title', 'Rekap Penilaian Karakter')

@section('meta')
  @if($guruNama ?? null)
  <span><strong>Guru:</strong> {{ $guruNama }}</span>
  <span><strong>NIP:</strong> {{ $guruNip }}</span>
  @if($mapelGuru ?? null)<span><strong>Mapel:</strong> {{ $mapelGuru }}</span>@endif
  <br>
  @endif
  <span><strong>Kelas:</strong> {{ $kelas }}</span>
  <span><strong>Periode:</strong> {{ $periode }}</span>
  <span><strong>Total Input:</strong> {{ $totalInput }}</span>
@endsection

@section('content')
<table>
  <thead>
    <tr>
      <th style="width:24px">No</th>
      <th>Nama Siswa</th>
      <th>NIS</th>
      @foreach($kategori as $kat)
        <th class="text-center" style="min-width:60px">{{ $kat }}</th>
      @endforeach
      <th class="text-center">Total Poin</th>
    </tr>
  </thead>
  <tbody>
    @foreach($rows as $i => $r)
    <tr>
      <td class="text-center">{{ $i + 1 }}</td>
      <td>{{ $r['nama'] }}</td>
      <td>{{ $r['nis'] }}</td>
      @foreach($kategori as $kat)
        @php $val = $r['per_kategori'][$kat] ?? 0 @endphp
        <td class="text-center {{ $val < 0 ? 'warn' : ($val > 0 ? 'good' : '') }}">
          {{ $val >= 0 ? '+' : '' }}{{ $val }}
        </td>
      @endforeach
      <td class="text-center {{ $r['total'] < 0 ? 'warn' : 'good' }}" style="font-weight:bold">
        {{ $r['total'] >= 0 ? '+' : '' }}{{ $r['total'] }}
      </td>
    </tr>
    @endforeach
  </tbody>
</table>
@endsection
