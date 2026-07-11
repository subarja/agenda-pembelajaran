import { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2, Upload, Download, Pencil, X, Check, AlertCircle } from 'lucide-react'
import { pklAdminApi, type PklAdminObjective, type PklImportResult } from '@/features/pkl/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export default function PklAdminTab() {
  return (
    <div className="space-y-6 max-w-4xl">
      <ModeSection />
      <ObjectivesSection />
      <PlacementsSection />
    </div>
  )
}

// ── Saklar Mode PKL ───────────────────────────────────────────────────────────
function ModeSection() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['pkl-setting'], queryFn: () => pklAdminApi.getSetting() })
  const aktif = data?.data.data.aktif ?? false

  const toggle = useMutation({
    mutationFn: (v: boolean) => pklAdminApi.setSetting(v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pkl-setting'] }),
  })

  return (
    <Card><CardContent className="p-4">
      <div className="flex items-start gap-3 justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm">Mode PKL</h3>
          <p className="text-xs text-muted-foreground max-w-lg mt-0.5">
            Saat aktif, sesi kelas XII tampil sebagai “Praktek Kerja Lapangan”, agenda harian kelas XII
            diganti agenda PKL mingguan, dan guru pembimbing mendapat menu PKL.
          </p>
        </div>
        <Switch className="shrink-0" checked={aktif} disabled={toggle.isPending} onCheckedChange={(v) => toggle.mutate(v)} />
      </div>
      {aktif && <Badge variant="default" className="mt-3">Mode PKL AKTIF</Badge>}
    </CardContent></Card>
  )
}

