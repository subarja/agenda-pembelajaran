import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Html5Qrcode } from 'html5-qrcode'
import { ScanLine, CheckCircle2, XCircle, LogOut, LogIn, Camera, CameraOff } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ScanResult { ok: boolean; message: string; arah?: 'keluar' | 'masuk'; data?: { nama: string; kelas: string | null; foto_url: string | null; keperluan: string; waktu: string } }
interface LogRow { nama: string | null; keperluan: string; status_label: string; waktu_keluar: string | null; waktu_masuk: string | null }

const READER_ID = 'sekuriti-qr-reader'

export default function SekuritiScanPage() {
  const qc = useQueryClient()
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const qrRef = useRef<Html5Qrcode | null>(null)
  const busyRef = useRef(false)          // cegah pemrosesan ganda satu frame
  const lastRef = useRef<{ token: string; at: number } | null>(null)

  const { data: log } = useQuery<{ data: LogRow[] }>({
    queryKey: ['sekuriti-log'],
    queryFn: () => api.get('/sekuriti/log').then(r => r.data),
    refetchInterval: 15_000,
  })

  async function handleToken(token: string) {
    // Anti-dobel: token sama dalam 4 dtk diabaikan.
    const now = Date.now()
    if (busyRef.current) return
    if (lastRef.current && lastRef.current.token === token && now - lastRef.current.at < 4000) return
    busyRef.current = true
    lastRef.current = { token, at: now }
    try {
      const r = await api.post('/sekuriti/scan', { qr_token: token })
      setResult(r.data); setError(null)
      qc.invalidateQueries({ queryKey: ['sekuriti-log'] })
    } catch (e: any) {
      setResult(e.response?.data ?? { ok: false, message: 'Scan gagal.' })
    } finally {
      setTimeout(() => { busyRef.current = false }, 1200)
    }
  }

  async function start() {
    setError(null)
    try {
      const qr = new Html5Qrcode(READER_ID)
      qrRef.current = qr
      await qr.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => { handleToken(decoded) },
        () => { /* abaikan frame tanpa QR */ })
      setScanning(true)
    } catch (e: any) {
      setError('Tidak bisa mengakses kamera. Pastikan izin kamera aktif dan halaman diakses lewat HTTPS.')
    }
  }

  async function stop() {
    try { await qrRef.current?.stop(); qrRef.current?.clear() } catch { /* noop */ }
    qrRef.current = null; setScanning(false)
  }

  useEffect(() => () => { qrRef.current?.stop().catch(() => {}) }, [])

  const tone = result ? (result.ok ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50') : ''

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <ScanLine className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-semibold">Pindai QR Izin Keluar</h1>
      </div>

      <Card><CardContent className="p-4 space-y-3">
        <div id={READER_ID} className="w-full max-w-sm mx-auto overflow-hidden rounded-lg bg-black/5" />
        <div className="flex justify-center gap-2">
          {!scanning
            ? <Button onClick={start}><Camera className="h-4 w-4 mr-1" /> Mulai Kamera</Button>
            : <Button variant="outline" onClick={stop}><CameraOff className="h-4 w-4 mr-1" /> Hentikan</Button>}
        </div>
        {error && <p className="text-xs text-red-600 text-center">{error}</p>}
      </CardContent></Card>

      {/* Hasil scan */}
      {result && (
        <Card className={`border-2 ${tone}`}><CardContent className="p-4">
          {result.ok && result.data ? (
            <div className="flex items-center gap-4">
              {result.data.foto_url
                ? <img src={result.data.foto_url} alt="" className="h-20 w-20 rounded-lg object-cover border" />
                : <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center text-2xl">👤</div>}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {result.arah === 'keluar' ? <LogOut className="h-5 w-5 text-blue-600" /> : <LogIn className="h-5 w-5 text-green-600" />}
                  <span className="font-semibold text-lg">{result.arah === 'keluar' ? 'KELUAR' : 'MASUK'}</span>
                  <span className="text-xs text-muted-foreground">{result.data.waktu}</span>
                </div>
                <div className="font-medium mt-1">{result.data.nama}</div>
                <div className="text-sm text-muted-foreground">{result.data.kelas} · {result.data.keperluan}</div>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          ) : (
            <div className="flex items-center gap-3 text-red-700">
              <XCircle className="h-8 w-8" />
              <span className="font-medium">{result.message}</span>
            </div>
          )}
        </CardContent></Card>
      )}

      {/* Log hari ini */}
      <Card><CardContent className="p-4 space-y-2">
        <h3 className="font-semibold text-sm">Riwayat Hari Ini</h3>
        <div className="rounded-lg border divide-y">
          {(log?.data ?? []).length === 0 && <div className="p-3 text-sm text-muted-foreground">Belum ada aktivitas.</div>}
          {(log?.data ?? []).map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="flex-1">{r.nama} <span className="text-muted-foreground">· {r.keperluan}</span></span>
              <span className="text-xs text-blue-600">{r.waktu_keluar ? `keluar ${r.waktu_keluar}` : ''}</span>
              <span className="text-xs text-green-600">{r.waktu_masuk ? `masuk ${r.waktu_masuk}` : ''}</span>
            </div>
          ))}
        </div>
      </CardContent></Card>
    </div>
  )
}
