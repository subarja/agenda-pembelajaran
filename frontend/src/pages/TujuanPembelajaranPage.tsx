import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil } from 'lucide-react'
import api from '@/lib/api'
import type { LearningObjective } from '@/features/agenda/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Context {
  class_id: string; class_label: string
  subject_id: string; subject_nama: string; subject_kode: string
}

const SEMESTER_OPTIONS = [
  { value: 'ganjil', label: 'Ganjil' },
  { value: 'genap',  label: 'Genap' },
]

export default function TujuanPembelajaranPage() {
  const queryClient = useQueryClient()
  const [selectedCtx, setSelectedCtx] = useState<Context | null>(null)
  const [semester, setSemester] = useState<'ganjil' | 'genap'>('ganjil')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [form, setForm] = useState({ kode: '', deskripsi: '', urutan: '1' })
  const [error, setError] = useState('')

  // Load konteks kelas+mapel dari jadwal guru
  const { data: ctxRes } = useQuery({
    queryKey: ['my-contexts'],
    queryFn: () => api.get<{ data: Context[] }>('/learning-objectives/my-contexts'),
  })
  const contexts = ctxRes?.data.data ?? []

  // Load TP sesuai konteks + semester
  const loKey = ['learning-objectives', selectedCtx?.class_id, selectedCtx?.subject_id, semester]
  const { data: loRes, isLoading } = useQuery({
    queryKey: loKey,
    queryFn: () => api.get<{ data: LearningObjective[] }>('/learning-objectives', {
      params: { class_id: selectedCtx!.class_id, subject_id: selectedCtx!.subject_id, semester },
    }),
    enabled: !!selectedCtx,
  })
  const objectives = loRes?.data.data ?? []

  const storeMutation = useMutation({
    mutationFn: () => api.post('/learning-objectives', {
      class_id: selectedCtx!.class_id,
      subject_id: selectedCtx!.subject_id,
      kode: form.kode,
      deskripsi: form.deskripsi,
      urutan: parseInt(form.urutan, 10),
      semester,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loKey })
      setShowForm(false); setForm({ kode: '', deskripsi: '', urutan: String(objectives.length + 2) })
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
      setEditId(null); setShowForm(false)
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setError(e.response?.data?.message ?? 'Gagal memperbarui.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (uuid: string) => api.delete(`/learning-objectives/${uuid}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: loKey }),
  })

  function openCreate() {
    setEditId(null)
    setForm({ kode: '', deskripsi: '', urutan: String(objectives.length + 1) })
    setError('')
    setShowForm(true)
  }

  function openEdit(lo: LearningObjective) {
    setEditId(lo.id)
    setForm({ kode: lo.kode, deskripsi: lo.deskripsi, urutan: String(lo.urutan) })
    setError('')
    setShowForm(true)
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

      {/* ── Pilih Kelas + Mapel ─────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label>Kelas & Mata Pelajaran</Label>
        {contexts.length === 0 && (
          <p className="text-sm text-muted-foreground">Belum ada jadwal mengajar terdaftar.</p>
        )}
        <div className="space-y-2">
          {contexts.map((ctx) => {
            const key   = `${ctx.class_id}-${ctx.subject_id}`
            const selKey = selectedCtx ? `${selectedCtx.class_id}-${selectedCtx.subject_id}` : ''
            const isSelected = key === selKey
            return (
              <button key={key} type="button"
                onClick={() => { setSelectedCtx(ctx); setShowForm(false) }}
                className={cn(
                  'w-full text-left rounded-lg border p-3 transition-colors',
                  isSelected ? 'border-primary-600 bg-primary-50' : 'border-border hover:border-primary-200',
                )}
              >
                <p className="text-sm font-medium">{ctx.subject_nama}</p>
                <p className="text-xs text-muted-foreground">{ctx.class_label} · {ctx.subject_kode}</p>
              </button>
            )
          })}
        </div>
      </div>

      {selectedCtx && (
        <>
          {/* ── Semester ────────────────────────────────────────────────── */}
          <div className="flex gap-2">
            {SEMESTER_OPTIONS.map((s) => (
              <button key={s.value} type="button"
                onClick={() => setSemester(s.value as 'ganjil' | 'genap')}
                className={cn(
                  'flex-1 rounded-md border py-2 text-sm font-medium transition-colors',
                  semester === s.value ? 'border-primary-600 bg-primary-50 text-primary-600' : 'border-border hover:bg-muted',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* ── List TP ─────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                TP Semester {semester.charAt(0).toUpperCase() + semester.slice(1)} ({objectives.length})
              </p>
              <Button size="sm" onClick={openCreate} disabled={showForm}>
                <Plus className="h-3.5 w-3.5" /> Tambah TP
              </Button>
            </div>

            {isLoading && <div className="h-24 rounded-lg bg-muted animate-pulse" />}

            {!isLoading && objectives.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Belum ada TP untuk semester ini.
              </p>
            )}

            {objectives.map((lo) => (
              <div key={lo.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3"
              >
                <span className="text-xs font-bold text-primary-600 mt-0.5 shrink-0 w-12">{lo.kode}</span>
                <p className="flex-1 text-sm">{lo.deskripsi}</p>
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

          {/* ── Form tambah / edit ──────────────────────────────────────── */}
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
        </>
      )}
    </div>
  )
}
