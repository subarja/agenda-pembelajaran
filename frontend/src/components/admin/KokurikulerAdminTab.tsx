import { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2, Plus, Trash2, Pencil, X, Download, BarChart3, AlertCircle,
  ChevronDown, ChevronUp, Upload, RotateCcw, FileText, Check,
} from 'lucide-react'
import {
  kokurikulerAdminApi,
  type KkAdminProject, type KkMasterDimension, type KkImportResult, type KkAdminProjectPayload,
} from '@/features/kokurikuler/api'
import { usePdfPreview } from '@/hooks/usePdfPreview'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_LABEL: Record<KkAdminProject['status'], { label: string; cls: string }> = {
  draft:   { label: 'Draft',   cls: 'bg-gray-100 text-gray-700' },
  aktif:   { label: 'Aktif',   cls: 'bg-emerald-100 text-emerald-700' },
  selesai: { label: 'Selesai', cls: 'bg-blue-100 text-blue-700' },
}

interface DimensiForm {
  dimension_id: number
  aspek: string
  subdimension_ids: number[]
}

interface FormState {
  id: string | null
  judul: string
  tema: string
  tingkat: string[]      // kosong = semua tingkat; bisa lebih dari satu, mis. ['XI','XII']
  tujuan: string
  deskripsi: string
  tanggal_mulai: string
  tanggal_selesai: string
  status: KkAdminProject['status']
  classes: { id: string; fasilitator_user_id: string | null }[]
  dimensi: DimensiForm[]
}

const EMPTY_FORM: FormState = {
  id: null, judul: '', tema: '', tingkat: [], tujuan: '', deskripsi: '',
  tanggal_mulai: '', tanggal_selesai: '', status: 'draft', classes: [], dimensi: [],
}

