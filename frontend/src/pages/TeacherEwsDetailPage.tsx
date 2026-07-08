import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, FileSpreadsheet, FileText, Loader2, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn, toLocalDateStr } from '@/lib/utils'
import { usePdfPreview } from '@/hooks/usePdfPreview'

interface Sesi {
  tanggal: string
  hari: string
  jam: string
  kelas: string
  mapel: string
  status: 'submitted' | 'draft' | 'kosong'
  log: { aksi: string; waktu: string; ip: string } | null
}

interface DetailData {
  teacher: { nama: string; nip: string | null; mapel_utama: string | null; foto_url: string | null }
  periode: { mulai: string; akhir: string }
  summary: { total_jadwal: number; terisi: number; draft: number; kosong: number }
  sesi: Sesi[]
}

const STATUS_CONFIG: Record<Sesi['status'], { label: string; cls: string }> = {
  submitted: { label: 'Terisi', cls: 'bg-green-100 text-green-700' },
  draft:     { label: 'Draft',  cls: 'bg-yellow-100 text-yellow-700' },
  kosong:    { label: 'Kosong', cls: 'bg-red-100 text-red-700' },
}

export default function TeacherEwsDetailPage() {
  const { teacherId } = useParams<{ teacherId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const today     = toLocalDateStr(new Date())
  const thirtyAgo = toLocalDateStr(new Date(Date.now() - 30 * 86400000))

  const [mulai, setMulai] = useState(searchParams.get('mulai') || thirtyAgo)
  const [akhir, setAkhir] = useState(searchParams.get('akhir') || today)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  const pdfPreview = usePdfPreview({ printSettings: true })

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['teacher-ews-sessions', teacherId, mulai, akhir],
    queryFn: () => api.get(`/admin/teacher-ews/${teacherId}/sessions?tanggal_mulai=${mulai}&tanggal_akhir=${akhir}`).then(r => r.data),
    enabled: !!teacherId,
  })

  const d: DetailData | undefined = data?.data

  const handleExport = async (format: 'excel' | 'pdf') => {
    const params = new URLSearchParams({ format, tanggal_mulai: mulai, tanggal_akhir: akhir })
    const endpoint = `/admin/teacher-ews/${teacherId}/sessions/export?${params.toString()}`

    if (format === 'pdf') {
      await pdfPreview.openPreview(endpoint, `Detail_Agenda_${d?.teacher.nama ?? teacherId}.pdf`)
      return
    }

    setExporting(format)
    try {
      const resp = await api.get(endpoint, { responseType: 'blob' })
      const url  = URL.createObjectURL(new Blob([resp.data]))
      const a    = document.createElement('a')
      a.href     = url
      a.download = `Detail_Agenda_${d?.teacher.nama ?? teacherId}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        {d && (
          <img src={d.teacher.foto_url || '/images/default-avatar.jpg'} alt={d.teacher.nama} className="w-[20mm] h-auto shrink-0 rounded border" />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{d?.teacher.nama ?? 'Detail Pengisian Agenda'}</h1>
          {d && (
            <p className="text-sm text-muted-foreground">
              NIP: {d.teacher.nip ?? '—'} · {d.teacher.mapel_utama ?? '—'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {d && d.sesi.length > 0 && (
            <>
              <Button variant="outline" size="sm" disabled={!!exporting} onClick={() => handleExport('excel')}
                className="h-8 gap-1.5 text-xs">
                {exporting === 'excel' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                Excel
              </Button>
              <Button variant="outline" size="sm" disabled={pdfPreview.loading} onClick={() => handleExport('pdf')}
                className="h-8 gap-1.5 text-xs">
                {pdfPreview.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                PDF
              </Button>
            </>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            Perbarui
          </button>
        </div>
      </div>

      {/* Filter periode */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Dari</label>
          <input type="date" value={mulai} max={toLocalDateStr(new Date())} onChange={e => setMulai(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Sampai</label>
          <input type="date" value={akhir} max={toLocalDateStr(new Date())} onChange={e => setAkhir(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
        </div>
      </div>

      {/* Ringkasan */}
      {d && (
        <div className="grid grid-cols-4 gap-2">
          <SummaryStat label="Total Jadwal" value={d.summary.total_jadwal} cls="text-foreground" />
          <SummaryStat label="Terisi" value={d.summary.terisi} cls="text-green-700" />
          <SummaryStat label="Draft" value={d.summary.draft} cls="text-yellow-700" />
          <SummaryStat label="Kosong" value={d.summary.kosong} cls="text-red-700" />
        </div>
      )}

      {/* Daftar sesi */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : !d || d.sesi.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">
          Tidak memiliki jadwal aktif pada periode ini.
        </p>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">No</th>
                  <th className="px-3 py-2 font-medium">Tanggal</th>
                  <th className="px-3 py-2 font-medium">Hari</th>
                  <th className="px-3 py-2 font-medium">Jam</th>
                  <th className="px-3 py-2 font-medium">Kelas</th>
                  <th className="px-3 py-2 font-medium">Mapel</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Diisi Pada</th>
                </tr>
              </thead>
              <tbody>
                {d.sesi.map((s, i) => {
                  const cfg = STATUS_CONFIG[s.status]
                  return (
                    <tr key={`${s.tanggal}-${i}`} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(s.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-3 py-2">{s.hari}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{s.jam}</td>
                      <td className="px-3 py-2">{s.kelas}</td>
                      <td className="px-3 py-2">{s.mapel}</td>
                      <td className="px-3 py-2">
                        <Badge className={cn('text-xs', cfg.cls)}>{cfg.label}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {s.status === 'kosong'
                          ? '—'
                          : s.log
                            ? <>{s.log.aksi} {s.log.waktu}<br />IP {s.log.ip}</>
                            : 'Belum tercatat (sebelum fitur log aktif)'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Keterangan */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p>Status Terisi/Draft/Kosong mengikuti status agenda yang guru simpan di halaman Agenda Pembelajaran.</p>
        <p>
          Kolom "Diisi Pada" diambil dari log audit yang mencatat waktu &amp; alamat IP setiap kali agenda
          dibuat/diubah — hanya tersedia untuk pengisian sejak fitur ini aktif. Agenda lama tetap tampil
          statusnya tapi log-nya "Belum tercatat".
        </p>
      </div>

      {pdfPreview.error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{pdfPreview.error}</div>
      )}
      {pdfPreview.modal}
      {pdfPreview.loadingOverlay}
    </div>
  )
}

function SummaryStat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className={cn('text-xl font-bold', cls)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
