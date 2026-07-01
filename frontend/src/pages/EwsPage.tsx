import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronRight, RefreshCw, ChevronLeft, FileText, FileSpreadsheet, Loader2 } from 'lucide-react'
import { ewsApi } from '@/features/ews/api'
import type { EwsLevel } from '@/features/ews/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { usePdfPreview } from '@/hooks/usePdfPreview'
import { useAuthStore } from '@/store/auth'

const LEVEL_CONFIG: Record<EwsLevel, { label: string; bg: string; text: string; border: string; dot: string }> = {
  hijau:  { label: 'Hijau',  bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200', dot: 'bg-green-500'  },
  kuning: { label: 'Kuning', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  oranye: { label: 'Oranye', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  merah:  { label: 'Merah',  bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',   dot: 'bg-red-500'    },
}

const LEVELS: EwsLevel[] = ['merah', 'oranye', 'kuning', 'hijau']
const PER_PAGE_OPTIONS = [25, 50, 100, 'semua'] as const
type PerPage = 25 | 50 | 100 | 'semua'

export default function EwsPage() {
  const navigate = useNavigate()
  const user     = useAuthStore(s => s.user)
  const isAdmin  = user?.role === 'admin' || user?.role === 'wakasek'
  const [filterLevel, setFilterLevel] = useState<EwsLevel | null>(null)
  const [perPage, setPerPage]         = useState<PerPage>(25)
  const [page, setPage]               = useState(1)
  const [exporting, setExporting]     = useState<'excel' | 'pdf' | null>(null)
  const pdfPreview = usePdfPreview({ printSettings: isAdmin })

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['ews', filterLevel],
    queryFn: () => ewsApi.getEws(filterLevel ? { level: filterLevel } : {}),
  })

  const allStudents = data?.data.data ?? []
  const summary     = data?.data.meta.summary

  useEffect(() => { setPage(1) }, [filterLevel, perPage])

  const handleExport = async (format: 'excel' | 'pdf') => {
    const params = new URLSearchParams({ format })
    if (filterLevel) params.set('level', filterLevel)

    if (format === 'pdf') {
      await pdfPreview.openPreview(`/ews/export?${params.toString()}`, 'EWS_Siswa.pdf')
      return
    }

    setExporting(format)
    try {
      const resp = await api.get(`/ews/export?${params.toString()}`, { responseType: 'blob' })
      const url  = URL.createObjectURL(new Blob([resp.data]))
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'EWS_Siswa.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(null)
    }
  }

  const totalItems = allStudents.length
  const totalPages = perPage === 'semua' ? 1 : Math.ceil(totalItems / perPage)
  const displayed  = perPage === 'semua'
    ? allStudents
    : allStudents.slice((page - 1) * perPage, page * perPage)

  const safePage = Math.min(page, Math.max(1, totalPages))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-bold">Early Warning System</h1>
        <div className="flex items-center gap-2">
          {totalItems > 0 && (
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
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            Perbarui
          </button>
        </div>
      </div>

      {/* ── Ringkasan per level ─────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-4 gap-2">
          {LEVELS.map((level) => {
            const cfg   = LEVEL_CONFIG[level]
            const count = summary[level] ?? 0
            return (
              <button
                key={level}
                onClick={() => setFilterLevel(filterLevel === level ? null : level)}
                className={cn(
                  'rounded-lg border p-3 text-center transition-all',
                  filterLevel === level
                    ? `${cfg.bg} ${cfg.border} ring-2 ring-offset-1 ring-current ${cfg.text}`
                    : 'border-border hover:border-muted-foreground',
                )}
              >
                <div className={cn('mx-auto mb-1.5 h-3 w-3 rounded-full', cfg.dot)} />
                <p className="text-xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{cfg.label}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Filter + per-page bar ───────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {filterLevel && (
            <>
              <span className="text-xs text-muted-foreground">Filter:</span>
              <button
                onClick={() => setFilterLevel(null)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium',
                  LEVEL_CONFIG[filterLevel].bg,
                  LEVEL_CONFIG[filterLevel].text,
                )}
              >
                {LEVEL_CONFIG[filterLevel].label} ×
              </button>
            </>
          )}
        </div>

        {/* Pilihan per-halaman */}
        {totalItems > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Tampilkan:</span>
            <div className="flex rounded-md border border-input overflow-hidden">
              {PER_PAGE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setPerPage(opt as PerPage)}
                  className={cn(
                    'px-2.5 py-1 text-xs transition-colors',
                    perPage === opt
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'hover:bg-muted',
                  )}
                >
                  {opt === 'semua' ? 'Semua' : opt}
                </button>
              ))}
            </div>
            <span className="text-muted-foreground">
              {perPage === 'semua'
                ? `${totalItems} data`
                : `${Math.min((page - 1) * perPage + 1, totalItems)}–${Math.min(page * perPage, totalItems)} dari ${totalItems}`}
            </span>
          </div>
        )}
      </div>

      {/* ── Daftar siswa ───────────────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && totalItems === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Tidak ada data EWS</p>
          <p className="text-xs text-muted-foreground mt-1">
            {filterLevel
              ? `Tidak ada siswa dengan level ${LEVEL_CONFIG[filterLevel].label}`
              : 'Belum ada siswa atau tahun ajaran aktif.'}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {displayed.map((s, idx) => {
          const cfg     = LEVEL_CONFIG[s.level]
          const nomor   = perPage === 'semua' ? idx + 1 : (page - 1) * (perPage as number) + idx + 1
          return (
            <Card
              key={s.student_id}
              className={cn('cursor-pointer transition-colors hover:border-muted-foreground', cfg.border)}
              onClick={() => navigate(`/ews/${s.student_id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{nomor}</span>
                  <div className={cn('h-3 w-3 shrink-0 rounded-full', cfg.dot)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{s.nama}</p>
                      <span className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                        cfg.bg, cfg.text,
                      )}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.nis}{s.kelas && ` · ${s.kelas}`}</p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <Metric label="Kehadiran" value={`${s.kehadiran_score}%`} warn={s.kehadiran_score < 80} />
                      <Metric
                        label="Karakter"
                        value={`${s.karakter_score >= 0 ? '+' : ''}${s.karakter_score}`}
                        warn={s.karakter_score < 0}
                      />
                      {s.catatan_count > 0 && (
                        <Metric label="Catatan" value={`${s.catatan_count}x`} warn={s.catatan_count >= 3} />
                      )}
                      {s.nilai_score !== null && (
                        <Metric label="Nilai" value={`${s.nilai_score}`} warn={s.nilai_score < 70} />
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── Navigasi halaman ───────────────────────────────────────────── */}
      {perPage !== 'semua' && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs disabled:opacity-40 hover:bg-muted"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Hal.</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={safePage}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (v >= 1 && v <= totalPages) setPage(v)
              }}
              className="w-12 rounded-md border border-input bg-background px-2 py-1 text-center text-xs"
            />
            <span className="text-muted-foreground">dari {totalPages}</span>
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs disabled:opacity-40 hover:bg-muted"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {pdfPreview.error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{pdfPreview.error}</div>
      )}
      {pdfPreview.modal}
      {pdfPreview.loadingOverlay}
    </div>
  )
}

function Metric({ label, value, warn }: { label: string; value: string; warn: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs',
      warn ? 'text-red-600 font-medium' : 'text-muted-foreground',
    )}>
      {warn && <AlertTriangle className="h-3 w-3" />}
      {label}: {value}
    </span>
  )
}