// ── TP Khusus PKL ─────────────────────────────────────────────────────────────
function ObjectivesSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['pkl-objectives'], queryFn: () => pklAdminApi.getObjectives() })
  const items = data?.data.data ?? []
  const jurusans = data?.data.jurusans ?? []

  const [deskripsi, setDeskripsi] = useState('')
  const [jurusan, setJurusan] = useState('')            // '' = semua jurusan
  const [editing, setEditing] = useState<PklAdminObjective | null>(null)

  const reset = () => { setDeskripsi(''); setJurusan(''); setEditing(null) }

  const save = useMutation({
    mutationFn: () => editing
      ? pklAdminApi.updateObjective(editing.id, { deskripsi, jurusan: jurusan || null })
      : pklAdminApi.createObjective({ deskripsi, jurusan: jurusan || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pkl-objectives'] }); reset() },
  })
  const del = useMutation({
    mutationFn: (id: string) => pklAdminApi.deleteObjective(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pkl-objectives'] }),
  })

  function startEdit(o: PklAdminObjective) {
    setEditing(o); setDeskripsi(o.deskripsi); setJurusan(o.jurusan ?? '')
  }

  return (
    <Card><CardContent className="p-4 space-y-3">
      <h3 className="font-semibold text-sm">Tujuan Pembelajaran PKL</h3>
      <p className="text-xs text-muted-foreground -mt-1">
        Kosongkan jurusan agar TP berlaku untuk <strong>semua jurusan</strong>; pilih jurusan untuk TP khusus.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input placeholder="Deskripsi TP PKL…" value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} className="flex-1" />
        <select className="rounded-md border border-input bg-background px-2 py-2 text-sm" value={jurusan} onChange={(e) => setJurusan(e.target.value)}>
          <option value="">Semua Jurusan</option>
          {jurusans.map((j) => <option key={j} value={j}>{j}</option>)}
        </select>
        <Button size="sm" disabled={!deskripsi.trim() || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {editing ? 'Simpan' : 'Tambah'}
        </Button>
        {editing && <Button size="sm" variant="ghost" onClick={reset}><X className="h-4 w-4" /></Button>}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</div>
      ) : (
        <div className="divide-y border rounded-lg">
          {items.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <div className="flex-1">
                <p>{o.deskripsi}</p>
                <Badge variant={o.jurusan ? 'secondary' : 'outline'} className="mt-1 text-[11px]">
                  {o.jurusan ? `Khusus ${o.jurusan}` : 'Umum (semua jurusan)'}
                </Badge>
              </div>
              <button onClick={() => startEdit(o)} aria-label="Ubah TP" className="p-2 -m-1 text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => del.mutate(o.id)} aria-label="Hapus TP" className="p-2 -m-1 text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {items.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted-foreground">Belum ada TP PKL.</div>}
        </div>
      )}
    </CardContent></Card>
  )
}

// ── Import penempatan + rekap ─────────────────────────────────────────────────
function PlacementsSection() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<PklImportResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [rekapClass, setRekapClass] = useState('semua')
  const [rekapErr, setRekapErr] = useState<string | null>(null)

  const { data } = useQuery({ queryKey: ['pkl-placements'], queryFn: () => pklAdminApi.getPlacements() })
  const rows = data?.data.data ?? []

  // Kelas distinct dari data penempatan untuk dropdown rekap.
  const classes = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) if (r.class_id && r.kelas) map.set(r.class_id, r.kelas)
    return [...map.entries()].map(([id, label]) => ({ id, label }))
  }, [rows])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setResult(null)
    try {
      const res = await pklAdminApi.importPlacements(file)
      setResult(res)
      qc.invalidateQueries({ queryKey: ['pkl-placements'] })
    } catch (err: any) {
      setResult({ success_count: 0, error_count: 1, errors: [err?.response?.data?.message ?? 'Import gagal.'] })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const del = useMutation({
    mutationFn: (id: string) => pklAdminApi.deletePlacement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pkl-placements'] }),
  })

  return (
    <Card><CardContent className="p-4 space-y-3">
      <h3 className="font-semibold text-sm">Data Penempatan PKL</h3>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => pklAdminApi.downloadTemplate()}>
          <Download className="h-4 w-4 mr-1" /> Unduh Template
        </Button>
        <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />} Impor Excel
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} />
      </div>

      {result && (
        <div className="rounded-lg border p-3 text-sm space-y-1">
          <p className="flex items-center gap-1 text-emerald-600"><Check className="h-4 w-4" /> {result.success_count} baris berhasil diimpor.</p>
          {result.error_count > 0 && (
            <div className="text-red-600">
              <p className="flex items-center gap-1"><AlertCircle className="h-4 w-4" /> {result.error_count} baris gagal:</p>
              <ul className="list-disc ml-6 text-xs">{result.errors.map((er, i) => <li key={i}>{er}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {/* Rekap absen per kelas */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-sm text-muted-foreground">Rekap absen:</span>
        <select className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={rekapClass} onChange={(e) => setRekapClass(e.target.value)}>
          <option value="semua">Semua Kelas</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <Button size="sm" variant="outline" onClick={() => {
          setRekapErr(null)
          pklAdminApi.downloadRekap(rekapClass, `rekap_absen_pkl.xlsx`)
            .catch((e: Error) => setRekapErr(e.message || 'Gagal mengunduh rekap.'))
        }}>
          <Download className="h-4 w-4 mr-1" /> Unduh Excel
        </Button>
      </div>
      {rekapErr && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="h-4 w-4 shrink-0" /> {rekapErr}</p>}

      {/* Daftar penempatan */}
      <div className="divide-y border rounded-lg max-h-96 overflow-y-auto">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{r.nama} <span className="text-xs text-muted-foreground">({r.kelas})</span></p>
              <p className="text-xs text-muted-foreground truncate">NISN {r.nisn ?? '—'} · {r.tempat_pkl} · Pemb.: {r.pembimbing ?? '—'}</p>
            </div>
            <button onClick={() => del.mutate(r.id)} aria-label="Hapus penempatan" className="p-2 -m-1 shrink-0 text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {rows.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted-foreground">Belum ada data penempatan PKL.</div>}
      </div>
    </CardContent></Card>
  )
}