export default function KokurikulerAdminTab() {
  const qc = useQueryClient()
  const [form, setForm]         = useState<FormState | null>(null)
  const [rekapFor, setRekapFor] = useState<string | null>(null)
  const [unduhErr, setUnduhErr] = useState<string | null>(null)
  const pdf = usePdfPreview()

  const { data, isLoading } = useQuery({
    queryKey: ['kokurikuler-admin-projects'],
    queryFn: () => kokurikulerAdminApi.projects(),
  })
  const projects = data?.data.data ?? []

  const del = useMutation({
    mutationFn: (id: string) => kokurikulerAdminApi.deleteProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kokurikuler-admin-projects'] }),
  })

  function startEdit(p: KkAdminProject) {
    setForm({
      id: p.id, judul: p.judul, tema: p.tema ?? '',
      tingkat: p.tingkat ? p.tingkat.split(',') : [],
      tujuan: p.tujuan ?? '', deskripsi: p.deskripsi ?? '',
      tanggal_mulai: p.tanggal_mulai, tanggal_selesai: p.tanggal_selesai, status: p.status,
      classes: p.classes.map((c) => ({
        id: c.id,
        fasilitator_user_id: c.wali_adalah_fasilitator ? null : c.fasilitator_user_id,
      })),
      dimensi: p.dimensi.map((d) => ({
        dimension_id: d.dimension_id, aspek: d.aspek ?? '', subdimension_ids: d.subdimension_ids,
      })),
    })
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <Card><CardContent className="p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div>
            <h3 className="font-semibold text-sm">Projek Kokurikuler</h3>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Projek per periode & tingkat: tema, judul, tujuan, dimensi + sub-dimensi, kelas peserta
              dengan fasilitator (default wali kelas — bisa diganti manual per kelas atau impor Excel),
              absen, laporan harian, refleksi siswa, penilaian, dan dokumen tim.
            </p>
          </div>
          <div className="flex flex-wrap gap-1 shrink-0">
            {/* Rekap seluruh program — tombol Absen/Nilai di tiap kartu hanya satu projek. */}
            <Button size="sm" variant="outline" disabled={projects.length === 0}
              title="Unduh seluruh program kokurikuler (Excel)"
              onClick={() => {
                setUnduhErr(null)
                kokurikulerAdminApi.downloadProjects('program_kokurikuler.xlsx')
                  .catch((e: Error) => setUnduhErr(e.message || 'Gagal mengunduh.'))
              }}>
              <Download className="h-4 w-4 mr-1" /> Unduh Semua Program
            </Button>
            {!form && (
              <Button size="sm" onClick={() => setForm(EMPTY_FORM)}>
                <Plus className="h-4 w-4 mr-1" /> Buat Projek
              </Button>
            )}
          </div>
        </div>
      </CardContent></Card>

      {form && <ProjectForm form={form} setForm={setForm} />}

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</div>
      ) : projects.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Belum ada projek kokurikuler.</CardContent></Card>
      ) : (
        projects.map((p) => (
          <Card key={p.id}><CardContent className="p-4 space-y-2">
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">{p.judul}
                  <span className={cn('ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_LABEL[p.status].cls)}>
                    {STATUS_LABEL[p.status].label}
                  </span>
                  <Badge variant="outline" className="ml-1 text-[11px]">Tingkat {p.tingkat ? p.tingkat.split(',').join(' & ') : 'Semua'}</Badge>
                </p>
                {p.tema && <p className="text-xs text-muted-foreground mt-0.5">Tema: {p.tema}</p>}
                {p.tujuan && <p className="text-xs text-muted-foreground mt-0.5">Tujuan: {p.tujuan}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {p.tanggal_mulai} s.d. {p.tanggal_selesai}{p.tahun_ajaran ? ` · TA ${p.tahun_ajaran}` : ''} · {p.classes.length} kelas
                  {p.dimensi.length > 0 && ` · Dimensi: ${p.dimensi.map((d) => d.nama).join(', ')}`}
                </p>
              </div>
              {/* Di HP baris 5 tombol ini butuh ~428px; `shrink-0` dulu menahannya tetap
                  selebar itu di dalam induk 324px sehingga dokumen meluap 71px —
                  `flex-wrap` tak menolong karena yang dibatasi induknya. Turun ke baris
                  sendiri (w-full) di HP, tetap sebaris di layar lebar. */}
              <div className="flex flex-wrap gap-1 w-full sm:w-auto sm:shrink-0">
                <Button size="sm" variant="outline" onClick={() => setRekapFor(rekapFor === p.id ? null : p.id)}>
                  <BarChart3 className="h-4 w-4 mr-1" /> Rekap {rekapFor === p.id ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                </Button>
                <Button size="sm" variant="outline" title="Unduh absen (Excel)" onClick={() => {
                  setUnduhErr(null)
                  kokurikulerAdminApi.downloadAbsen(p.id, `absen_kokurikuler_${p.judul.replace(/\s+/g, '_')}.xlsx`)
                    .catch((e: Error) => setUnduhErr(e.message || 'Gagal mengunduh.'))
                }}>
                  <Download className="h-4 w-4 mr-1" /> Absen
                </Button>
                <Button size="sm" variant="outline" title="Unduh nilai (Excel)" onClick={() => {
                  setUnduhErr(null)
                  kokurikulerAdminApi.downloadNilaiExcel(p.id, `nilai_kokurikuler_${p.judul.replace(/\s+/g, '_')}.xlsx`)
                    .catch((e: Error) => setUnduhErr(e.message || 'Gagal mengunduh.'))
                }}>
                  <Download className="h-4 w-4 mr-1" /> Nilai
                </Button>
                <Button size="sm" variant="outline" title="Unduh nilai (PDF, TTD fasilitator)" onClick={() => {
                  setUnduhErr(null)
                  pdf.openPreview(kokurikulerAdminApi.nilaiPdfUrl(p.id), `nilai_kokurikuler_${p.judul.replace(/\s+/g, '_')}.pdf`)
                    .catch((e: Error) => setUnduhErr(e.message || 'Gagal membuka PDF.'))
                }}>
                  <FileText className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => startEdit(p)} aria-label="Ubah projek"><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-red-600" aria-label="Hapus projek"
                  onClick={() => { if (confirm(`Hapus projek "${p.judul}"?`)) del.mutate(p.id) }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {p.classes.map((c) => (
                <Badge key={c.id} variant="outline" className="text-[11px]">
                  {c.label} · {c.fasilitator ?? '—'}{c.wali_adalah_fasilitator ? ' (wali)' : ''}
                </Badge>
              ))}
            </div>

            {rekapFor === p.id && <RekapSection projectId={p.id} />}
          </CardContent></Card>
        ))
      )}
      {unduhErr && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="h-4 w-4 shrink-0" /> {unduhErr}</p>}

      <MasterDimensiSection />
      {pdf.modal}
    </div>
  )
}

// ── Form buat/ubah projek ─────────────────────────────────────────────────────
function ProjectForm({ form, setForm }: { form: FormState; setForm: (f: FormState | null) => void }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importResult, setImportResult] = useState<KkImportResult | null>(null)
  const [importing, setImporting] = useState(false)

  const { data: classesRes } = useQuery({
    queryKey: ['kokurikuler-admin-class-options'],
    queryFn: () => api.get<{ data: { id: string; label: string }[] }>('/character/classes'),
  })
  const { data: teacherRes } = useQuery({
    queryKey: ['kokurikuler-admin-teacher-options'],
    queryFn: () => kokurikulerAdminApi.teacherOptions(),
  })
  const { data: dimRes } = useQuery({
    queryKey: ['kokurikuler-admin-dimensions'],
    queryFn: () => kokurikulerAdminApi.dimensions(),
  })

  const teacherOptions = teacherRes?.data.data ?? []
  const masterDims     = (dimRes?.data.data ?? []).filter((d) => d.aktif)

  // Kelas difilter sesuai tingkat projek (label kelas diawali tingkatnya).
  // Tanpa centang tingkat = semua kelas.
  const classOptions = useMemo(() => {
    const all = classesRes?.data.data ?? []
    if (form.tingkat.length === 0) return all
    return all.filter((c) => form.tingkat.some((t) => c.label.startsWith(`${t} `)))
  }, [classesRes, form.tingkat])

  const save = useMutation({
    mutationFn: () => {
      const payload: KkAdminProjectPayload = {
        judul: form.judul, tema: form.tema || null,
        tingkat: form.tingkat.length > 0 ? form.tingkat.join(',') : null,
        tujuan: form.tujuan || null, deskripsi: form.deskripsi || null,
        tanggal_mulai: form.tanggal_mulai, tanggal_selesai: form.tanggal_selesai,
        status: form.status,
        classes: form.classes,
        dimensi: form.dimensi.map((d) => ({
          dimension_id: d.dimension_id, aspek: d.aspek || null, subdimension_ids: d.subdimension_ids,
        })),
      }
      return form.id
        ? kokurikulerAdminApi.updateProject(form.id, payload)
        : kokurikulerAdminApi.createProject(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kokurikuler-admin-projects'] })
      setForm(null)
    },
  })

  const reset = useMutation({
    mutationFn: () => kokurikulerAdminApi.fasilitatorReset(form.id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kokurikuler-admin-projects'] })
      setForm({ ...form, classes: form.classes.map((c) => ({ ...c, fasilitator_user_id: null })) })
    },
  })

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !form.id) return
    setImporting(true); setImportResult(null)
    try {
      const res = await kokurikulerAdminApi.importFasilitator(form.id, file)
      setImportResult(res)
      qc.invalidateQueries({ queryKey: ['kokurikuler-admin-projects'] })
    } catch (err: any) {
      setImportResult({ success_count: 0, error_count: 1, errors: [err?.response?.data?.message ?? 'Import gagal.'] })
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch })

  const toggleClass = (id: string) => {
    const exists = form.classes.some((c) => c.id === id)
    set({
      classes: exists
        ? form.classes.filter((c) => c.id !== id)
        : [...form.classes, { id, fasilitator_user_id: null }],
    })
  }

  const setFasilitator = (classId: string, userId: string | null) =>
    set({ classes: form.classes.map((c) => (c.id === classId ? { ...c, fasilitator_user_id: userId } : c)) })

  const toggleDimensi = (dim: KkMasterDimension) => {
    const exists = form.dimensi.some((d) => d.dimension_id === dim.id)
    if (exists) {
      set({ dimensi: form.dimensi.filter((d) => d.dimension_id !== dim.id) })
    } else if (form.dimensi.length >= 4) {
      alert('Maksimal 4 dimensi per projek. Panduan Kokurikuler mencontohkan 2–3 dimensi.')
    } else {
      set({ dimensi: [...form.dimensi, { dimension_id: dim.id, aspek: '', subdimension_ids: dim.subdimensions.map((s) => s.id) }] })
    }
  }

  const patchDimensi = (dimensionId: number, patch: Partial<DimensiForm>) =>
    set({ dimensi: form.dimensi.map((d) => (d.dimension_id === dimensionId ? { ...d, ...patch } : d)) })

  const labelById = useMemo(() => new Map((classesRes?.data.data ?? []).map((c) => [c.id, c.label])), [classesRes])
  const valid = form.judul.trim() && form.tanggal_mulai && form.tanggal_selesai && form.tanggal_selesai >= form.tanggal_mulai

  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{form.id ? 'Ubah Projek' : 'Buat Projek Baru'}</h3>
        <Button size="sm" variant="ghost" onClick={() => setForm(null)}><X className="h-4 w-4" /></Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground">Judul projek *</label>
          <Input value={form.judul} onChange={(e) => set({ judul: e.target.value })} placeholder="mis. SAKOLA WALUYA" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground">Tema</label>
          <Input value={form.tema} onChange={(e) => set({ tema: e.target.value })} placeholder="mis. Pendidikan Karakter Pancawaluya" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground">Tujuan akhir kegiatan</label>
          <textarea className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-14"
            value={form.tujuan} onChange={(e) => set({ tujuan: e.target.value })} maxLength={2000}
            placeholder="Kalimat tujuan akhir kegiatan projek ini…" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground">Deskripsi</label>
          <textarea className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-14"
            value={form.deskripsi} onChange={(e) => set({ deskripsi: e.target.value })} maxLength={2000} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Tingkat sasaran (boleh lebih dari satu; tanpa centang = semua tingkat)</label>
          <div className="flex gap-4 rounded-md border border-input bg-background px-3 py-2">
            {(['X', 'XI', 'XII'] as const).map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="checkbox" checked={form.tingkat.includes(t)}
                  onChange={() => set({
                    tingkat: form.tingkat.includes(t)
                      ? form.tingkat.filter((x) => x !== t)
                      : [...form.tingkat, t],
                  })} />
                {t}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Status projek</label>
          <select className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
            value={form.status} onChange={(e) => set({ status: e.target.value as FormState['status'] })}>
            <option value="draft">Draft — masih disiapkan</option>
            <option value="aktif">Aktif — berjalan</option>
            <option value="selesai">Selesai — dikunci baca-saja</option>
          </select>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Draft: belum terlihat guru/siswa. Aktif: menu Kokurikuler muncul dan bisa diisi.
            Selesai: data terkunci, hanya bisa dilihat/diunduh.
          </p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Periode mulai *</label>
          <Input type="date" value={form.tanggal_mulai} onChange={(e) => set({ tanggal_mulai: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Periode selesai *</label>
          <Input type="date" min={form.tanggal_mulai || undefined} value={form.tanggal_selesai} onChange={(e) => set({ tanggal_selesai: e.target.value })} />
        </div>
      </div>

      {/* Dimensi yang dinilai */}
      <div>
        <label className="text-xs text-muted-foreground">Dimensi Profil Lulusan yang dinilai ({form.dimensi.length}/4)</label>
        {form.dimensi.length > 3 && (
          <p className="text-xs text-amber-600 mt-0.5">Panduan Kokurikuler mencontohkan 2–3 dimensi — semakin banyak, semakin berat penilaian fasilitator.</p>
        )}
        <div className="mt-1 space-y-2">
          {masterDims.map((dim) => {
            const picked = form.dimensi.find((d) => d.dimension_id === dim.id)
            return (
              <div key={dim.id} className={cn('border rounded-lg p-2', picked && 'border-primary-300 bg-primary-50/40')}>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!picked} onChange={() => toggleDimensi(dim)} />
                  <span className="font-medium">{dim.nama}</span>
                </label>
                {picked && (
                  <div className="mt-2 ml-6 space-y-1.5">
                    <Input placeholder="Aspek yang dinilai (kalimat rubrik)…" value={picked.aspek}
                      onChange={(e) => patchDimensi(dim.id, { aspek: e.target.value })} />
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {dim.subdimensions.map((s) => (
                        <label key={s.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input type="checkbox"
                            checked={picked.subdimension_ids.includes(s.id)}
                            onChange={() => patchDimensi(dim.id, {
                              subdimension_ids: picked.subdimension_ids.includes(s.id)
                                ? picked.subdimension_ids.filter((x) => x !== s.id)
                                : [...picked.subdimension_ids, s.id],
                            })} />
                          {s.nama}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {masterDims.length === 0 && <p className="text-xs text-muted-foreground">Master dimensi kosong — tambahkan di bagian "Master Dimensi" di bawah.</p>}
        </div>
      </div>

      {/* Kelas peserta + fasilitator */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground">Kelas peserta ({form.classes.length} dipilih) — fasilitator default: wali kelas</label>
          <div className="ml-auto flex flex-wrap gap-2">
            {form.id && (
              <>
                <Button size="sm" variant="outline" disabled={reset.isPending} onClick={() => reset.mutate()}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Semua Default Wali
                </Button>
                <Button size="sm" variant="outline" onClick={() => kokurikulerAdminApi.downloadFasilitatorTemplate(form.id!)}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Template
                </Button>
                <Button size="sm" variant="outline" disabled={importing} onClick={() => fileRef.current?.click()}>
                  {importing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />} Impor Fasilitator
                </Button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onImportFile} />
              </>
            )}
          </div>
        </div>
        {!form.id && (
          <p className="text-xs text-muted-foreground mt-0.5">Simpan projek dulu untuk memakai impor fasilitator dari Excel.</p>
        )}

        {importResult && (
          <div className="rounded-lg border p-2 mt-1 text-sm space-y-1">
            <p className="flex items-center gap-1 text-emerald-600"><Check className="h-4 w-4" /> {importResult.success_count} baris fasilitator diperbarui.</p>
            {importResult.error_count > 0 && (
              <div className="text-red-600">
                <p className="flex items-center gap-1"><AlertCircle className="h-4 w-4" /> {importResult.error_count} baris gagal:</p>
                <ul className="list-disc ml-6 text-xs">{importResult.errors.map((er, i) => <li key={i}>{er}</li>)}</ul>
              </div>
            )}
          </div>
        )}

        <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-48 overflow-y-auto border rounded-lg p-2">
          {classOptions.map((c) => (
            <label key={c.id} className="flex items-center gap-1.5 text-sm px-1 py-0.5 rounded hover:bg-accent cursor-pointer">
              <input type="checkbox" checked={form.classes.some((x) => x.id === c.id)} onChange={() => toggleClass(c.id)} />
              <span className="truncate">{c.label}</span>
            </label>
          ))}
          {classOptions.length === 0 && <p className="col-span-full text-xs text-muted-foreground p-2">
            Tidak ada kelas{form.tingkat ? ` tingkat ${form.tingkat}` : ''} di TA aktif.
          </p>}
        </div>

        {form.classes.length > 0 && (
          <div className="mt-2 divide-y border rounded-lg">
            {form.classes.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-sm">
                <span className="min-w-0 truncate font-medium">{labelById.get(c.id) ?? c.id}</span>
                <div className="ml-auto flex items-center gap-1">
                  <select className="rounded-md border border-input bg-background px-2 py-1 text-xs max-w-56"
                    value={c.fasilitator_user_id ?? ''}
                    onChange={(e) => setFasilitator(c.id, e.target.value || null)}>
                    <option value="">Default — wali kelas</option>
                    {teacherOptions.map((t) => (
                      <option key={t.id} value={t.id}>{t.nama}{t.nip ? ` (${t.nip})` : ''}</option>
                    ))}
                  </select>
                  {c.fasilitator_user_id && (
                    <button title="Kembalikan ke wali kelas" onClick={() => setFasilitator(c.id, null)}
                      className="p-1 text-muted-foreground hover:text-foreground">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} {form.id ? 'Simpan Perubahan' : 'Buat Projek'}
        </Button>
        {save.isError && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="h-4 w-4 shrink-0" /> {(save.error as any)?.response?.data?.message ?? 'Gagal menyimpan projek.'}
          </p>
        )}
      </div>
    </CardContent></Card>
  )
}

// ── Rekap keterisian + nilai ──────────────────────────────────────────────────
function RekapSection({ projectId }: { projectId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['kokurikuler-admin-rekap', projectId],
    queryFn: () => kokurikulerAdminApi.rekap(projectId),
  })
  const rekap = data?.data.data ?? null

  if (isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground text-sm pt-2"><Loader2 className="h-4 w-4 animate-spin" /> Memuat rekap…</div>
  }
  if (!rekap) return null

  return (
    <div className="pt-2 space-y-2">
      <p className="text-xs text-muted-foreground">
        Per sel: <strong>A</strong> siswa terabsen · <strong>L</strong> laporan fasilitator · <strong>R</strong> refleksi terisi.
      </p>
      <div className="overflow-x-auto border rounded-lg">
        <table className="text-xs w-full min-w-max">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-2 py-1.5 sticky left-0 bg-muted/50">Kelas</th>
              {rekap.hari.map((h) => <th key={h.tanggal} className="px-2 py-1.5 whitespace-nowrap">{h.label.split(',')[1]?.trim() ?? h.tanggal}</th>)}
              <th className="px-2 py-1.5">Tim</th>
              <th className="px-2 py-1.5">Dok.</th>
              <th className="px-2 py-1.5 whitespace-nowrap">Refl. Akhir</th>
              <th className="px-2 py-1.5 whitespace-nowrap">Nilai</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rekap.classes.map((c) => (
              <tr key={c.id}>
                <td className="px-2 py-1.5 sticky left-0 bg-background whitespace-nowrap">
                  <span className="font-medium">{c.label}</span>
                  <span className="text-muted-foreground"> · {c.fasilitator} · {c.jumlah_siswa} siswa</span>
                </td>
                {rekap.hari.map((h) => {
                  const a = c.absen[h.tanggal] ?? 0
                  const l = c.laporan[h.tanggal] ?? false
                  const r = c.refleksi[h.tanggal] ?? 0
                  return (
                    <td key={h.tanggal} className="px-2 py-1.5 text-center whitespace-nowrap">
                      <span className={a > 0 ? 'text-emerald-700' : 'text-muted-foreground'}>A:{a}</span>{' '}
                      <span className={l ? 'text-emerald-700' : 'text-muted-foreground'}>L:{l ? '✓' : '—'}</span>{' '}
                      <span className={r > 0 ? 'text-emerald-700' : 'text-muted-foreground'}>R:{r}</span>
                    </td>
                  )
                })}
                <td className="px-2 py-1.5 text-center">{c.jumlah_tim}</td>
                <td className="px-2 py-1.5 text-center">{c.dokumen}</td>
                <td className="px-2 py-1.5 text-center">{c.refleksi_akhir}/{c.jumlah_siswa}</td>
                <td className={cn('px-2 py-1.5 text-center whitespace-nowrap',
                  c.nilai_total > 0 && c.nilai_terisi >= c.nilai_total ? 'text-emerald-700 font-medium' : '')}>
                  {c.nilai_terisi}/{c.nilai_total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Master Dimensi Profil Lulusan ─────────────────────────────────────────────
function MasterDimensiSection() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<KkMasterDimension | null>(null)
  const [nama, setNama] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [subText, setSubText] = useState('')  // satu sub-dimensi per baris
  const [err, setErr] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<KkImportResult | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['kokurikuler-admin-dimensions'],
    queryFn: () => kokurikulerAdminApi.dimensions(),
    enabled: open,
  })
  const items = data?.data.data ?? []

  const resetForm = () => { setEditing(null); setNama(''); setDeskripsi(''); setSubText(''); setErr(null) }

  const save = useMutation({
    mutationFn: () => {
      const subdimensions = subText.split('\n').map((s) => s.trim()).filter(Boolean)
      return editing
        ? kokurikulerAdminApi.updateDimension(editing.id, { nama, deskripsi: deskripsi || null, subdimensions })
        : kokurikulerAdminApi.createDimension({ nama, deskripsi: deskripsi || null, subdimensions })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kokurikuler-admin-dimensions'] }); resetForm() },
    onError: (e: any) => setErr(e?.response?.data?.message ?? 'Gagal menyimpan dimensi.'),
  })
  const del = useMutation({
    mutationFn: (id: number) => kokurikulerAdminApi.deleteDimension(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kokurikuler-admin-dimensions'] }),
    onError: (e: any) => setErr(e?.response?.data?.message ?? 'Gagal menghapus dimensi.'),
  })

  function startEdit(d: KkMasterDimension) {
    setEditing(d); setNama(d.nama); setDeskripsi(d.deskripsi ?? '')
    setSubText(d.subdimensions.map((s) => s.nama).join('\n')); setErr(null)
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true); setImportResult(null); setErr(null)
    try {
      const res = await kokurikulerAdminApi.importDimensions(file)
      setImportResult(res)
      qc.invalidateQueries({ queryKey: ['kokurikuler-admin-dimensions'] })
    } catch (error: any) {
      setImportResult({ success_count: 0, error_count: 1, errors: [error?.response?.data?.message ?? 'Import gagal.'] })
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Card><CardContent className="p-4 space-y-3">
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen(!open)}>
        <div>
          <h3 className="font-semibold text-sm">Master Dimensi Profil Lulusan</h3>
          <p className="text-xs text-muted-foreground">8 dimensi Permendikdasmen 10/2025 (ter-seed otomatis) — nama, deskripsi, dan sub-dimensi bisa disesuaikan.</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>

      {open && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => kokurikulerAdminApi.downloadDimensionTemplate()}>
              <Download className="h-3.5 w-3.5 mr-1" /> Unduh Template
            </Button>
            <Button size="sm" variant="outline" disabled={importing} onClick={() => fileRef.current?.click()}>
              {importing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />} Impor Excel
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onImportFile} />
            <span className="text-[11px] text-muted-foreground self-center">
              Template berisi master saat ini — edit lalu impor ulang (pencocokan by nama; sub-dimensi lama tidak dihapus).
            </span>
          </div>

          {importResult && (
            <div className="rounded-lg border p-2 text-sm space-y-1">
              <p className="flex items-center gap-1 text-emerald-600"><Check className="h-4 w-4" /> {importResult.success_count} dimensi diperbarui/ditambahkan.</p>
              {importResult.error_count > 0 && (
                <div className="text-red-600">
                  <p className="flex items-center gap-1"><AlertCircle className="h-4 w-4" /> {importResult.error_count} baris gagal:</p>
                  <ul className="list-disc ml-6 text-xs">{importResult.errors.map((er, i) => <li key={i}>{er}</li>)}</ul>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Input placeholder="Nama dimensi…" value={nama} onChange={(e) => setNama(e.target.value)} />
              <textarea className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-14 mt-1"
                placeholder="Deskripsi (opsional)…" value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} />
            </div>
            <div>
              <textarea className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-24"
                placeholder={'Sub-dimensi, satu per baris…'} value={subText} onChange={(e) => setSubText(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={!nama.trim() || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : editing ? <Check className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              {editing ? 'Simpan' : 'Tambah Dimensi'}
            </Button>
            {editing && <Button size="sm" variant="ghost" onClick={resetForm}><X className="h-4 w-4" /></Button>}
            {err && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="h-4 w-4 shrink-0" /> {err}</p>}
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</div>
          ) : (
            <div className="divide-y border rounded-lg">
              {items.map((d) => (
                <div key={d.id} className="flex items-start justify-between gap-2 px-3 py-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{d.nama} {!d.aktif && <Badge variant="outline" className="text-[10px]">nonaktif</Badge>}</p>
                    <p className="text-xs text-muted-foreground">{d.subdimensions.map((s) => s.nama).join(' · ') || '—'}</p>
                  </div>
                  <button onClick={() => startEdit(d)} aria-label="Ubah dimensi" className="p-2 -m-1 text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del.mutate(d.id)} aria-label="Hapus dimensi" className="p-2 -m-1 text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              {items.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted-foreground">Belum ada dimensi — jalankan seeder atau tambah manual.</div>}
            </div>
          )}
        </>
      )}
    </CardContent></Card>
  )
}
