import { useEffect, useState } from 'react'
import { Download, FileX, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

// Sama seperti alur preview-PDF di seluruh aplikasi (lihat `usePdfPreview`), tapi PDF-nya
// langsung di-embed di halaman (bukan modal) karena user minta "jadwal juga muncul di
// halaman". Tetap lewat endpoint `?preview=1` (JSON base64) — BUKAN <a href> langsung ke
// endpoint mentah — supaya tidak kena sniffing download manager (mis. IDM).
export default function JadwalSayaPage() {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [filename, setFilename] = useState('jadwal.pdf')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let currentUrl: string | null = null
    setLoading(true)
    setError('')
    api.get('/schedules/my-pdf?preview=1')
      .then(resp => {
        const blob = base64ToBlob(resp.data.base64, 'application/pdf')
        currentUrl = URL.createObjectURL(blob)
        setBlobUrl(currentUrl)
        setFilename(resp.data.filename || 'jadwal.pdf')
      })
      .catch(e => setError(e?.response?.data?.message ?? 'Jadwal PDF belum tersedia.'))
      .finally(() => setLoading(false))
    return () => { if (currentUrl) URL.revokeObjectURL(currentUrl) }
  }, [])

  function download() {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Jadwal Saya</h2>
        {blobUrl && (
          <Button size="sm" onClick={download}>
            <Download className="h-4 w-4 mr-1.5" /> Unduh PDF
          </Button>
        )}
      </div>

      {loading && (
        <div className="rounded-xl border bg-card flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Memuat jadwal...</p>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border bg-card flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
          <FileX className="h-8 w-8" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && blobUrl && (
        <div className="rounded-xl border overflow-hidden shadow-sm">
          <iframe src={blobUrl} title="Jadwal Saya" className="w-full h-[80vh] border-0" />
        </div>
      )}
    </div>
  )
}
