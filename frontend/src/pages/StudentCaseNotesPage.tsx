import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Lock, Edit2, Trash2, Loader2, MessageCircle } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn, toLocalDateStr } from '@/lib/utils'

interface StudentItem { id: string; nama: string; nis: string; kelas: string | null }
interface CaseNote {
  id: string; jenis: 'bk' | 'wali_kelas'; catatan: string
  tindak_lanjut: string | null; tanggal: string; konfidensial: boolean
  author: string; author_id: number; created_at: string
}

const JENIS_LABEL: Record<string, string> = { bk: 'Konseling BK', wali_kelas: 'Pembinaan Wali Kelas' }
const JENIS_COLOR: Record<string, string> = {
  bk: 'bg-blue-100 text-blue-700',
  wali_kelas: 'bg-purple-100 text-purple-700',
}

export default function StudentCaseNotesPage() {
  const user = useAuthStore((s) => s.user)
  const kap  = user?.kapabilitas
  const qc   = useQueryClient()

  const isBk       = kap?.is_bk || user?.role === 'bk'
  const isWaliKelas = kap?.is_wali_kelas || user?.role === 'wali_kelas'
  const isAdmin     = user?.role === 'admin' || user?.role === 'wakasek'

  // Siswa search
  const [studentQ, setStudentQ]       = useState('')
  const [selectedStudent, setSelected] = useState<StudentItem | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)

  // Form state
  const [showForm, setShowForm]     = useState(false)
  const [editNote, setEditNote]     = useState<CaseNote | null>(null)
  const [formJenis, setFormJenis]   = useState<'bk' | 'wali_kelas'>(isBk ? 'bk' : 'wali_kelas')
  const [formCatatan, setFormCatatan] = useState('')
  const [formTindak, setFormTindak]   = useState('')
  const [formTanggal, setFormTanggal] = useState(() => toLocalDateStr(new Date()))
  const [formKonfidensial, setFormKonfidensial] = useState(false)
  const [formErr, setFormErr]         = useState('')

  // Search students
  const { data: studentsRes } = useQuery({
    queryKey: ['case-note-students', studentQ],
    queryFn: () => api.get<{ data: any[] }>('/students', { params: { search: studentQ, per_page: 10 } }).then(r => {
      // Flatten response — endpoint returns array or paginated
      const raw = Array.isArray(r.data) ? r.data : (r.data.data ?? [])
      return raw.map((s: any) => ({
        id: s.uuid ?? s.id,
        nama: s.user?.nama ?? s.nama ?? '—',
        nis: s.nis,
        kelas: s.schoolClass ? `${s.schoolClass.tingkat} ${s.schoolClass.jurusan}` : (s.kelas?.label ?? null),
      })) as StudentItem[]
    }),
    enabled: studentQ.length >= 2,
  })
  const students = studentsRes ?? []

  // Case notes for selected student
  const { data: notesRes, isLoading: notesLoading } = useQuery({
    queryKey: ['case-notes', selectedStudent?.id],
    queryFn: () => api.get<{ data: CaseNote[] }>('/student-case-notes', { params: { student_id: selectedStudent!.id } }).then(r => r.data.data),
    enabled: !!selectedStudent,
  })
  const notes = notesRes ?? []

  const save = useMutation({
    mutationFn: (d: object) => editNote
      ? api.put(`/student-case-notes/${editNote.id}`, d)
      : api.post('/student-case-notes', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['case-notes', selectedStudent?.id] })
      resetForm()
    },
    onError: (e: any) => setFormErr(e.response?.data?.message ?? 'Terjadi kesalahan'),
  })

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/student-case-notes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['case-notes', selectedStudent?.id] }),
  })

  function openEdit(n: CaseNote) {
    setEditNote(n)
    setFormJenis(n.jenis)
    setFormCatatan(n.catatan)
    setFormTindak(n.tindak_lanjut ?? '')
    setFormTanggal(n.tanggal)
    setFormKonfidensial(n.konfidensial)
    setShowForm(true)
    setFormErr('')
  }

  function resetForm() {
    setEditNote(null)
    setShowForm(false)
    setFormCatatan('')
    setFormTindak('')
    setFormTanggal(toLocalDateStr(new Date()))
    setFormKonfidensial(false)
    setFormErr('')
  }

  function handleSubmit() {
    if (!formCatatan.trim()) { setFormErr('Catatan tidak boleh kosong.'); return }
    if (!selectedStudent)    { setFormErr('Pilih siswa terlebih dahulu.'); return }
    setFormErr('')
    save.mutate({
      student_id:    selectedStudent.id,
      jenis:         formJenis,
      catatan:       formCatatan,
      tindak_lanjut: formTindak || undefined,
      tanggal:       formTanggal,
      konfidensial:  formKonfidensial,
    })
  }

  const availableJenis = useMemo(() => {
    const opts: { value: 'bk' | 'wali_kelas'; label: string }[] = []
    if (isBk || isAdmin)       opts.push({ value: 'bk', label: 'Konseling BK' })
    if (isWaliKelas || isAdmin) opts.push({ value: 'wali_kelas', label: 'Pembinaan Wali Kelas' })
    return opts
  }, [isBk, isWaliKelas, isAdmin])

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Konseling</h1>
      </div>

      {/* GK8/GK9: Murid Konseling — kasus yang diajukan wali kelas & sedang/sudah
          ditangani BK ini (terpisah dari Catatan BK biasa di bawah, yang tidak
          terhubung ke alur eskalasi Rekomendasi & Riwayat Penanganan). */}
      {isBk && <MuridKonselingCard />}

      {/* Pilih Siswa */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Pilih Siswa</CardTitle></CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8"
              placeholder="Ketik nama atau NIS siswa (min. 2 karakter)..."
              value={studentQ}
              onChange={e => { setStudentQ(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
            />
            {showDropdown && students.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-lg">
                {students.map(s => (
                  <button key={s.id} type="button"
                    onClick={() => { setSelected(s); setStudentQ(s.nama); setShowDropdown(false) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                  >
                    <span className="font-medium">{s.nama}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{s.nis} · {s.kelas ?? '—'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedStudent && (
            <p className="mt-2 text-xs text-muted-foreground">
              Siswa terpilih: <strong>{selectedStudent.nama}</strong> ({selectedStudent.nis}) — {selectedStudent.kelas ?? '—'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Form tambah / edit */}
      {selectedStudent && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{editNote ? 'Edit Catatan' : 'Tambah Catatan'}</CardTitle>
              {!showForm
                ? <Button size="sm" onClick={() => { resetForm(); setShowForm(true) }}>
                    <Plus className="mr-1 h-4 w-4" />Tambah
                  </Button>
                : <Button size="sm" variant="ghost" onClick={resetForm}>Batal</Button>
              }
            </div>
          </CardHeader>
          {showForm && (
            <CardContent className="space-y-4">
              {availableJenis.length > 1 && (
                <div className="space-y-1.5">
                  <Label>Jenis Catatan</Label>
                  <div className="flex gap-2">
                    {availableJenis.map(o => (
                      <button key={o.value} type="button"
                        onClick={() => setFormJenis(o.value)}
                        className={cn('flex-1 rounded-md border py-2 text-sm font-medium transition-colors',
                          formJenis === o.value ? 'border-primary-600 bg-primary-50 text-primary-700' : 'hover:border-primary-200')}
                      >{o.label}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="tanggal">Tanggal</Label>
                <Input id="tanggal" type="date" value={formTanggal} max={toLocalDateStr(new Date())} onChange={e => setFormTanggal(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="catatan">Catatan <span className="text-red-500">*</span></Label>
                <textarea
                  id="catatan"
                  value={formCatatan}
                  onChange={e => setFormCatatan(e.target.value)}
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  placeholder="Tulis catatan konseling / pembinaan..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tindak">Tindak Lanjut (opsional)</Label>
                <Input id="tindak" value={formTindak} onChange={e => setFormTindak(e.target.value)} placeholder="Mis: Panggil orang tua minggu depan" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={formKonfidensial} onChange={e => setFormKonfidensial(e.target.checked)} className="rounded" />
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                Konfidensial (hanya bisa dilihat oleh saya sendiri)
              </label>
              {formErr && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{formErr}</p>}
              <Button onClick={handleSubmit} disabled={save.isPending} className="w-full">
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editNote ? 'Perbarui Catatan' : 'Simpan Catatan'}
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      {/* Daftar catatan */}
      {selectedStudent && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Riwayat Catatan — {selectedStudent.nama}
          </h2>
          {notesLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin" />}
          {!notesLoading && notes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Belum ada catatan untuk siswa ini.</p>
          )}
          {notes.map(n => (
            <Card key={n.id} className={cn(n.konfidensial ? 'border-amber-200' : '')}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', JENIS_COLOR[n.jenis])}>
                        {JENIS_LABEL[n.jenis]}
                      </span>
                      {n.konfidensial && (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <Lock className="h-3 w-3" />Konfidensial
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{n.tanggal} · {n.author}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{n.catatan}</p>
                    {n.tindak_lanjut && (
                      <p className="text-xs text-muted-foreground border-l-2 pl-2">
                        Tindak lanjut: {n.tindak_lanjut}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(n)} className="rounded p-1 hover:bg-accent">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => window.confirm('Hapus catatan ini?') && del.mutate(n.id)}
                      className="rounded p-1 hover:bg-red-100 text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Murid Konseling (GK8/GK9) ──────────────────────────────────────────────────
interface KonselingItem {
  id: string
  student: { id: string; nama: string; kelas: string | null }
  bk_status: 'diajukan' | 'diterima' | 'selesai'
  diajukan_konseling_pada: string | null
  diterima_bk_pada: string | null
  bk_selesai_pada: string | null
  is_mine: boolean
}

const BK_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  diajukan: { label: 'Menunggu Diterima', cls: 'bg-purple-100 text-purple-700' },
  diterima: { label: 'Sedang Ditangani', cls: 'bg-indigo-100 text-indigo-700' },
  selesai:  { label: 'Selesai', cls: 'bg-teal-100 text-teal-700' },
}

function MuridKonselingCard() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<{ data: KonselingItem[] }>({
    queryKey: ['bk-konseling'],
    queryFn: () => api.get('/bk/konseling').then(r => r.data),
  })

  const terima = useMutation({
    mutationFn: (id: string) => api.put(`/recommendations/${id}/bk-terima`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bk-konseling'] }),
  })

  const items = data?.data ?? []
  if (isLoading) return <div className="h-16 rounded-lg bg-muted animate-pulse" />
  if (items.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Murid Konseling
          {items.filter(i => i.bk_status === 'diajukan').length > 0 && (
            <Badge className="bg-purple-100 text-purple-700">{items.filter(i => i.bk_status === 'diajukan').length} baru diajukan</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {items.map(item => {
          const cfg = BK_STATUS_LABEL[item.bk_status]
          return (
            <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border p-3">
              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/ews/${item.student.id}`)}>
                <p className="text-sm font-medium">{item.student.nama}</p>
                <p className="text-xs text-muted-foreground">{item.student.kelas}</p>
              </div>
              <Badge className={cn('text-xs shrink-0', cfg?.cls)}>{cfg?.label ?? item.bk_status}</Badge>
              {item.bk_status === 'diajukan' && (
                <Button size="sm" onClick={() => terima.mutate(item.id)} disabled={terima.isPending}>
                  Terima
                </Button>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
