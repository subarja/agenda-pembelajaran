import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, Download, Upload, CheckCircle2, AlertCircle, X, History, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import type { LearningObjective } from '@/features/agenda/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

interface Context {
  subject_id: string
  subject_nama: string
  subject_kode: string
  fase: 'E' | 'F'
  fase_label: string
}

interface ImportResult {
  message: string; inserted: number; updated: number; errors: string[]
}

interface TpLog {
  uuid: string
  action: 'create' | 'update' | 'delete' | 'restore'
  changed_by: string
  tp_kode: string
  snapshot: { kode: string; deskripsi: string; urutan: number; semester: string; aktif: boolean } | null
  created_at: string
}

const SEMESTER_OPTIONS = [
  { value: 'ganjil', label: 'Ganjil' },
  { value: 'genap',  label: 'Genap' },
]

const ACTION_LABEL: Record<string, string> = {
  create: 'Ditambahkan',
  update: 'Diubah',
  delete: 'Dihapus',
  restore: 'Dikembalikan',
}

const ACTION_COLOR: Record<string, string> = {
  create:  'bg-green-100 text-green-700',
  update:  'bg-blue-100 text-blue-700',
  delete:  'bg-red-100 text-red-700',
  restore: 'bg-yellow-100 text-yellow-700',
}

