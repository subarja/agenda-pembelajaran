import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2, Star } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const HARI = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'] as const

interface BelPeriodRow { jam_ke: number; jam_mulai: string; jam_selesai: string }
interface BelMode { id: number; nama: string; offset_menit: number; is_default: boolean }
interface BelOverride { id: number; tanggal: string; mode_id: number; mode_nama: string | null; keterangan: string | null }
interface BelData {
  periods: Record<string, BelPeriodRow[]>
  modes: BelMode[]
  day_defaults: Record<string, number>
  overrides: BelOverride[]
}

const inputCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

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
    </div>
  )
}

// ── Bel per hari (jam ke- → pukul) ───────────────────────────────────────────
function BelHariSection({ data }: { data: BelData }) {
  const qc = useQueryClient()
  const [hari, setHari] = useState<string>('senin')
  const [rows, setRows] = useState<BelPeriodRow[]>([])
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    setRows((data.periods[hari] ?? []).map(r => ({ ...r })))
    setMsg(null)
  }, [hari, data])

  const save = useMutation({
    mutationFn: () => api.put('/admin/bell-schedule/periods', { hari, periods: rows }).then(r => r.data),
    onSuccess: (d) => { setMsg(d.message); qc.invalidateQueries({ queryKey: ['admin-bell-schedule'] }) },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal menyimpan.'),
  })

  const set = (i: number, k: keyof BelPeriodRow, v: string | number) =>
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r))

  const tambah = () => {
    const last = rows[rows.length - 1]
    setRows([...rows, {
      jam_ke: (last?.jam_ke ?? 0) + 1,
      jam_mulai: last?.jam_selesai ?? '07:00',
      jam_selesai: last?.jam_selesai ?? '07:45',
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

      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Belum ada bel untuk hari ini. Import XML akan mengisinya otomatis, atau tambahkan manual.
        </p>
      )}

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-14 shrink-0">Jam ke-</span>
            <input type="number" min={0} max={20} className={inputCls + ' w-20'} value={r.jam_ke}
              onChange={e => set(i, 'jam_ke', Number(e.target.value))} />
            <input type="time" className={inputCls + ' w-32'} value={r.jam_mulai}
              onChange={e => set(i, 'jam_mulai', e.target.value)} />
            <span className="text-xs text-muted-foreground">s.d.</span>
            <input type="time" className={inputCls + ' w-32'} value={r.jam_selesai}
              onChange={e => set(i, 'jam_selesai', e.target.value)} />
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
