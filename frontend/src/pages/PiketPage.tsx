import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Siren, Clock, DoorOpen, AlarmClock, ClipboardList, FileText, Check, X, LogOut, LogIn } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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

      {/* Izin Keluar (QR) */}
      <IzinKeluarSection />

      {/* Placeholder fitur sprint berikutnya */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SoonCard icon={AlarmClock} title="Izin Masuk Kesiangan" desc="Verifikasi siswa terlambat (foto) & poin otomatis." />
        <SoonCard icon={ClipboardList} title="Absensi Harian" desc="Absen manual seluruh kelas oleh petugas piket." />
        <SoonCard icon={FileText} title="Resume Piket" desc="Ringkasan & kejadian penting harian + ekspor." />
      </div>
    </div>
  )
}

// ── Izin Keluar: proses pengajuan + pantau keluar/masuk real-time ────────────
interface IzinRow {
  id: string; nama: string | null; kelas: string | null; foto_url: string | null
  keperluan: string; alasan: string | null; status: string; status_label: string
  berlaku_dari: string | null; berlaku_sampai: string | null
  waktu_keluar: string | null; waktu_masuk: string | null; catatan_piket: string | null
}

function IzinKeluarSection() {
  const qc = useQueryClient()
  const { data } = useQuery<{ data: IzinRow[] }>({
    queryKey: ['piket-izin-keluar'],
    queryFn: () => api.get('/piket/izin-keluar').then(r => r.data),
    refetchInterval: 10_000,
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['piket-izin-keluar'] })

  const proses = useMutation({
    mutationFn: (p: { id: string; body: Record<string, unknown> }) => api.post(`/piket/izin-keluar/${p.id}/proses`, p.body).then(r => r.data),
    onSuccess: () => refresh(),
  })

  const rows = data?.data ?? []
  const menunggu = rows.filter(r => r.status === 'diajukan')
  const berjalan = rows.filter(r => ['disetujui', 'keluar', 'kembali'].includes(r.status))

  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium"><DoorOpen className="h-4 w-4" /> Izin Keluar (QR)</div>

      <div>
        <div className="text-xs text-muted-foreground mb-2">Menunggu persetujuan ({menunggu.length})</div>
        {menunggu.length === 0 && <p className="text-xs text-muted-foreground">Tidak ada pengajuan.</p>}
        <div className="space-y-2">
          {menunggu.map(r => <PengajuanCard key={r.id} row={r} onProses={(body) => proses.mutate({ id: r.id, body })} pending={proses.isPending} />)}
        </div>
      </div>

      {berjalan.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-2">Berjalan hari ini</div>
          <div className="rounded-lg border divide-y">
            {berjalan.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1">{r.nama} <span className="text-muted-foreground text-xs">· {r.keperluan}</span></span>
                <Badge variant="secondary" className="text-[10px]">{r.status_label}</Badge>
                {r.waktu_keluar && <span className="text-xs text-blue-600 flex items-center gap-0.5"><LogOut className="h-3 w-3" />{r.waktu_keluar}</span>}
                {r.waktu_masuk && <span className="text-xs text-green-600 flex items-center gap-0.5"><LogIn className="h-3 w-3" />{r.waktu_masuk}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </CardContent></Card>
  )
}

function PengajuanCard({ row, onProses, pending }: { row: IzinRow; onProses: (body: Record<string, unknown>) => void; pending: boolean }) {
  const [sampai, setSampai] = useState('')
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center gap-3">
        {row.foto_url
          ? <img src={row.foto_url} alt="" className="h-12 w-12 rounded object-cover border" />
          : <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">👤</div>}
        <div className="flex-1">
          <div className="font-medium text-sm">{row.nama} <span className="text-xs text-muted-foreground">{row.kelas}</span></div>
          <div className="text-xs text-muted-foreground">{row.keperluan}{row.alasan ? ` — ${row.alasan}` : ''}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-muted-foreground flex items-center gap-1">
          Berlaku s.d. <input type="time" className="rounded border px-2 py-1 text-xs" value={sampai} onChange={e => setSampai(e.target.value)} />
        </label>
        <Button size="sm" disabled={pending || !sampai} onClick={() => onProses({ aksi: 'setujui', berlaku_sampai: sampai })}>
          <Check className="h-4 w-4 mr-1" /> Setujui
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => onProses({ aksi: 'tolak' })}>
          <X className="h-4 w-4 mr-1" /> Tolak
        </Button>
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