export default function TujuanPembelajaranPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin' || user?.role === 'wakasek'

  const [selectedCtx, setSelectedCtx] = useState<Context | null>(null)
  const [semester, setSemester] = useState<'ganjil' | 'genap'>('ganjil')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [form, setForm] = useState({ kode: '', deskripsi: '', urutan: '1' })
  const [error, setError] = useState('')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [showLog, setShowLog] = useState(false)
  const [revertConfirm, setRevertConfirm] = useState<string | null>(null)

  // ── Load konteks mapel+fase dari jadwal guru ──────────────────────────────
  const { data: ctxRes } = useQuery({
    queryKey: ['tp-contexts'],
    queryFn: () => api.get<{ data: Context[] }>('/learning-objectives/my-contexts'),
  })
  const contexts = ctxRes?.data.data ?? []

  // ── Load TP sesuai konteks + semester ─────────────────────────────────────
  const loKey = ['learning-objectives', selectedCtx?.subject_id, selectedCtx?.fase, semester]
  const { data: loRes, isLoading } = useQuery({
    queryKey: loKey,
    queryFn: () => api.get<{ data: LearningObjective[] }>('/learning-objectives', {
      params: { subject_id: selectedCtx!.subject_id, fase: selectedCtx!.fase, semester },
    }),
    enabled: !!selectedCtx,
  })
  const objectives = loRes?.data.data ?? []

  // ── Load log perubahan ────────────────────────────────────────────────────
  const logKey = ['tp-logs', selectedCtx?.subject_id, selectedCtx?.fase]
  const { data: logRes, isLoading: logLoading } = useQuery({
    queryKey: logKey,
    queryFn: () => api.get<{ data: TpLog[] }>('/learning-objectives/logs', {
      params: { subject_id: selectedCtx!.subject_id, fase: selectedCtx!.fase },
    }),
    enabled: !!selectedCtx && showLog,
  })
  const logs = logRes?.data.data ?? []

  // ── Mutations ──────────────────────────────────────────────────────────────
  const storeMutation = useMutation({
    mutationFn: () => api.post('/learning-objectives', {
      subject_id: selectedCtx!.subject_id,
      fase: selectedCtx!.fase,
      kode: form.kode,
      deskripsi: form.deskripsi,
      urutan: parseInt(form.urutan, 10),
      semester,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loKey })
      queryClient.invalidateQueries({ queryKey: logKey })
      setShowForm(false)
      setForm({ kode: '', deskripsi: '', urutan: String(objectives.length + 2) })
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setError(e.response?.data?.message ?? 'Gagal menyimpan.'),
  })

  const updateMutation = useMutation({
    mutationFn: () => api.put(`/learning-objectives/${editId}`, {
      kode: form.kode, deskripsi: form.deskripsi, urutan: parseInt(form.urutan, 10),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loKey })
      queryClient.invalidateQueries({ queryKey: logKey })
      setEditId(null); setShowForm(false)
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setError(e.response?.data?.message ?? 'Gagal memperbarui.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (uuid: string) => api.delete(`/learning-objectives/${uuid}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loKey })
      queryClient.invalidateQueries({ queryKey: logKey })
    },
  })

  const revertMutation = useMutation({
    mutationFn: (logUuid: string) =>
      api.post(`/admin/learning-objectives/revert/${logUuid}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loKey })
      queryClient.invalidateQueries({ queryKey: logKey })
      setRevertConfirm(null)
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      alert(e.response?.data?.message ?? 'Gagal mengembalikan.'),
  })

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('subject_id', selectedCtx!.subject_id)
      fd.append('fase', selectedCtx!.fase)
      fd.append('semester', semester)
      return api.post<ImportResult>('/learning-objectives/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: (res) => {
      setImportResult(res.data)
      queryClient.invalidateQueries({ queryKey: loKey })
      queryClient.invalidateQueries({ queryKey: logKey })
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      setImportResult({ message: e.response?.data?.message ?? 'Import gagal.', inserted: 0, updated: 0, errors: [] })
    },
  })

  async function downloadTemplate() {
    const res = await api.get('/learning-objectives/template', { responseType: 'blob' })
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a'); a.href = url
    a.download = 'template_tujuan_pembelajaran.xlsx'; a.click()
    URL.revokeObjectURL(url)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportResult(null); importMutation.mutate(file); e.target.value = ''
  }

  function openCreate() {
    setEditId(null); setForm({ kode: '', deskripsi: '', urutan: String(objectives.length + 1) })
    setError(''); setShowForm(true)
  }

  function openEdit(lo: LearningObjective) {
    setEditId(lo.id); setForm({ kode: lo.kode, deskripsi: lo.deskripsi, urutan: String(lo.urutan) })
    setError(''); setShowForm(true)
  }

  function handleSave() {
    setError('')
    if (!form.kode || !form.deskripsi) { setError('Kode dan deskripsi wajib diisi.'); return }
    editId ? updateMutation.mutate() : storeMutation.mutate()
  }

  const saving = storeMutation.isPending || updateMutation.isPending

  return (
    <div className="max-w-lg space-y-5">
      <h1 className="text-xl font-bold">Tujuan Pembelajaran (TP)</h1>

      {/* ── Pilih Mapel + Fase ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label>Mata Pelajaran & Fase</Label>
        {contexts.length === 0 && (
          <p className="text-sm text-muted-foreground">Belum ada jadwal mengajar terdaftar.</p>
        )}
        <div className="space-y-2">
          {contexts.map((ctx) => {
            const key    = `${ctx.subject_id}-${ctx.fase}`
            const selKey = selectedCtx ? `${selectedCtx.subject_id}-${selectedCtx.fase}` : ''
            const isSelected = key === selKey
            return (
              <button key={key} type="button"
                onClick={() => {
                  setSelectedCtx(ctx); setShowForm(false)
                  setImportResult(null); setShowLog(false)
                }}
                className={cn(
                  'w-full text-left rounded-lg border p-3 transition-colors',
                  isSelected ? 'border-primary-600 bg-primary-50' : 'border-border hover:border-primary-200',
                )}
              >
                <p className="text-sm font-medium">{ctx.subject_nama}</p>
                <p className="text-xs text-muted-foreground">{ctx.fase_label} · {ctx.subject_kode}</p>
              </button>
            )
          })}
        </div>
      </div>

      {selectedCtx && (
        <>
          {/* ── Semester ────────────────────────────────────────────────────── */}
          <div className="flex gap-2">
            {SEMESTER_OPTIONS.map((s) => (
              <button key={s.value} type="button"
                onClick={() => { setSemester(s.value as 'ganjil' | 'genap'); setImportResult(null) }}
                className={cn(
                  'flex-1 rounded-md border py-2 text-sm font-medium transition-colors',
                  semester === s.value
                    ? 'border-primary-600 bg-primary-50 text-primary-600'
                    : 'border-border hover:bg-muted',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* ── Info shared TP ───────────────────────────────────────────────── */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            TP di sini dibagikan ke semua guru yang mengajar <strong>{selectedCtx.subject_nama}</strong> di
            <strong> {selectedCtx.fase_label}</strong>. Setiap perubahan berlaku untuk semua guru tersebut.
          </div>

          {/* ── Hasil import ─────────────────────────────────────────────────── */}
          {importResult && (
            <div className={cn(
              'rounded-lg border p-3 text-sm',
              importResult.errors.length > 0 && importResult.inserted + importResult.updated === 0
                ? 'border-red-200 bg-red-50'
                : 'border-green-200 bg-green-50',
            )}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 font-medium">
                  {importResult.inserted + importResult.updated > 0
                    ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    : <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />}
                  {importResult.message}
                </div>
                <button onClick={() => setImportResult(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {importResult.errors.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-red-700 list-disc list-inside">
                  {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* ── List TP ─────────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
                TP Semester {semester.charAt(0).toUpperCase() + semester.slice(1)} ({objectives.length})
              </p>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline"
                  onClick={() => { setShowLog(!showLog); setShowForm(false) }}
                  title="Riwayat perubahan"
                >
                  <History className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline ml-1">Riwayat</span>
                </Button>
                <Button size="sm" variant="outline" onClick={downloadTemplate} title="Download template Excel">
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline ml-1">Template</span>
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importMutation.isPending}
                  title="Import dari file Excel"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline ml-1">
                    {importMutation.isPending ? 'Mengimpor...' : 'Import'}
                  </span>
                </Button>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
                <Button size="sm" onClick={openCreate} disabled={showForm}>
                  <Plus className="h-3.5 w-3.5" />
                  <span className="ml-1">Tambah</span>
                </Button>
              </div>
            </div>

            {isLoading && <div className="h-24 rounded-lg bg-muted animate-pulse" />}

            {!isLoading && objectives.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Belum ada TP untuk semester ini. Tambah manual atau import dari Excel.
              </p>
            )}

            {objectives.map((lo) => (
              <div key={lo.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3"
              >
                <span className="text-xs font-bold text-primary-600 mt-0.5 shrink-0 w-12">{lo.kode}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{lo.deskripsi}</p>
                  {lo.updated_by && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Diubah oleh {lo.updated_by} · {lo.updated_at}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(lo)} className="text-muted-foreground hover:text-primary-600 p-1">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm('Hapus TP ini?')) deleteMutation.mutate(lo.id) }}
                    className="text-muted-foreground hover:text-red-600 p-1"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Form tambah / edit ──────────────────────────────────────────── */}
          {showForm && (
            <Card className="border-primary-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{editId ? 'Edit TP' : 'Tambah TP Baru'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Kode TP</Label>
                    <Input placeholder="mis: 3.1, 4.2" value={form.kode}
                      onChange={(e) => setForm({ ...form, kode: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Urutan</Label>
                    <Input type="number" min={1} value={form.urutan}
                      onChange={(e) => setForm({ ...form, urutan: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Deskripsi TP</Label>
                  <textarea rows={3} value={form.deskripsi}
                    onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                    placeholder="Peserta didik mampu..."
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <Button size="sm" disabled={saving} onClick={handleSave}>
                    {saving ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Tambahkan'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditId(null) }}>Batal</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Modal Riwayat Perubahan ─────────────────────────────────────── */}
          {showLog && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-lg rounded-lg bg-white shadow-xl flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
                  <div>
                    <h3 className="font-semibold text-sm">Riwayat Perubahan TP</h3>
                    <p className="text-xs text-muted-foreground">
                      {selectedCtx.subject_nama} · {selectedCtx.fase_label}
                    </p>
                  </div>
                  <button onClick={() => { setShowLog(false); setRevertConfirm(null) }}
                    className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {logLoading && (
                    <div className="space-y-3">
                      {[1,2,3].map(i => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}
                    </div>
                  )}

                  {!logLoading && logs.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">Belum ada riwayat perubahan.</p>
                  )}

                  {logs.map((log) => (
                    <div key={log.uuid} className="mb-3 rounded-lg border border-border p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn('text-xs rounded-full px-2 py-0.5 font-medium', ACTION_COLOR[log.action])}>
                              {ACTION_LABEL[log.action]}
                            </span>
                            <span className="text-xs font-mono text-muted-foreground">{log.tp_kode}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Oleh <span className="font-medium text-foreground">{log.changed_by}</span>
                            {' · '}{log.created_at}
                          </p>
                          {log.action === 'update' && log.snapshot && (
                            <div className="mt-1.5 rounded bg-muted/50 px-2 py-1.5 text-xs">
                              <p className="text-muted-foreground mb-0.5">Sebelumnya:</p>
                              <p className="font-medium">{log.snapshot.kode} — {log.snapshot.deskripsi}</p>
                            </div>
                          )}
                          {log.action === 'delete' && log.snapshot && (
                            <div className="mt-1.5 rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">
                              <p>Dihapus: {log.snapshot.kode} — {log.snapshot.deskripsi}</p>
                            </div>
                          )}
                        </div>

                        {isAdmin && (log.action === 'update' || log.action === 'delete') && (
                          <div className="shrink-0">
                            {revertConfirm === log.uuid ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => revertMutation.mutate(log.uuid)}
                                  disabled={revertMutation.isPending}
                                  className="text-xs bg-yellow-500 text-white rounded px-2 py-1 hover:bg-yellow-600"
                                >
                                  {revertMutation.isPending ? '...' : 'Ya, Kembalikan'}
                                </button>
                                <button
                                  onClick={() => setRevertConfirm(null)}
                                  className="text-xs border rounded px-2 py-1 hover:bg-muted"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setRevertConfirm(log.uuid)}
                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                              >
                                <ChevronRight className="h-3 w-3" />
                                Kembalikan
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
