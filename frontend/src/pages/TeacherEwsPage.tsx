import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileSpreadsheet, FileText, Loader2, RefreshCw, Users } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, toLocalDateStr } from '@/lib/utils'
import { usePdfPreview } from '@/hooks/usePdfPreview'

const LEVEL_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  merah:  { label: 'Merah',  dot: 'bg-red-500',    bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200'    },
  oranye: { label: 'Oranye', dot: 'bg-orange-500',  bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  kuning: { label: 'Kuning', dot: 'bg-yellow-500',  bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  hijau:  { label: 'Hijau',  dot: 'bg-green-500',   bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200'  },
  'n/a':  { label: 'Tidak ada jadwal', dot: 'bg-gray-300', bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' },
}

interface TeacherEws {
  teacher_id: string; nama: string; nip: string; mapel_utama: string; role: string
  total_jadwal: number; total_diisi: number; total_tersubmit: number; total_draft: number; total_kosong: number
  pct_terisi: number | null; level: string
  last_login: string; last_login_date: string | null; last_login_raw: string | null
}

const PER_PAGE_OPTIONS = [25, 50, 100, 'semua'] as const
type PerPage = 25 | 50 | 100 | 'semua'

export default function TeacherEwsPage() {
  const navigate  = useNavigate()
  const today     = toLocalDateStr(new Date())
  const thirtyAgo = toLocalDateStr(new Date(Date.now() - 30 * 86400000))

  const [mulai, setMulai]        = useState(thirtyAgo)
  const [akhir, setAkhir]        = useState(today)
  const [filterLevel, setFilter] = useState<string | null>(null)
  const [perPage, setPerPage]    = useState<PerPage>(25)
  const [page, setPage]          = useState(1)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  // Halaman ini hanya dapat diakses admin/wakasek (lihat nav-config.ts) — tombol
  // pengaturan kertas & margin aman ditampilkan tanpa cek role tambahan di sini.
  const pdfPreview = usePdfPreview({ printSettings: true })

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['teacher-ews', mulai, akhir],
    queryFn: () => api.get(`/admin/teacher-ews?tanggal_mulai=${mulai}&tanggal_akhir=${akhir}`).then(r => r.data),
  })

  const teachers: TeacherEws[] = data?.data ?? []
  const summary  = data?.meta?.summary ?? {}
  const filtered = filterLevel ? teachers.filter(t => t.level === filterLevel) : teachers

  useEffect(() => { setPage(1) }, [filterLevel, perPage, mulai, akhir])

  const handleExport = async (format: 'excel' | 'pdf') => {
    const params = new URLSearchParams({ format, tanggal_mulai: mulai, tanggal_akhir: akhir })
    if (filterLevel) params.set('level', filterLevel)

    if (format === 'pdf') {
      await pdfPreview.openPreview(`/admin/teacher-ews/export?${params.toString()}`, 'EWS_Guru.pdf')
      return
    }

    setExporting(format)
    try {
      const resp = await api.get(`/admin/teacher-ews/export?${params.toString()}`, { responseType: 'blob' })
      const url  = URL.createObjectURL(new Blob([resp.data]))
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'EWS_Guru.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(null)
    }
  }

  const totalItems = filtered.length
  const totalPages = perPage === 'semua' ? 1 : Math.ceil(totalItems / perPage)
  const displayed  = perPage === 'semua'
    ? filtered
    : filtered.slice((page - 1) * perPage, page * perPage)

  const safePage = Math.min(page, Math.max(1, totalPages))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5" />
            EWS Kepatuhan Guru
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitoring pengisian agenda & aktivitas guru
          </p>
        </div>
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
          <input type="date" value={mulai} onChange={e => setMulai(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Sampai</label>
          <input type="date" value={akhir} onChange={e => setAkhir(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
        </div>
      </div>

      {/* Distribusi level */}
      {data && (
        <div className="grid grid-cols-4 gap-2">
          {(['merah', 'oranye', 'kuning', 'hijau'] as const).map(level => {
            const cfg = LEVEL_CONFIG[level]
            return (
              <button
                key={level}
                onClick={() => setFilter(filterLevel === level ? null : level)}
                className={cn(
                  'rounded-lg border p-3 text-center transition-all',
                  filterLevel === level
                    ? `${cfg.bg} ${cfg.border} ring-2 ring-current ${cfg.text}`
                    : 'border-border hover:border-muted-foreground'
                )}
              >
                <div className={cn('mx-auto mb-1.5 h-3 w-3 rounded-full', cfg.dot)} />
                <p className="text-xl font-bold">{summary[level] ?? 0}</p>
                <p className="text-xs text-muted-foreground">{cfg.label}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Legenda */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
        <span>Level ditentukan dari % sesi yang sudah diisi dalam periode:</span>
        <span className="text-red-700 font-medium">Merah &lt;50%</span>
        <span className="text-orange-700 font-medium">Oranye 50–74%</span>
        <span className="text-yellow-700 font-medium">Kuning 75–89%</span>
        <span className="text-green-700 font-medium">Hijau ≥90%</span>
      </div>

      {/* ── Kontrol per-halaman + info ─────────────────────────────────── */}
      {!isLoading && totalItems > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          {filterLevel ? (
            <button
              onClick={() => setFilter(null)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium',
                LEVEL_CONFIG[filterLevel]?.bg,
                LEVEL_CONFIG[filterLevel]?.text,
              )}
            >
              {LEVEL_CONFIG[filterLevel]?.label ?? filterLevel} ×
            </button>
          ) : <span />}

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
            <span>
              {perPage === 'semua'
                ? `${totalItems} data`
                : `${Math.min((page - 1) * perPage + 1, totalItems)}–${Math.min(page * perPage, totalItems)} dari ${totalItems}`}
            </span>
          </div>
        </div>
      )}

      {/* Daftar guru */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : displayed.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">Tidak ada data.</p>
      ) : (
        <div className="space-y-2">
          {displayed.map((t, idx) => {
            const cfg      = LEVEL_CONFIG[t.level] ?? LEVEL_CONFIG['n/a']
            const pct      = t.pct_terisi
            const loginLama = t.last_login_raw
              ? new Date(t.last_login_raw) < new Date(Date.now() - 7 * 86400000)
              : true
            const nomor    = perPage === 'semua' ? idx + 1 : (page - 1) * (perPage as number) + idx + 1

            return (
              <Card
                key={t.teacher_id}
                className={cn('border cursor-pointer hover:border-primary/40 hover:shadow-sm transition-shadow', cfg.border)}
                onClick={() => navigate(`/ews-guru/${t.teacher_id}?mulai=${mulai}&akhir=${akhir}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-muted-foreground w-5 text-right shrink-0 mt-1">{nomor}</span>
                    <div className={cn('mt-1 h-3 w-3 shrink-0 rounded-full', cfg.dot)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{t.nama}</p>
                        <Badge className={cn('text-xs', cfg.bg, cfg.text)}>{cfg.label}</Badge>
                        <span className="text-xs text-muted-foreground capitalize">
                          {t.role.replace(/_/g, ' ')}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.mapel_utama} · NIP: {t.nip}</p>

                      {t.total_jadwal > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>{t.total_diisi} dari {t.total_jadwal} sesi diisi</span>
                            <span className={cn('font-semibold', cfg.text)}>
                              {pct !== null ? `${pct}%` : '—'}
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all',
                                t.level === 'merah'  ? 'bg-red-500'    :
                                t.level === 'oranye' ? 'bg-orange-500' :
                                t.level === 'kuning' ? 'bg-yellow-500' : 'bg-green-500'
                              )}
                              style={{ width: `${pct ?? 0}%` }}
                            />
                          </div>
                          {t.total_draft > 0 && (
                            <p className="text-xs text-yellow-600 mt-0.5">
                              {t.total_draft} agenda masih draft (belum submit)
                            </p>
                          )}
                          {t.total_kosong > 0 && (
                            <p className="text-xs text-red-600 mt-0.5">
                              {t.total_kosong} sesi kosong tidak diisi
                            </p>
                          )}
                        </div>
                      )}

                      {t.total_jadwal === 0 && (
                        <p className="text-xs text-muted-foreground mt-1 italic">Tidak memiliki jadwal mengajar aktif.</p>
                      )}

                      <div className={cn(
                        'flex items-center gap-1.5 mt-2 text-xs',
                        loginLama ? 'text-red-600' : 'text-muted-foreground'
                      )}>
                        {loginLama
                          ? <AlertTriangle className="h-3 w-3 shrink-0" />
                          : <CheckCircle2 className="h-3 w-3 shrink-0 text-green-600" />
                        }
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>
                          Terakhir login: <strong>{t.last_login_date ?? 'Belum pernah'}</strong>
                          {t.last_login_raw && <span className="text-muted-foreground"> ({t.last_login})</span>}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

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
