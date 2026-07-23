import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Volume2, BellRing, Wifi, WifiOff, Play, FlaskConical, Trash2, Plus } from 'lucide-react'
import api from '@/lib/api'

/**
 * Pemutar Bel (kiosk) — halaman perangkat tersambung speaker. Publik (butuh token perangkat
 * pada URL: /bel/pemutar?token=...). Mengambil jadwal bunyi hari ini (event otomatis +
 * jadwal kustom), memutar audio pada waktunya (jam server disinkron ke tick lokal 1 dtk),
 * lapor heartbeat & log tiap bunyi.
 *
 * cPanel-friendly: TANPA websocket. Poll /bel/hari-ini tiap 60 dtk (sekaligus heartbeat),
 * tick lokal 1 dtk untuk hitung mundur & pemicu bunyi. Autoplay perlu 1 gestur ("Aktifkan Suara").
 * Volume per audio (0-100%) diterapkan lewat <audio>.volume — bekerja untuk audio lokal
 * maupun R2 (lintas-origin) tanpa risiko "taint" Web Audio.
 */

interface KioskEvent { waktu: string; jenis_event: string; jenis_label: string; bell_audio_id: number | null; audio_nama: string | null; audio_url: string | null; volume: number; custom: boolean }
interface KioskAudio { id: number; nama: string; kategori: string; url: string | null; volume: number }
interface KioskData { tanggal: string; server_time: string; events: KioskEvent[]; audios: KioskAudio[] }

// WAV senyap (durasi ~0) untuk "membuka kunci" autoplay saat tak ada audio nyata yang bisa
// dipakai priming. Memutar SUMBER VALID di dalam gestur klik memberi elemen izin autoplay,
// sehingga bunyi terjadwal (dari timer, bukan klik) tak lagi diblok browser.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

