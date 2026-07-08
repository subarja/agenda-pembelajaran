import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Eye, FileArchive, FileImage, FileText, FolderOpen, Loader2, Search } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type DokumenPenanganan = {
  session_id: string
  recommendation_id: string
  nama_siswa: string
  kelas: string
  tanggal: string
  diupload_oleh: string
  nama_file: string
  url: string
  path: string
  ukuran: number | null
  tipe: 'pdf' | 'gambar'
}

function formatUkuran(bytes: number | null): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Semua foto/PDF yang PERNAH diupload lewat fitur "Upload File" di riwayat penanganan
// siswa (EWS Siswa > detail rekomendasi) — bukan link yang ditempel manual. Scope-nya
// otomatis menyesuaikan siapa yang login (backend RecommendationController::documents):
// admin/wakasek lihat semua sekolah, wali kelas lihat kelasnya sendiri, guru/BK lain
// lihat yang mereka upload sendiri.
export default function RiwayatDokumenPenangananPage() {
  const [search, setSearch] = useState('')
  const [tipeFilter, setTipeFilter] = useState<'semua' | 'gambar' | 'pdf'>('semua')
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['handling-documents'],
    queryFn: () => api.get('/handling-documents').then(r => r.data.data as DokumenPenanganan[]),
  })

  const filtered = useMemo(() => {
    const list = data ?? []
    return list.filter(d => {
      if (tipeFilter !== 'semua' && d.tipe !== tipeFilter) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return d.nama_siswa.toLowerCase().includes(q) || d.kelas.toLowerCase().includes(q) || d.nama_file.toLowerCase().includes(q)
    })
  }, [data, search, tipeFilter])

  async function downloadOne(doc: DokumenPenanganan) {
    setDownloadingPath(doc.path)
    try {
      const resp = await api.get('/handling-documents/download', { params: { path: doc.path }, responseType: 'blob' })
      const url = URL.createObjectURL(resp.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.nama_file
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingPath(null)
    }
  }

  async function downloadAll() {
    setDownloadingAll(true)
    try {
      const resp = await api.get('/handling-documents/download-all', { responseType: 'blob' })
      const url = URL.createObjectURL(resp.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `riwayat_dokumen_penanganan_${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingAll(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><FolderOpen className="h-5 w-5" /> Riwayat Dokumen Penanganan</h2>
          <p className="text-sm text-muted-foreground">Foto & PDF yang pernah diupload saat mengisi riwayat penanganan siswa.</p>
        </div>
        <Button onClick={downloadAll} disabled={downloadingAll || !filtered.length}>
          {downloadingAll ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileArchive className="h-4 w-4 mr-1.5" />}
          Download Semua (ZIP)
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full rounded-md border border-input pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-white"
            placeholder="Cari nama siswa, kelas, atau nama file..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 rounded-md border p-1 bg-white">
          {(['semua', 'gambar', 'pdf'] as const).map(t => (
            <button key={t} onClick={() => setTipeFilter(t)}
              className={`rounded px-3 py-1.5 text-xs font-medium capitalize ${tipeFilter === t ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Memuat dokumen...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
            <p className="text-sm">Gagal memuat daftar dokumen.</p>
          </div>
        ) : !filtered.length ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
            <FolderOpen className="h-8 w-8" />
            <p className="text-sm">{data?.length ? 'Tidak ada dokumen yang cocok dengan filter.' : 'Belum ada dokumen yang diupload.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Siswa</th>
                  <th className="text-left font-medium px-3 py-2">Kelas</th>
                  <th className="text-left font-medium px-3 py-2">Tanggal</th>
                  <th className="text-left font-medium px-3 py-2">Nama File</th>
                  <th className="text-left font-medium px-3 py-2">Ukuran</th>
                  <th className="text-left font-medium px-3 py-2">Diupload Oleh</th>
                  <th className="text-right font-medium px-3 py-2">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(doc => (
                  <tr key={`${doc.session_id}-${doc.path}`} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{doc.nama_siswa}</td>
                    <td className="px-3 py-2 text-muted-foreground">{doc.kelas}</td>
                    <td className="px-3 py-2 text-muted-foreground">{doc.tanggal}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        {doc.tipe === 'pdf' ? <FileText className="h-3.5 w-3.5 text-red-500 shrink-0" /> : <FileImage className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                        <span className="truncate max-w-[220px]">{doc.nama_file}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{formatUkuran(doc.ukuran)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{doc.diupload_oleh}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="rounded p-1.5 hover:bg-muted" title="Lihat">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </a>
                        <button onClick={() => downloadOne(doc)} disabled={downloadingPath === doc.path} className="rounded p-1.5 hover:bg-muted" title="Download">
                          {downloadingPath === doc.path ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Download className="h-4 w-4 text-muted-foreground" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!!filtered.length && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} dokumen {tipeFilter !== 'semua' || search ? `(dari ${data?.length ?? 0} total)` : ''} — <Badge className="ml-1">{filtered.filter(d => d.tipe === 'gambar').length} gambar</Badge>{' '}
          <Badge>{filtered.filter(d => d.tipe === 'pdf').length} PDF</Badge>
        </p>
      )}
    </div>
  )
}
