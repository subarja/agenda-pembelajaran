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
      {{-- Lebar dipatok eksplisit: dgn 8 kolom, Deskripsi yg auto-width memakan sisa ruang
           dan mendesak dua kolom nama guru sampai terlipat jadi dua baris. --}}
      <th style="width:24px">No</th>
      <th style="width:130px">Nama Siswa</th>
      <th style="width:62px">NIS</th>
      <th class="text-center" style="width:44px">Nilai</th>
      <th>Deskripsi</th>
      <th style="width:88px">Tanggal &amp; Jam</th>
      <th style="width:118px">Diberikan Oleh</th>
      <th style="width:110px">Atas Nama</th>
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
      <td style="white-space:nowrap">{{ $r['tanggal'] }}</td>
      <td>
        {{ $r['guru'] }}
        @if($r['oleh_inval'])
          <span style="color:#64748b; font-size:0.85em">(inval)</span>
        @endif
      </td>
      <td>{{ $r['atas_nama'] }}</td>
    </tr>
    @empty
    <tr>
      <td colspan="8" class="text-center" style="color:#94a3b8; padding:16px">Belum ada nilai tambah untuk kelas ini.</td>
    </tr>
    @endforelse
  </tbody>
</table>
@endsection
