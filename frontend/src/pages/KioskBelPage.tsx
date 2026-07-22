import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Volume2, BellRing, AlertTriangle, Wifi, WifiOff } from 'lucide-react'
import api from '@/lib/api'

/**
 * Pemutar Bel (kiosk) — halaman perangkat tersambung speaker. Publik (butuh token perangkat
 * pada URL: /bel/pemutar?token=...). Mengambil jadwal bunyi hari ini, memutar audio pada
 * waktunya (jam server disinkron ke tick lokal 1 dtk), lapor heartbeat & log tiap bunyi.
 *
 * cPanel-friendly: TANPA websocket. Poll /bel/hari-ini tiap 60 dtk (sekaligus heartbeat),
 * tick lokal 1 dtk untuk hitung mundur & pemicu bunyi. Autoplay perlu 1 gestur ("Aktifkan Suara").
 */

interface KioskEvent { waktu: string; jenis_event: string; jenis_label: string; bell_audio_id: number | null; audio_nama: string | null; audio_url: string | null }
interface ManualAudio { id: number; nama: string; kategori: string; url: string | null }
interface KioskData { tanggal: string; server_time: string; events: KioskEvent[]; manual_audios: ManualAudio[] }

const toSec = (hms: string) => { const [h, m, s] = hms.split(':').map(Number); return h * 3600 + m * 60 + (s || 0) }
const pad = (n: number) => String(n).padStart(2, '0')
const fmtClock = (sec: number) => { sec = ((sec % 86400) + 86400) % 86400; return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}` }

export default function KioskBelPage() {
  const token = new URLSearchParams(window.location.search).get('token') ?? ''

  const [data, setData] = useState<KioskData | null>(null)
  const [online, setOnline] = useState(true)
  const [enabled, setEnabled] = useState(false)      // audio di-unlock oleh gestur
  const [nowSec, setNowSec] = useState(0)
  const [lastRung, setLastRung] = useState<string | null>(null)

  const offsetRef = useRef(0)                         // serverSec - localSec saat fetch
  const playedRef = useRef<Set<string>>(new Set())
  const dateRef = useRef<string>('')
  const audioElRef = useRef<HTMLAudioElement | null>(null)

  const localSec = () => { const d = new Date(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() }

  // ── Ambil jadwal hari ini (+ heartbeat) ────────────────────────────────────
  const fetchPlan = useCallback(async () => {
    try {
      const r = await api.get('/bel/hari-ini', { params: token ? { device_token: token } : {} })
      const d: KioskData = r.data.data
      offsetRef.current = toSec(d.server_time) - localSec()

      // Ganti hari -> reset penanda; event yang sudah lewat saat load ditandai "sudah"
      // supaya tidak membunyikan bel masa lalu ketika halaman dibuka di tengah hari.
      if (dateRef.current !== d.tanggal) { playedRef.current = new Set(); dateRef.current = d.tanggal }
      const cur = localSec() + offsetRef.current
      d.events.forEach(e => { if (toSec(e.waktu) <= cur) playedRef.current.add(e.waktu + '|' + e.jenis_event) })

      setData(d); setOnline(true)
    } catch { setOnline(false) }
  }, [token])

  useEffect(() => { fetchPlan(); const id = setInterval(fetchPlan, 60_000); return () => clearInterval(id) }, [fetchPlan])

  const ringLog = useCallback((ev: KioskEvent, status: 'berhasil' | 'gagal' | 'dilewati') => {
    if (!token) return
    api.post('/bel/ring-log', {
      device_token: token, jenis_event: ev.jenis_event, waktu: fmtClock(nowSec),
      bell_audio_id: ev.bell_audio_id, status,
    }).catch(() => {})
  }, [token, nowSec])

  const playUrl = useCallback((url: string | null): Promise<boolean> => {
    if (!url) return Promise.resolve(false)
    const el = audioElRef.current ?? new Audio()
    audioElRef.current = el
    el.src = url
    return el.play().then(() => true).catch(() => false)
  }, [])

  // ── Tick lokal 1 dtk: hitung mundur + pemicu bunyi ─────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const cur = localSec() + offsetRef.current
      setNowSec(cur)
      if (!enabled || !data) return
      for (const ev of data.events) {
        const key = ev.waktu + '|' + ev.jenis_event
        if (playedRef.current.has(key)) continue
        if (toSec(ev.waktu) <= cur && cur - toSec(ev.waktu) < 90) {
          playedRef.current.add(key)
          setLastRung(`${ev.jenis_label} (${ev.waktu.slice(0, 5)})`)
          playUrl(ev.audio_url).then(ok => ringLog(ev, ev.audio_url ? (ok ? 'berhasil' : 'gagal') : 'dilewati'))
        }
      }
    }, 1000)
    return () => clearInterval(id)
  }, [enabled, data, playUrl, ringLog])

  // ── Aktifkan suara (unlock autoplay) ───────────────────────────────────────
  const aktifkan = async () => {
    const el = audioElRef.current ?? new Audio()
    audioElRef.current = el
    el.muted = true
    try { await el.play() } catch { /* biarkan */ }
    el.pause(); el.muted = false; el.currentTime = 0
    setEnabled(true)
  }

  const manualBel = async (a: ManualAudio) => {
    if (!window.confirm(`Bunyikan bel "${a.nama}" sekarang?`)) return
    await playUrl(a.url)
    if (token) api.post('/bel/manual', { device_token: token, jenis_event: a.kategori, bell_audio_id: a.id, keterangan: `Manual: ${a.nama}` }).catch(() => {})
    setLastRung(`Manual: ${a.nama}`)
  }

  const { current, next } = useMemo(() => {
    const evs = data?.events ?? []
    let current: KioskEvent | null = null, next: KioskEvent | null = null
    for (const e of evs) { if (toSec(e.waktu) <= nowSec) current = e; else { next = e; break } }
    return { current, next }
  }, [data, nowSec])

  const countdown = next ? Math.max(0, toSec(next.waktu) - nowSec) : null

  if (!token) return <Centered><p className="text-red-300">Token perangkat tidak ada di URL. Buka lewat menu Admin {'>'} Jam & Bel {'>'} Perangkat Pemutar.</p></Centered>

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <BellRing className="h-5 w-5" /> Pemutar Bel Sekolah
          </div>
          <div className={`flex items-center gap-1 text-xs ${online ? 'text-emerald-400' : 'text-red-400'}`}>
            {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}{online ? 'Tersambung' : 'Terputus'}
          </div>
        </div>

        {/* Jam besar */}
        <div className="text-center">
          <div className="font-mono text-7xl sm:text-8xl font-bold tracking-tight tabular-nums">{fmtClock(nowSec)}</div>
          <div className="text-slate-400 text-sm mt-1">{data?.tanggal ? new Date(data.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</div>
        </div>

        {!enabled && (
          <button onClick={aktifkan} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-4 text-lg font-semibold flex items-center justify-center gap-2">
            <Volume2 className="h-6 w-6" /> Aktifkan Suara
          </button>
        )}

        {/* Berikutnya + hitung mundur */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-900 p-4">
            <div className="text-xs text-slate-400">Sebelumnya</div>
            <div className="font-semibold mt-1">{current ? current.jenis_label : '—'}</div>
            <div className="text-xs text-slate-500">{current ? current.waktu.slice(0, 5) : ''}</div>
          </div>
          <div className="rounded-xl bg-slate-900 p-4">
            <div className="text-xs text-slate-400">Berikutnya</div>
            <div className="font-semibold mt-1">{next ? next.jenis_label : 'Selesai'}</div>
            <div className="text-xs text-emerald-400 font-mono">
              {countdown !== null ? `${pad(Math.floor(countdown / 3600))}:${pad(Math.floor((countdown % 3600) / 60))}:${pad(countdown % 60)}` : ''}
              {next ? ` (${next.waktu.slice(0, 5)})` : ''}
            </div>
          </div>
        </div>

        {lastRung && <div className="text-center text-xs text-slate-400">Bunyi terakhir: <span className="text-slate-200">{lastRung}</span></div>}

        {/* Jadwal hari ini */}
        <div className="rounded-xl bg-slate-900 divide-y divide-slate-800">
          {(data?.events ?? []).length === 0 && <div className="p-4 text-sm text-slate-400">Tidak ada jadwal bel hari ini.</div>}
          {(data?.events ?? []).map((e, i) => {
            const past = toSec(e.waktu) <= nowSec
            return (
              <div key={i} className={`flex items-center gap-3 px-4 py-2 text-sm ${past ? 'opacity-40' : ''}`}>
                <span className="font-mono tabular-nums w-14">{e.waktu.slice(0, 5)}</span>
                <span className="flex-1">{e.jenis_label}</span>
                <span className="text-xs text-slate-500">{e.audio_nama ?? 'tanpa audio'}</span>
              </div>
            )
          })}
        </div>

        {/* Bel manual / darurat */}
        {(data?.manual_audios ?? []).length > 0 && (
          <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-300 text-sm"><AlertTriangle className="h-4 w-4" /> Bel Manual / Darurat</div>
            <div className="flex flex-wrap gap-2">
              {(data?.manual_audios ?? []).map(a => (
                <button key={a.id} onClick={() => manualBel(a)} disabled={!enabled}
                  className="rounded-lg bg-amber-700/70 hover:bg-amber-600 disabled:opacity-40 px-3 py-2 text-sm font-medium">
                  {a.nama}
                </button>
              ))}
            </div>
            {!enabled && <p className="text-xs text-amber-400/80">Tekan "Aktifkan Suara" dulu.</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">{children}</div>
}
