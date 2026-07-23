import { useEffect, useRef, useState } from 'react'
import { Download, CalendarX, Loader2, ExternalLink, Clock, MapPin } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

type Sesi = {
  id: string
  jam_mulai: string | null
  jam_selesai: string | null
  jam_ke_mulai: number | null
  jam_ke_selesai: number | null
  ruangan: string | null
  subject: { nama: string; kode: string | null }
  kelas?: string // untuk guru
  guru?: string // untuk siswa
}

type JadwalMinggu = {
  data: Record<string, Sesi[]>
  hari: string[]
  role: 'guru' | 'siswa'
  has_pdf: boolean
}

const LABEL_HARI: Record<string, string> = {
  senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu',
  kamis: 'Kamis', jumat: 'Jumat', sabtu: 'Sabtu',
}

function jamKe(s: Sesi): string | null {
  if (s.jam_ke_mulai == null) return null
  if (s.jam_ke_selesai == null || s.jam_ke_selesai === s.jam_ke_mulai) return `Jam ke-${s.jam_ke_mulai}`
  return `Jam ke-${s.jam_ke_mulai}–${s.jam_ke_selesai}`
}

// Halaman "Jadwal Saya". Tampilan utama = tabel/kartu HTML ringan dari data jadwal
// TERSTRUKTUR (`schedules`), bukan embed PDF — supaya tampil baik & ringan di Android
// maupun desktop. PDF resmi aSc (upload admin) tetap bisa diunduh / dibuka di tab baru,
// tapi baru di-fetch saat tombolnya ditekan (lazy) supaya halaman ringan.
export default function JadwalSayaPage() {
  const [jadwal, setJadwal] = useState<JadwalMinggu | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Cache blob PDF per-endpoint (generated & resmi) supaya tidak di-fetch berulang.
  const pdfBlobs = useRef<Record<string, { url: string; name: string }>>({})
  const [busy, setBusy] = useState<string | null>(null)   // endpoint yang sedang dimuat
  const [pdfError, setPdfError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    api.get('/schedules/my-week')
      .then(resp => setJadwal(resp.data))
      .catch(e => setError(e?.response?.data?.message ?? 'Gagal memuat jadwal.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => () => { Object.values(pdfBlobs.current).forEach(b => URL.revokeObjectURL(b.url)) }, [])

  // Ambil (sekali) PDF via endpoint preview base64-JSON — pola anti-IDM yang sama dengan
  // alur preview PDF lain. `endpoint` bisa PDF resmi (unggahan) atau jadwal yang dibangkitkan.
  async function ensurePdf(endpoint: string, fallbackName: string) {
    if (pdfBlobs.current[endpoint]) return pdfBlobs.current[endpoint]
    setBusy(endpoint); setPdfError('')
    try {
      const resp = await api.get(`${endpoint}?preview=1`)
      if (resp.data.available === false || !resp.data.base64) {
        setPdfError(resp.data.message ?? 'Jadwal PDF belum tersedia.')
        return null
      }
      const entry = { url: URL.createObjectURL(base64ToBlob(resp.data.base64, 'application/pdf')), name: resp.data.filename || fallbackName }
      pdfBlobs.current[endpoint] = entry
      return entry
    } catch (e: any) {
      setPdfError(e?.response?.data?.message ?? 'Jadwal PDF gagal dimuat.')
      return null
    } finally {
      setBusy(null)
    }
  }

  async function openTab(endpoint: string, fallbackName: string) {
    // Buka tab SINKRON dengan klik (lolos popup-blocker), arahkan setelah fetch. Tanpa
    // 'noopener' (sebagian browser balikkan null → tab kosong). Blob milik sendiri, aman.
    const w = window.open('', '_blank')
    const entry = await ensurePdf(endpoint, fallbackName)
    if (!w) { setPdfError('Tab baru diblokir browser. Gunakan tombol Unduh PDF.'); return }
    if (entry) w.location.href = entry.url
    else w.close()
  }

  async function download(endpoint: string, fallbackName: string) {
    const entry = await ensurePdf(endpoint, fallbackName)
    if (!entry) return
    const a = document.createElement('a')
    a.href = entry.url; a.download = entry.name
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const hariTampil = jadwal ? jadwal.hari.filter(h => (jadwal.data[h]?.length ?? 0) > 0) : []
  const kosong = !loading && !error && hariTampil.length === 0
  const GEN = '/schedules/my-week/pdf'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Jadwal Saya</h2>
        <div className="flex flex-wrap gap-2">
          {/* Jadwal PDF dibangkitkan dari data — selalu tersedia (guru & siswa) */}
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => openTab(GEN, 'Jadwal_Mingguan.pdf')}>
            {busy === GEN ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-1.5" />}
            Buka di Tab Baru
          </Button>
          <Button size="sm" disabled={busy !== null} onClick={() => download(GEN, 'Jadwal_Mingguan.pdf')}>
            {busy === GEN ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
            Unduh PDF
          </Button>
          {/* PDF resmi (unggahan admin) — bila ada */}
          {jadwal?.has_pdf && (
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => openTab('/schedules/my-pdf', 'jadwal.pdf')} title="PDF resmi unggahan admin">
              {busy === '/schedules/my-pdf' ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-1.5" />}
              PDF Resmi
            </Button>
          )}
        </div>
      </div>

      {pdfError && <p className="text-xs text-destructive">{pdfError}</p>}

      {loading && (
        <div className="rounded-xl border bg-card flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Memuat jadwal...</p>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border bg-card flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
          <CalendarX className="h-8 w-8" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {kosong && (
        <div className="rounded-xl border bg-card flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
          <CalendarX className="h-8 w-8" />
          <p className="text-sm">Belum ada jadwal untuk tahun ajaran ini.</p>
        </div>
      )}

      {!loading && !error && hariTampil.length > 0 && jadwal && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {hariTampil.map(hari => (
            <div key={hari} className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="bg-muted/60 px-4 py-2 font-semibold text-sm border-b">
                {LABEL_HARI[hari] ?? hari}
              </div>
              <ul className="divide-y">
                {jadwal.data[hari].map(s => (
                  <li key={s.id} className="px-4 py-2.5 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-medium text-foreground">
                        {s.jam_mulai ?? '—'}{s.jam_selesai ? `–${s.jam_selesai}` : ''}
                      </span>
                      {jamKe(s) && <span className="text-muted-foreground">· {jamKe(s)}</span>}
                    </div>
                    <div className="font-medium leading-snug">{s.subject.nama}</div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                      <span>{jadwal.role === 'guru' ? s.kelas : s.guru}</span>
                      {s.ruangan && (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0" /> {s.ruangan}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        <strong>Unduh PDF</strong> / <strong>Buka di Tab Baru</strong> mencetak jadwal ini (termasuk ruangan).
        {jadwal?.has_pdf && <> Tombol <strong>PDF Resmi</strong> membuka berkas jadwal resmi unggahan admin.</>}
      </p>
    </div>
  )
}