const toSec = (hms: string) => { const [h, m, s] = hms.split(':').map(Number); return h * 3600 + m * 60 + (s || 0) }
const pad = (n: number) => String(n).padStart(2, '0')
const fmtClock = (sec: number) => { sec = ((sec % 86400) + 86400) % 86400; return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}` }
const fmtDur = (sec: number) => `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`

export default function KioskBelPage() {
  const token = new URLSearchParams(window.location.search).get('token') ?? ''

  const [data, setData] = useState<KioskData | null>(null)
  const [online, setOnline] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [nowSec, setNowSec] = useState(0)
  const [lastRung, setLastRung] = useState<string | null>(null)

  const offsetRef = useRef(0)
  const playedRef = useRef<Set<string>>(new Set())
  const dateRef = useRef<string>('')
  const elRef = useRef<HTMLAudioElement | null>(null)

  const localSec = () => { const d = new Date(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() }

  const fetchPlan = useCallback(async () => {
    try {
      const r = await api.get('/bel/hari-ini', { params: token ? { device_token: token } : {} })
      const d: KioskData = r.data.data
      offsetRef.current = toSec(d.server_time) - localSec()
      if (dateRef.current !== d.tanggal) { playedRef.current = new Set(); dateRef.current = d.tanggal }
      // Event yang sudah lewat saat load ditandai "sudah" agar tak membunyikan bel masa lalu.
      const cur = localSec() + offsetRef.current
      d.events.forEach(e => { if (toSec(e.waktu) <= cur) playedRef.current.add(e.waktu + '|' + e.jenis_event) })
      setData(d); setOnline(true)
    } catch { setOnline(false) }
  }, [token])

  useEffect(() => { fetchPlan(); const id = setInterval(fetchPlan, 60_000); return () => clearInterval(id) }, [fetchPlan])

  const ringLog = useCallback((jenis: string, audioId: number | null, status: 'berhasil' | 'gagal' | 'dilewati') => {
    if (!token) return
    api.post('/bel/ring-log', { device_token: token, jenis_event: jenis, waktu: fmtClock(localSec() + offsetRef.current), bell_audio_id: audioId, status }).catch(() => {})
  }, [token])

  // Putar url dengan volume (persen 0-100). Mengembalikan true bila mulai memutar.
  const play = useCallback((url: string | null, volumePct = 100): Promise<boolean> => {
    const el = elRef.current
    if (!url || !el) return Promise.resolve(false)
    el.muted = false
    el.volume = Math.min(1, Math.max(0, volumePct / 100))
    el.src = url
    el.load()
    return el.play().then(() => true).catch(() => false)
  }, [])

  // ── Tick 1 dtk: hitung mundur + pemicu bunyi terjadwal ─────────────────────
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
          play(ev.audio_url, ev.volume).then(ok => ringLog(ev.jenis_event, ev.bell_audio_id, ev.audio_url ? (ok ? 'berhasil' : 'gagal') : 'dilewati'))
        }
      }
    }, 1000)
    return () => clearInterval(id)
  }, [enabled, data, play, ringLog])

  // ── Aktifkan suara (unlock autoplay dengan 1 gestur) ───────────────────────
  // Memutar SUMBER VALID (muted) di dalam gestur klik agar elemen <audio> mendapat izin
  // autoplay. Versi lama memanggil play() tanpa src → selalu reject → tak pernah ter-unlock,
  // sehingga bunyi terjadwal (dari timer) diblok browser (gejala: "diaktifkan pun tak bunyi").
  const aktifkan = async () => {
    const el = elRef.current
    if (el) {
      const prime = data?.audios.find(a => a.url)?.url ?? SILENT_WAV
      try {
        el.muted = true
        el.src = prime
        await el.play()
        el.pause()
      } catch { /* biarkan; sebagian browser tetap ter-unlock oleh gestur ini */ } finally {
        el.muted = false
        el.removeAttribute('src')
        el.load()
      }
    }
    setEnabled(true)
  }

  const putarSekarang = async (a: KioskAudio, konfirmasi = true) => {
    if (konfirmasi && !window.confirm(`Bunyikan "${a.nama}" sekarang?`)) return
    const ok = await play(a.url, a.volume)
    setLastRung(`Manual: ${a.nama}`)
    if (token) api.post('/bel/manual', { device_token: token, jenis_event: a.kategori, bell_audio_id: a.id, keterangan: `Manual: ${a.nama}` }).catch(() => {})
    return ok
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
      <audio ref={elRef} preload="none" className="hidden" />
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-400"><BellRing className="h-5 w-5" /> Pemutar Bel Sekolah</div>
          <div className={`flex items-center gap-1 text-xs ${online ? 'text-emerald-400' : 'text-red-400'}`}>
            {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}{online ? 'Tersambung' : 'Terputus'}
          </div>
        </div>

        <div className="text-center">
          <div className="font-mono text-7xl sm:text-8xl font-bold tracking-tight tabular-nums">{fmtClock(nowSec)}</div>
          <div className="text-slate-400 text-sm mt-1">{data?.tanggal ? new Date(data.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</div>
        </div>

        {!enabled && (
          <button onClick={aktifkan} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-4 text-lg font-semibold flex items-center justify-center gap-2">
            <Volume2 className="h-6 w-6" /> Aktifkan Suara
          </button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-900 p-4">
            <div className="text-xs text-slate-400">Sebelumnya</div>
            <div className="font-semibold mt-1">{current ? current.jenis_label : '—'}</div>
            <div className="text-xs text-slate-500">{current ? current.waktu.slice(0, 5) : ''}</div>
          </div>
          <div className="rounded-xl bg-slate-900 p-4">
            <div className="text-xs text-slate-400">Berikutnya</div>
            <div className="font-semibold mt-1">{next ? next.jenis_label : 'Selesai'}</div>
            <div className="text-xs text-emerald-400 font-mono">{countdown !== null ? fmtDur(countdown) : ''}{next ? ` (${next.waktu.slice(0, 5)})` : ''}</div>
          </div>
        </div>

        {lastRung && <div className="text-center text-xs text-slate-400">Bunyi terakhir: <span className="text-slate-200">{lastRung}</span></div>}

        <div className="rounded-xl bg-slate-900 divide-y divide-slate-800">
          {(data?.events ?? []).length === 0 && <div className="p-4 text-sm text-slate-400">Tidak ada jadwal bel hari ini.</div>}
          {(data?.events ?? []).map((e, i) => {
            const past = toSec(e.waktu) <= nowSec
            return (
              <div key={i} className={`flex items-center gap-3 px-4 py-2 text-sm ${past ? 'opacity-40' : ''}`}>
                <span className="font-mono tabular-nums w-14">{e.waktu.slice(0, 5)}</span>
                <span className="flex-1">{e.jenis_label}{e.custom && <span className="ml-1 text-[10px] text-sky-400">kustom</span>}</span>
                <span className="text-xs text-slate-500">{e.audio_nama ?? 'tanpa audio'}</span>
              </div>
            )
          })}
        </div>

        {/* Putar cepat + Uji terjadwal */}
        <TestPanel audios={data?.audios ?? []} enabled={enabled} onPlay={putarSekarang} />
      </div>
    </div>
  )
}

// ── Panel uji: putar sekarang + jadwal uji relatif (menit dari sekarang) ──────
interface Jadwal { id: string; audioId: number; nama: string; target: number; status: 'menunggu' | 'diputar' | 'gagal' | 'dibatalkan' }

function TestPanel({ audios, enabled, onPlay }: {
  audios: KioskAudio[]; enabled: boolean; onPlay: (a: KioskAudio, konfirmasi?: boolean) => Promise<boolean | undefined>
}) {
  const [rows, setRows] = useState<{ menit: number; audioId: number }[]>([{ menit: 1, audioId: 0 }])
  const [jadwal, setJadwal] = useState<Jadwal[]>([])
  const [nowTs, setNowTs] = useState(() => Date.now())
  const timers = useRef<number[]>([])

  // Pra-pilih audio pertama supaya "Mulai Uji" tak jadi no-op karena lupa pilih audio.
  useEffect(() => {
    if (audios.length) setRows(rs => rs.map(r => (r.audioId ? r : { ...r, audioId: audios[0].id })))
  }, [audios])

  const running = jadwal.some(j => j.status === 'menunggu')

  // Tick 1 dtk untuk hitung mundur — hanya aktif selama ada jadwal menunggu.
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNowTs(Date.now()), 500)
    return () => clearInterval(id)
  }, [running])

  useEffect(() => () => { timers.current.forEach(t => clearTimeout(t)) }, [])
  if (audios.length === 0) return null

  const mulaiUji = () => {
    timers.current.forEach(t => clearTimeout(t)); timers.current = []
    const valid = rows.filter(r => r.audioId)
    if (valid.length === 0) { window.alert('Pilih audio dulu pada tiap baris uji.'); return }

    const base = Date.now()
    const items: Jadwal[] = valid.map((r, i) => ({
      id: `${base}-${i}`,
      audioId: r.audioId,
      nama: audios.find(a => a.id === r.audioId)?.nama ?? '—',
      target: base + Math.max(0, r.menit) * 60_000,
      status: 'menunggu',
    }))
    setJadwal(items)
    setNowTs(base)

    items.forEach(it => {
      const t = window.setTimeout(async () => {
        const a = audios.find(x => x.id === it.audioId)
        const ok = a ? await onPlay(a, false) : false
        setJadwal(js => js.map(x => x.id === it.id ? { ...x, status: ok ? 'diputar' : 'gagal' } : x))
      }, Math.max(0, it.target - base))
      timers.current.push(t)
    })
  }

  const stop = () => {
    timers.current.forEach(t => clearTimeout(t)); timers.current = []
    setJadwal(js => js.map(x => x.status === 'menunggu' ? { ...x, status: 'dibatalkan' } : x))
  }

  const fmtSisa = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}` }

  return (
    <div className="rounded-xl border border-sky-900/50 bg-sky-950/20 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sky-300 text-sm"><FlaskConical className="h-4 w-4" /> Uji & Putar Manual</div>

      {/* Putar sekarang */}
      <div>
        <div className="text-xs text-slate-400 mb-1">Putar sekarang</div>
        <div className="flex flex-wrap gap-2">
          {audios.map(a => (
            <button key={a.id} onClick={() => onPlay(a)} disabled={!enabled}
              className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-3 py-1.5 text-xs font-medium flex items-center gap-1">
              <Play className="h-3 w-3" /> {a.nama} <span className="text-slate-500">{a.volume}%</span>
            </button>
          ))}
        </div>
      </div>

      {/* Uji terjadwal (menit dari sekarang) */}
      <div>
        <div className="text-xs text-slate-400 mb-1">Uji terjadwal — mainkan audio sekian menit dari sekarang</div>
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <input type="number" min={0} step={0.5} value={r.menit} disabled={running}
                onChange={e => setRows(rs => rs.map((x, idx) => idx === i ? { ...x, menit: Number(e.target.value) } : x))}
                className="w-16 rounded bg-slate-800 px-2 py-1 disabled:opacity-50" />
              <span className="text-slate-500">menit →</span>
              <select value={r.audioId} disabled={running} onChange={e => setRows(rs => rs.map((x, idx) => idx === i ? { ...x, audioId: Number(e.target.value) } : x))}
                className="rounded bg-slate-800 px-2 py-1 flex-1 disabled:opacity-50">
                <option value={0}>— pilih audio —</option>
                {audios.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}
              </select>
              <button onClick={() => setRows(rs => rs.filter((_, idx) => idx !== i))} disabled={running || rows.length === 1} className="text-red-400 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button onClick={() => setRows(rs => [...rs, { menit: (rs[rs.length - 1]?.menit ?? 0) + 1, audioId: audios[0]?.id ?? 0 }])} disabled={running}
            className="rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-2 py-1 text-xs flex items-center gap-1"><Plus className="h-3 w-3" /> Tambah</button>
          {!running
            ? <button onClick={mulaiUji} disabled={!enabled} className="rounded bg-sky-700 hover:bg-sky-600 disabled:opacity-40 px-3 py-1 text-xs font-medium">Mulai Uji</button>
            : <button onClick={stop} className="rounded bg-red-700 hover:bg-red-600 px-3 py-1 text-xs font-medium">Hentikan</button>}
          {!enabled && <span className="text-xs text-amber-400/80">Tekan "Aktifkan Suara" dulu.</span>}
        </div>

        {/* Hitung mundur + status tiap jadwal uji */}
        {jadwal.length > 0 && (
          <div className="mt-3 rounded-lg bg-slate-900/60 divide-y divide-slate-800">
            {jadwal.map(j => {
              const sisa = j.target - nowTs
              return (
                <div key={j.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                  <span className="flex-1 truncate">{j.nama}</span>
                  {j.status === 'menunggu' && <span className="font-mono tabular-nums text-emerald-400">⏳ {fmtSisa(sisa)}</span>}
                  {j.status === 'diputar' && <span className="text-emerald-400">▶ diputar</span>}
                  {j.status === 'gagal' && <span className="text-red-400">✕ gagal diputar</span>}
                  {j.status === 'dibatalkan' && <span className="text-slate-500">dibatalkan</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">{children}</div>
}
