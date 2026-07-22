import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Download, Upload, AlertCircle, Check, Search } from 'lucide-react'
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
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

interface PiketRow { id: number; tanggal: string; teacher_id: string; nama_guru: string | null }
interface TeacherOpt { id: string; nama: string }

export default function PiketAdminTab() {
  const qc = useQueryClient()
  const [dari, setDari] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` })
  const [sampai, setSampai] = useState(() => { const d = new Date(); const e = new Date(d.getFullYear(), d.getMonth() + 1, 0); return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}` })

  const { data, isLoading } = useQuery<{ data: PiketRow[] }>({
    queryKey: ['admin-piket', dari, sampai],
    queryFn: () => api.get('/admin/piket/assignments', { params: { dari, sampai } }).then(r => r.data),
  })

  const byDate = useMemo(() => {
    const m: Record<string, PiketRow[]> = {}
    for (const r of data?.data ?? []) { (m[r.tanggal] ??= []).push(r) }
    return m
  }, [data])

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-piket'] })

  const hapus = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/piket/assignments/${id}`).then(r => r.data),
    onSuccess: () => refresh(),
  })

  return (
    <div className="space-y-6 max-w-4xl">
      <p className="text-xs text-muted-foreground max-w-2xl">
        Tugaskan guru piket per tanggal. Menu <b>Piket</b> muncul di akun guru <b>hanya pada hari
        ia bertugas</b>. Satu hari boleh beberapa petugas. Impor massal dari Excel di bawah.
      </p>

      <TambahSection onSaved={refresh} />
      <ImportSection onSaved={refresh} />
      <TierSection />

      <Card><CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold text-sm">Jadwal Piket</h3>
          <div className="flex items-center gap-2 text-sm">
            <input type="date" className={inputCls + ' w-auto'} value={dari} onChange={e => setDari(e.target.value)} />
            <span className="text-muted-foreground">s.d.</span>
            <input type="date" className={inputCls + ' w-auto'} value={sampai} onChange={e => setSampai(e.target.value)} />
          </div>
        </div>

        {isLoading ? <div className="h-24 rounded bg-muted animate-pulse" /> : (
          <div className="space-y-2">
            {Object.keys(byDate).length === 0 && <p className="text-xs text-muted-foreground">Belum ada penugasan pada rentang ini.</p>}
            {Object.entries(byDate).map(([tgl, rows]) => (
              <div key={tgl} className="rounded-md border p-3">
                <div className="text-sm font-medium mb-1">{new Date(tgl).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div className="flex flex-wrap gap-1.5">
                  {rows.map(r => (
                    <Badge key={r.id} variant="secondary" className="cursor-pointer" onClick={() => hapus.mutate(r.id)}>
                      {r.nama_guru ?? '—'} ✕
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>
    </div>
  )
}

// ── Tambah penugasan (tanggal + cari guru multi-pilih) ───────────────────────
function TambahSection({ onSaved }: { onSaved: () => void }) {
  const [tanggal, setTanggal] = useState(todayStr)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [picked, setPicked] = useState<TeacherOpt[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const t = useRef<number | undefined>(undefined)

  useEffect(() => { window.clearTimeout(t.current); t.current = window.setTimeout(() => setDebounced(search), 300); return () => window.clearTimeout(t.current) }, [search])

  const { data: hasil } = useQuery<{ data: TeacherOpt[] }>({
    queryKey: ['piket-teacher-search', debounced],
    queryFn: () => api.get('/admin/teachers', { params: { search: debounced, per_page: 30 } }).then(r => r.data),
    enabled: debounced.length >= 2,
  })

  const simpan = useMutation({
    mutationFn: () => api.post('/admin/piket/assignments', { tanggal, teacher_uuid: picked.map(p => p.id) }).then(r => r.data),
    onSuccess: (d) => { setMsg(d.message); setPicked([]); setSearch(''); onSaved() },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal menyimpan.'),
  })

  const add = (o: TeacherOpt) => { if (!picked.find(p => p.id === o.id)) setPicked([...picked, o]); setSearch('') }

  return (
    <Card><CardContent className="p-4 space-y-3">
      <h3 className="font-semibold text-sm">Tugaskan Guru Piket</h3>
      <div className="flex items-end gap-2 flex-wrap">
        <div className="w-44">
          <label className="text-xs text-muted-foreground">Tanggal</label>
          <input type="date" className={inputCls} value={tanggal} onChange={e => setTanggal(e.target.value)} />
        </div>
        <div className="flex-1 min-w-52 relative">
          <label className="text-xs text-muted-foreground">Cari guru (min. 2 huruf)</label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
            <input className={inputCls + ' pl-8'} value={search} onChange={e => setSearch(e.target.value)} placeholder="nama guru" />
          </div>
          {debounced.length >= 2 && (hasil?.data?.length ?? 0) > 0 && (
            <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-popover shadow">
              {hasil!.data.map(o => (
                <button key={o.id} onClick={() => add(o)} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-accent">{o.nama}</button>
              ))}
            </div>
          )}
        </div>
        <Button size="sm" onClick={() => { setMsg(null); simpan.mutate() }} disabled={simpan.isPending || picked.length === 0}>
          {simpan.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}<Plus className="h-4 w-4 mr-1" /> Tugaskan
        </Button>
      </div>
      {picked.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {picked.map(p => (
            <Badge key={p.id} variant="secondary" className="cursor-pointer" onClick={() => setPicked(ps => ps.filter(x => x.id !== p.id))}>{p.nama} ✕</Badge>
          ))}
        </div>
      )}
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </CardContent></Card>
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
      const r = await api.post('/admin/piket/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setResult({ ok: true, message: r.data.message, errors: r.data.errors }); onSaved()
    } catch (err: any) {
      const d = err?.response?.data
      setResult({ ok: false, message: d?.message ?? 'Import gagal.', errors: d?.errors })
    } finally { setImporting(false) }
  }

  return (
    <Card><CardContent className="p-4 space-y-2">
      <h3 className="font-semibold text-sm">Impor dari Excel</h3>
      <p className="text-xs text-muted-foreground">Kolom: <code>tanggal</code> (YYYY-MM-DD), <code>nama_guru</code> (satu baris = satu guru pada satu tanggal).</p>
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
