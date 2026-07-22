import { useEffect, useState } from 'react'
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

  // Cache blob PDF supaya tidak di-fetch berulang; disimpan setelah tombol pertama ditekan.
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfName, setPdfName] = useState('jadwal.pdf')
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    api.get('/schedules/my-week')
      .then(resp => setJadwal(resp.data))
      .catch(e => setError(e?.response?.data?.message ?? 'Gagal memuat jadwal.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }, [pdfUrl])

  // Ambil (sekali) PDF resmi via endpoint preview base64-JSON — pola anti-IDM yang sama
  // dengan alur preview PDF lain di aplikasi (lihat usePdfPreview). Mengembalikan blob URL.
  async function ensurePdf(): Promise<string | null> {
    if (pdfUrl) return pdfUrl
    setPdfBusy(true)
    setPdfError('')
    try {
      const resp = await api.get('/schedules/my-pdf?preview=1')
      if (resp.data.available === false || !resp.data.base64) {
        setPdfError(resp.data.message ?? 'Jadwal PDF belum tersedia.')
        return null
      }
      const url = URL.createObjectURL(base64ToBlob(resp.data.base64, 'application/pdf'))
      setPdfUrl(url)
      setPdfName(resp.data.filename || 'jadwal.pdf')
      return url
    } catch (e: any) {
      setPdfError(e?.response?.data?.message ?? 'Jadwal PDF belum tersedia.')
      return null
    } finally {
      setPdfBusy(false)
    }
  }

  async function openTab() {
    // Buka tab SINKRON dengan klik dulu (lolos popup-blocker), baru diarahkan setelah
    // fetch. JANGAN pakai 'noopener': sebagian browser mengembalikan null dengan opsi itu,
    // sehingga tab baru terbuka KOSONG dan tak pernah diarahkan ke PDF (gejala: "buka tab
    // baru tidak muncul" padahal unduh jalan). Blob PDF milik sendiri, aman tanpa noopener.
    const w = window.open('', '_blank')
    const url = await ensurePdf()
    if (! w) {
      setPdfError('Tab baru diblokir browser. Gunakan tombol Unduh PDF.')
      return
    }
    if (url) w.location.href = url
    else w.close()
  }

  async function download() {
    const url = await ensurePdf()
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = pdfName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const hariTampil = jadwal ? jadwal.hari.filter(h => (jadwal.data[h]?.length ?? 0) > 0) : []
  const kosong = !loading && !error && hariTampil.length === 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Jadwal Saya</h2>
        {jadwal?.has_pdf && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={pdfBusy} onClick={openTab}>
              {pdfBusy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-1.5" />}
              Buka di Tab Baru
            </Button>
            <Button size="sm" disabled={pdfBusy} onClick={download}>
              {pdfBusy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
              Unduh PDF
            </Button>
          </div>
        )}
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

      {jadwal?.has_pdf && (
        <p className="text-xs text-muted-foreground">
          Butuh jadwal resmi (format cetak)? Gunakan <strong>Unduh PDF</strong> atau <strong>Buka di Tab Baru</strong> di atas.
        </p>
      )}
    </div>
  )
}
