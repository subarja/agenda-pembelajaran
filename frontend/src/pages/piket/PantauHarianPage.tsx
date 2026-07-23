import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Siren, Search, ChevronDown, ChevronRight, MapPin, UserCheck, AlarmClock } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import BelRealtime from '@/components/piket/BelRealtime'

interface TidakHadir { nama: string | null; status: string; alasan: string | null; terlambat_menit: number | null }
interface Sesi {
  id: string; jam_ke: string; jam_mulai: string; jam_selesai: string
  kelas: string | null; mapel: string; ruangan: string | null
  guru: string; guru_terjadwal: string | null; is_inval: boolean
  agenda_status: 'kosong' | 'draft' | 'submitted'; presensi_terisi: boolean
  hadir: number | null; total: number | null; tidak_hadir: TidakHadir[]
}
interface Kesiangan { nama: string | null; kelas: string | null; waktu_tiba: string | null; terlambat_menit: number; alasan: string | null; status_label: string }
interface Ringkasan { total_sesi: number; agenda_terisi: number; agenda_kosong: number; presensi_terisi: number; kesiangan_count: number }
interface PantauData { tanggal: string; server_time: string; sesi: Sesi[]; kesiangan: Kesiangan[]; ringkasan: Ringkasan }

type Filter = 'semua' | 'belum_agenda' | 'belum_presensi'

const STATUS_LABEL: Record<string, string> = { hadir: 'Hadir', sakit: 'Sakit', izin: 'Izin', alpha: 'Alpha' }

export default function PantauHarianPage() {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('semua')

  const { data, isLoading, isError } = useQuery<PantauData>({
    queryKey: ['piket-pantau'],
    queryFn: () => api.get('/piket/pantau').then(r => r.data.data),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })

  const sesiTampil = useMemo(() => {
    let s = data?.sesi ?? []
    if (filter === 'belum_agenda') s = s.filter(x => x.agenda_status === 'kosong')
    else if (filter === 'belum_presensi') s = s.filter(x => !x.presensi_terisi)
    const key = q.trim().toLowerCase()
    if (key) s = s.filter(x => [x.kelas, x.mapel, x.guru, x.ruangan].some(v => (v ?? '').toLowerCase().includes(key)))
    return s
  }, [data, filter, q])

  const r = data?.ringkasan

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Siren className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-lg font-semibold">Pantau Jadwal Harian</h1>
          <p className="text-xs text-muted-foreground">
            {data?.tanggal ? new Date(data.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
          </p>
        </div>
      </div>

      {isError && <div className="text-sm text-muted-foreground">Anda tidak bertugas piket hari ini, atau data gagal dimuat.</div>}

      <BelRealtime />

      {/* Ringkasan */}
      {r && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard label="Total Sesi" value={r.total_sesi} />
          <StatCard label="Agenda Terisi" value={`${r.agenda_terisi}/${r.total_sesi}`} tone={r.agenda_kosong > 0 ? 'warn' : 'ok'} />
          <StatCard label="Presensi Terisi" value={`${r.presensi_terisi}/${r.total_sesi}`} tone={r.presensi_terisi < r.total_sesi ? 'warn' : 'ok'} />
          <StatCard label="Kesiangan" value={r.kesiangan_count} tone={r.kesiangan_count > 0 ? 'warn' : 'ok'} />
        </div>
      )}

      {/* Kesiangan hari ini */}
      {(data?.kesiangan?.length ?? 0) > 0 && (
        <Card><CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium"><AlarmClock className="h-4 w-4" /> Kesiangan Hari Ini ({data!.kesiangan.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {data!.kesiangan.map((k, i) => (
              <Badge key={i} variant="secondary" className="font-normal">
                {k.nama} <span className="text-muted-foreground ml-1">· {k.kelas} · {k.waktu_tiba} (+{k.terlambat_menit}m){k.alasan ? ` · ${k.alasan}` : ''}</span>
              </Badge>
            ))}
          </div>
        </CardContent></Card>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
          <input className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm" placeholder="cari kelas / mapel / guru / ruangan" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {(['semua', 'belum_agenda', 'belum_presensi'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium border ${filter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'}`}>
              {f === 'semua' ? 'Semua' : f === 'belum_agenda' ? 'Belum Agenda' : 'Belum Presensi'}
            </button>
          ))}
        </div>
      </div>

      {/* Daftar sesi */}
      {isLoading ? <div className="h-40 rounded bg-muted animate-pulse" /> : (
        <div className="space-y-2">
          {sesiTampil.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada sesi yang cocok.</p>}
          {sesiTampil.map(s => <SesiCard key={s.id} s={s} />)}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: 'ok' | 'warn' }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === 'warn' ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30' : 'bg-card'}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function AgendaBadge({ status }: { status: Sesi['agenda_status'] }) {
  if (status === 'submitted') return <Badge className="bg-green-600 hover:bg-green-600 text-[10px]">Agenda ✓</Badge>
  if (status === 'draft') return <Badge className="bg-amber-500 hover:bg-amber-500 text-[10px]">Agenda draft</Badge>
  return <Badge variant="destructive" className="text-[10px]">Agenda ✗</Badge>
}

function SesiCard({ s }: { s: Sesi }) {
  const [open, setOpen] = useState(false)
  const adaTidakHadir = s.tidak_hadir.length > 0
  return (
    <div className="rounded-lg border bg-card">
      <div className="p-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="font-mono text-xs tabular-nums w-24 shrink-0">
          {s.jam_mulai}–{s.jam_selesai}
          <div className="text-[10px] text-muted-foreground">Jam ke-{s.jam_ke}</div>
        </div>
        <div className="flex-1 min-w-40">
          <div className="text-sm font-medium">{s.kelas} <span className="text-muted-foreground font-normal">· {s.mapel}</span></div>
          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2">
            <span className="inline-flex items-center gap-0.5"><UserCheck className="h-3 w-3" /> {s.guru}</span>
            {s.is_inval && <Badge variant="outline" className="text-[10px]">inval (asli: {s.guru_terjadwal})</Badge>}
            {s.ruangan && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {s.ruangan}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <AgendaBadge status={s.agenda_status} />
          {s.presensi_terisi
            ? <Badge className="bg-green-600 hover:bg-green-600 text-[10px]">Hadir {s.hadir}/{s.total}</Badge>
            : <Badge variant="destructive" className="text-[10px]">Presensi ✗</Badge>}
          {s.presensi_terisi && adaTidakHadir && (
            <button onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground">
              {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} {s.tidak_hadir.length} tidak hadir
            </button>
          )}
        </div>
      </div>
      {open && adaTidakHadir && (
        <div className="border-t px-3 py-2 bg-muted/30">
          <ul className="text-xs space-y-1">
            {s.tidak_hadir.map((t, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-2">
                <span className="font-medium">{t.nama ?? '—'}</span>
                <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[t.status] ?? t.status}</Badge>
                {t.terlambat_menit ? <span className="text-muted-foreground">telat {t.terlambat_menit}m</span> : null}
                {t.alasan && <span className="text-muted-foreground">· {t.alasan}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
