import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Download, Upload, AlertCircle, Check, Search, Trash2, Pencil, X } from 'lucide-react'
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

const inputCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

interface Petugas { id: string; nama: string | null }
interface Shift { id: number; hari: string; nama_shift: string; jam_mulai: string; jam_selesai: string; urutan: number; petugas: Petugas[] }
interface HariOpt { value: string; label: string }
interface ShiftsResp { data: Shift[]; hari: HariOpt[] }
interface TeacherOpt { id: string; nama: string }

const SHIFTS_KEY = ['admin-piket-shifts']

export default function PiketAdminTab() {
  return (
    <div className="space-y-6 max-w-4xl">
      <p className="text-xs text-muted-foreground max-w-2xl">
        Atur <b>pola mingguan</b> petugas piket: untuk tiap <b>hari</b> × <b>shift jam</b>, tentukan siapa
        petugasnya. Setup sekali, berulang tiap minggu. Menu <b>Piket</b> muncul otomatis di akun guru
        pada hari ia bertugas — tanpa input per tanggal. Satu hari boleh beberapa shift; jam antar shift
        tidak boleh tumpang tindih.
      </p>

      <WeeklyGrid />
      <ImportSection onSaved={() => {}} />
      <TierSection />
    </div>
  )
}

// ── Grid pola mingguan Hari × Shift ──────────────────────────────────────────
function WeeklyGrid() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<ShiftsResp>({
    queryKey: SHIFTS_KEY,
    queryFn: () => api.get('/admin/piket/shifts').then(r => r.data),
  })
  const refresh = () => qc.invalidateQueries({ queryKey: SHIFTS_KEY })

  const byHari = useMemo(() => {
    const m: Record<string, Shift[]> = {}
    for (const s of data?.data ?? []) { (m[s.hari] ??= []).push(s) }
    return m
  }, [data])

  const hariList = data?.hari ?? []

  return (
    <Card><CardContent className="p-4 space-y-3">
      <h3 className="font-semibold text-sm">Jadwal Piket Mingguan</h3>
      {isLoading ? <div className="h-40 rounded bg-muted animate-pulse" /> : (
        <div className="space-y-4">
          {hariList.map(h => (
            <div key={h.value} className="rounded-md border p-3 space-y-2">
              <div className="text-sm font-semibold">{h.label}</div>
              {(byHari[h.value] ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Belum ada shift.</p>
              )}
              <div className="space-y-2">
                {(byHari[h.value] ?? []).map(s => <ShiftCard key={s.id} shift={s} onChanged={refresh} />)}
              </div>
              <AddShiftForm hari={h.value} onSaved={refresh} />
            </div>
          ))}
        </div>
      )}
    </CardContent></Card>
  )
}

// ── Kartu satu shift: jam, petugas (chip hapus), tambah petugas, edit, hapus ──
function ShiftCard({ shift, onChanged }: { shift: Shift; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const setPetugas = useMutation({
    mutationFn: (uuids: string[]) => api.put(`/admin/piket/shifts/${shift.id}/petugas`, { teacher_uuid: uuids }).then(r => r.data),
    onSuccess: () => onChanged(),
    onError: (e: any) => setErr(e.response?.data?.message ?? 'Gagal.'),
  })
  const hapus = useMutation({
    mutationFn: () => api.delete(`/admin/piket/shifts/${shift.id}`).then(r => r.data),
    onSuccess: () => onChanged(),
  })

  const uuids = shift.petugas.map(p => p.id)
  const addTeacher = (o: TeacherOpt) => { if (!uuids.includes(o.id)) setPetugas.mutate([...uuids, o.id]) }
  const removeTeacher = (id: string) => setPetugas.mutate(uuids.filter(u => u !== id))

  if (editing) return <ShiftForm shift={shift} onDone={() => { setEditing(false); onChanged() }} onCancel={() => setEditing(false)} />

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm font-medium">
          {shift.nama_shift} <span className="text-xs text-muted-foreground font-normal">{shift.jam_mulai}–{shift.jam_selesai}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => hapus.mutate()} disabled={hapus.isPending}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {shift.petugas.length === 0 && <span className="text-xs text-muted-foreground">Belum ada petugas.</span>}
        {shift.petugas.map(p => (
          <Badge key={p.id} variant="secondary" className="cursor-pointer" onClick={() => removeTeacher(p.id)}>
            {p.nama ?? '—'} ✕
          </Badge>
        ))}
      </div>
      <TeacherPicker onPick={addTeacher} disabled={setPetugas.isPending} />
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  )
}

