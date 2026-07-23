import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface PiketEvent { waktu: string; jenis_label: string; audio_nama: string | null; custom: boolean }
interface PiketShiftInfo { nama_shift: string; jam_mulai: string; jam_selesai: string; petugas: string[]; aktif_sekarang: boolean }
interface PiketRingkasan { tanggal: string; server_time: string; petugas: string[]; shifts: PiketShiftInfo[]; events: PiketEvent[] }

const toSec = (hms: string) => { const [h, m, s] = hms.split(':').map(Number); return h * 3600 + m * 60 + (s || 0) }
const pad = (n: number) => String(n).padStart(2, '0')
const fmtClock = (sec: number) => { sec = ((sec % 86400) + 86400) % 86400; return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}` }
const fmtDur = (sec: number) => `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`

/** Kartu bel real-time + strip shift piket hari ini (shift aktif ditonjolkan). */
export default function BelRealtime() {
  const { data, isLoading } = useQuery<PiketRingkasan>({
    queryKey: ['piket-ringkasan'],
    queryFn: () => api.get('/piket/ringkasan').then(r => r.data.data),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  })

  const offsetRef = useRef(0)
  const [nowSec, setNowSec] = useState(0)
  const localSec = useCallback(() => { const d = new Date(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() }, [])

  useEffect(() => { if (data?.server_time) offsetRef.current = toSec(data.server_time) - localSec() }, [data?.server_time, localSec])
  useEffect(() => { const id = setInterval(() => setNowSec(localSec() + offsetRef.current), 1000); return () => clearInterval(id) }, [localSec])

  const { current, next } = useMemo(() => {
    const evs = data?.events ?? []
    let current: PiketEvent | null = null, next: PiketEvent | null = null
    for (const e of evs) { if (toSec(e.waktu) <= nowSec) current = e; else { next = e; break } }
    return { current, next }
  }, [data, nowSec])

  const countdown = next ? Math.max(0, toSec(next.waktu) - nowSec) : null

  return (
    <>
      {(data?.shifts?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          {data!.shifts.map((s, i) => (
            <div key={i} className={`rounded-lg border px-3 py-2 text-xs ${s.aktif_sekarang ? 'border-primary bg-primary/10' : 'bg-muted/40'}`}>
              <div className="flex items-center gap-1.5 font-medium">
                {s.nama_shift} <span className="text-muted-foreground font-normal">{s.jam_mulai}–{s.jam_selesai}</span>
                {s.aktif_sekarang && <Badge variant="default" className="text-[10px]">aktif</Badge>}
              </div>
              <div className="text-muted-foreground mt-0.5">{s.petugas.length ? s.petugas.join(', ') : 'Belum ada petugas'}</div>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium"><Clock className="h-4 w-4" /> Bel Berjalan</div>
            <div className="font-mono text-2xl font-bold tabular-nums">{fmtClock(nowSec)}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">Sebelumnya</div>
              <div className="font-semibold text-sm mt-0.5">{current?.jenis_label ?? '—'}</div>
              <div className="text-xs text-muted-foreground">{current?.waktu.slice(0, 5) ?? ''}</div>
            </div>
            <div className="rounded-lg bg-primary/10 p-3">
              <div className="text-xs text-muted-foreground">Berikutnya</div>
              <div className="font-semibold text-sm mt-0.5">{next?.jenis_label ?? 'Selesai'}</div>
              <div className="text-xs text-primary font-mono">{countdown !== null ? `${fmtDur(countdown)}${next ? ` (${next.waktu.slice(0, 5)})` : ''}` : ''}</div>
            </div>
          </div>

          {isLoading ? <div className="h-24 rounded bg-muted animate-pulse" /> : (
            <div className="rounded-lg border divide-y">
              {(data?.events ?? []).length === 0 && <div className="p-3 text-sm text-muted-foreground">Tidak ada jadwal bel hari ini.</div>}
              {(data?.events ?? []).map((e, i) => {
                const past = toSec(e.waktu) <= nowSec
                const now = current && e.waktu === current.waktu && e.jenis_label === current.jenis_label
                return (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2 text-sm ${past ? 'opacity-50' : ''} ${now ? 'bg-primary/5' : ''}`}>
                    <span className="font-mono tabular-nums w-14">{e.waktu.slice(0, 5)}</span>
                    <span className="flex-1">{e.jenis_label}{e.custom && <Badge variant="secondary" className="ml-1 text-[10px]">kustom</Badge>}</span>
                    <span className="text-xs text-muted-foreground">{e.audio_nama ?? ''}</span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
