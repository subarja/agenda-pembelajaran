<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; margin: 1cm 2cm 1cm 2cm; }
  .kop { text-align: center; margin-bottom: 8px; }
  .kop img { display: inline-block; max-width: 100%; height: auto; }
  .kop-garis { border-top: 3px solid #000; border-bottom: 1px solid #000; margin-bottom: 12px; }
  .judul-laporan { font-size: 13px; font-weight: bold; margin-bottom: 6px; }
  .meta { font-size: 10px; color: #64748b; border-bottom: 1px solid #e2e8f0; margin-bottom: 12px; padding-bottom: 8px; }
  .meta strong { color: #1e293b; }
  .meta span { margin-right: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #1f4e79; color: white; padding: 6px 8px; text-align: left; font-weight: 600; }
  td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 9999px; font-size: 9px; font-weight: 600; }
  .badge-hijau  { background: #dcfce7; color: #166534; }
  .badge-kuning { background: #fef9c3; color: #854d0e; }
  .badge-oranye { background: #ffedd5; color: #9a3412; }
  .badge-merah  { background: #fee2e2; color: #991b1b; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; text-align: right; }
  .warn { color: #dc2626; font-weight: 600; }
  .good { color: #16a34a; }
  /* TTD */
  .ttd-table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 10px; }
  .ttd-cell { text-align: center; padding: 0 8px; vertical-align: top; }
  .ttd-cell .ttd-role { font-weight: bold; margin-bottom: 50px; font-size: 10px; }
  .ttd-cell .ttd-nama { display: inline-block; border-top: 1px solid #333; padding-top: 3px; min-width: 140px; font-size: 10px; }
  .ttd-cell .ttd-nip { font-size: 9px; color: #555; }
</style>
</head>
<body>
<div class="kop">
  <img src="file://{{ public_path('images/kop_surat.jpg') }}" alt="Kop SMKN 2 Cimahi">
</div>
<div class="kop-garis"></div>
<div class="judul-laporan">@yield('title')</div>
<div class="meta">@yield('meta')</div>
@yield('content')

{{-- TTD: default Wakasek Kurikulum; view dapat override via @section('ttd') --}}
@section('ttd')
<table class="ttd-table">
  <tr>
    <td class="ttd-cell" style="width:60%"></td>
    <td class="ttd-cell">
      <div>Cimahi, {{ now('Asia/Jakarta')->isoFormat('D MMMM YYYY') }}</div>
      <div class="ttd-role">Wakasek Bid. Kurikulum,</div>
      <span class="ttd-nama">Kusman Subarja, S.Pd., M.T.</span>
      <div class="ttd-nip">NIP. 197501012005011001</div>
    </td>
  </tr>
</table>
@show

<div class="footer">Dicetak: {{ now('Asia/Jakarta')->format('d M Y H:i') }} WIB</div>
</body>
</html>
