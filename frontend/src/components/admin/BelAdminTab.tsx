import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2, Star, Download, Upload, AlertCircle, Check } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

async function downloadBlob(url: string, filename: string) {
  const res = await api.get(url, { responseType: 'blob' })
  const href = URL.createObjectURL(new Blob([res.data]))
  const a = document.createElement('a')
  a.href = href; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 60_000)
}

const HARI = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'] as const

interface BelPeriodRow { jam_ke: number; jam_mulai: string; jam_selesai: string; is_istirahat?: boolean; terkunci_offset?: boolean }
interface BelMode { id: number; nama: string; offset_menit: number; is_default: boolean }
interface BelOverride { id: number; tanggal: string; mode_id: number; mode_nama: string | null; keterangan: string | null }
interface BelData {
  periods: Record<string, BelPeriodRow[]>
  modes: BelMode[]
  day_defaults: Record<string, number>
  overrides: BelOverride[]
}

const inputCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
// Varian tanpa w-full untuk input berukuran tetap (baris jam bel) — supaya lebar
// eksplisit (w-16/w-28) tidak dikalahkan w-full.
const belInputCls = 'rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

function useBel() {
  return useQuery<BelData>({
    queryKey: ['admin-bell-schedule'],
    queryFn: () => api.get('/admin/bell-schedule').then(r => r.data.data),
  })
}