// ── Form tambah shift (nama + jam mulai/selesai) ─────────────────────────────
function AddShiftForm({ hari, onSaved }: { hari: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Tambah shift</Button>
  return <ShiftForm hari={hari} onDone={() => { setOpen(false); onSaved() }} onCancel={() => setOpen(false)} />
}

function ShiftForm({ shift, hari, onDone, onCancel }: { shift?: Shift; hari?: string; onDone: () => void; onCancel: () => void }) {
  const [nama, setNama] = useState(shift?.nama_shift ?? '')
  const [mulai, setMulai] = useState(shift?.jam_mulai ?? '06:00')
  const [selesai, setSelesai] = useState(shift?.jam_selesai ?? '11:00')
  const [err, setErr] = useState<string | null>(null)
  const targetHari = shift?.hari ?? hari!

  const simpan = useMutation({
    mutationFn: () => {
      const body = { hari: targetHari, nama_shift: nama, jam_mulai: mulai, jam_selesai: selesai }
      return shift
        ? api.put(`/admin/piket/shifts/${shift.id}`, body).then(r => r.data)
        : api.post('/admin/piket/shifts', body).then(r => r.data)
    },
    onSuccess: () => onDone(),
    onError: (e: any) => setErr(e.response?.data?.message ?? 'Gagal menyimpan.'),
  })

  return (
    <div className="rounded-md border border-dashed p-3 space-y-2">
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-32">
          <label className="text-xs text-muted-foreground">Nama shift</label>
          <input className={inputCls} value={nama} onChange={e => setNama(e.target.value)} placeholder="mis. Pagi" />
        </div>
        <div className="w-28">
          <label className="text-xs text-muted-foreground">Mulai</label>
          <input type="time" className={inputCls} value={mulai} onChange={e => setMulai(e.target.value)} />
        </div>
        <div className="w-28">
          <label className="text-xs text-muted-foreground">Selesai</label>
          <input type="time" className={inputCls} value={selesai} onChange={e => setSelesai(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => { setErr(null); simpan.mutate() }} disabled={simpan.isPending || !nama.trim()}>
          {simpan.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Simpan
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}><X className="h-4 w-4 mr-1" /> Batal</Button>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  )
}

// ── Pencari guru (reusable) ──────────────────────────────────────────────────
function TeacherPicker({ onPick, disabled }: { onPick: (o: TeacherOpt) => void; disabled?: boolean }) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const t = useRef<number | undefined>(undefined)
  useEffect(() => { window.clearTimeout(t.current); t.current = window.setTimeout(() => setDebounced(search), 300); return () => window.clearTimeout(t.current) }, [search])

  const { data: hasil } = useQuery<{ data: TeacherOpt[] }>({
    queryKey: ['piket-teacher-search', debounced],
    queryFn: () => api.get('/admin/teachers', { params: { search: debounced, per_page: 30 } }).then(r => r.data),
    enabled: debounced.length >= 2,
  })

  return (
    <div className="relative max-w-xs">
      <div className="relative">
        <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
        <input className={inputCls + ' pl-8'} value={search} disabled={disabled} onChange={e => setSearch(e.target.value)} placeholder="+ tambah guru (min. 2 huruf)" />
      </div>
      {debounced.length >= 2 && (hasil?.data?.length ?? 0) > 0 && (
        <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-popover shadow">
          {hasil!.data.map(o => (
            <button key={o.id} onClick={() => { onPick(o); setSearch('') }} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-accent">{o.nama}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tier poin keterlambatan (kesiangan) ──────────────────────────────────────
interface Tier { menit_min: number; menit_max: number | null; poin: number }
interface TierData { tiers: Tier[]; subitem_id: number | null; subitems: { id: number; label: string }[] }

function TierSection() {
  const qc = useQueryClient()
  const [rows, setRows] = useState<Tier[]>([])
  const [subitemId, setSubitemId] = useState<string>('')
  const [msg, setMsg] = useState<string | null>(null)

  const { data } = useQuery<{ data: TierData }>({
    queryKey: ['admin-kesiangan-tiers'],
    queryFn: () => api.get('/admin/kesiangan-tiers').then(r => r.data),
  })
  useEffect(() => { if (data?.data) { setRows(data.data.tiers.map(t => ({ ...t }))); setSubitemId(data.data.subitem_id ? String(data.data.subitem_id) : '') } }, [data])

  const save = useMutation({
    mutationFn: () => api.put('/admin/kesiangan-tiers', { tiers: rows, subitem_id: subitemId ? Number(subitemId) : null }).then(r => r.data),
    onSuccess: (d) => { setMsg(d.message); qc.invalidateQueries({ queryKey: ['admin-kesiangan-tiers'] }) },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal menyimpan.'),
  })

  const set = (i: number, k: keyof Tier, v: string) =>
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [k]: v === '' ? (k === 'menit_max' ? null : 0) : Number(v) } : r))

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-sm">Poin Kesiangan Otomatis</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Poin negatif otomatis per rentang menit keterlambatan. Kosongkan "s.d." pada baris terakhir = tak terbatas.
        </p>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Sub-karakter untuk poin kesiangan</label>
        <select className={inputCls} value={subitemId} onChange={e => setSubitemId(e.target.value)}>
          <option value="">— pilih sub-karakter —</option>
          {(data?.data.subitems ?? []).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        {!subitemId && <p className="text-[11px] text-amber-700 mt-0.5">Wajib dipilih, jika kosong poin kesiangan tidak akan tercatat.</p>}
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap text-sm">
            <input type="number" min={0} className={inputCls + ' w-20'} value={r.menit_min} onChange={e => set(i, 'menit_min', e.target.value)} />
            <span className="text-xs text-muted-foreground">s.d.</span>
            <input type="number" min={0} className={inputCls + ' w-20'} value={r.menit_max ?? ''} placeholder="∞" onChange={e => set(i, 'menit_max', e.target.value)} />
            <span className="text-xs text-muted-foreground">menit →</span>
            <input type="number" max={0} className={inputCls + ' w-20'} value={r.poin} onChange={e => set(i, 'poin', e.target.value)} />
            <span className="text-xs text-muted-foreground">poin</span>
            <Button size="icon" variant="ghost" onClick={() => setRows(rs => rs.filter((_, idx) => idx !== i))}><span className="text-red-500">✕</span></Button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => setRows([...rows, { menit_min: 0, menit_max: null, poin: 0 }])}><Plus className="h-4 w-4 mr-1" /> Tambah Tier</Button>
        <Button size="sm" onClick={() => { setMsg(null); save.mutate() }} disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Simpan Tier
        </Button>
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </CardContent></Card>
  )
}

// ── Import Excel ─────────────────────────────────────────────────────────────
function ImportSection({ onSaved }: { onSaved: () => void }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string; errors?: string[] } | null>(null)

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setImporting(true); setResult(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await api.post('/admin/piket/import', fd)
      setResult({ ok: true, message: r.data.message, errors: r.data.errors })
      qc.invalidateQueries({ queryKey: SHIFTS_KEY }); onSaved()
    } catch (err: any) {
      const d = err?.response?.data
      setResult({ ok: false, message: d?.message ?? 'Import gagal.', errors: d?.errors })
    } finally { setImporting(false) }
  }

  return (
    <Card><CardContent className="p-4 space-y-2">
      <h3 className="font-semibold text-sm">Impor dari Excel</h3>
      <p className="text-xs text-muted-foreground">Kolom: <code>hari</code> (senin–jumat), <code>nama_shift</code>, <code>jam_mulai</code>, <code>jam_selesai</code> (HH:MM), <code>nama_guru</code> — satu baris = satu guru pada satu shift-hari.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => downloadBlob('/admin/piket/template', 'template_piket.xlsx')}>
          <Download className="h-4 w-4 mr-1" /> Unduh Template
        </Button>
        <Button size="sm" variant="outline" disabled={importing} onClick={() => fileRef.current?.click()}>
          {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />} Import Excel
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onImport} />
      </div>
      {result && (
        <div className={`rounded-md border p-2 text-xs ${result.ok ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <p className="flex items-center gap-1 font-medium">{result.ok ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />} {result.message}</p>
          {result.errors && result.errors.length > 0 && <ul className="list-disc ml-5 mt-1 text-red-600">{result.errors.slice(0, 8).map((er, i) => <li key={i}>{er}</li>)}</ul>}
        </div>
      )}
    </CardContent></Card>
  )
}
