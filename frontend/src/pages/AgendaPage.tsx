import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, Clock, CheckCircle2, FileEdit, X } from 'lucide-react'
import { agendaApi } from '@/features/agenda/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

const statusBadge = {
  submitted: { label: 'Selesai', variant: 'hijau'  as const },
  draft:     { label: 'Draft',   variant: 'kuning' as const },
}

type PaginationMeta = { total: number; current_page: number; last_page: number; per_page: number }

function Pagination({ meta, page, onPage }: { meta: PaginationMeta; page: number; onPage: (p: number) => void }) {
  const [inputVal, setInputVal] = useState(String(page))
  useEffect(() => { setInputVal(String(page)) }, [page])

  function commit() {
    const p = parseInt(inputVal, 10)
    if (!isNaN(p) && p >= 1 && p <= meta.last_page) onPage(p)
    else setInputVal(String(page))
  }

  if (!meta || meta.last_page <= 1) return null
  const from = (page - 1) * meta.per_page + 1
  const to   = Math.min(page * meta.per_page, meta.total)

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{from}–{to} dari {meta.total} agenda</span>
      <div className="flex items-center gap-1">
        <button
          className="rounded border px-2 py-1 disabled:opacity-40 hover:bg-muted"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >← Sblm</button>
        <span className="px-1">Hal</span>
        <input
          type="number" min={1} max={meta.last_page}
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit() }}
          onBlur={commit}
          className="w-12 rounded border px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <span className="px-1">/ {meta.last_page}</span>
        <button
          className="rounded border px-2 py-1 disabled:opacity-40 hover:bg-muted"
          disabled={page >= meta.last_page}
          onClick={() => onPage(page + 1)}
        >Selanj →</button>
      </div>
    </div>
  )
}

function formatTanggal(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function AgendaPage() {
  const navigate = useNavigate()

  const [page, setPage]               = useState(1)
  const [kelas, setKelas]             = useState('')
  const [tanggalDari, setTanggalDari] = useState('')
  const [tanggalSampai, setTanggalSampai] = useState('')

  // reset ke halaman 1 bila filter berubah
  useEffect(() => { setPage(1) }, [kelas, tanggalDari, tanggalSampai])

  const hasFilter = kelas !== '' || tanggalDari !== '' || tanggalSampai !== ''

  function resetFilter() {
    setKelas(''); setTanggalDari(''); setTanggalSampai(''); setPage(1)
  }

  const { data: schedulesRes } = useQuery({
    queryKey: ['schedules-today'],
    queryFn: () => agendaApi.getTodaySchedules(),
  })

  const { data: classesRes } = useQuery({
    queryKey: ['agenda-my-classes'],
    queryFn: () => agendaApi.getMyClasses(),
  })
  const myClasses = classesRes?.data.data ?? []

  const { data: agendasRes, isLoading } = useQuery({
    queryKey: ['agendas', page, kelas, tanggalDari, tanggalSampai],
    queryFn: () => agendaApi.getAgendas({
      page,
      kelas:          kelas         || undefined,
      tanggal_dari:   tanggalDari   || undefined,
      tanggal_sampai: tanggalSampai || undefined,
    }),
  })

  const todaySchedules = schedulesRes?.data.data ?? []
  const agendas = agendasRes?.data.data ?? []
  const meta    = agendasRes?.data.meta

  const unfilledToday = todaySchedules.filter((s) => !s.agenda_hari_ini)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Agenda Pembelajaran</h1>
        <Button size="sm" onClick={() => navigate('/agenda/baru')}>
          <Plus className="h-4 w-4" />
          Isi Agenda
        </Button>
      </div>

      {/* ── Jadwal belum diisi hari ini ──────────────────────────────── */}
      {unfilledToday.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Belum diisi hari ini
          </p>
          {unfilledToday.map((s) => (
            <Card key={s.id} className="border-amber-200 bg-amber-50">
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    {s.jam_mulai.slice(0, 5)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.subject.nama}</p>
                    <p className="text-xs text-muted-foreground">{s.class.label}</p>
                  </div>
                </div>
                <Button
                  size="sm" variant="outline"
                  className="shrink-0 border-amber-400 text-amber-700 hover:bg-amber-100"
                  onClick={() => navigate(`/agenda/baru?schedule=${s.id}`)}
                >
                  Isi Sekarang
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Riwayat + filter ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Riwayat Agenda
        </p>

        {/* Filter kelas */}
        <div className="space-y-1">
          <Label className="text-xs">Filter Kelas</Label>
          <select
            value={kelas}
            onChange={e => setKelas(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Semua Kelas —</option>
            {myClasses.map((c) => (
              <option key={c.label} value={c.label}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Filter tanggal */}
        <div className="space-y-1">
          <Label className="text-xs">Filter Periode (Rentang Tanggal)</Label>
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-1.5 min-w-0">
              <span className="text-xs text-muted-foreground shrink-0">Dari:</span>
              <input
                type="date"
                value={tanggalDari}
                onChange={e => setTanggalDari(e.target.value)}
                className="flex-1 min-w-0 h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-1 items-center gap-1.5 min-w-0">
              <span className="text-xs text-muted-foreground shrink-0">s.d.:</span>
              <input
                type="date"
                value={tanggalSampai}
                min={tanggalDari || undefined}
                onChange={e => setTanggalSampai(e.target.value)}
                className="flex-1 min-w-0 h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {hasFilter && (
          <button
            onClick={resetFilter}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Reset semua filter
          </button>
        )}
      </div>

      {/* ── Daftar agenda ────────────────────────────────────────────── */}
      <div className="space-y-2">
        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && agendas.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">
              {hasFilter ? 'Tidak ada agenda yang cocok dengan filter.' : 'Belum ada agenda'}
            </p>
            {!hasFilter && (
              <p className="text-xs text-muted-foreground mt-1">Isi agenda pertama Anda hari ini.</p>
            )}
          </div>
        )}

        {agendas.map((agenda) => {
          const badge = statusBadge[agenda.status]
          return (
            <Card
              key={agenda.id}
              className="cursor-pointer hover:border-primary-200 transition-colors"
              onClick={() => navigate(`/agenda/${agenda.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold truncate">
                        {agenda.schedule?.subject.nama ?? '—'}
                      </p>
                      <Badge variant={badge.variant} className="shrink-0">
                        {badge.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {agenda.schedule?.class.label} · {formatTanggal(agenda.tanggal)}
                    </p>
                    {agenda.learning_objectives.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {agenda.learning_objectives.length} TP dicapai
                      </p>
                    )}
                    {agenda.resume_kbm && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {agenda.resume_kbm}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {agenda.status === 'submitted'
                      ? <CheckCircle2 className="h-5 w-5 text-ews-hijau" />
                      : <FileEdit className="h-5 w-5 text-ews-kuning" />
                    }
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {meta && <Pagination meta={meta} page={page} onPage={setPage} />}
      </div>
    </div>
  )
}