export default function BelAdminTab() {
  const { data, isLoading } = useBel()

  if (isLoading || !data) return <div className="h-40 rounded-lg bg-muted animate-pulse" />

  return (
    <div className="space-y-6 max-w-4xl">
      <p className="text-xs text-muted-foreground max-w-2xl">
        Jadwal menyimpan <b>jam ke berapa</b>; pukul persisnya ditentukan bel per hari di bawah,
        lalu digeser oleh mode waktu masuk (mis. Apel / Tanpa Apel). Import XML mengisi bel
        Senin–Jumat otomatis dan <b>tidak menimpa</b> bel yang sudah Anda ubah — hari yang durasinya
        beda (mis. Jumat) cukup diedit sekali di sini.
      </p>
      <BelHariSection data={data} />
      <ModeSection data={data} />
      <DayDefaultSection data={data} />
      <OverrideSection data={data} />
      <AudioBankSection />
      <EventMapSection />
      <DeviceSection />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Bel & Audio (Sprint 2): bank suara, pemetaan event -> audio, perangkat kiosk
// ═══════════════════════════════════════════════════════════════════════════

interface BelAudio {
  id: number; uuid: string; nama: string; kategori: string; kategori_label: string
  durasi_detik: number | null; ukuran_byte: number; aktif: boolean; url: string | null
}
interface BelAudioMap { id: number; bell_mode_id: number | null; jenis_event: string; bell_audio_id: number; aktif: boolean }
interface BelEventOpt { value: string; label: string }
interface BelDevice { id: number; uuid: string; nama: string; token: string; aktif: boolean; last_heartbeat_at: string | null }
interface BelAudioData {
  audios: BelAudio[]
  maps: BelAudioMap[]
  modes: { id: number; nama: string; is_default: boolean }[]
  events: BelEventOpt[]
  devices: BelDevice[]
}

const fmtBytes = (n: number) => n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`

function useBelAudio() {
  return useQuery<BelAudioData>({
    queryKey: ['admin-bell-audios'],
    queryFn: () => api.get('/admin/bell-audios').then(r => r.data.data),
  })
}

// ── Bank Audio (upload + daftar) ─────────────────────────────────────────────
function AudioBankSection() {
  const { data, isLoading } = useBelAudio()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [nama, setNama] = useState('')
  const [kategori, setKategori] = useState('masuk')
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-bell-audios'] })

  async function onUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file || !nama.trim()) { setMsg('Isi nama dan pilih berkas audio.'); return }
    setUploading(true); setMsg(null)
    try {
      const fd = new FormData()
      fd.append('nama', nama); fd.append('kategori', kategori); fd.append('file', file)
      const r = await api.post('/admin/bell-audios', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setMsg(r.data.message); setNama(''); if (fileRef.current) fileRef.current.value = ''
      refresh()
    } catch (e: any) {
      setMsg(e.response?.data?.message ?? 'Upload gagal (format harus MP3/OGG, maks 5MB).')
    } finally { setUploading(false) }
  }

  const toggle = useMutation({
    mutationFn: (a: BelAudio) => api.put(`/admin/bell-audios/${a.id}`, { aktif: !a.aktif }).then(r => r.data),
    onSuccess: () => refresh(),
  })
  const hapus = useMutation({
    mutationFn: (a: BelAudio) => api.delete(`/admin/bell-audios/${a.id}`).then(r => r.data),
    onSuccess: (d) => { setMsg(d.message); refresh() },
  })

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-sm">Bank Audio Bel</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Unggah berkas suara (MP3/OGG, maks 5MB) lalu petakan ke event bel di bawah. Berkas
          disimpan di penyimpanan aplikasi (ikut pindah ke R2 otomatis bila diaktifkan).
        </p>
      </div>

      <div className="flex items-end gap-2 flex-wrap rounded-lg border bg-muted/30 p-3">
        <div className="flex-1 min-w-40">
          <label className="text-xs text-muted-foreground">Nama audio</label>
          <input className={inputCls} value={nama} onChange={e => setNama(e.target.value)} placeholder="mis. Bel Masuk" />
        </div>
        <div className="w-44">
          <label className="text-xs text-muted-foreground">Kategori</label>
          <select className={inputCls} value={kategori} onChange={e => setKategori(e.target.value)}>
            {(data?.events ?? []).map(ev => <option key={ev.value} value={ev.value}>{ev.label}</option>)}
          </select>
        </div>
        <input ref={fileRef} type="file" accept="audio/mpeg,audio/ogg,.mp3,.ogg" className="text-xs max-w-52" />
        <Button size="sm" onClick={onUpload} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />} Unggah
        </Button>
      </div>

      {isLoading ? <div className="h-16 rounded bg-muted animate-pulse" /> : (
        <div className="space-y-1.5">
          {(data?.audios ?? []).length === 0 && <p className="text-xs text-muted-foreground">Belum ada audio.</p>}
          {(data?.audios ?? []).map(a => (
            <div key={a.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 flex-wrap ${a.aktif ? '' : 'opacity-50'}`}>
              <span className="text-sm font-medium">{a.nama}</span>
              <Badge variant="secondary">{a.kategori_label}</Badge>
              <span className="text-xs text-muted-foreground">{fmtBytes(a.ukuran_byte)}</span>
              {a.url && <audio controls preload="none" src={a.url} className="h-8 max-w-[220px]" />}
              <span className="ml-auto flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={() => toggle.mutate(a)} disabled={toggle.isPending}>
                  {a.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => hapus.mutate(a)} disabled={hapus.isPending}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </CardContent></Card>
  )
}

