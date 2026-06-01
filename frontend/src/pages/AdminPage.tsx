import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Loader2, X, Check, AlertCircle } from 'lucide-react'
import { adminApi } from '@/features/admin/api'
import type {
  AdminTeacher, AdminStudent, AdminClass, AdminSubject,
  AdminSchedule, AdminCharacterCategory, AdminCharacterSubitem, AdminThreshold,
} from '@/features/admin/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ── Tab labels ────────────────────────────────────────────────────────────────
const TABS = ['Guru', 'Siswa', 'Kelas', 'Mapel', 'Jadwal', 'Karakter', 'Ambang']

// ── Simple modal ──────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

// ── Form field ────────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
const inputCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const selectCls = inputCls

// ── Error toast ───────────────────────────────────────────────────────────────
function ErrMsg({ msg }: { msg: string }) {
  return <p className="mt-1 flex items-center gap-1 text-xs text-red-500"><AlertCircle className="h-3 w-3" />{msg}</p>
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: GURU
// ─────────────────────────────────────────────────────────────────────────────
function GuruTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [selected, setSelected] = useState<AdminTeacher | null>(null)
  const [form, setForm] = useState({ nama: '', email: '', nip: '', mapel_utama: '', role: 'guru', nomor_hp: '', password: '' })
  const [err, setErr] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['admin-teachers'], queryFn: () => adminApi.getTeachers() })

  const save = useMutation({
    mutationFn: (d: object) => selected ? adminApi.updateTeacher(selected.id, d) : adminApi.createTeacher(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-teachers'] }); setModal(null); setErr('') },
    onError: (e: any) => setErr(e.response?.data?.message || 'Terjadi kesalahan'),
  })

  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteTeacher(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-teachers'] }),
    onError: (e: any) => alert(e.response?.data?.message || 'Gagal menghapus'),
  })

  function openAdd() {
    setSelected(null); setErr('')
    setForm({ nama: '', email: '', nip: '', mapel_utama: '', role: 'guru', nomor_hp: '', password: '' })
    setModal('add')
  }
  function openEdit(t: AdminTeacher) {
    setSelected(t); setErr('')
    setForm({ nama: t.nama, email: t.email, nip: t.nip, mapel_utama: t.mapel_utama, role: t.role, nomor_hp: t.nomor_hp || '', password: '' })
    setModal('edit')
  }
  function handleSubmit() {
    const payload: any = { ...form }
    if (!payload.password) delete payload.password
    if (!payload.nomor_hp) delete payload.nomor_hp
    save.mutate(payload)
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Total: {data?.meta?.total ?? 0} guru</p>
        <Button size="sm" onClick={openAdd}><Plus className="mr-1 h-4 w-4" />Tambah Guru</Button>
      </div>

      {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                {['Nama', 'NIP', 'Mapel', 'Peran', 'Status', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.data?.map(t => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{t.nama}</td>
                  <td className="px-3 py-2 text-muted-foreground">{t.nip}</td>
                  <td className="px-3 py-2">{t.mapel_utama}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className="capitalize">{t.role.replace(/_/g, ' ')}</Badge></td>
                  <td className="px-3 py-2">
                    <Badge className={t.status === 'aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{t.status}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(t)} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => window.confirm('Nonaktifkan guru ini?') && del.mutate(t.id)} className="rounded p-1 hover:bg-red-100 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal === 'add' ? 'Tambah Guru' : 'Edit Guru'} onClose={() => setModal(null)}>
          <Field label="Nama Lengkap"><input className={inputCls} value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} /></Field>
          <Field label="Email"><input className={inputCls} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
          <Field label="NIP"><input className={inputCls} value={form.nip} onChange={e => setForm(f => ({ ...f, nip: e.target.value }))} /></Field>
          <Field label="Mapel Utama"><input className={inputCls} value={form.mapel_utama} onChange={e => setForm(f => ({ ...f, mapel_utama: e.target.value }))} /></Field>
          <Field label="Peran">
            <select className={selectCls} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {['guru', 'wali_kelas', 'wakasek', 'bk'].map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
          <Field label="No. HP (opsional)"><input className={inputCls} value={form.nomor_hp} onChange={e => setForm(f => ({ ...f, nomor_hp: e.target.value }))} /></Field>
          <Field label={modal === 'add' ? 'Password (default: password)' : 'Password baru (kosongkan jika tidak diubah)'}>
            <input className={inputCls} type="password" placeholder={modal === 'add' ? 'password' : ''} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </Field>
          {err && <ErrMsg msg={err} />}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Batal</Button>
            <Button size="sm" onClick={handleSubmit} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Simpan
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: SISWA
// ─────────────────────────────────────────────────────────────────────────────
function SiswaTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [selected, setSelected] = useState<AdminStudent | null>(null)
  const [form, setForm] = useState({ nama: '', email: '', nis: '', nisn: '', class_id: '', angkatan: '', wali_nama: '', wali_kontak: '', password: '' })
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')
  const [filterKelas, setFilterKelas] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['admin-students', search, filterKelas], queryFn: () => adminApi.getStudents({ search: search || undefined, class_id: filterKelas || undefined }) })
  const { data: classes } = useQuery({ queryKey: ['admin-classes'], queryFn: adminApi.getClasses })

  const save = useMutation({
    mutationFn: (d: object) => selected ? adminApi.updateStudent(selected.id, d) : adminApi.createStudent(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-students'] }); setModal(null); setErr('') },
    onError: (e: any) => setErr(e.response?.data?.message || 'Terjadi kesalahan'),
  })
  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteStudent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-students'] }),
    onError: (e: any) => alert(e.response?.data?.message),
  })

  function openAdd() {
    setSelected(null); setErr('')
    setForm({ nama: '', email: '', nis: '', nisn: '', class_id: '', angkatan: '', wali_nama: '', wali_kontak: '', password: '' })
    setModal('add')
  }
  function openEdit(s: AdminStudent) {
    setSelected(s); setErr('')
    setForm({ nama: s.nama, email: s.email, nis: s.nis, nisn: s.nisn || '', class_id: s.kelas?.id || '', angkatan: String(s.angkatan || ''), wali_nama: s.wali_nama || '', wali_kontak: s.wali_kontak || '', password: '' })
    setModal('edit')
  }
  function handleSubmit() {
    const payload: any = { ...form, angkatan: form.angkatan ? Number(form.angkatan) : undefined }
    if (!payload.password) delete payload.password
    if (!payload.email) delete payload.email
    if (!payload.nisn) delete payload.nisn
    if (!payload.wali_nama) delete payload.wali_nama
    if (!payload.wali_kontak) delete payload.wali_kontak
    if (!payload.angkatan) delete payload.angkatan
    save.mutate(payload)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className={inputCls + ' max-w-xs'} placeholder="Cari nama / NIS..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className={selectCls + ' max-w-[200px]'} value={filterKelas} onChange={e => setFilterKelas(e.target.value)}>
          <option value="">Semua Kelas</option>
          {classes?.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <Button size="sm" onClick={openAdd} className="ml-auto"><Plus className="mr-1 h-4 w-4" />Tambah Siswa</Button>
      </div>

      {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>{['Nama', 'NIS', 'Kelas', 'Angkatan', 'Status', ''].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data?.data?.map(s => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{s.nama}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.nis}</td>
                  <td className="px-3 py-2">{s.kelas?.label ?? '-'}</td>
                  <td className="px-3 py-2">{s.angkatan ?? '-'}</td>
                  <td className="px-3 py-2"><Badge className={s.status === 'aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{s.status}</Badge></td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(s)} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => window.confirm('Nonaktifkan siswa ini?') && del.mutate(s.id)} className="rounded p-1 hover:bg-red-100 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal === 'add' ? 'Tambah Siswa' : 'Edit Siswa'} onClose={() => setModal(null)}>
          <Field label="Nama"><input className={inputCls} value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} /></Field>
          <Field label="NIS"><input className={inputCls} value={form.nis} onChange={e => setForm(f => ({ ...f, nis: e.target.value }))} /></Field>
          <Field label="NISN (opsional)"><input className={inputCls} value={form.nisn} onChange={e => setForm(f => ({ ...f, nisn: e.target.value }))} /></Field>
          <Field label="Kelas">
            <select className={selectCls} value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}>
              <option value="">-- Pilih Kelas --</option>
              {classes?.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Angkatan"><input className={inputCls} type="number" placeholder="2024" value={form.angkatan} onChange={e => setForm(f => ({ ...f, angkatan: e.target.value }))} /></Field>
          <Field label="Nama Wali"><input className={inputCls} value={form.wali_nama} onChange={e => setForm(f => ({ ...f, wali_nama: e.target.value }))} /></Field>
          <Field label="Kontak Wali"><input className={inputCls} value={form.wali_kontak} onChange={e => setForm(f => ({ ...f, wali_kontak: e.target.value }))} /></Field>
          <Field label={modal === 'add' ? 'Password (default: password)' : 'Password baru'}>
            <input className={inputCls} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </Field>
          {err && <ErrMsg msg={err} />}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Batal</Button>
            <Button size="sm" onClick={handleSubmit} disabled={save.isPending}>{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Simpan</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: KELAS
// ─────────────────────────────────────────────────────────────────────────────
function KelasTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [selected, setSelected] = useState<AdminClass | null>(null)
  const [form, setForm] = useState({ tingkat: 'XI', jurusan: '', rombel: '', wali_kelas_id: '' })
  const [err, setErr] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['admin-classes'], queryFn: adminApi.getClasses })
  const { data: teachers } = useQuery({ queryKey: ['admin-teachers'], queryFn: () => adminApi.getTeachers() })

  const save = useMutation({
    mutationFn: (d: object) => selected ? adminApi.updateClass(selected.id, d) : adminApi.createClass(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-classes'] }); setModal(null); setErr('') },
    onError: (e: any) => setErr(e.response?.data?.message || 'Gagal'),
  })
  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteClass(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-classes'] }),
    onError: (e: any) => alert(e.response?.data?.message),
  })

  function openAdd() {
    setSelected(null); setErr(''); setForm({ tingkat: 'XI', jurusan: '', rombel: '', wali_kelas_id: '' }); setModal('add')
  }
  function openEdit(c: AdminClass) {
    setSelected(c); setErr('')
    setForm({ tingkat: c.tingkat, jurusan: c.jurusan, rombel: c.rombel, wali_kelas_id: c.wali_kelas?.id || '' })
    setModal('edit')
  }

  return (
    <div>
      <div className="mb-4 flex justify-between">
        <p className="text-sm text-muted-foreground">{data?.length ?? 0} kelas</p>
        <Button size="sm" onClick={openAdd}><Plus className="mr-1 h-4 w-4" />Tambah Kelas</Button>
      </div>
      {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>{['Kelas', 'Wali Kelas', 'Siswa', 'Tahun Ajaran', ''].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data?.map(c => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{c.label}</td>
                  <td className="px-3 py-2">{c.wali_kelas?.nama ?? '-'}</td>
                  <td className="px-3 py-2">{c.jumlah_siswa} siswa</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.tahun_ajaran}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(c)} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => window.confirm('Hapus kelas ini?') && del.mutate(c.id)} className="rounded p-1 hover:bg-red-100 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <Modal title={modal === 'add' ? 'Tambah Kelas' : 'Edit Kelas'} onClose={() => setModal(null)}>
          <Field label="Tingkat">
            <select className={selectCls} value={form.tingkat} onChange={e => setForm(f => ({ ...f, tingkat: e.target.value }))}>
              {['X', 'XI', 'XII'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Jurusan"><input className={inputCls} placeholder="Rekayasa Perangkat Lunak" value={form.jurusan} onChange={e => setForm(f => ({ ...f, jurusan: e.target.value }))} /></Field>
          <Field label="Rombel"><input className={inputCls} placeholder="A" value={form.rombel} onChange={e => setForm(f => ({ ...f, rombel: e.target.value }))} /></Field>
          <Field label="Wali Kelas">
            <select className={selectCls} value={form.wali_kelas_id} onChange={e => setForm(f => ({ ...f, wali_kelas_id: e.target.value }))}>
              <option value="">-- Tidak Ada --</option>
              {teachers?.data?.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)}
            </select>
          </Field>
          {err && <ErrMsg msg={err} />}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Batal</Button>
            <Button size="sm" onClick={() => save.mutate({ ...form, wali_kelas_id: form.wali_kelas_id || undefined })} disabled={save.isPending}>{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Simpan</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: MAPEL
// ─────────────────────────────────────────────────────────────────────────────
function MapelTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [selected, setSelected] = useState<AdminSubject | null>(null)
  const [form, setForm] = useState({ kode: '', nama: '', kelompok: 'produktif' })
  const [err, setErr] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['admin-subjects'], queryFn: adminApi.getSubjects })

  const save = useMutation({
    mutationFn: (d: object) => selected ? adminApi.updateSubject(selected.id, d) : adminApi.createSubject(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-subjects'] }); setModal(null); setErr('') },
    onError: (e: any) => setErr(e.response?.data?.message || 'Gagal'),
  })
  const del = useMutation({
    mutationFn: adminApi.deleteSubject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-subjects'] }),
    onError: (e: any) => alert(e.response?.data?.message),
  })

  const kelompokColor: Record<string, string> = {
    normatif: 'bg-blue-100 text-blue-700',
    adaptif: 'bg-purple-100 text-purple-700',
    produktif: 'bg-green-100 text-green-700',
    muatan_lokal: 'bg-yellow-100 text-yellow-700',
  }

  return (
    <div>
      <div className="mb-4 flex justify-between">
        <p className="text-sm text-muted-foreground">{data?.length ?? 0} mata pelajaran</p>
        <Button size="sm" onClick={() => { setSelected(null); setErr(''); setForm({ kode: '', nama: '', kelompok: 'produktif' }); setModal('add') }}><Plus className="mr-1 h-4 w-4" />Tambah Mapel</Button>
      </div>
      {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>{['Kode', 'Nama', 'Kelompok', 'Status', ''].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data?.map(s => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">{s.kode}</td>
                  <td className="px-3 py-2 font-medium">{s.nama}</td>
                  <td className="px-3 py-2"><Badge className={kelompokColor[s.kelompok] || ''}>{s.kelompok.replace(/_/g, ' ')}</Badge></td>
                  <td className="px-3 py-2"><Badge className={s.aktif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{s.aktif ? 'aktif' : 'nonaktif'}</Badge></td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => { setSelected(s); setErr(''); setForm({ kode: s.kode, nama: s.nama, kelompok: s.kelompok }); setModal('edit') }} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => window.confirm('Hapus mapel ini?') && del.mutate(s.id)} className="rounded p-1 hover:bg-red-100 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <Modal title={modal === 'add' ? 'Tambah Mata Pelajaran' : 'Edit Mata Pelajaran'} onClose={() => setModal(null)}>
          <Field label="Kode"><input className={inputCls} placeholder="RPL-001" value={form.kode} onChange={e => setForm(f => ({ ...f, kode: e.target.value }))} /></Field>
          <Field label="Nama Mata Pelajaran"><input className={inputCls} value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} /></Field>
          <Field label="Kelompok">
            <select className={selectCls} value={form.kelompok} onChange={e => setForm(f => ({ ...f, kelompok: e.target.value }))}>
              {['normatif', 'adaptif', 'produktif', 'muatan_lokal'].map(k => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
          {err && <ErrMsg msg={err} />}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Batal</Button>
            <Button size="sm" onClick={() => save.mutate(form)} disabled={save.isPending}>{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Simpan</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: JADWAL
// ─────────────────────────────────────────────────────────────────────────────
function JadwalTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [selected, setSelected] = useState<AdminSchedule | null>(null)
  const [form, setForm] = useState({ class_id: '', subject_id: '', teacher_id: '', hari: 'senin', jam_mulai: '08:00', jam_selesai: '09:30' })
  const [filterKelas, setFilterKelas] = useState('')
  const [err, setErr] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['admin-schedules', filterKelas], queryFn: () => adminApi.getSchedules({ class_id: filterKelas || undefined }) })
  const { data: classes } = useQuery({ queryKey: ['admin-classes'], queryFn: adminApi.getClasses })
  const { data: subjects } = useQuery({ queryKey: ['admin-subjects'], queryFn: adminApi.getSubjects })
  const { data: teachers } = useQuery({ queryKey: ['admin-teachers'], queryFn: () => adminApi.getTeachers() })

  const save = useMutation({
    mutationFn: (d: object) => selected ? adminApi.updateSchedule(selected.id, d) : adminApi.createSchedule(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-schedules'] }); setModal(null); setErr('') },
    onError: (e: any) => setErr(e.response?.data?.message || 'Gagal'),
  })
  const del = useMutation({
    mutationFn: adminApi.deleteSchedule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-schedules'] }),
    onError: (e: any) => alert(e.response?.data?.message),
  })

  const hariOrder = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu']

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className={selectCls + ' max-w-[200px]'} value={filterKelas} onChange={e => setFilterKelas(e.target.value)}>
          <option value="">Semua Kelas</option>
          {classes?.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <Button size="sm" onClick={() => { setSelected(null); setErr(''); setForm({ class_id: '', subject_id: '', teacher_id: '', hari: 'senin', jam_mulai: '08:00', jam_selesai: '09:30' }); setModal('add') }} className="ml-auto"><Plus className="mr-1 h-4 w-4" />Tambah Jadwal</Button>
      </div>
      {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>{['Hari', 'Jam', 'Kelas', 'Mapel', 'Guru', ''].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>)}</tr>
            </thead>
            <tbody>
              {[...(data || [])].sort((a, b) => hariOrder.indexOf(a.hari) - hariOrder.indexOf(b.hari) || a.jam_mulai.localeCompare(b.jam_mulai)).map(s => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 capitalize font-medium">{s.hari}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.jam_mulai}–{s.jam_selesai}</td>
                  <td className="px-3 py-2">{s.kelas.label}</td>
                  <td className="px-3 py-2">{s.mapel.nama}</td>
                  <td className="px-3 py-2">{s.guru.nama}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => { setSelected(s); setErr(''); setForm({ class_id: s.kelas.id, subject_id: s.mapel.id, teacher_id: s.guru.id, hari: s.hari, jam_mulai: s.jam_mulai, jam_selesai: s.jam_selesai }); setModal('edit') }} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => window.confirm('Hapus jadwal ini?') && del.mutate(s.id)} className="rounded p-1 hover:bg-red-100 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <Modal title={modal === 'add' ? 'Tambah Jadwal' : 'Edit Jadwal'} onClose={() => setModal(null)}>
          {modal === 'add' && (
            <>
              <Field label="Kelas">
                <select className={selectCls} value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}>
                  <option value="">-- Pilih Kelas --</option>
                  {classes?.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Mata Pelajaran">
                <select className={selectCls} value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}>
                  <option value="">-- Pilih Mapel --</option>
                  {subjects?.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
                </select>
              </Field>
            </>
          )}
          <Field label="Guru">
            <select className={selectCls} value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}>
              <option value="">-- Pilih Guru --</option>
              {teachers?.data?.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)}
            </select>
          </Field>
          <Field label="Hari">
            <select className={selectCls} value={form.hari} onChange={e => setForm(f => ({ ...f, hari: e.target.value }))}>
              {hariOrder.map(h => <option key={h} value={h} className="capitalize">{h}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jam Mulai"><input className={inputCls} type="time" value={form.jam_mulai} onChange={e => setForm(f => ({ ...f, jam_mulai: e.target.value }))} /></Field>
            <Field label="Jam Selesai"><input className={inputCls} type="time" value={form.jam_selesai} onChange={e => setForm(f => ({ ...f, jam_selesai: e.target.value }))} /></Field>
          </div>
          {err && <ErrMsg msg={err} />}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Batal</Button>
            <Button size="sm" onClick={() => save.mutate(form)} disabled={save.isPending}>{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Simpan</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: KARAKTER (Kategori + Sub-item)
// ─────────────────────────────────────────────────────────────────────────────
function KarakterAdminTab() {
  const qc = useQueryClient()
  const [catModal, setCatModal] = useState<'add' | 'edit' | null>(null)
  const [subModal, setSubModal] = useState<'add' | 'edit' | null>(null)
  const [selCat, setSelCat] = useState<AdminCharacterCategory | null>(null)
  const [selSub, setSelSub] = useState<AdminCharacterSubitem | null>(null)
  const [catForm, setCatForm] = useState({ nama: '', deskripsi: '' })
  const [subForm, setSubForm] = useState({ category_id: '', kode: '', deskripsi: '', bobot: '5', sifat: 'positif' })
  const [err, setErr] = useState('')

  const { data: cats } = useQuery({ queryKey: ['admin-char-cats'], queryFn: adminApi.getCharacterCategories })
  const { data: subs } = useQuery({ queryKey: ['admin-char-subs'], queryFn: () => adminApi.getCharacterSubitems() })

  const saveCat = useMutation({
    mutationFn: (d: object) => selCat ? adminApi.updateCharacterCategory(selCat.id, d) : adminApi.createCharacterCategory(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-char-cats'] }); setCatModal(null); setErr('') },
    onError: (e: any) => setErr(e.response?.data?.message || 'Gagal'),
  })
  const delCat = useMutation({
    mutationFn: adminApi.deleteCharacterCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-char-cats'] }),
    onError: (e: any) => alert(e.response?.data?.message),
  })
  const saveSub = useMutation({
    mutationFn: (d: object) => selSub ? adminApi.updateCharacterSubitem(selSub.id, d) : adminApi.createCharacterSubitem(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-char-subs'] }); setSubModal(null); setErr('') },
    onError: (e: any) => setErr(e.response?.data?.message || 'Gagal'),
  })
  const delSub = useMutation({
    mutationFn: adminApi.deleteCharacterSubitem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-char-subs'] }),
    onError: (e: any) => alert(e.response?.data?.message),
  })

  return (
    <div className="space-y-6">
      {/* Kategori */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Induk Karakter</h3>
          <Button size="sm" onClick={() => { setSelCat(null); setErr(''); setCatForm({ nama: '', deskripsi: '' }); setCatModal('add') }}><Plus className="mr-1 h-4 w-4" />Tambah</Button>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>{['Nama', 'Sub-item', 'Status', ''].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>)}</tr>
            </thead>
            <tbody>
              {cats?.map(c => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{c.nama}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.jumlah_subitem} item</td>
                  <td className="px-3 py-2"><Badge className={c.aktif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{c.aktif ? 'aktif' : 'nonaktif'}</Badge></td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => { setSelCat(c); setErr(''); setCatForm({ nama: c.nama, deskripsi: c.deskripsi || '' }); setCatModal('edit') }} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => window.confirm('Hapus kategori ini?') && delCat.mutate(c.id)} className="rounded p-1 hover:bg-red-100 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sub-item */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Sub-Karakter</h3>
          <Button size="sm" onClick={() => { setSelSub(null); setErr(''); setSubForm({ category_id: cats?.[0]?.id || '', kode: '', deskripsi: '', bobot: '5', sifat: 'positif' }); setSubModal('add') }}><Plus className="mr-1 h-4 w-4" />Tambah</Button>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>{['Kode', 'Deskripsi', 'Bobot', 'Sifat', 'Kategori', ''].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>)}</tr>
            </thead>
            <tbody>
              {subs?.map(s => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">{s.kode}</td>
                  <td className="px-3 py-2">{s.deskripsi}</td>
                  <td className="px-3 py-2 font-semibold">{s.bobot}</td>
                  <td className="px-3 py-2"><Badge className={s.sifat === 'positif' ? 'bg-green-100 text-green-700' : s.sifat === 'negatif' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}>{s.sifat}</Badge></td>
                  <td className="px-3 py-2 text-muted-foreground">{s.kategori?.nama}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => { setSelSub(s); setErr(''); setSubForm({ category_id: s.kategori?.id || '', kode: s.kode, deskripsi: s.deskripsi, bobot: String(s.bobot), sifat: s.sifat }); setSubModal('edit') }} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => window.confirm('Hapus sub-karakter ini?') && delSub.mutate(s.id)} className="rounded p-1 hover:bg-red-100 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {catModal && (
        <Modal title={catModal === 'add' ? 'Tambah Induk Karakter' : 'Edit Induk Karakter'} onClose={() => setCatModal(null)}>
          <Field label="Nama"><input className={inputCls} value={catForm.nama} onChange={e => setCatForm(f => ({ ...f, nama: e.target.value }))} /></Field>
          <Field label="Deskripsi"><textarea className={inputCls} rows={2} value={catForm.deskripsi} onChange={e => setCatForm(f => ({ ...f, deskripsi: e.target.value }))} /></Field>
          {err && <ErrMsg msg={err} />}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCatModal(null)}>Batal</Button>
            <Button size="sm" onClick={() => saveCat.mutate(catForm)} disabled={saveCat.isPending}>{saveCat.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Simpan</Button>
          </div>
        </Modal>
      )}

      {subModal && (
        <Modal title={subModal === 'add' ? 'Tambah Sub-Karakter' : 'Edit Sub-Karakter'} onClose={() => setSubModal(null)}>
          <Field label="Kategori">
            <select className={selectCls} value={subForm.category_id} onChange={e => setSubForm(f => ({ ...f, category_id: e.target.value }))}>
              {cats?.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
            </select>
          </Field>
          <Field label="Kode"><input className={inputCls} placeholder="KD-07" value={subForm.kode} onChange={e => setSubForm(f => ({ ...f, kode: e.target.value }))} /></Field>
          <Field label="Deskripsi"><input className={inputCls} value={subForm.deskripsi} onChange={e => setSubForm(f => ({ ...f, deskripsi: e.target.value }))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bobot (1-100)"><input className={inputCls} type="number" min={1} max={100} value={subForm.bobot} onChange={e => setSubForm(f => ({ ...f, bobot: e.target.value }))} /></Field>
            <Field label="Sifat">
              <select className={selectCls} value={subForm.sifat} onChange={e => setSubForm(f => ({ ...f, sifat: e.target.value }))}>
                <option value="positif">Positif</option>
                <option value="negatif">Negatif</option>
                <option value="keduanya">Keduanya</option>
              </select>
            </Field>
          </div>
          {err && <ErrMsg msg={err} />}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setSubModal(null)}>Batal</Button>
            <Button size="sm" onClick={() => saveSub.mutate({ ...subForm, bobot: Number(subForm.bobot) })} disabled={saveSub.isPending}>{saveSub.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Simpan</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: AMBANG TINDAKAN
// ─────────────────────────────────────────────────────────────────────────────
function AmbangTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [selected, setSelected] = useState<AdminThreshold | null>(null)
  const [form, setForm] = useState({ min_point: '', max_point: '', sifat: 'negatif', rekomendasi: '' })
  const [err, setErr] = useState('')

  const { data } = useQuery({ queryKey: ['admin-thresholds'], queryFn: adminApi.getThresholds })

  const save = useMutation({
    mutationFn: (d: object) => selected ? adminApi.updateThreshold(selected.id, d) : adminApi.createThreshold(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-thresholds'] }); setModal(null); setErr('') },
    onError: (e: any) => setErr(e.response?.data?.message || 'Gagal'),
  })
  const del = useMutation({
    mutationFn: adminApi.deleteThreshold,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-thresholds'] }),
    onError: (e: any) => alert(e.response?.data?.message),
  })

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Ambang poin yang memicu rekomendasi tindakan otomatis</p>
        <Button size="sm" onClick={() => { setSelected(null); setErr(''); setForm({ min_point: '', max_point: '', sifat: 'negatif', rekomendasi: '' }); setModal('add') }}><Plus className="mr-1 h-4 w-4" />Tambah</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>{['Rentang Poin', 'Sifat', 'Rekomendasi', 'Status', ''].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>)}</tr>
          </thead>
          <tbody>
            {data?.map(t => (
              <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-xs">{t.min_point} s.d. {t.max_point ?? '∞'}</td>
                <td className="px-3 py-2"><Badge className={t.sifat === 'positif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{t.sifat}</Badge></td>
                <td className="px-3 py-2 max-w-xs truncate">{t.rekomendasi}</td>
                <td className="px-3 py-2"><Badge className={t.aktif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>{t.aktif ? 'aktif' : 'nonaktif'}</Badge></td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => { setSelected(t); setErr(''); setForm({ min_point: String(t.min_point), max_point: t.max_point != null ? String(t.max_point) : '', sifat: t.sifat, rekomendasi: t.rekomendasi }); setModal('edit') }} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => window.confirm('Hapus ambang ini?') && del.mutate(t.id)} className="rounded p-1 hover:bg-red-100 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={modal === 'add' ? 'Tambah Ambang Tindakan' : 'Edit Ambang Tindakan'} onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min Poin"><input className={inputCls} type="number" value={form.min_point} onChange={e => setForm(f => ({ ...f, min_point: e.target.value }))} /></Field>
            <Field label="Max Poin (kosong = tidak terbatas)"><input className={inputCls} type="number" value={form.max_point} onChange={e => setForm(f => ({ ...f, max_point: e.target.value }))} /></Field>
          </div>
          <Field label="Sifat">
            <select className={selectCls} value={form.sifat} onChange={e => setForm(f => ({ ...f, sifat: e.target.value }))}>
              <option value="negatif">Negatif (pelanggaran)</option>
              <option value="positif">Positif (apresiasi)</option>
            </select>
          </Field>
          <Field label="Rekomendasi Tindakan">
            <textarea className={inputCls} rows={3} value={form.rekomendasi} onChange={e => setForm(f => ({ ...f, rekomendasi: e.target.value }))} />
          </Field>
          {err && <ErrMsg msg={err} />}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Batal</Button>
            <Button size="sm" onClick={() => save.mutate({ ...form, min_point: Number(form.min_point), max_point: form.max_point ? Number(form.max_point) : undefined })} disabled={save.isPending}>{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Simpan</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Panel Admin</h1>
      <p className="mb-4 text-sm text-muted-foreground">Kelola data master aplikasi</p>

      {/* Tabs */}
      <div className="mb-6 flex overflow-x-auto gap-1 border-b">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === i
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 0 && <GuruTab />}
        {activeTab === 1 && <SiswaTab />}
        {activeTab === 2 && <KelasTab />}
        {activeTab === 3 && <MapelTab />}
        {activeTab === 4 && <JadwalTab />}
        {activeTab === 5 && <KarakterAdminTab />}
        {activeTab === 6 && <AmbangTab />}
      </div>
    </div>
  )
}
