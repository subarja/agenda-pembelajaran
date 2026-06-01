import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronRight, RefreshCw } from 'lucide-react'
import { ewsApi } from '@/features/ews/api'
import type { EwsLevel } from '@/features/ews/types'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const LEVEL_CONFIG: Record<EwsLevel, { label: string; bg: string; text: string; border: string; dot: string }> = {
  hijau:  { label: 'Hijau',  bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200', dot: 'bg-green-500'  },
  kuning: { label: 'Kuning', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  oranye: { label: 'Oranye', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  merah:  { label: 'Merah',  bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',   dot: 'bg-red-500'    },
}

const LEVELS: EwsLevel[] = ['merah', 'oranye', 'kuning', 'hijau']

export default function EwsPage() {
  const navigate = useNavigate()
  const [filterLevel, setFilterLevel] = useState<EwsLevel | null>(null)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['ews', filterLevel],
    queryFn: () => ewsApi.getEws(filterLevel ? { level: filterLevel } : {}),
  })

  const students = data?.data.data ?? []
  const summary  = data?.data.meta.summary

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Early Warning System</h1>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          Perbarui
        </button>
      </div>

      {/* ── Ringkasan per level ─────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-4 gap-2">
          {LEVELS.map((level) => {
            const cfg = LEVEL_CONFIG[level]
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

      {/* ── Filter chips ───────────────────────────────────────────────── */}
      {filterLevel && (
        <div className="flex items-center gap-2">
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
        </div>
      )}

      {/* ── Daftar siswa ───────────────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && students.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Tidak ada data EWS</p>
          <p className="text-xs text-muted-foreground mt-1">
            {filterLevel ? `Tidak ada siswa dengan level ${LEVEL_CONFIG[filterLevel].label}` : 'Belum ada siswa atau tahun ajaran aktif.'}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {students.map((s) => {
          const cfg = LEVEL_CONFIG[s.level]
          return (
            <Card
              key={s.student_id}
              className={cn('cursor-pointer transition-colors hover:border-muted-foreground', cfg.border)}
              onClick={() => navigate(`/ews/${s.student_id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {/* Level dot */}
                  <div className={cn('h-3 w-3 shrink-0 rounded-full', cfg.dot)} />

                  {/* Student info */}
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

                    {/* Mini metrics */}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <Metric
                        label="Kehadiran"
                        value={`${s.kehadiran_score}%`}
                        warn={s.kehadiran_score < 80}
                      />
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