// ── Pemetaan event -> audio (per mode + global) ──────────────────────────────
function EventMapSection() {
  const { data } = useBelAudio()
  const qc = useQueryClient()
  const [msg, setMsg] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (p: { bell_mode_id: number | null; jenis_event: string; bell_audio_id: number | null }) =>
      api.put('/admin/bell-audio-maps', p).then(r => r.data),
    onSuccess: (d) => { setMsg(d.message); qc.invalidateQueries({ queryKey: ['admin-bell-audios'] }) },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal menyimpan pemetaan.'),
  })

  if (!data) return null
  const val = (modeId: number | null, ev: string) =>
    data.maps.find(m => m.bell_mode_id === modeId && m.jenis_event === ev)?.bell_audio_id ?? ''
  // Kolom: Semua Mode (global) + tiap mode.
  const cols: { id: number | null; nama: string }[] = [{ id: null, nama: 'Semua Mode' }, ...data.modes.map(m => ({ id: m.id, nama: m.nama }))]

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-sm">Pemetaan Bel (Event {'->'} Audio)</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pilih audio untuk tiap event bel. Kolom <b>Semua Mode</b> berlaku umum; kolom mode tertentu
          <b> mengalahkan</b> pemetaan umum saat mode itu aktif. Kosongkan untuk tidak berbunyi.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse min-w-[520px]">
          <thead>
            <tr>
              <th className="text-left p-2 font-medium">Event</th>
              {cols.map(c => <th key={String(c.id)} className="text-left p-2 font-medium">{c.nama}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.events.map(ev => (
              <tr key={ev.value} className="border-t">
                <td className="p-2 whitespace-nowrap">{ev.label}</td>
                {cols.map(c => (
                  <td key={String(c.id)} className="p-1.5">
                    <select
                      className={inputCls + ' w-40 text-xs py-1'}
                      value={val(c.id, ev.value)}
                      onChange={e => save.mutate({ bell_mode_id: c.id, jenis_event: ev.value, bell_audio_id: e.target.value ? Number(e.target.value) : null })}
                    >
                      <option value="">—</option>
                      {data.audios.filter(a => a.aktif).map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </CardContent></Card>
  )
}

// ── Perangkat pemutar (kiosk) ────────────────────────────────────────────────
function DeviceSection() {
  const { data } = useBelAudio()
  const qc = useQueryClient()
  const [nama, setNama] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-bell-audios'] })

  const daftar = useMutation({
    mutationFn: () => api.post('/admin/bell-devices', { nama }).then(r => r.data),
    onSuccess: (d) => { setMsg(`Perangkat "${d.data.nama}" terdaftar. Buka pemutar lewat tautan di bawah.`); setNama(''); refresh() },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal mendaftar perangkat.'),
  })
  const hapus = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/bell-devices/${id}`).then(r => r.data),
    onSuccess: (d) => { setMsg(d.message); refresh() },
  })

  const kioskUrl = (token: string) => `${window.location.origin}/bel/pemutar?token=${token}`

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-sm">Perangkat Pemutar (Kiosk)</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Daftarkan PC/HP yang tersambung speaker. Buka tautan pemutar di perangkat itu, lalu tekan
          "Aktifkan Suara" sekali. Pemutar berbunyi otomatis sesuai jadwal & mode hari itu.
        </p>
      </div>

      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-40">
          <label className="text-xs text-muted-foreground">Nama perangkat</label>
          <input className={inputCls} value={nama} onChange={e => setNama(e.target.value)} placeholder="mis. Speaker Lobi" />
        </div>
        <Button size="sm" onClick={() => daftar.mutate()} disabled={daftar.isPending || !nama.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Daftarkan
        </Button>
      </div>

      <div className="space-y-1.5">
        {(data?.devices ?? []).map(d => (
          <div key={d.id} className="flex items-center gap-2 rounded-md border px-3 py-2 flex-wrap text-sm">
            <span className="font-medium">{d.nama}</span>
            <span className="text-xs text-muted-foreground">
              {d.last_heartbeat_at ? `aktif ${new Date(d.last_heartbeat_at).toLocaleString('id-ID')}` : 'belum pernah aktif'}
            </span>
            <a href={kioskUrl(d.token)} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Buka Pemutar</a>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(kioskUrl(d.token)); setMsg('Tautan pemutar disalin.') }}>
              Salin Tautan
            </Button>
            <Button size="icon" variant="ghost" className="ml-auto" onClick={() => hapus.mutate(d.id)} disabled={hapus.isPending}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ))}
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </CardContent></Card>
  )
}

// ── Bel per hari (jam ke- → pukul) ───────────────────────────────────────────
function BelHariSection({ data }: { data: BelData }) {
  const qc = useQueryClient()
  const [hari, setHari] = useState<string>('senin')
  const [rows, setRows] = useState<BelPeriodRow[]>([])
  const [msg, setMsg] = useState<string | null>(null)

  // ── Import Excel (semua hari sekaligus) ──
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ ok: boolean; message: string; errors?: string[] } | null>(null)

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setImporting(true); setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await api.post('/admin/bell-schedule/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setImportResult({ ok: true, message: r.data.message, errors: r.data.errors })
      qc.invalidateQueries({ queryKey: ['admin-bell-schedule'] })
    } catch (err: any) {
      const d = err?.response?.data
      setImportResult({ ok: false, message: d?.message ?? 'Import gagal.', errors: d?.errors })
    } finally {
      setImporting(false)
    }
  }

  useEffect(() => {
    setRows((data.periods[hari] ?? []).map(r => ({ ...r })))
    setMsg(null)
  }, [hari, data])

  const save = useMutation({
    mutationFn: () => api.put('/admin/bell-schedule/periods', { hari, periods: rows }).then(r => r.data),
    onSuccess: (d) => { setMsg(d.message); qc.invalidateQueries({ queryKey: ['admin-bell-schedule'] }) },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal menyimpan.'),
  })

  const set = (i: number, k: keyof BelPeriodRow, v: string | number | boolean) =>
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r))

  const tambah = () => {
    const last = rows[rows.length - 1]
    setRows([...rows, {
      jam_ke: (last?.jam_ke ?? 0) + 1,
      jam_mulai: last?.jam_selesai ?? '07:00',
      jam_selesai: last?.jam_selesai ?? '07:45',
      is_istirahat: false,
      terkunci_offset: false,
    }])
  }

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-semibold text-sm">Jam Bel per Hari</h3>
        <select className={inputCls + ' w-auto'} value={hari} onChange={e => setHari(e.target.value)}>
          {HARI.map(h => <option key={h} value={h}>{h.charAt(0).toUpperCase() + h.slice(1)}</option>)}
        </select>
      </div>

      {/* Import Excel — mengisi banyak hari sekaligus (kolom: hari, jam_ke, jam_mulai, jam_selesai) */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
        <p className="text-xs text-muted-foreground">
          Impor semua hari sekaligus dari Excel. Kolom: <code>hari</code>, <code>jam_ke</code>, <code>jam_mulai</code>, <code>jam_selesai</code>, <code>is_istirahat</code>, <code>terkunci_offset</code> (satu baris = satu jam bel; dua kolom terakhir isi "ya" bila istirahat / jam dikunci). Setiap hari yang ada di file <b>menggantikan</b> bel hari itu; hari yang tak ada di file tidak berubah.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => downloadBlob('/admin/bell-schedule/template', 'template_jam_bel.xlsx')}>
            <Download className="h-4 w-4 mr-1" /> Unduh Template
          </Button>
          <Button size="sm" variant="outline" disabled={importing} onClick={() => fileRef.current?.click()}>
            {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />} Import Excel
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onImport} />
        </div>
        {importResult && (
          <div className={`rounded-md border p-2 text-xs ${importResult.ok ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
            <p className="flex items-center gap-1 font-medium">
              {importResult.ok ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />} {importResult.message}
            </p>
            {importResult.errors && importResult.errors.length > 0 && (
              <ul className="list-disc ml-5 mt-1 text-red-600">{importResult.errors.slice(0, 8).map((er, i) => <li key={i}>{er}</li>)}</ul>
            )}
          </div>
        )}
      </div>

      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Belum ada bel untuk hari ini. Import XML akan mengisinya otomatis, atau tambahkan manual.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Tandai <b>Istirahat</b> untuk periode bukan jam pelajaran, dan <b>Kunci jam</b> agar jam dindingnya
        tetap walau mode menggeser awal hari (mis. istirahat 15 menit setelah jam ke-4 dan istirahat siang
        12.00–13.00 tidak ikut maju saat Tanpa Apel).
      </p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground shrink-0">Jam ke-</span>
            <input type="number" min={0} max={20} className={`${belInputCls} w-16`} value={r.jam_ke}
              onChange={e => set(i, 'jam_ke', Number(e.target.value))} />
            <input type="time" className={`${belInputCls} w-28`} value={r.jam_mulai}
              onChange={e => set(i, 'jam_mulai', e.target.value)} />
            <span className="text-xs text-muted-foreground">s.d.</span>
            <input type="time" className={`${belInputCls} w-28`} value={r.jam_selesai}
              onChange={e => set(i, 'jam_selesai', e.target.value)} />
            <label className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <input type="checkbox" checked={!!r.is_istirahat} onChange={e => set(i, 'is_istirahat', e.target.checked)} />
              Istirahat
            </label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <input type="checkbox" checked={!!r.terkunci_offset} onChange={e => set(i, 'terkunci_offset', e.target.checked)} />
              Kunci jam
            </label>
            <Button size="icon" variant="ghost" className="shrink-0" onClick={() => setRows(rs => rs.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={tambah}><Plus className="h-4 w-4 mr-1" />Tambah Jam</Button>
        <Button size="sm" onClick={() => { setMsg(null); save.mutate() }} disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          Simpan Bel {hari.charAt(0).toUpperCase() + hari.slice(1)}
        </Button>
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </CardContent></Card>
  )
}

// ── Mode waktu masuk (pergeseran menit) ──────────────────────────────────────
function ModeSection({ data }: { data: BelData }) {
  const qc = useQueryClient()
  const [nama, setNama] = useState('')
  const [offset, setOffset] = useState('0')
  const [msg, setMsg] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-bell-schedule'] })

  const tambah = useMutation({
    mutationFn: () => api.post('/admin/bell-schedule/modes', { nama, offset_menit: Number(offset) || 0 }).then(r => r.data),
    onSuccess: (d) => { setMsg(d.message); setNama(''); setOffset('0'); refresh() },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal menambah mode.'),
  })
  const jadikanDefault = useMutation({
    mutationFn: (id: number) => api.put(`/admin/bell-schedule/modes/${id}`, { is_default: true }).then(r => r.data),
    onSuccess: (d) => { setMsg(d.message); refresh() },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal.'),
  })
  const hapus = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/bell-schedule/modes/${id}`).then(r => r.data),
    onSuccess: (d) => { setMsg(d.message); refresh() },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal menghapus.'),
  })

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-sm">Mode Waktu Masuk</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pergeseran menit terhadap bel. Contoh: <b>Apel</b> = 0 (jam normal), <b>Tanpa Apel</b> = −60
          (semua sesi masuk 1 jam lebih awal, durasi tiap jam tetap mengikuti bel harinya).
        </p>
      </div>

      <div className="space-y-2">
        {data.modes.map(m => (
          <div key={m.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
            <span className="text-sm font-medium">{m.nama}</span>
            <Badge variant="secondary">{m.offset_menit > 0 ? `+${m.offset_menit}` : m.offset_menit} menit</Badge>
            {m.is_default
              ? <Badge className="ml-auto">Default</Badge>
              : (
                <span className="ml-auto flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => jadikanDefault.mutate(m.id)} disabled={jadikanDefault.isPending}>
                    <Star className="h-3.5 w-3.5 mr-1" />Jadikan Default
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => hapus.mutate(m.id)} disabled={hapus.isPending}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </span>
              )}
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-40">
          <label className="text-xs text-muted-foreground">Nama mode baru</label>
          <input className={inputCls} value={nama} onChange={e => setNama(e.target.value)} placeholder="mis. Ujian" />
        </div>
        <div className="w-32">
          <label className="text-xs text-muted-foreground">Geser (menit)</label>
          <input type="number" min={-180} max={180} className={inputCls} value={offset} onChange={e => setOffset(e.target.value)} />
        </div>
        <Button size="sm" onClick={() => { setMsg(null); tambah.mutate() }} disabled={tambah.isPending || !nama.trim()}>
          <Plus className="h-4 w-4 mr-1" />Tambah
        </Button>
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </CardContent></Card>
  )
}

// ── Default per hari ─────────────────────────────────────────────────────────
function DayDefaultSection({ data }: { data: BelData }) {
  const qc = useQueryClient()
  const [vals, setVals] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    setVals(Object.fromEntries(HARI.map(h => [h, data.day_defaults[h] ? String(data.day_defaults[h]) : ''])))
  }, [data])

  const save = useMutation({
    mutationFn: () => api.put('/admin/bell-schedule/day-defaults', {
      day_defaults: Object.fromEntries(HARI.map(h => [h, vals[h] ? Number(vals[h]) : null])),
    }).then(r => r.data),
    onSuccess: (d) => { setMsg(d.message); qc.invalidateQueries({ queryKey: ['admin-bell-schedule'] }) },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal menyimpan.'),
  })

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-sm">Mode Default per Hari</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Hari tertentu yang rutin memakai mode berbeda. Kosongkan untuk mengikuti mode default global.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {HARI.map(h => (
          <div key={h}>
            <label className="text-xs text-muted-foreground">{h.charAt(0).toUpperCase() + h.slice(1)}</label>
            <select className={inputCls} value={vals[h] ?? ''} onChange={e => setVals(v => ({ ...v, [h]: e.target.value }))}>
              <option value="">(Ikuti default global)</option>
              {data.modes.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setMsg(null); save.mutate() }} disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          Simpan
        </Button>
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </CardContent></Card>
  )
}

// ── Pengecualian per tanggal (insidental) ────────────────────────────────────
function OverrideSection({ data }: { data: BelData }) {
  const qc = useQueryClient()
  const [tanggal, setTanggal] = useState('')
  const [daftar, setDaftar] = useState<string[]>([])
  const [modeId, setModeId] = useState('')
  const [ket, setKet] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-bell-schedule'] })

  const simpan = useMutation({
    mutationFn: () => api.post('/admin/bell-schedule/overrides', {
      tanggal: daftar, bell_mode_id: Number(modeId), keterangan: ket || null,
    }).then(r => r.data),
    onSuccess: (d) => { setMsg(d.message); setDaftar([]); setKet(''); refresh() },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal menyimpan.'),
  })
  const hapus = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/bell-schedule/overrides/${id}`).then(r => r.data),
    onSuccess: (d) => { setMsg(d.message); refresh() },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal menghapus.'),
  })

  const tambahTanggal = () => {
    if (tanggal && !daftar.includes(tanggal)) setDaftar([...daftar, tanggal].sort())
    setTanggal('')
  }

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-sm">Pengecualian per Tanggal</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Insidental — mis. besok masuk 1 jam lebih awal karena cuaca. Pilih satu atau beberapa
          tanggal, lalu mode yang berlaku pada tanggal-tanggal itu. Prioritasnya paling tinggi,
          mengalahkan default per hari maupun global.
        </p>
      </div>

      <div className="flex items-end gap-2 flex-wrap">
        <div>
          <label className="text-xs text-muted-foreground">Tanggal</label>
          <div className="flex gap-1">
            <input type="date" className={inputCls + ' w-40'} value={tanggal} onChange={e => setTanggal(e.target.value)} />
            <Button size="sm" variant="outline" onClick={tambahTanggal} disabled={!tanggal}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="w-40">
          <label className="text-xs text-muted-foreground">Mode</label>
          <select className={inputCls} value={modeId} onChange={e => setModeId(e.target.value)}>
            <option value="">— pilih —</option>
            {data.modes.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-40">
          <label className="text-xs text-muted-foreground">Keterangan (opsional)</label>
          <input className={inputCls} value={ket} onChange={e => setKet(e.target.value)} placeholder="mis. Cuaca panas" />
        </div>
        <Button size="sm" onClick={() => { setMsg(null); simpan.mutate() }} disabled={simpan.isPending || daftar.length === 0 || !modeId}>
          {simpan.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          Simpan {daftar.length > 0 ? `(${daftar.length} tgl)` : ''}
        </Button>
      </div>

      {daftar.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {daftar.map(t => (
            <Badge key={t} variant="secondary" className="cursor-pointer" onClick={() => setDaftar(d => d.filter(x => x !== t))}>
              {t} ✕
            </Badge>
          ))}
        </div>
      )}

      {data.overrides.length > 0 && (
        <div className="space-y-1">
          {data.overrides.map(o => (
            <div key={o.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
              <span className="font-mono text-xs">{o.tanggal}</span>
              <Badge variant="secondary">{o.mode_nama ?? '—'}</Badge>
              {o.keterangan && <span className="text-xs text-muted-foreground truncate">{o.keterangan}</span>}
              <Button size="icon" variant="ghost" className="ml-auto shrink-0" onClick={() => hapus.mutate(o.id)} disabled={hapus.isPending}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </CardContent></Card>
  )
}
