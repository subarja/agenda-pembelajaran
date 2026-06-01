<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 11px; color: #1e293b; }
  .header { background: #1f4e79; color: white; padding: 14px 20px; margin-bottom: 16px; }
  .header h1 { font-size: 15px; font-weight: bold; }
  .header p { font-size: 10px; opacity: .85; margin-top: 2px; }
  .meta { padding: 0 20px 12px; display: flex; gap: 24px; font-size: 10px; color: #64748b; border-bottom: 1px solid #e2e8f0; margin-bottom: 14px; }
  .meta strong { color: #1e293b; }
  .content { padding: 0 20px 20px; }
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
  .footer { margin-top: 16px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; text-align: right; }
  .warn { color: #dc2626; font-weight: 600; }
  .good { color: #16a34a; }
</style>
</head>
<body>
<div class="header">
  <h1>@yield('title')</h1>
  <p>SMK Negeri 2 Cimahi &nbsp;·&nbsp; Aplikasi Agenda Pembelajaran</p>
</div>
<div class="meta">@yield('meta')</div>
<div class="content">
  @yield('content')
  <div class="footer">Dicetak: {{ now('Asia/Jakarta')->format('d M Y H:i') }} WIB</div>
</div>
</body>
</html>
