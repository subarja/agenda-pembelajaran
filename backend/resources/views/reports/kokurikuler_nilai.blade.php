@extends('reports.layout')

@section('title', 'Rekap Nilai Kokurikuler — ' . $project->judul)

@section('meta')
  @if($project->tema)<span><strong>Tema:</strong> {{ $project->tema }}</span>@endif
  <span><strong>Periode:</strong> {{ $project->tanggal_mulai->locale('id')->isoFormat('D MMM YYYY') }} – {{ $project->tanggal_selesai->locale('id')->isoFormat('D MMM YYYY') }}</span>
  @if($project->tingkat)<span><strong>Tingkat:</strong> {{ $project->tingkat }}</span>@endif
  <span><strong>Level:</strong> SB = Sangat Baik · B = Baik · C = Cukup · K = Perlu Bimbingan</span>
@endsection

@section('content')
@if($project->tujuan)
<div style="font-size:10px; margin-bottom:8px"><strong>Tujuan:</strong> {{ $project->tujuan }}</div>
@endif

<div style="font-size:9.5px; color:#475569; margin-bottom:10px">
  @foreach($dimensi as $d)
    <div><strong>{{ $d['nama'] }}</strong>@if($d['aspek']) — {{ $d['aspek'] }}@endif
      @if(count($d['subdimensi']))<span style="color:#94a3b8"> ({{ collect($d['subdimensi'])->implode(' · ') }})</span>@endif
    </div>
  @endforeach
</div>

@foreach($sections as $sec)
<div style="margin-bottom:8px; {{ !$loop->first ? 'page-break-before: always;' : '' }}">
  <div style="font-weight:bold; margin:6px 0; font-size:11px">{{ $sec['kelas'] }}</div>
  <table>
    <thead>
      <tr>
        <th style="width:24px">No</th>
        <th style="width:180px">Nama Siswa</th>
        <th style="width:80px">NIS</th>
        @foreach($dimensi as $d)
          <th class="text-center">{{ $d['nama'] }}</th>
        @endforeach
      </tr>
    </thead>
    <tbody>
      @forelse($sec['rows'] as $i => $r)
      <tr>
        <td class="text-center">{{ $i + 1 }}</td>
        <td>{{ $r['nama'] }}</td>
        <td>{{ $r['nis'] }}</td>
        @foreach($dimensi as $d)
          <td class="text-center" style="font-weight:bold">{{ $r['levels'][$d['id']] ?: '—' }}</td>
        @endforeach
      </tr>
      @empty
      <tr><td colspan="{{ 3 + count($dimensi) }}" class="text-center">Tidak ada siswa.</td></tr>
      @endforelse
    </tbody>
  </table>

  {{-- Pengesahan fasilitator kelas ybs — tetap fasilitator walau diunduh admin. --}}
  <table class="ttd-table">
    <tr>
      <td class="ttd-cell" style="width:60%"></td>
      <td class="ttd-cell">
        <div>Cimahi, {{ now('Asia/Jakarta')->locale('id')->isoFormat('D MMMM YYYY') }}</div>
        <div class="ttd-role">Fasilitator,</div>
        <span class="ttd-nama">{{ $sec['fasilitator']['nama'] }}</span>
        <div class="ttd-nip">NIP. {{ $sec['fasilitator']['nip'] }}</div>
      </td>
    </tr>
  </table>
</div>
@endforeach
@endsection

@section('ttd')
@endsection
