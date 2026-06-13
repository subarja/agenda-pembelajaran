import { useRef, useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Loader2, X, Check, AlertCircle, Upload, Download, FileCode2, CheckCircle2, Users, Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import api from '@/lib/api'
import { adminApi } from '@/features/admin/api'
import type {
  AdminTeacher, AdminStudent, AdminClass, AdminSubject,
  AdminSchedule, AdminCharacterCategory, AdminCharacterSubitem, AdminThreshold,
  AdminUser, AdminAcademicYear, ImportResult,
} from '@/features/admin/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ── Tab labels ────────────────────────────────────────────────────────────────
const TABS = ['Guru', 'Siswa', 'Kelas', 'Mapel', 'Jadwal', 'Karakter', 'Ambang', 'Pengguna', 'Tahun Ajaran', 'Import Data']

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

// ── Search bar ────────────────────────────────────────────────────────────────
function SearchBar({ value, onChange, placeholder = 'Cari...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <input
        className={`${inputCls} pl-8 w-56`}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

// ── Sortable column header ────────────────────────────────────────────────────
type SortDir = 'asc' | 'desc'
function SortTh({ label, col, sortCol, sortDir, onSort }: {
  label: string; col: string; sortCol: string | null; sortDir: SortDir; onSort: (col: string) => void
}) {
  const active = sortCol === col
  return (
    <th onClick={() => onSort(col)} className="cursor-pointer select-none px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground">
      <span className="inline-flex items-center gap-0.5">
        {label}
        {active
          ? sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
          : <ChevronsUpDown className="h-3 w-3 opacity-30" />}
      </span>
    </th>
  )
}

// Non-sortable plain header cell
function Th({ label }: { label: string }) {
  return <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{label}</th>
}

// Generic client-side sort
function applySort<T>(items: T[], col: string | null, dir: SortDir, getVal: (item: T, col: string) => string | number): T[] {
  if (!col) return items
  return [...items].sort((a, b) => {
    const av = getVal(a, col); const bv = getVal(b, col)
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv), 'id', { sensitivity: 'base' })
    return dir === 'asc' ? cmp : -cmp
  })
}

// ── Import Modal ──────────────────────────────────────────────────────────────
function ImportModal({
  entity, label, onClose, onSuccess,
}: {
  entity: string; label: string; onClose: () => void; onSuccess?: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [dlLoading, setDlLoading] = useState(false)

  async function handleDownload() {
    setDlLoading(true)
    try { await adminApi.downloadTemplate(entity) } finally { setDlLoading(false) }
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)
    try {
      const res = await adminApi.importData(entity, file)
      setResult(res)
      if (res.success_count > 0) onSuccess?.()
    } catch (e: any) {
      setResult({ success_count: 0, error_count: 1, errors: [e.response?.data?.message || 'Import gagal'] })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={`Import ${label}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="mb-2 text-sm text-blue-700">Unduh template, isi data sesuai format, lalu upload kembali.</p>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={dlLoading}>
            {dlLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
            Download Template Excel
          </Button>
        </div>

        <Field label="File Excel (.xlsx)">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className={inputCls}
            onChange={e => { setFile(e.target.files?.[0] || null); setResult(null) }}
          />
        </Field>

        {result && (
          <div className={`rounded-lg p-3 text-sm ${result.error_count === 0 ? 'border border-green-200 bg-green-50' : 'border border-yellow-200 bg-yellow-50'}`}>
            <p className="font-medium">
              {result.success_count} baris berhasil diimpor
              {result.error_count > 0 && `, ${result.error_count} baris gagal`}.
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs text-red-600">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Tutup</Button>
          <Button size="sm" onClick={handleImport} disabled={!file || loading}>
            {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
            Import
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Pagination controls ───────────────────────────────────────────────────────
type PaginationMeta = { total: number; current_page: number; last_page: number; per_page?: number }

function Pagination({ meta, page, onPage }: { meta: PaginationMeta; page: number; onPage: (p: number) => void }) {
  const [inputVal, setInputVal] = useState(String(page))

  useEffect(() => { setInputVal(String(page)) }, [page])

  function commit() {
    const p = parseInt(inputVal, 10)
    if (!isNaN(p) && p >= 1 && p <= meta.last_page) onPage(p)
    else setInputVal(String(page))
  }

  if (!meta || meta.last_page <= 1) return null
  const perPage = meta.per_page ?? 20
  const from = (page - 1) * perPage + 1
  const to   = Math.min(page * perPage, meta.total)

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{from}–{to} dari {meta.total} data</span>
      <div className="flex items-center gap-1">
        <button
          className="rounded border px-2 py-1 disabled:opacity-40 hover:bg-muted"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >← Sblm</button>
        <span className="px-1">Hal</span>
        <input
          type="number"
          min={1}
          max={meta.last_page}
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit() }}
          onBlur={commit}
          className="w-12 rounded border px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <span className="px-1">/ {meta.last_page}</span>
        <button
          className="rounded border px-2 py-1 disabled:opacity-40 hover:bg-muted"
          disabled={page >= meta.last_page}
          onClick={() => onPage(page + 1)}
        >Selanj →</button>
      </div>
    </div>
  )
}

// ── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: GURU
// ─────────────────────────────────────────────────────────────────────────────
function GuruTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [selected, setSelected] = useState<AdminTeacher | null>(null)
  const [form, setForm] = useState({ nama: '', email: '', nip: '', mapel_utama: '', role: 'guru', nomor_hp: '', password: '', gelar_depan: '', gelar_belakang: '' })
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const debouncedQ = useDebounce(q, 350)
  useEffect(() => { setPage(1) }, [debouncedQ])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-teachers', debouncedQ, page],
    queryFn: () => adminApi.getTeachers({ search: debouncedQ || undefined, page }),
  })

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const rows = useMemo(() => applySort(data?.data ?? [], sortCol, sortDir, (t, col) => {
    if (col === 'nama') return t.nama
    if (col === 'nip') return t.nip ?? ''
    if (col === 'mapel_utama') return t.mapel_utama ?? ''
    if (col === 'role') return t.role
    if (col === 'status') return t.status
    return ''
  }), [data?.data, sortCol, sortDir])

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
    setForm({ nama: '', email: '', nip: '', mapel_utama: '', role: 'guru', nomor_hp: '', password: '', gelar_depan: '', gelar_belakang: '' })
    setModal('add')
  }
  function openEdit(t: AdminTeacher) {
    setSelected(t); setErr('')
    setForm({ nama: t.nama, email: t.email, nip: t.nip, mapel_utama: t.mapel_utama, role: t.role, nomor_hp: t.nomor_hp || '', password: '', gelar_depan: t.gelar_depan || '', gelar_belakang: t.gelar_belakang || '' })
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
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBar value={q} onChange={setQ} placeholder="Cari nama / NIP / mapel..." />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" />Import Excel
          </Button>
          <Button size="sm" onClick={openAdd}><Plus className="mr-1 h-4 w-4" />Tambah Guru</Button>
        </div>
      </div>

      {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <Th label="#" />
                <SortTh label="Nama" col="nama" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="NIP" col="nip" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Mapel" col="mapel_utama" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Peran" col="role" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Status" col="status" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th label="" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="w-10 px-3 py-2 text-center text-muted-foreground">{(page - 1) * (data?.meta?.per_page ?? 20) + i + 1}</td>
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
              {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada data</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {data?.meta && <Pagination meta={data.meta} page={page} onPage={setPage} />}

      {modal && (
        <Modal title={modal === 'add' ? 'Tambah Guru' : 'Edit Guru'} onClose={() => setModal(null)}>
          <Field label="Nama Lengkap (tanpa gelar)"><input className={inputCls} value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Gelar Depan"><input className={inputCls} placeholder="mis: Drs., Dr., H." value={form.gelar_depan} onChange={e => setForm(f => ({ ...f, gelar_depan: e.target.value }))} /></Field>
            <Field label="Gelar Belakang"><input className={inputCls} placeholder="mis: S.Pd., M.T." value={form.gelar_belakang} onChange={e => setForm(f => ({ ...f, gelar_belakang: e.target.value }))} /></Field>
          </div>
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

      {importOpen && (
        <ImportModal
          entity="guru"
          label="Guru"
          onClose={() => setImportOpen(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-teachers'] })}
        />
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
  const [importOpen, setImportOpen] = useState(false)
  const [selected, setSelected] = useState<AdminStudent | null>(null)
  const [form, setForm] = useState({ nama: '', email: '', nis: '', nisn: '', class_id: '', angkatan: '', wali_nama: '', wali_kontak: '', password: '' })
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')
  const [filterKelas, setFilterKelas] = useState('')
  const [page, setPage] = useState(1)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const debouncedSearch = useDebounce(search, 350)

  // Reset ke halaman 1 saat filter berubah
  useEffect(() => { setPage(1) }, [debouncedSearch, filterKelas])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-students', debouncedSearch, filterKelas, page],
    queryFn: () => adminApi.getStudents({ search: debouncedSearch || undefined, class_id: filterKelas || undefined, page }),
  })
  const { data: classes } = useQuery({ queryKey: ['admin-classes'], queryFn: adminApi.getClasses })

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const rows = useMemo(() => applySort(data?.data ?? [], sortCol, sortDir, (s, col) => {
    if (col === 'nama') return s.nama
    if (col === 'nis') return s.nis ?? ''
    if (col === 'kelas') return s.kelas?.label ?? ''
    if (col === 'angkatan') return s.angkatan ?? 0
    if (col === 'status') return s.status
    return ''
  }), [data?.data, sortCol, sortDir])

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
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" />Import Excel
          </Button>
          <Button size="sm" onClick={openAdd}><Plus className="mr-1 h-4 w-4" />Tambah Siswa</Button>
        </div>
      </div>

      {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <Th label="#" />
                <SortTh label="Nama" col="nama" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="NIS" col="nis" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Kelas" col="kelas" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Angkatan" col="angkatan" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Status" col="status" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th label="" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="w-10 px-3 py-2 text-center text-muted-foreground">{(page - 1) * (data?.meta?.per_page ?? 30) + i + 1}</td>
                  <td className="px-3 py-2 font-medium">{s.nama}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.nis}</td>
                  <td className="px-3 py-2">{s.kelas?.label ?? <span className="text-muted-foreground italic">—</span>}</td>
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
              {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada data</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {data?.meta && <Pagination meta={data.meta} page={page} onPage={setPage} />}

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

      {importOpen && (
        <ImportModal
          entity="siswa"
          label="Siswa"
          onClose={() => setImportOpen(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-students'] })}
        />
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
  const [importOpen, setImportOpen] = useState(false)
  const [importWaliOpen, setImportWaliOpen] = useState(false)
  const [dlWaliLoading, setDlWaliLoading] = useState(false)
  const [selected, setSelected] = useState<AdminClass | null>(null)

  async function downloadWaliKelas() {
    setDlWaliLoading(true)
    try {
      const resp = await api.get('/admin/export/wali-kelas', { responseType: 'blob' })
      const url  = URL.createObjectURL(new Blob([resp.data]))
      const a    = document.createElement('a'); a.href = url; a.download = 'daftar_wali_kelas.xlsx'; a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDlWaliLoading(false)
    }
  }
  const KELAS_PER_PAGE = 20
  const [form, setForm] = useState({ tingkat: 'XI', jurusan: '', rombel: '', wali_kelas_id: '' })
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data, isLoading } = useQuery({ queryKey: ['admin-classes'], queryFn: adminApi.getClasses })
  const { data: teachers } = useQuery({ queryKey: ['admin-teachers'], queryFn: () => adminApi.getTeachers() })

  useEffect(() => { setPage(1) }, [q])

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const allRows = useMemo(() => {
    let list = [...(data ?? [])]
    if (q) {
      const lower = q.toLowerCase()
      list = list.filter(c => [c.label, c.jurusan, c.wali_kelas?.nama].some(v => v?.toLowerCase().includes(lower)))
    }
    return applySort(list, sortCol, sortDir, (c, col) => {
      if (col === 'label') return c.label
      if (col === 'jurusan') return c.jurusan
      if (col === 'tingkat') return c.tingkat
      if (col === 'wali_kelas') return c.wali_kelas?.nama ?? ''
      if (col === 'jumlah_siswa') return c.jumlah_siswa
      if (col === 'tahun_ajaran') return c.tahun_ajaran ?? ''
      return ''
    })
  }, [data, q, sortCol, sortDir])

  const rows = useMemo(() => allRows.slice((page - 1) * KELAS_PER_PAGE, page * KELAS_PER_PAGE), [allRows, page])
  const kelasMeta = useMemo<PaginationMeta>(() => ({
    total: allRows.length, current_page: page,
    last_page: Math.max(1, Math.ceil(allRows.length / KELAS_PER_PAGE)), per_page: KELAS_PER_PAGE,
  }), [allRows.length, page])

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
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBar value={q} onChange={setQ} placeholder="Cari kelas / jurusan / wali..." />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" />Import Kelas
          </Button>
          <Button variant="outline" size="sm" onClick={downloadWaliKelas} disabled={dlWaliLoading}>
            {dlWaliLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
            Data Wali Kelas
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportWaliOpen(true)}>
            <Upload className="mr-1 h-4 w-4" />Import Wali Kelas
          </Button>
          <Button size="sm" onClick={openAdd}><Plus className="mr-1 h-4 w-4" />Tambah Kelas</Button>
        </div>
      </div>
      {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <Th label="#" />
                <SortTh label="Kelas" col="label" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Wali Kelas" col="wali_kelas" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Siswa" col="jumlah_siswa" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Tahun Ajaran" col="tahun_ajaran" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th label="" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c, i) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="w-10 px-3 py-2 text-center text-muted-foreground">{(page - 1) * KELAS_PER_PAGE + i + 1}</td>
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
              {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada data</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={kelasMeta} page={page} onPage={setPage} />
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

      {importOpen && (
        <ImportModal
          entity="kelas"
          label="Kelas"
          onClose={() => setImportOpen(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-classes'] })}
        />
      )}

      {importWaliOpen && (
        <WaliKelasImportModal
          onClose={() => setImportWaliOpen(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-classes'] })}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WALI KELAS IMPORT MODAL  (khusus — menampilkan info + tombol download data)
// ─────────────────────────────────────────────────────────────────────────────
function WaliKelasImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile]   = useState<File | null>(null)
  const [result, setResult] = useState<{ success_count: number; error_count: number; errors: string[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [dlLoading, setDlLoading] = useState(false)
  const [dlTplLoading, setDlTplLoading] = useState(false)

  async function downloadData() {
    setDlLoading(true)
    try {
      const resp = await api.get('/admin/export/wali-kelas', { responseType: 'blob' })
      const url  = URL.createObjectURL(new Blob([resp.data]))
      const a    = document.createElement('a'); a.href = url; a.download = 'daftar_wali_kelas.xlsx'; a.click()
      URL.revokeObjectURL(url)
    } finally { setDlLoading(false) }
  }

  async function downloadTemplate() {
    setDlTplLoading(true)
    try { await adminApi.downloadTemplate('wali_kelas') } finally { setDlTplLoading(false) }
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)
    try {
      const form = new FormData(); form.append('file', file)
      const res = await api.post('/admin/import/wali-kelas', form, { headers: { 'Accept': 'application/json' } })
      setResult(res.data)
      if (res.data.success_count > 0) onSuccess?.()
    } catch (e: any) {
      setResult({ success_count: 0, error_count: 1, errors: [e.response?.data?.message || 'Import gagal'] })
    } finally { setLoading(false) }
  }

  return (
    <Modal title="Import Penugasan Wali Kelas" onClose={onClose}>
      <div className="space-y-4">
        {/* Info */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 space-y-1">
          <p className="font-medium">Format file: 3 kolom</p>
          <ul className="text-xs space-y-0.5 pl-2">
            <li><strong>kelas</strong> — label kelas sesuai data di sistem (contoh: <code className="bg-blue-100 px-0.5 rounded">XI Pengembangan Perangkat Lunak dan Gim A</code>)</li>
            <li><strong>nip_guru</strong> — NIP 18 digit (utama)</li>
            <li><strong>nama_guru</strong> — nama lengkap guru (fallback jika NIP kosong)</li>
          </ul>
          <p className="text-xs mt-1">Jika guru belum berperan <em>wali_kelas</em>, role-nya akan diupdate otomatis.</p>
        </div>

        {/* Download buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={downloadData} disabled={dlLoading}>
            {dlLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
            Download Data Saat Ini
          </Button>
          <Button variant="outline" size="sm" onClick={downloadTemplate} disabled={dlTplLoading}>
            {dlTplLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
            Download Template Kosong
          </Button>
        </div>

        {/* Upload */}
        <Field label="File Excel (.xlsx) yang sudah diisi">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className={inputCls}
            onChange={e => { setFile(e.target.files?.[0] || null); setResult(null) }}
          />
        </Field>

        {/* Result */}
        {result && (
          <div className={`rounded-lg p-3 text-sm ${result.error_count === 0 ? 'border border-green-200 bg-green-50' : 'border border-yellow-200 bg-yellow-50'}`}>
            <p className="font-medium">{result.success_count} kelas berhasil diperbarui{result.error_count > 0 ? `, ${result.error_count} gagal` : ''}.</p>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs text-red-600">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Tutup</Button>
          <Button size="sm" onClick={handleImport} disabled={!file || loading}>
            {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
            Import
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: MAPEL
// ─────────────────────────────────────────────────────────────────────────────
function MapelTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [selected, setSelected] = useState<AdminSubject | null>(null)
  const [form, setForm] = useState({ kode: '', nama: '', kelompok: 'produktif' })
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data, isLoading } = useQuery({ queryKey: ['admin-subjects'], queryFn: adminApi.getSubjects })

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const MAPEL_PER_PAGE = 20

  useEffect(() => { setPage(1) }, [q])

  const allRows = useMemo(() => {
    let list = [...(data ?? [])]
    if (q) {
      const lower = q.toLowerCase()
      list = list.filter(s => [s.kode, s.nama, s.kelompok].some(v => v?.toLowerCase().includes(lower)))
    }
    return applySort(list, sortCol, sortDir, (s, col) => {
      if (col === 'kode') return s.kode
      if (col === 'nama') return s.nama
      if (col === 'kelompok') return s.kelompok
      if (col === 'aktif') return s.aktif ? 'aktif' : 'nonaktif'
      return ''
    })
  }, [data, q, sortCol, sortDir])

  const rows = useMemo(() => allRows.slice((page - 1) * MAPEL_PER_PAGE, page * MAPEL_PER_PAGE), [allRows, page])
  const mapelMeta = useMemo<PaginationMeta>(() => ({
    total: allRows.length, current_page: page,
    last_page: Math.max(1, Math.ceil(allRows.length / MAPEL_PER_PAGE)), per_page: MAPEL_PER_PAGE,
  }), [allRows.length, page])

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
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBar value={q} onChange={setQ} placeholder="Cari kode / nama / kelompok..." />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" />Import Excel
          </Button>
          <Button size="sm" onClick={() => { setSelected(null); setErr(''); setForm({ kode: '', nama: '', kelompok: 'produktif' }); setModal('add') }}>
            <Plus className="mr-1 h-4 w-4" />Tambah Mapel
          </Button>
        </div>
      </div>
      {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <Th label="#" />
                <SortTh label="Kode" col="kode" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Nama" col="nama" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Kelompok" col="kelompok" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Status" col="aktif" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th label="" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="w-10 px-3 py-2 text-center text-muted-foreground">{(page - 1) * MAPEL_PER_PAGE + i + 1}</td>
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
              {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada data</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={mapelMeta} page={page} onPage={setPage} />
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

      {importOpen && (
        <ImportModal
          entity="mapel"
          label="Mata Pelajaran"
          onClose={() => setImportOpen(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-subjects'] })}
        />
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
  const [importOpen, setImportOpen] = useState(false)
  const [selected, setSelected] = useState<AdminSchedule | null>(null)
  const [form, setForm] = useState({ class_id: '', subject_id: '', teacher_id: '', hari: 'senin', jam_mulai: '08:00', jam_selesai: '09:30' })
  const [filterKelas, setFilterKelas] = useState('')
  const [filterHari, setFilterHari] = useState('')
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const debouncedQ = useDebounce(q, 350)
  useEffect(() => { setPage(1) }, [debouncedQ, filterKelas, filterHari])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-schedules', filterKelas, filterHari, debouncedQ, page],
    queryFn: () => adminApi.getSchedules({
      class_id: filterKelas || undefined,
      hari: filterHari || undefined,
      search: debouncedQ || undefined,
      page,
    }),
  })
  const { data: classes } = useQuery({ queryKey: ['admin-classes'], queryFn: adminApi.getClasses })
  const { data: subjects } = useQuery({ queryKey: ['admin-subjects'], queryFn: adminApi.getSubjects })
  const { data: teachers } = useQuery({ queryKey: ['admin-teachers'], queryFn: () => adminApi.getTeachers() })

  const rows = data?.data ?? []

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

  const hariOptions = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu']

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBar value={q} onChange={setQ} placeholder="Cari mapel / guru..." />
        <select className={selectCls + ' max-w-[180px]'} value={filterKelas} onChange={e => setFilterKelas(e.target.value)}>
          <option value="">Semua Kelas</option>
          {classes?.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select className={selectCls + ' max-w-[120px]'} value={filterHari} onChange={e => setFilterHari(e.target.value)}>
          <option value="">Semua Hari</option>
          {hariOptions.map(h => <option key={h} value={h} className="capitalize">{h.charAt(0).toUpperCase() + h.slice(1)}</option>)}
        </select>
        <p className="text-xs text-muted-foreground">{data?.meta?.total ?? 0} jadwal</p>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" />Import Excel
          </Button>
          <Button size="sm" onClick={() => { setSelected(null); setErr(''); setForm({ class_id: '', subject_id: '', teacher_id: '', hari: 'senin', jam_mulai: '08:00', jam_selesai: '09:30' }); setModal('add') }}>
            <Plus className="mr-1 h-4 w-4" />Tambah Jadwal
          </Button>
        </div>
      </div>
      {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <Th label="#" />
                <Th label="Hari" />
                <Th label="Jam" />
                <Th label="Kelas" />
                <Th label="Mapel" />
                <Th label="Guru" />
                <Th label="" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="w-10 px-3 py-2 text-center text-muted-foreground">{(page - 1) * (data?.meta?.per_page ?? 50) + i + 1}</td>
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
              {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada data</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {data?.meta && <Pagination meta={data.meta} page={page} onPage={setPage} />}
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

      {importOpen && (
        <ImportModal
          entity="jadwal"
          label="Jadwal"
          onClose={() => setImportOpen(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-schedules'] })}
        />
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
  const [importCatOpen, setImportCatOpen] = useState(false)
  const [importSubOpen, setImportSubOpen] = useState(false)
  const [selCat, setSelCat] = useState<AdminCharacterCategory | null>(null)
  const [selSub, setSelSub] = useState<AdminCharacterSubitem | null>(null)
  const [catForm, setCatForm] = useState({ nama: '', deskripsi: '' })
  const [subForm, setSubForm] = useState({ category_id: '', kode: '', deskripsi: '', bobot: '5', sifat: 'positif' })
  const [err, setErr] = useState('')
  const [qCat, setQCat] = useState(''); const [sortCatCol, setSortCatCol] = useState<string|null>(null); const [sortCatDir, setSortCatDir] = useState<SortDir>('asc')
  const [qSub, setQSub] = useState(''); const [sortSubCol, setSortSubCol] = useState<string|null>(null); const [sortSubDir, setSortSubDir] = useState<SortDir>('asc')

  const { data: cats } = useQuery({ queryKey: ['admin-char-cats'], queryFn: adminApi.getCharacterCategories })
  const { data: subs } = useQuery({ queryKey: ['admin-char-subs'], queryFn: () => adminApi.getCharacterSubitems() })

  function toggleCatSort(col: string) { if (sortCatCol === col) setSortCatDir(d => d==='asc'?'desc':'asc'); else { setSortCatCol(col); setSortCatDir('asc') } }
  function toggleSubSort(col: string) { if (sortSubCol === col) setSortSubDir(d => d==='asc'?'desc':'asc'); else { setSortSubCol(col); setSortSubDir('asc') } }

  const catRows = useMemo(() => {
    let list = [...(cats ?? [])]
    if (qCat) { const l = qCat.toLowerCase(); list = list.filter(c => c.nama.toLowerCase().includes(l)) }
    return applySort(list, sortCatCol, sortCatDir, (c, col) => col === 'nama' ? c.nama : col === 'jumlah_subitem' ? c.jumlah_subitem : col === 'aktif' ? (c.aktif ? 'aktif' : 'nonaktif') : '')
  }, [cats, qCat, sortCatCol, sortCatDir])

  const subRows = useMemo(() => {
    let list = [...(subs ?? [])]
    if (qSub) { const l = qSub.toLowerCase(); list = list.filter(s => [s.kode, s.deskripsi, s.kategori?.nama, s.sifat].some(v => v?.toLowerCase().includes(l))) }
    return applySort(list, sortSubCol, sortSubDir, (s, col) => {
      if (col === 'kode') return s.kode
      if (col === 'deskripsi') return s.deskripsi
      if (col === 'bobot') return s.bobot
      if (col === 'sifat') return s.sifat
      if (col === 'kategori') return s.kategori?.nama ?? ''
      return ''
    })
  }, [subs, qSub, sortSubCol, sortSubDir])

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
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">Induk Karakter</h3>
          <SearchBar value={qCat} onChange={setQCat} placeholder="Cari nama..." />
          <span className="text-xs text-muted-foreground">{catRows.length} induk</span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportCatOpen(true)}><Upload className="mr-1 h-4 w-4" />Import Excel</Button>
            <Button size="sm" onClick={() => { setSelCat(null); setErr(''); setCatForm({ nama: '', deskripsi: '' }); setCatModal('add') }}><Plus className="mr-1 h-4 w-4" />Tambah</Button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <SortTh label="Nama" col="nama" sortCol={sortCatCol} sortDir={sortCatDir} onSort={toggleCatSort} />
                <SortTh label="Sub-item" col="jumlah_subitem" sortCol={sortCatCol} sortDir={sortCatDir} onSort={toggleCatSort} />
                <SortTh label="Status" col="aktif" sortCol={sortCatCol} sortDir={sortCatDir} onSort={toggleCatSort} />
                <Th label="" />
              </tr>
            </thead>
            <tbody>
              {catRows.map(c => (
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
              {catRows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sub-item */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">Sub-Karakter</h3>
          <SearchBar value={qSub} onChange={setQSub} placeholder="Cari kode / deskripsi..." />
          <span className="text-xs text-muted-foreground">{subRows.length} sub-item</span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportSubOpen(true)}><Upload className="mr-1 h-4 w-4" />Import Excel</Button>
            <Button size="sm" onClick={() => { setSelSub(null); setErr(''); setSubForm({ category_id: cats?.[0]?.id || '', kode: '', deskripsi: '', bobot: '5', sifat: 'positif' }); setSubModal('add') }}><Plus className="mr-1 h-4 w-4" />Tambah</Button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <SortTh label="Kode" col="kode" sortCol={sortSubCol} sortDir={sortSubDir} onSort={toggleSubSort} />
                <SortTh label="Deskripsi" col="deskripsi" sortCol={sortSubCol} sortDir={sortSubDir} onSort={toggleSubSort} />
                <SortTh label="Bobot" col="bobot" sortCol={sortSubCol} sortDir={sortSubDir} onSort={toggleSubSort} />
                <SortTh label="Sifat" col="sifat" sortCol={sortSubCol} sortDir={sortSubDir} onSort={toggleSubSort} />
                <SortTh label="Kategori" col="kategori" sortCol={sortSubCol} sortDir={sortSubDir} onSort={toggleSubSort} />
                <Th label="" />
              </tr>
            </thead>
            <tbody>
              {subRows.map(s => (
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
              {subRows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada data</td></tr>}
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

      {importCatOpen && (
        <ImportModal
          entity="karakter_kategori"
          label="Induk Karakter"
          onClose={() => setImportCatOpen(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-char-cats'] })}
        />
      )}
      {importSubOpen && (
        <ImportModal
          entity="karakter_subitem"
          label="Sub-Karakter"
          onClose={() => setImportSubOpen(false)}
          onSuccess={() => { qc.invalidateQueries({ queryKey: ['admin-char-subs'] }); qc.invalidateQueries({ queryKey: ['admin-char-cats'] }) }}
        />
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
  const [importOpen, setImportOpen] = useState(false)
  const [selected, setSelected] = useState<AdminThreshold | null>(null)
  const [form, setForm] = useState({ min_point: '', max_point: '', sifat: 'negatif', rekomendasi: '' })
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [sortCol, setSortCol] = useState<string | null>('min_point')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data } = useQuery({ queryKey: ['admin-thresholds'], queryFn: adminApi.getThresholds })

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const rows = useMemo(() => {
    let list = [...(data ?? [])]
    if (q) { const l = q.toLowerCase(); list = list.filter(t => t.rekomendasi.toLowerCase().includes(l) || t.sifat.includes(l)) }
    return applySort(list, sortCol, sortDir, (t, col) => {
      if (col === 'min_point') return t.min_point
      if (col === 'sifat') return t.sifat
      if (col === 'aktif') return t.aktif ? 'aktif' : 'nonaktif'
      if (col === 'rekomendasi') return t.rekomendasi
      return ''
    })
  }, [data, q, sortCol, sortDir])

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
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBar value={q} onChange={setQ} placeholder="Cari rekomendasi / sifat..." />
        <p className="text-xs text-muted-foreground">{rows.length} ambang</p>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" />Import Excel
          </Button>
          <Button size="sm" onClick={() => { setSelected(null); setErr(''); setForm({ min_point: '', max_point: '', sifat: 'negatif', rekomendasi: '' }); setModal('add') }}><Plus className="mr-1 h-4 w-4" />Tambah</Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <SortTh label="Rentang Poin" col="min_point" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
              <SortTh label="Sifat" col="sifat" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
              <SortTh label="Rekomendasi" col="rekomendasi" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
              <SortTh label="Status" col="aktif" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
              <Th label="" />
            </tr>
          </thead>
          <tbody>
            {rows.map(t => (
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
            {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada data</td></tr>}
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

      {importOpen && (
        <ImportModal
          entity="ambang"
          label="Ambang Tindakan"
          onClose={() => setImportOpen(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['admin-thresholds'] })}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: PENGGUNA (Admin, BK, Orang Tua)
// ─────────────────────────────────────────────────────────────────────────────
function PenggunaTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [form, setForm] = useState({ nama: '', email: '', role: 'admin', nomor_hp: '', password: '', student_id: '' })
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data, isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: () => adminApi.getAdminUsers() })

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const rows = useMemo(() => {
    let list = [...(data?.data ?? [])]
    if (q) { const l = q.toLowerCase(); list = list.filter(u => [u.nama, u.email, u.role].some(v => v?.toLowerCase().includes(l))) }
    return applySort(list, sortCol, sortDir, (u, col) => {
      if (col === 'nama') return u.nama
      if (col === 'email') return u.email
      if (col === 'role') return u.role
      if (col === 'status') return u.status
      return ''
    })
  }, [data?.data, q, sortCol, sortDir])
  const { data: studentsRes } = useQuery({
    queryKey: ['admin-students-list'],
    queryFn: () => adminApi.getStudents({ per_page: 500 }),
    enabled: form.role === 'orang_tua',
  })
  const allStudents = studentsRes?.data ?? []

  const save = useMutation({
    mutationFn: (d: object) => selected ? adminApi.updateAdminUser(selected.id, d) : adminApi.createAdminUser(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setModal(null); setErr('') },
    onError: (e: any) => setErr(e.response?.data?.message || 'Terjadi kesalahan'),
  })
  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteAdminUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: (e: any) => alert(e.response?.data?.message || 'Gagal'),
  })

  function openAdd() {
    setSelected(null); setErr('')
    setForm({ nama: '', email: '', role: 'admin', nomor_hp: '', password: '', student_id: '' })
    setModal('add')
  }
  function openEdit(u: AdminUser) {
    setSelected(u); setErr('')
    setForm({ nama: u.nama, email: u.email, role: u.role, nomor_hp: u.nomor_hp || '', password: '', student_id: u.linked_student?.id || '' })
    setModal('edit')
  }
  function handleSubmit() {
    const payload: any = { ...form }
    if (!payload.password) delete payload.password
    if (!payload.nomor_hp) delete payload.nomor_hp
    if (payload.role !== 'orang_tua') delete payload.student_id
    save.mutate(payload)
  }

  const roleColor: Record<string, string> = {
    admin: 'bg-red-100 text-red-700',
    bk: 'bg-purple-100 text-purple-700',
    orang_tua: 'bg-blue-100 text-blue-700',
  }

  return (
    <div>
      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Kelola akun pengguna non-guru: <strong>Admin</strong>, <strong>BK</strong> (Bimbingan Konseling), dan <strong>Orang Tua</strong>.
        Akun guru, wali kelas, dan siswa dikelola di tab masing-masing.
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBar value={q} onChange={setQ} placeholder="Cari nama / email / peran..." />
        <p className="text-xs text-muted-foreground">{rows.length} dari {data?.meta?.total ?? 0} pengguna</p>
        <div className="ml-auto">
          <Button size="sm" onClick={openAdd}><Plus className="mr-1 h-4 w-4" />Tambah Pengguna</Button>
        </div>
      </div>

      {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <SortTh label="Nama" col="nama" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Email" col="email" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Peran" col="role" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Siswa Dipantau" />
                <SortTh label="Status" col="status" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th label="" />
              </tr>
            </thead>
            <tbody>
              {rows.map(u => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{u.nama}</td>
                  <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                  <td className="px-3 py-2">
                    <Badge className={roleColor[u.role] || 'bg-gray-100 text-gray-700'}>{u.role.replace(/_/g, ' ')}</Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {u.linked_student
                      ? <span>{u.linked_student.nama} <span className="text-muted-foreground">({u.linked_student.kelas || '-'})</span></span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Badge className={u.status === 'aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{u.status}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(u)} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => window.confirm('Nonaktifkan pengguna ini?') && del.mutate(u.id)} className="rounded p-1 hover:bg-red-100 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada data</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal === 'add' ? 'Tambah Pengguna' : 'Edit Pengguna'} onClose={() => setModal(null)}>
          <Field label="Nama Lengkap"><input className={inputCls} value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} /></Field>
          <Field label="Email"><input className={inputCls} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
          <Field label="Peran">
            <select className={selectCls} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, student_id: '' }))}>
              <option value="admin">Admin</option>
              <option value="bk">BK (Bimbingan Konseling)</option>
              <option value="orang_tua">Orang Tua</option>
            </select>
          </Field>
          {form.role === 'orang_tua' && (
            <Field label="Siswa yang Dipantau">
              <select className={selectCls} value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}>
                <option value="">— Pilih Siswa —</option>
                {allStudents.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.nama} ({s.nis}){s.kelas ? ` — ${s.kelas.label}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="No. HP (opsional)">
            <input className={inputCls} placeholder="08123456789" value={form.nomor_hp} onChange={e => setForm(f => ({ ...f, nomor_hp: e.target.value }))} />
          </Field>
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
// TAB: TAHUN AJARAN
// ─────────────────────────────────────────────────────────────────────────────
function TahunAjaranTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [selected, setSelected] = useState<AdminAcademicYear | null>(null)
  const [form, setForm] = useState({ tahun: '', semester: 'ganjil' })
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [sortCol, setSortCol] = useState<string | null>('tahun')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const { data: years, isLoading } = useQuery({
    queryKey: ['admin-academic-years'],
    queryFn: () => adminApi.getAcademicYears(),
  })

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const rows = useMemo(() => {
    let list = [...(years ?? [])]
    if (q) { const l = q.toLowerCase(); list = list.filter(y => [y.tahun, y.semester].some(v => v?.toLowerCase().includes(l))) }
    return applySort(list, sortCol, sortDir, (y, col) => {
      if (col === 'tahun') return y.tahun
      if (col === 'semester') return y.semester
      if (col === 'aktif') return y.aktif ? 'aktif' : 'nonaktif'
      return ''
    })
  }, [years, q, sortCol, sortDir])

  const save = useMutation({
    mutationFn: (d: object) =>
      selected ? adminApi.updateAcademicYear(selected.id, d) : adminApi.createAcademicYear(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-academic-years'] }); setModal(null); setErr('') },
    onError: (e: any) => setErr(e.response?.data?.message || 'Terjadi kesalahan'),
  })

  const setAktif = useMutation({
    mutationFn: (id: string) => adminApi.updateAcademicYear(id, { aktif: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-academic-years'] }),
    onError: (e: any) => alert(e.response?.data?.message || 'Gagal'),
  })

  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteAcademicYear(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-academic-years'] }),
    onError: (e: any) => alert(e.response?.data?.message || 'Gagal'),
  })

  function openAdd() {
    setSelected(null); setErr('')
    setForm({ tahun: '', semester: 'ganjil' })
    setModal('add')
  }
  function openEdit(y: AdminAcademicYear) {
    setSelected(y); setErr('')
    setForm({ tahun: y.tahun, semester: y.semester })
    setModal('edit')
  }

  return (
    <div>
      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Satu tahun ajaran harus di-set <strong>Aktif</strong> — ini digunakan sebagai konteks seluruh data EWS, laporan, dan jadwal.
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBar value={q} onChange={setQ} placeholder="Cari tahun / semester..." />
        <p className="text-xs text-muted-foreground">{rows.length} tahun ajaran</p>
        <div className="ml-auto">
          <Button size="sm" onClick={openAdd}><Plus className="mr-1 h-4 w-4" />Tambah</Button>
        </div>
      </div>

      {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <SortTh label="Tahun Ajaran" col="tahun" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Semester" col="semester" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Status" col="aktif" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th label="" />
              </tr>
            </thead>
            <tbody>
              {rows.map(y => (
                <tr key={y.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{y.tahun}</td>
                  <td className="px-3 py-2 text-muted-foreground capitalize">{y.semester}</td>
                  <td className="px-3 py-2">
                    {y.aktif
                      ? <Badge className="bg-green-100 text-green-700">Aktif</Badge>
                      : <button
                          onClick={() => setAktif.mutate(y.id)}
                          className="text-xs text-primary hover:underline"
                          disabled={setAktif.isPending}
                        >Set Aktif</button>
                    }
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(y)} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                      {!y.aktif && (
                        <button
                          onClick={() => window.confirm('Hapus tahun ajaran ini?') && del.mutate(y.id)}
                          className="rounded p-1 hover:bg-red-100 text-red-600"
                        ><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada data</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal === 'add' ? 'Tambah Tahun Ajaran' : 'Edit Tahun Ajaran'} onClose={() => setModal(null)}>
          <Field label="Tahun Ajaran (contoh: 2025/2026)">
            <input
              className={inputCls}
              placeholder="2025/2026"
              value={form.tahun}
              onChange={e => setForm(f => ({ ...f, tahun: e.target.value }))}
            />
          </Field>
          <Field label="Semester">
            <select className={selectCls} value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value }))}>
              <option value="ganjil">Ganjil</option>
              <option value="genap">Genap</option>
            </select>
          </Field>
          {err && <ErrMsg msg={err} />}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Batal</Button>
            <Button size="sm" onClick={() => save.mutate(form)} disabled={save.isPending}>
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
        {activeTab === 7 && <PenggunaTab />}
        {activeTab === 8 && <TahunAjaranTab />}
        {activeTab === 9 && <AscXmlImportTab />}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT DATA TAB  (aSc XML + Dapodik Guru + Dapodik Siswa)
// ─────────────────────────────────────────────────────────────────────────────

type SimpleStats = { created: number; updated: number; skipped: number }

interface AscImportResult {
  mata_pelajaran: SimpleStats
  guru:           SimpleStats
  kelas:          SimpleStats
  jadwal:         SimpleStats
}

// Generic upload + import card
function ImportCard({
  title,
  badge,
  badgeColor,
  description,
  bullets,
  warning,
  accept,
  endpoint,
  resultLabels,
  icon,
}: {
  title: string
  badge: string
  badgeColor: string
  description: string
  bullets: string[]
  warning?: string
  accept: string
  endpoint: string
  resultLabels: string[]
  icon: React.ReactNode
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile]     = useState<File | null>(null)
  const [result, setResult] = useState<Record<string, SimpleStats> | null>(null)
  const [error, setError]   = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (f: File) => {
      const form = new FormData()
      form.append('file', f)
      const resp = await api.post<{ message: string; data: Record<string, SimpleStats> }>(
        endpoint,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      return resp.data
    },
    onSuccess: (data) => { setResult(data.data); setError(null) },
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? err?.message ?? 'Terjadi kesalahan.')
      setResult(null)
    },
  })

  function reset() {
    setFile(null); setResult(null); setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-sm font-semibold">{title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>{badge}</span>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      {/* Bullets */}
      <ul className="text-xs text-muted-foreground space-y-0.5 pl-1">
        {bullets.map((b, i) => <li key={i} className="flex gap-1.5"><span className="text-primary shrink-0">•</span>{b}</li>)}
      </ul>
      {warning && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">{warning}</p>}

      {/* Upload zone */}
      <div
        className="rounded-md border-2 border-dashed border-muted-foreground/25 p-4 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        {file ? (
          <p className="text-xs"><span className="font-medium">{file.name}</span> <span className="text-muted-foreground">({(file.size/1024).toFixed(0)} KB)</span></p>
        ) : (
          <p className="text-xs text-muted-foreground">Klik pilih file {accept.includes('xml') ? '.xml' : '.xlsx'}</p>
        )}
        <input ref={fileRef} type="file" accept={accept} className="hidden"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(null) }} />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 flex gap-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded border border-green-200 bg-green-50 px-3 py-2 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-green-800">
            <CheckCircle2 className="h-3.5 w-3.5" /> Import berhasil!
          </div>
          <div className="grid grid-cols-2 gap-2">
            {resultLabels.map((label) => {
              const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '')
              // Try exact key match or fallback to first matching key
              const statsKey = Object.keys(result).find(k =>
                k === key || k.includes(label.toLowerCase().split(' ')[0]) || label.toLowerCase().includes(k.split('_')[0])
              )
              const stats = statsKey ? result[statsKey] : null
              if (!stats) return null
              return <ResultCard key={label} label={label} stats={stats} />
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!file || mutation.isPending}
          onClick={() => file && mutation.mutate(file)}
          className="inline-flex items-center gap-1.5 rounded bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {mutation.isPending
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Mengimport...</>
            : <><Upload className="h-3.5 w-3.5" />Mulai Import</>}
        </button>
        {(file || result || error) && (
          <button type="button" onClick={reset}
            className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
            <X className="h-3.5 w-3.5" />Reset
          </button>
        )}
      </div>
    </div>
  )
}

function AscXmlImportTab() {
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-base font-semibold mb-1">Import Data</h2>
        <p className="text-sm text-muted-foreground">
          Tiga sumber import yang saling melengkapi. Urutan disarankan: <strong>1 → 2 → 3</strong>.
        </p>
      </div>

      {/* Langkah 1: aSc XML */}
      <ImportCard
        title="1. aSc Timetables XML"
        badge="Jadwal & Struktur"
        badgeColor="bg-purple-100 text-purple-700"
        description="Langkah pertama. Buat data guru (nama), kelas, mata pelajaran, dan jadwal lengkap dari file ekspor aSc."
        bullets={[
          'Mata pelajaran — nama, kode, kelompok',
          'Guru — akun login dengan email sementara (akan dilengkapi di langkah 2)',
          'Kelas — tingkat, jurusan, rombel untuk tahun ajaran aktif',
          'Jadwal — hari, jam, guru, kelas, mapel (750+ jadwal sekaligus)',
        ]}
        warning="Pastikan sudah ada Tahun Ajaran aktif sebelum import. NIP & email akan dilengkapi di langkah 2."
        accept=".xml,application/xml,text/xml"
        endpoint="/admin/import/asc-xml"
        resultLabels={['Mata Pelajaran', 'Guru', 'Kelas', 'Jadwal']}
        icon={<FileCode2 className="h-8 w-8 text-purple-500" />}
      />

      {/* Langkah 2: Dapodik Guru */}
      <ImportCard
        title="2. Daftar Guru (Dapodik Excel)"
        badge="Lengkapi Data Guru"
        badgeColor="bg-blue-100 text-blue-700"
        description="Melengkapi data guru dari langkah 1. Cocokkan berdasarkan nama, update NIP, NUPTK, email asli, HP, dan role jabatan."
        bullets={[
          'NIP (18 digit) — untuk guru PNS/PPPK',
          'NUPTK (16 digit) — untuk semua guru',
          'Email & HP asli dari Dapodik (menggantikan email sementara)',
          'Role otomatis: "Guru Wali" → wali_kelas, "Wakil KS" → wakasek',
          'Jika nama tidak cocok dengan data aSc → buat akun baru',
        ]}
        warning={`Format file: ekspor "Daftar PTK" dari Dapodik. Header data di baris 5, data mulai baris 7.`}
        accept=".xlsx,.xls"
        endpoint="/admin/import/dapodik-guru"
        resultLabels={['Guru']}
        icon={<Users className="h-8 w-8 text-blue-500" />}
      />

      {/* Langkah 3: Dapodik Siswa */}
      <ImportCard
        title="3. Daftar Peserta Didik (Dapodik Excel)"
        badge="Import Semua Siswa"
        badgeColor="bg-green-100 text-green-700"
        description="Import seluruh siswa aktif dari Dapodik. Assign otomatis ke kelas berdasarkan kolom Rombel. Mendukung 1.700+ siswa sekaligus."
        bullets={[
          'Nama, NISN (ID nasional), NIPD (nomor induk lokal/NIS)',
          'Assign ke kelas berdasarkan "Rombel Saat Ini" (contoh: XI RPL A)',
          'Angkatan otomatis dihitung dari tingkat kelas',
          'Nama ayah & ibu (untuk kebutuhan BK dan data orang tua)',
          'HP siswa — kontak langsung',
          'Email (jika tersedia); default: NISN@siswa.smkn2cimahi.sch.id',
        ]}
        warning="Kelas harus sudah ada (dari langkah 1). Siswa di rombel yang tidak dikenal akan tetap diimport tapi tanpa kelas."
        accept=".xlsx,.xls"
        endpoint="/admin/import/dapodik-siswa"
        resultLabels={['Siswa']}
        icon={<Users className="h-8 w-8 text-green-500" />}
      />
    </div>
  )
}

function ResultCard({
  label, stats,
}: { label: string; stats: { created: number; updated: number; skipped: number } }) {
  return (
    <div className="rounded-md bg-white border p-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-green-700">Dibuat baru</span>
          <span className="font-semibold text-green-700">{stats.created}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-blue-700">Diperbarui</span>
          <span className="font-semibold text-blue-700">{stats.updated}</span>
        </div>
        {stats.skipped > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dilewati</span>
            <span className="font-semibold text-muted-foreground">{stats.skipped}</span>
          </div>
        )}
      </div>
    </div>
  )
}
