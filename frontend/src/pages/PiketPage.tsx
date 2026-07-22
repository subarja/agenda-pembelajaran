import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Siren, Clock, DoorOpen, AlarmClock, ClipboardList, FileText } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

/**
 * Dashboard Piket — guru piket hari itu. Sprint 3: pandangan bel real-time (bel berjalan,
 * berikutnya + hitung mundur, sebelumnya). Izin keluar QR, kesiangan, absensi & resume
 * menyusul di sprint berikutnya (kartu placeholder di bawah).
 *
 * Real-time = polling ringan (10 dtk) + tick lokal 1 dtk. Jam server disinkron ke lokal.
 */

interface PiketEvent { waktu: string; jenis_label: string; audio_nama: string | null; custom: boolean }
interface PiketRingkasan { tanggal: string; server_time: string; petugas: string[]; events: PiketEvent[] }

const toSec = (hms: string) => { const [h, m, s] = hms.split(':').map(Number); return h * 3600 + m * 60 + (s || 0) }
const pad = (n: number) => String(n).padStart(2, '0')
const fmtClock = (sec: number) => { sec = ((sec % 86400) + 86400) % 86400; return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}` }
const fmtDur = (sec: number) => `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`

export default function PiketPage() {
  const { data, isLoading, isError } = useQuery<PiketRingkasan>({
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

  if (isError) return <div className="p-6 text-sm text-muted-foreground">Anda tidak bertugas piket hari ini, atau data gagal dimuat.</div>

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Siren className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-lg font-semibold">Piket Hari Ini</h1>
          <p className="text-xs text-muted-foreground">
            {data?.tanggal ? new Date(data.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
            {data?.petugas?.length ? ` · Petugas: ${data.petugas.join(', ')}` : ''}
          </p>
        </div>
      </div>

      {/* Bel real-time */}
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

      {/* Placeholder fitur sprint berikutnya */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SoonCard icon={DoorOpen} title="Izin Keluar (QR)" desc="Menyetujui izin keluar siswa & memantau scan sekuriti keluar/masuk." />
        <SoonCard icon={AlarmClock} title="Izin Masuk Kesiangan" desc="Verifikasi siswa terlambat (foto) & poin otomatis." />
        <SoonCard icon={ClipboardList} title="Absensi Harian" desc="Absen manual seluruh kelas oleh petugas piket." />
        <SoonCard icon={FileText} title="Resume Piket" desc="Ringkasan & kejadian penting harian + ekspor." />
      </div>
    </div>
  )
}

function SoonCard({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <Card className="opacity-70">
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4" /> {title} <Badge variant="outline" className="ml-auto text-[10px]">Segera</Badge></div>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  )
}
