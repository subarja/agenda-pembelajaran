import { useState, useRef, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2, Upload, Download, Pencil, X, Check, AlertCircle, Search } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { pklAdminApi, type PklAdminObjective, type PklImportResult, type PklPlacementRow } from '@/features/pkl/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { WhatsAppLink } from '@/components/ui/whatsapp-link'

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

  const [kode, setKode] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [jurusan, setJurusan] = useState('')            // '' = semua jurusan
  const [editing, setEditing] = useState<PklAdminObjective | null>(null)

  const reset = () => { setKode(''); setDeskripsi(''); setJurusan(''); setEditing(null) }

  const save = useMutation({
    mutationFn: () => editing
      ? pklAdminApi.updateObjective(editing.id, { kode: kode.trim() || null, deskripsi, jurusan: jurusan || null })
      : pklAdminApi.createObjective({ kode: kode.trim() || null, deskripsi, jurusan: jurusan || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pkl-objectives'] }); reset() },
  })
  const del = useMutation({
    mutationFn: (id: string) => pklAdminApi.deleteObjective(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pkl-objectives'] }),
  })

  function startEdit(o: PklAdminObjective) {
    setEditing(o); setKode(o.kode ?? ''); setDeskripsi(o.deskripsi); setJurusan(o.jurusan ?? '')
  }

  return (
    <Card><CardContent className="p-4 space-y-3">
      <h3 className="font-semibold text-sm">Tujuan Pembelajaran PKL</h3>
      <p className="text-xs text-muted-foreground -mt-1">
        Kosongkan jurusan agar TP berlaku untuk <strong>semua jurusan</strong>; pilih jurusan untuk TP khusus.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input placeholder="Kode (mis. PKL-01)" value={kode} onChange={(e) => setKode(e.target.value)} maxLength={30} className="sm:w-36" />
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
                <p>
                  {o.kode && <code className="mr-1.5 rounded bg-muted px-1 py-0.5 text-[11px] font-semibold text-muted-foreground">{o.kode}</code>}
                  {o.deskripsi}
                </p>
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

  // ── Pencarian & filter daftar penempatan (client-side, data sudah utuh) ──
  const [q, setQ] = useState('')
  const dq = useDebounce(q, 300)
  const [fKelas, setFKelas] = useState('')
  const [fIndustri, setFIndustri] = useState('')
  const [fPembimbing, setFPembimbing] = useState('')
  const [fDari, setFDari] = useState('')
  const [fSampai, setFSampai] = useState('')

  const industriList = useMemo(
    () => [...new Set(rows.map((r) => r.tempat_pkl).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id')),
    [rows])
  const pembimbingList = useMemo(
    () => [...new Set(rows.map((r) => r.pembimbing).filter((p): p is string => !!p))].sort((a, b) => a.localeCompare(b, 'id')),
    [rows])

  const adaFilter = !!(dq.trim() || fKelas || fIndustri || fPembimbing || fDari || fSampai)
  const resetFilter = () => { setQ(''); setFKelas(''); setFIndustri(''); setFPembimbing(''); setFDari(''); setFSampai('') }

  const filtered = useMemo(() => {
    const s = dq.trim().toLowerCase()
    return rows.filter((r) => {
      if (fKelas && r.class_id !== fKelas) return false
      if (fIndustri && r.tempat_pkl !== fIndustri) return false
      if (fPembimbing && (r.pembimbing ?? '') !== fPembimbing) return false
      // Rentang waktu: tampilkan penempatan yang periodenya BERIRISAN dengan rentang filter
      // (tanggal ISO dibandingkan sebagai string; baris tanpa tanggal tersaring keluar).
      if (fDari && (r.selesai ?? '') < fDari) return false
      if (fSampai && (r.mulai ?? '~') > fSampai) return false
      if (s) {
        const hay = [r.nama, r.nis, r.nisn, r.telpon, r.kelas, r.tempat_pkl, r.alamat_pkl, r.pembimbing, r.mulai, r.selesai]
          .filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
  }, [rows, dq, fKelas, fIndustri, fPembimbing, fDari, fSampai])

  // File terakhir disimpan supaya keputusan "timpa / perusahaan baru" atas
  // perusahaan MIRIP bisa diterapkan dengan mengunggah ulang file yang sama.
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [decisions, setDecisions] = useState<Record<string, 'timpa' | 'baru'>>({})
  const [editRow, setEditRow] = useState<PklPlacementRow | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  async function doImport(file: File, dec?: Record<string, 'timpa' | 'baru'>) {
    setUploading(true); setResult(null)
    try {
      const res = await pklAdminApi.importPlacements(file, dec)
      setResult(res)
      if (res.pending_matches?.length) {
        setPendingFile(file); setDecisions({})
      } else {
        setPendingFile(null); setDecisions({})
      }
      qc.invalidateQueries({ queryKey: ['pkl-placements'] })
    } catch (err: any) {
      setResult({ success_count: 0, error_count: 1, errors: [err?.response?.data?.message ?? 'Import gagal.'] })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) await doImport(file)
  }

  const pending = result?.pending_matches ?? []
  const semuaDiputuskan = pending.length > 0 && pending.every((m) => decisions[m.key])

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
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Tambah Manual
        </Button>
        <Button size="sm" variant="outline" disabled={rows.length === 0} onClick={() => pklAdminApi.exportPlacements()}>
          <Download className="h-4 w-4 mr-1" /> Export Peserta
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} />
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Impor ulang <strong>melengkapi</strong> data (kunci: siswa + nama perusahaan): perusahaan sama = ditimpa,
        perusahaan baru = baris tambahan (satu siswa boleh beberapa tempat asal periodenya tidak bertumpuk).
        Export memakai format yang sama dengan template sehingga hasil edit bisa diimpor kembali.
      </p>

      {result && (
        <div className="rounded-lg border p-3 text-sm space-y-1">
          <p className="flex items-center gap-1 text-emerald-600"><Check className="h-4 w-4" /> {result.success_count} baris berhasil diimpor.</p>
          {result.error_count > 0 && (
            <div className="text-red-600">
              <p className="flex items-center gap-1"><AlertCircle className="h-4 w-4" /> {result.error_count} baris gagal:</p>
              <ul className="list-disc ml-6 text-xs">{result.errors.map((er, i) => <li key={i}>{er}</li>)}</ul>
            </div>
          )}

          {/* Perusahaan mirip — tanyakan dulu: timpa atau memang perusahaan baru? */}
          {pending.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 mt-2 space-y-2">
              <p className="text-amber-800 font-medium text-xs">
                {pending.length} baris ditahan — nama perusahaannya mirip dengan yang sudah ada. Putuskan satu per satu:
              </p>
              {pending.map((m) => (
                <div key={m.key} className="text-xs flex flex-wrap items-center gap-2">
                  <span className="min-w-0">
                    <strong>{m.siswa}</strong> ({m.kelas}): “{m.tempat_baru}” ≈ “{m.tempat_lama}”
                  </span>
                  <span className="flex gap-1">
                    <button
                      onClick={() => setDecisions((d) => ({ ...d, [m.key]: 'timpa' }))}
                      className={cnBtn(decisions[m.key] === 'timpa')}>
                      Timpa yang lama
                    </button>
                    <button
                      onClick={() => setDecisions((d) => ({ ...d, [m.key]: 'baru' }))}
                      className={cnBtn(decisions[m.key] === 'baru')}>
                      Perusahaan baru
                    </button>
                  </span>
                </div>
              ))}
              <Button size="sm" disabled={!semuaDiputuskan || uploading || !pendingFile}
                onClick={() => pendingFile && doImport(pendingFile, decisions)}>
                {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                Terapkan Keputusan
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Dialog edit / tambah manual */}
      <PlacementFormDialog
        open={addOpen || editRow !== null}
        row={editRow}
        onClose={() => { setAddOpen(false); setEditRow(null) }}
        onSaved={() => { setAddOpen(false); setEditRow(null); qc.invalidateQueries({ queryKey: ['pkl-placements'] }) }}
      />

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

      {/* Pencarian & filter daftar penempatan */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / NIS / industri / alamat…" className="pl-8" />
        </div>
        <select className="rounded-md border border-input bg-background px-2 py-2 text-sm" value={fKelas} onChange={(e) => setFKelas(e.target.value)} aria-label="Filter kelas">
          <option value="">Semua Kelas</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select className="rounded-md border border-input bg-background px-2 py-2 text-sm max-w-[180px]" value={fIndustri} onChange={(e) => setFIndustri(e.target.value)} aria-label="Filter industri">
          <option value="">Semua Industri</option>
          {industriList.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="rounded-md border border-input bg-background px-2 py-2 text-sm max-w-[180px]" value={fPembimbing} onChange={(e) => setFPembimbing(e.target.value)} aria-label="Filter pembimbing">
          <option value="">Semua Pembimbing</option>
          {pembimbingList.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          PKL antara
          <Input type="date" value={fDari} onChange={(e) => setFDari(e.target.value)} className="w-[8.7rem] h-9" aria-label="Rentang PKL dari" />
          s.d.
          <Input type="date" value={fSampai} onChange={(e) => setFSampai(e.target.value)} className="w-[8.7rem] h-9" aria-label="Rentang PKL sampai" />
        </span>
        {adaFilter && (
          <Button size="sm" variant="ghost" onClick={resetFilter}><X className="h-4 w-4 mr-1" /> Reset</Button>
        )}
      </div>
      {adaFilter && (
        <p className="text-xs text-muted-foreground -mt-1">{filtered.length} dari {rows.length} penempatan cocok.</p>
      )}

      {/* Daftar penempatan — data lengkap seperti saat import, bisa diedit manual */}
      <div className="divide-y border rounded-lg max-h-96 overflow-y-auto">
        {filtered.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{r.nama} <span className="text-xs text-muted-foreground">({r.kelas})</span></p>
              <p className="text-xs text-muted-foreground truncate">
                NIS {r.nis ?? '—'} · NISN {r.nisn ?? '—'} · <strong>{r.tempat_pkl}</strong>
                {r.alamat_pkl ? ` — ${r.alamat_pkl}` : ''}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {r.mulai} → {r.selesai} · Pemb.: {r.pembimbing ?? '—'}
              </p>
              {r.telpon && <WhatsAppLink telpon={r.telpon} className="text-xs text-muted-foreground" />}
            </div>
            <button onClick={() => setEditRow(r)} aria-label="Edit penempatan" className="p-2 -m-1 shrink-0 text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
            <button onClick={() => del.mutate(r.id)} aria-label="Hapus penempatan" className="p-2 -m-1 shrink-0 text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            {rows.length === 0 ? 'Belum ada data penempatan PKL.' : 'Tidak ada penempatan yang cocok dengan pencarian/filter.'}
          </div>
        )}
      </div>
    </CardContent></Card>
  )
}

// Tombol keputusan kecil (timpa / perusahaan baru).
function cnBtn(active: boolean): string {
  return `rounded border px-2 py-0.5 ${active ? 'border-amber-600 bg-amber-600 text-white' : 'border-amber-300 bg-white text-amber-800 hover:bg-amber-100'}`
}

/** Form tambah (row=null) / edit (row terisi) penempatan PKL — dipakai admin. */
function PlacementFormDialog({ open, row, onClose, onSaved }: {
  open: boolean
  row: PklPlacementRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [f, setF] = useState({ nisn: '', nis: '', tempat_pkl: '', alamat_pkl: '', telpon: '', tanggal_mulai: '', tanggal_selesai: '', pembimbing: '' })
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  // Prefill saat mulai mengedit baris.
  useEffect(() => {
    if (row) {
      setF({
        nisn: row.nisn ?? '', nis: row.nis ?? '',
        tempat_pkl: row.tempat_pkl, alamat_pkl: row.alamat_pkl ?? '', telpon: row.telpon ?? '',
        tanggal_mulai: row.mulai ?? '', tanggal_selesai: row.selesai ?? '', pembimbing: row.pembimbing ?? '',
      })
    } else {
      setF({ nisn: '', nis: '', tempat_pkl: '', alamat_pkl: '', telpon: '', tanggal_mulai: '', tanggal_selesai: '', pembimbing: '' })
    }
    setErr('')
  }, [row, open])

  async function save() {
    setSaving(true); setErr('')
    try {
      const base = {
        tempat_pkl: f.tempat_pkl, alamat_pkl: f.alamat_pkl || null, telpon: f.telpon || null,
        tanggal_mulai: f.tanggal_mulai, tanggal_selesai: f.tanggal_selesai,
      }
      if (row) {
        await pklAdminApi.updatePlacement(row.id, { ...base, pembimbing: f.pembimbing || null })
      } else {
        await pklAdminApi.createPlacement({ ...base, nisn: f.nisn || undefined, nis: f.nis || undefined, pembimbing: f.pembimbing })
      }
      onSaved()
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  const valid = f.tempat_pkl.trim() && f.tanggal_mulai && f.tanggal_selesai
    && (row ? true : (f.pembimbing.trim() && (f.nisn.trim() || f.nis.trim())))

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{row ? `Edit Penempatan — ${row.nama}` : 'Tambah Penempatan Manual'}</DialogTitle></DialogHeader>
        <div className="space-y-2.5 text-sm">
          {!row && (
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">NISN</Label><Input value={f.nisn} onChange={(e) => setF({ ...f, nisn: e.target.value })} placeholder="kunci utama" /></div>
              <div><Label className="text-xs">NIS (bila NISN kosong)</Label><Input value={f.nis} onChange={(e) => setF({ ...f, nis: e.target.value })} /></div>
            </div>
          )}
          <div><Label className="text-xs">Nama Perusahaan / Tempat PKL</Label><Input value={f.tempat_pkl} onChange={(e) => setF({ ...f, tempat_pkl: e.target.value })} /></div>
          <div><Label className="text-xs">Alamat</Label><Input value={f.alamat_pkl} onChange={(e) => setF({ ...f, alamat_pkl: e.target.value })} /></div>
          <div><Label className="text-xs">No. HP Siswa</Label><Input value={f.telpon} onChange={(e) => setF({ ...f, telpon: e.target.value })} placeholder="08…" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Awal PKL</Label><Input type="date" value={f.tanggal_mulai} onChange={(e) => setF({ ...f, tanggal_mulai: e.target.value })} /></div>
            <div><Label className="text-xs">Akhir PKL</Label><Input type="date" value={f.tanggal_selesai} onChange={(e) => setF({ ...f, tanggal_selesai: e.target.value })} /></div>
          </div>
          <div><Label className="text-xs">Guru Pembimbing (nama persis)</Label><Input value={f.pembimbing} onChange={(e) => setF({ ...f, pembimbing: e.target.value })} placeholder={row ? 'kosongkan = tidak diubah' : ''} /></div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={onClose}>Batal</Button>
            <Button size="sm" disabled={!valid || saving} onClick={save}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />} Simpan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
