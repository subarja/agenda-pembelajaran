import { useRef, useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Loader2, X, Check, AlertCircle, Upload, Download, FileCode2, CheckCircle2, XCircle, Key, Users, Search, ChevronUp, ChevronDown, ChevronsUpDown, RefreshCw, Calendar } from 'lucide-react'
import api from '@/lib/api'
import { adminApi } from '@/features/admin/api'
import type {
  AdminTeacher, AdminStudent, AdminClass, AdminSubject,
  AdminSchedule, AdminCharacterCategory, AdminCharacterSubitem, AdminThreshold,
  AdminUser, AdminAcademicYear, ImportResult, AdminManualNote,
} from '@/features/admin/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PasswordInput } from '@/components/ui/password-input'
import { cn } from '@/lib/utils'

// ── Tab labels ────────────────────────────────────────────────────────────────
const TABS = ['Guru', 'Siswa', 'Kelas', 'Mapel', 'Jadwal', 'Karakter', 'Ambang', 'Pengguna', 'Tahun Ajaran', 'Import Data', 'Nilai Manual', 'Kalender', 'Backup & Restore']

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
type PerPageOpt = 25 | 50 | 100 | 'semua'
const PER_PAGE_OPTS: PerPageOpt[] = [25, 50, 100, 'semua']

function Pagination({
  meta, page, onPage, perPage, onPerPage,
}: {
  meta: PaginationMeta; page: number; onPage: (p: number) => void
  perPage?: PerPageOpt; onPerPage?: (pp: PerPageOpt) => void
}) {
  const [inputVal, setInputVal] = useState(String(page))
  useEffect(() => { setInputVal(String(page)) }, [page])

  function commit() {
    const p = parseInt(inputVal, 10)
    if (!isNaN(p) && p >= 1 && p <= meta.last_page) onPage(p)
    else setInputVal(String(page))
  }

  const pp    = typeof perPage === 'number' ? perPage : (meta.per_page ?? 25)
  const from  = perPage === 'semua' ? 1 : (page - 1) * pp + 1
  const to    = perPage === 'semua' ? meta.total : Math.min(page * pp, meta.total)
  const showNav = meta.last_page > 1 && perPage !== 'semua'

  if (!onPerPage && !showNav) return null

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{from}–{to} dari {meta.total} data</span>
      <div className="flex items-center gap-3 flex-wrap justify-end">
        {onPerPage && (
          <div className="flex items-center gap-1.5">
            <span>Tampilkan:</span>
            <div className="flex rounded-md border border-input overflow-hidden">
              {PER_PAGE_OPTS.map(opt => (
                <button
                  key={opt}
                  onClick={() => onPerPage(opt)}
                  className={`px-2 py-0.5 text-xs transition-colors ${perPage === opt ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted'}`}
                >
                  {opt === 'semua' ? 'Semua' : opt}
                </button>
              ))}
            </div>
          </div>
        )}
        {showNav && (
          <div className="flex items-center gap-1">
            <button className="rounded border px-2 py-1 disabled:opacity-40 hover:bg-muted" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Sblm</button>
            <span className="px-1">Hal</span>
            <input
              type="number" min={1} max={meta.last_page} value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commit() }}
              onBlur={commit}
              className="w-12 rounded border px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="px-1">/ {meta.last_page}</span>
            <button className="rounded border px-2 py-1 disabled:opacity-40 hover:bg-muted" disabled={page >= meta.last_page} onClick={() => onPage(page + 1)}>Selanj →</button>
          </div>
        )}
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

// ── Skeleton tabel (loading state) ──────────────────────────────────────────
// Menjaga tinggi & struktur tabel tetap terlihat saat data sedang dimuat, supaya
// tidak ada jeda "layar kosong" antara ganti tab dan tabel/isi tampil.
function TableSkeleton({ cols, rows = 6 }: { cols: number[]; rows?: number }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-b last:border-0">
              {cols.map((w, j) => (
                <td key={j} className="px-3 py-2">
                  <div className="h-3.5 rounded bg-muted animate-pulse" style={{ width: w }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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
  const [perPage, setPerPage] = useState<PerPageOpt>(25)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const debouncedQ = useDebounce(q, 350)
  useEffect(() => { setPage(1) }, [debouncedQ, perPage])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-teachers', debouncedQ, page, perPage],
    queryFn: () => adminApi.getTeachers({ search: debouncedQ || undefined, page, per_page: perPage === 'semua' ? 'all' : perPage }),
    placeholderData: (prev) => prev,
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

      {isLoading ? <TableSkeleton cols={[16, 160, 120, 120, 80, 70, 40]} rows={8} /> : (
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
                  <td className="w-10 px-3 py-2 text-center text-muted-foreground">{perPage === 'semua' ? i + 1 : (page - 1) * (data?.meta?.per_page ?? 25) + i + 1}</td>
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
      {data?.meta && <Pagination meta={data.meta} page={page} onPage={setPage} perPage={perPage} onPerPage={(pp) => { setPerPage(pp); setPage(1) }} />}

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
            <PasswordInput className={inputCls} placeholder={modal === 'add' ? 'password' : ''} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
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
  const [perPage, setPerPage] = useState<PerPageOpt>(25)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const debouncedSearch = useDebounce(search, 350)

  useEffect(() => { setPage(1) }, [debouncedSearch, filterKelas, perPage])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-students', debouncedSearch, filterKelas, page, perPage],
    queryFn: () => adminApi.getStudents({ search: debouncedSearch || undefined, class_id: filterKelas || undefined, page, per_page: perPage === 'semua' ? 'all' : perPage }),
    placeholderData: (prev) => prev,
  })
  const { data: classes } = useQuery({ queryKey: ['admin-classes'], queryFn: adminApi.getClasses })

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const rows = useMemo(() => applySort(data?.data ?? [], sortCol, sortDir, (s, col) => {
    if (col === 'nama') return s.nama
    if (col === 'nis') return s.nis ?? ''
    if (col === 'nisn') return s.nisn ?? ''
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

      {isLoading ? (
        <TableSkeleton cols={[16, 160, 80, 80, 120, 60, 60, 40]} rows={8} />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <Th label="#" />
                <SortTh label="Nama" col="nama" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="NIS" col="nis" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="NISN" col="nisn" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Kelas" col="kelas" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Angkatan" col="angkatan" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Status" col="status" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th label="" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="w-10 px-3 py-2 text-center text-muted-foreground">{perPage === 'semua' ? i + 1 : (page - 1) * (data?.meta?.per_page ?? 25) + i + 1}</td>
                  <td className="px-3 py-2 font-medium">{s.nama}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.nis}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.nisn ?? '-'}</td>
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
              {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada data</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {data?.meta && <Pagination meta={data.meta} page={page} onPage={setPage} perPage={perPage} onPerPage={(pp) => { setPerPage(pp); setPage(1) }} />}

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
            <PasswordInput className={inputCls} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
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
  const [form, setForm] = useState({ tingkat: 'XI', jurusan: '', rombel: '', wali_kelas_id: '' })
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<PerPageOpt>(25)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data, isLoading } = useQuery({ queryKey: ['admin-classes'], queryFn: adminApi.getClasses })
  const { data: teachers } = useQuery({ queryKey: ['admin-teachers', 'all'], queryFn: () => adminApi.getTeachers({ per_page: 'all' }) })

  useEffect(() => { setPage(1) }, [q, perPage])

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

  const pp = typeof perPage === 'number' ? perPage : allRows.length
  const rows = useMemo(() => perPage === 'semua' ? allRows : allRows.slice((page - 1) * pp, page * pp), [allRows, page, perPage, pp])
  const kelasMeta = useMemo<PaginationMeta>(() => ({
    total: allRows.length, current_page: page,
    last_page: perPage === 'semua' ? 1 : Math.max(1, Math.ceil(allRows.length / pp)),
    per_page: pp,
  }), [allRows.length, page, perPage, pp])

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
      {isLoading ? <TableSkeleton cols={[16, 140, 120, 70, 100, 40]} rows={8} /> : (
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
                  <td className="w-10 px-3 py-2 text-center text-muted-foreground">{perPage === 'semua' ? i + 1 : (page - 1) * pp + i + 1}</td>
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
      <Pagination meta={kelasMeta} page={page} onPage={setPage} perPage={perPage} onPerPage={(p) => { setPerPage(p); setPage(1) }} />
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

  const [perPage, setPerPage] = useState<PerPageOpt>(25)

  useEffect(() => { setPage(1) }, [q, perPage])

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

  const mpp = typeof perPage === 'number' ? perPage : allRows.length
  const rows = useMemo(() => perPage === 'semua' ? allRows : allRows.slice((page - 1) * mpp, page * mpp), [allRows, page, perPage, mpp])
  const mapelMeta = useMemo<PaginationMeta>(() => ({
    total: allRows.length, current_page: page,
    last_page: perPage === 'semua' ? 1 : Math.max(1, Math.ceil(allRows.length / mpp)),
    per_page: mpp,
  }), [allRows.length, page, perPage, mpp])

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
      {isLoading ? <TableSkeleton cols={[16, 60, 160, 90, 70, 40]} rows={8} /> : (
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
                  <td className="w-10 px-3 py-2 text-center text-muted-foreground">{perPage === 'semua' ? i + 1 : (page - 1) * mpp + i + 1}</td>
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
      <Pagination meta={mapelMeta} page={page} onPage={setPage} perPage={perPage} onPerPage={(p) => { setPerPage(p); setPage(1) }} />
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
  const [perPage, setPerPage] = useState<PerPageOpt>(25)

  const debouncedQ = useDebounce(q, 350)
  useEffect(() => { setPage(1) }, [debouncedQ, filterKelas, filterHari, perPage])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-schedules', filterKelas, filterHari, debouncedQ, page, perPage],
    queryFn: () => adminApi.getSchedules({
      class_id: filterKelas || undefined,
      hari: filterHari || undefined,
      search: debouncedQ || undefined,
      page,
      per_page: perPage === 'semua' ? 'all' : perPage,
    }),
    placeholderData: (prev) => prev,
  })
  const { data: classes } = useQuery({ queryKey: ['admin-classes'], queryFn: adminApi.getClasses })
  const { data: subjects } = useQuery({ queryKey: ['admin-subjects'], queryFn: adminApi.getSubjects })
  const { data: teachers } = useQuery({ queryKey: ['admin-teachers', 'all'], queryFn: () => adminApi.getTeachers({ per_page: 'all' }) })

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
      {isLoading ? <TableSkeleton cols={[16, 70, 90, 120, 120, 120, 40]} rows={8} /> : (
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
                  <td className="w-10 px-3 py-2 text-center text-muted-foreground">{perPage === 'semua' ? i + 1 : (page - 1) * (data?.meta?.per_page ?? 25) + i + 1}</td>
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
      {data?.meta && <Pagination meta={data.meta} page={page} onPage={setPage} perPage={perPage} onPerPage={(p) => { setPerPage(p); setPage(1) }} />}
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
              {hariOptions.map(h => <option key={h} value={h} className="capitalize">{h}</option>)}
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
  const [subTab, setSubTab] = useState<'admin' | 'guru' | 'siswa'>('admin')
  const [modal, setModal] = useState<'add' | 'edit' | 'reset-pw' | null>(null)
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [form, setForm] = useState({ nama: '', email: '', role: 'admin', nomor_hp: '', password: '', student_id: '' })
  const [resetPw, setResetPw] = useState('')
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [genMsg, setGenMsg] = useState('')
  const [genLoading, setGenLoading] = useState(false)
  const debouncedQ = useDebounce(q, 350)

  // ── Admin/BK/OrangTua query ────────────────────────────────────────────────
  const { data, isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: () => adminApi.getAdminUsers() })

  // ── Guru/Siswa detail queries ──────────────────────────────────────────────
  const { data: guruDetailData, isLoading: guruLoading, refetch: refetchGuru } = useQuery({
    queryKey: ['admin-users-detail', 'guru', debouncedQ],
    queryFn: () => api.get('/admin/users-detail', { params: { role: 'guru', search: debouncedQ || undefined } }).then(r => r.data),
    enabled: subTab === 'guru',
    staleTime: 60_000,
  })
  const { data: siswaDetailData, isLoading: siswaLoading, refetch: refetchSiswa } = useQuery({
    queryKey: ['admin-users-detail', 'siswa', debouncedQ],
    queryFn: () => api.get('/admin/users-detail', { params: { role: 'siswa', search: debouncedQ || undefined } }).then(r => r.data),
    enabled: subTab === 'siswa',
    staleTime: 60_000,
  })

  const rows = useMemo(() => {
    const list = [...(data?.data ?? [])]
    if (!q) return list
    const l = q.toLowerCase()
    return list.filter(u => [u.nama, u.email, u.role].some(v => v?.toLowerCase().includes(l)))
  }, [data?.data, q])

  const { data: studentsRes } = useQuery({
    queryKey: ['admin-students', 'all'],
    queryFn: () => adminApi.getStudents({ per_page: 'all' }),
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
  const toggleStatus = useMutation({
    mutationFn: (uuid: string) => api.put(`/admin/users/${uuid}/toggle-status`),
    onSuccess: () => { refetchGuru(); refetchSiswa() },
  })
  const doResetPw = useMutation({
    mutationFn: ({ uuid, password }: { uuid: string; password: string }) =>
      api.put(`/admin/users/${uuid}/reset-password`, { password }),
    onSuccess: () => { setModal(null); setResetPw(''); setErr('') },
    onError: (e: any) => setErr(e.response?.data?.message || 'Gagal'),
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
  function openResetPw(u: any) { setSelected(u); setResetPw(''); setErr(''); setModal('reset-pw') }
  function handleSubmit() {
    const payload: any = { ...form }
    if (!payload.password) delete payload.password
    if (!payload.nomor_hp) delete payload.nomor_hp
    if (payload.role !== 'orang_tua') delete payload.student_id
    save.mutate(payload)
  }

  async function generateAccounts(type: 'guru' | 'siswa') {
    if (!window.confirm(`Set password default untuk semua ${type === 'guru' ? 'guru' : 'siswa'}? Tindakan ini tidak dapat diurungkan.`)) return
    setGenLoading(true); setGenMsg('')
    try {
      const r = await api.post('/admin/generate-accounts', null, { params: { type } })
      setGenMsg(r.data.message)
      if (type === 'guru') refetchGuru(); else refetchSiswa()
    } catch { setGenMsg('Gagal generate akun.') }
    finally { setGenLoading(false) }
  }

  const roleColor: Record<string, string> = {
    admin: 'bg-red-100 text-red-700',
    bk: 'bg-purple-100 text-purple-700',
    orang_tua: 'bg-blue-100 text-blue-700',
    guru: 'bg-green-100 text-green-700',
    wali_kelas: 'bg-teal-100 text-teal-700',
    wakasek: 'bg-orange-100 text-orange-700',
    siswa: 'bg-sky-100 text-sky-700',
  }

  const detailRows: any[] = subTab === 'guru' ? (guruDetailData?.data ?? []) : (siswaDetailData?.data ?? [])
  const detailLoading = subTab === 'guru' ? guruLoading : siswaLoading

  return (
    <div className="space-y-3">
      {/* Sub-tab switcher */}
      <div className="flex rounded-md border border-input overflow-hidden w-fit">
        {(['admin', 'guru', 'siswa'] as const).map(t => (
          <button key={t} onClick={() => { setSubTab(t); setQ('') }}
            className={cn('px-4 py-1.5 text-xs capitalize transition-colors',
              subTab === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
            {t === 'admin' ? 'Administrator' : t === 'guru' ? 'Guru / Staf' : 'Siswa'}
          </button>
        ))}
      </div>

      {/* Search + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={q} onChange={setQ} placeholder={`Cari ${subTab === 'siswa' ? 'nama siswa...' : 'nama / email / NIP...'}`} />
        {subTab === 'admin' && (
          <Button size="sm" onClick={openAdd}><Plus className="mr-1 h-4 w-4" />Tambah Pengguna</Button>
        )}
        {(subTab === 'guru' || subTab === 'siswa') && (
          <Button size="sm" variant="outline" disabled={genLoading}
            onClick={() => generateAccounts(subTab)}>
            {genLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Key className="h-3.5 w-3.5 mr-1" />}
            Generate Akun
          </Button>
        )}
      </div>
      {genMsg && <div className="rounded bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">{genMsg}</div>}

      {/* ── Admin/BK/OrangTua sub-tab ────────────────────────────────────────── */}
      {subTab === 'admin' && (
        <>
          {isLoading ? <TableSkeleton cols={[140, 180, 90, 140, 70, 40]} rows={8} /> : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <Th label="Nama" /><Th label="Email" /><Th label="Peran" /><Th label="Siswa Dipantau" /><Th label="Status" /><Th label="" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(u => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{u.nama}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{u.email}</td>
                      <td className="px-3 py-2"><Badge className={roleColor[u.role] || 'bg-gray-100 text-gray-700'}>{u.role.replace(/_/g, ' ')}</Badge></td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">
                        {u.linked_student ? `${u.linked_student.nama} (${u.linked_student.kelas || '-'})` : '—'}
                      </td>
                      <td className="px-3 py-2"><Badge className={u.status === 'aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{u.status}</Badge></td>
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
        </>
      )}

      {/* ── Guru / Siswa sub-tabs ─────────────────────────────────────────────── */}
      {(subTab === 'guru' || subTab === 'siswa') && (
        <>
          {subTab === 'guru' && (
            <p className="text-xs text-muted-foreground">Username login guru = <strong>NIP</strong> · Password default: <code>SMKN2Cimahi!</code></p>
          )}
          {subTab === 'siswa' && (
            <p className="text-xs text-muted-foreground">Username login siswa = <strong>NISN</strong> · Password default: <code>SMKN2Cimahi_Istimewa!</code></p>
          )}
          {detailLoading ? <TableSkeleton cols={[16, 140, 90, 120, 80, 70, 90, 80, 40]} rows={8} /> : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <Th label="#" />
                    <Th label="Nama" />
                    {subTab === 'guru' ? <Th label="NIP" /> : <Th label="NISN" />}
                    {subTab === 'guru' ? <Th label="Mapel" /> : <Th label="Kelas" />}
                    <Th label="Peran" />
                    <Th label="Status" />
                    <Th label="Login Terakhir" />
                    <Th label="IP" />
                    <Th label="" />
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((u: any, i: number) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">
                        <div className="flex items-center gap-1.5">
                          {u.online && <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" title="Online" />}
                          {u.nama}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono">{subTab === 'guru' ? (u.nip || '—') : (u.nisn || '—')}</td>
                      <td className="px-3 py-2 text-muted-foreground">{subTab === 'guru' ? (u.mapel_utama || '—') : (u.kelas || '—')}</td>
                      <td className="px-3 py-2"><Badge className={roleColor[u.role] || 'bg-gray-100 text-gray-700'}>{u.role.replace(/_/g, ' ')}</Badge></td>
                      <td className="px-3 py-2">
                        <Badge className={u.status === 'aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{u.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{u.last_login || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground font-mono">{u.ip_address || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button title="Reset Password" onClick={() => openResetPw(u)}
                            className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground">
                            <Key className="h-3.5 w-3.5" />
                          </button>
                          <button title={u.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                            onClick={() => window.confirm(`${u.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'} ${u.nama}?`) && toggleStatus.mutate(u.id)}
                            className={cn('rounded p-1', u.status === 'aktif' ? 'hover:bg-red-100 text-red-600' : 'hover:bg-green-100 text-green-600')}>
                            {u.status === 'aktif' ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {detailRows.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada data</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Modal Tambah/Edit Pengguna (admin tab) ───────────────────────────── */}
      {modal === 'add' || modal === 'edit' ? (
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
                  <option key={s.id} value={s.id}>{s.nama} ({s.nis}){s.kelas ? ` — ${s.kelas.label}` : ''}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="No. HP (opsional)">
            <input className={inputCls} placeholder="08123456789" value={form.nomor_hp} onChange={e => setForm(f => ({ ...f, nomor_hp: e.target.value }))} />
          </Field>
          <Field label={modal === 'add' ? 'Password (default: password)' : 'Password baru (kosongkan jika tidak diubah)'}>
            <PasswordInput className={inputCls} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
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
      ) : modal === 'reset-pw' ? (
        <Modal title={`Reset Password — ${selected?.nama}`} onClose={() => setModal(null)}>
          <Field label="Password Baru">
            <PasswordInput className={inputCls} placeholder="Min. 8 karakter" value={resetPw}
              onChange={e => setResetPw(e.target.value)} />
          </Field>
          {err && <ErrMsg msg={err} />}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Batal</Button>
            <Button size="sm" disabled={doResetPw.isPending || resetPw.length < 8}
              onClick={() => selected && doResetPw.mutate({ uuid: selected.id, password: resetPw })}>
              {doResetPw.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              Reset Password
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: TAHUN AJARAN
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_PEJABAT_FORM = {
  wk_kurikulum_gelar_depan: '', wk_kurikulum_nama: '', wk_kurikulum_gelar_belakang: '', wk_kurikulum_nip: '',
  kepala_sekolah_gelar_depan: '', kepala_sekolah_nama: '', kepala_sekolah_gelar_belakang: '', kepala_sekolah_nip: '',
}

function TahunAjaranTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'add' | 'edit' | 'pejabat' | null>(null)
  const [selected, setSelected] = useState<AdminAcademicYear | null>(null)
  const [form, setForm] = useState({ tahun: '', semester: 'ganjil', tanggal_mulai: '', tanggal_selesai: '' })
  const [pejabatForm, setPejabatForm] = useState(EMPTY_PEJABAT_FORM)
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
    setForm({ tahun: '', semester: 'ganjil', tanggal_mulai: '', tanggal_selesai: '' })
    setModal('add')
  }
  function openEdit(y: AdminAcademicYear) {
    setSelected(y); setErr('')
    setForm({ tahun: y.tahun, semester: y.semester, tanggal_mulai: y.tanggal_mulai ?? '', tanggal_selesai: y.tanggal_selesai ?? '' })
    setModal('edit')
  }
  function openPejabat(y: AdminAcademicYear) {
    setSelected(y); setErr('')
    setPejabatForm({
      wk_kurikulum_gelar_depan: y.wk_kurikulum_gelar_depan ?? '',
      wk_kurikulum_nama: y.wk_kurikulum_nama ?? '',
      wk_kurikulum_gelar_belakang: y.wk_kurikulum_gelar_belakang ?? '',
      wk_kurikulum_nip: y.wk_kurikulum_nip ?? '',
      kepala_sekolah_gelar_depan: y.kepala_sekolah_gelar_depan ?? '',
      kepala_sekolah_nama: y.kepala_sekolah_nama ?? '',
      kepala_sekolah_gelar_belakang: y.kepala_sekolah_gelar_belakang ?? '',
      kepala_sekolah_nip: y.kepala_sekolah_nip ?? '',
    })
    setModal('pejabat')
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

      {isLoading ? <TableSkeleton cols={[100, 80, 140, 80, 40]} rows={4} /> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <SortTh label="Tahun Ajaran" col="tahun" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Semester" col="semester" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Tanggal Semester" />
                <SortTh label="Status" col="aktif" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th label="" />
              </tr>
            </thead>
            <tbody>
              {rows.map(y => (
                <tr key={y.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{y.tahun}</td>
                  <td className="px-3 py-2 text-muted-foreground capitalize">{y.semester}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {y.tanggal_mulai && y.tanggal_selesai
                      ? `${y.tanggal_mulai} – ${y.tanggal_selesai}`
                      : <span className="text-amber-600">Belum diisi</span>}
                  </td>
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
                      <button onClick={() => openEdit(y)} className="rounded p-1 hover:bg-accent" title="Edit Tahun Ajaran"><Pencil className="h-3.5 w-3.5" /></button>
                      <button
                        onClick={() => openPejabat(y)}
                        title="Identitas Wk. Kurikulum & Kepala Sekolah"
                        className="flex items-center gap-1 rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200 transition-colors"
                      >
                        <Users className="h-3.5 w-3.5" />
                        Edit Pejabat
                      </button>
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
              {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada data</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {(modal === 'add' || modal === 'edit') && (
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tanggal Mulai Semester">
              <input
                type="date"
                className={inputCls}
                value={form.tanggal_mulai}
                onChange={e => setForm(f => ({ ...f, tanggal_mulai: e.target.value }))}
              />
            </Field>
            <Field label="Tanggal Selesai Semester">
              <input
                type="date"
                className={inputCls}
                value={form.tanggal_selesai}
                onChange={e => setForm(f => ({ ...f, tanggal_selesai: e.target.value }))}
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground -mt-2 mb-2">
            Dipakai untuk menghitung Minggu/Hari Efektif — boleh dikosongkan dulu dan diisi/diedit belakangan.
          </p>
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

      {modal === 'pejabat' && selected && (
        <Modal title={`Identitas Pejabat — ${selected.tahun} ${selected.semester}`} onClose={() => setModal(null)}>
          <p className="text-xs text-muted-foreground mb-3">
            Dipakai sebagai penanda tangan laporan Minggu Efektif (Per Kelas &amp; Umum). Boleh
            beda orang tiap semester, dan boleh dikosongkan kalau belum tahu siapa yang menjabat.
          </p>

          <p className="text-xs font-semibold mb-2">Wk. Kurikulum</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="Gelar Depan">
              <input className={inputCls} placeholder="mis. Drs." value={pejabatForm.wk_kurikulum_gelar_depan}
                onChange={e => setPejabatForm(f => ({ ...f, wk_kurikulum_gelar_depan: e.target.value }))} />
            </Field>
            <Field label="Gelar Belakang">
              <input className={inputCls} placeholder="mis. S.Pd., M.T." value={pejabatForm.wk_kurikulum_gelar_belakang}
                onChange={e => setPejabatForm(f => ({ ...f, wk_kurikulum_gelar_belakang: e.target.value }))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Field label="Nama">
              <input className={inputCls} value={pejabatForm.wk_kurikulum_nama}
                onChange={e => setPejabatForm(f => ({ ...f, wk_kurikulum_nama: e.target.value }))} />
            </Field>
            <Field label="NIP">
              <input className={inputCls} value={pejabatForm.wk_kurikulum_nip}
                onChange={e => setPejabatForm(f => ({ ...f, wk_kurikulum_nip: e.target.value }))} />
            </Field>
          </div>

          <p className="text-xs font-semibold mb-2">Kepala Sekolah</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="Gelar Depan">
              <input className={inputCls} placeholder="mis. Drs." value={pejabatForm.kepala_sekolah_gelar_depan}
                onChange={e => setPejabatForm(f => ({ ...f, kepala_sekolah_gelar_depan: e.target.value }))} />
            </Field>
            <Field label="Gelar Belakang">
              <input className={inputCls} placeholder="mis. S.Pd., M.M." value={pejabatForm.kepala_sekolah_gelar_belakang}
                onChange={e => setPejabatForm(f => ({ ...f, kepala_sekolah_gelar_belakang: e.target.value }))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nama">
              <input className={inputCls} value={pejabatForm.kepala_sekolah_nama}
                onChange={e => setPejabatForm(f => ({ ...f, kepala_sekolah_nama: e.target.value }))} />
            </Field>
            <Field label="NIP">
              <input className={inputCls} value={pejabatForm.kepala_sekolah_nip}
                onChange={e => setPejabatForm(f => ({ ...f, kepala_sekolah_nip: e.target.value }))} />
            </Field>
          </div>

          {err && <ErrMsg msg={err} />}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Batal</Button>
            <Button size="sm" onClick={() => save.mutate(pejabatForm)} disabled={save.isPending}>
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
// NILAI MANUAL TAB
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_MN_LABEL: Record<string, string> = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' }
const STATUS_MN_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

function CatatanManualTab() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [page, setPage] = useState(1)
  const [reviewModal, setReviewModal] = useState<AdminManualNote | null>(null)
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'adjust'>('approve')
  const [reviewNilai, setReviewNilai] = useState('')
  const [reviewCatatan, setReviewCatatan] = useState('')
  const [reviewErr, setReviewErr] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-manual-notes', statusFilter, page],
    queryFn: () => adminApi.getManualNotes({ status: statusFilter === 'all' ? undefined : statusFilter, page }),
    placeholderData: (prev) => prev,
  })
  const notes = data?.data ?? []
  const meta  = data?.meta

  const review = useMutation({
    mutationFn: () => adminApi.reviewManualNote(reviewModal!.uuid, {
      action: reviewAction,
      nilai_final: reviewAction !== 'reject' && reviewNilai !== '' ? parseInt(reviewNilai) : null,
      admin_catatan: reviewCatatan || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-manual-notes'] })
      setReviewModal(null); setReviewNilai(''); setReviewCatatan(''); setReviewErr('')
    },
    onError: (e: any) => setReviewErr(e.response?.data?.message ?? 'Gagal'),
  })

  const pendingCount = statusFilter === 'pending' ? meta?.total : undefined

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Nilai Manual Karakter</h2>
          {pendingCount !== undefined && pendingCount > 0 && (
            <span className="rounded-full bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 font-medium">{pendingCount} menunggu</span>
          )}
        </div>
        <div className="flex gap-1">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
              className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${statusFilter === s ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
              {s === 'all' ? 'Semua' : STATUS_MN_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="px-3 py-2 font-medium">Siswa</th>
              <th className="px-3 py-2 font-medium">Guru</th>
              <th className="px-3 py-2 font-medium">Catatan</th>
              <th className="px-3 py-2 font-medium text-right">Nilai</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Tanggal</th>
              <th className="px-3 py-2 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-8"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            )}
            {!isLoading && notes.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">Tidak ada data.</td></tr>
            )}
            {notes.map(n => (
              <tr key={n.id} className="border-t hover:bg-muted/20">
                <td className="px-3 py-2">
                  <p className="font-medium">{n.student.nama}</p>
                  <p className="text-xs text-muted-foreground">{n.student.nis} · {n.student.kelas ?? '—'}</p>
                </td>
                <td className="px-3 py-2 text-xs">{n.teacher.nama}</td>
                <td className="px-3 py-2 max-w-xs">
                  <p className="text-xs line-clamp-2">{n.catatan}</p>
                </td>
                <td className="px-3 py-2 text-right">
                  {n.nilai !== null ? (
                    <span className={n.nilai >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                      {n.nilai >= 0 ? '+' : ''}{n.nilai}
                    </span>
                  ) : <span className="text-muted-foreground">—</span>}
                  {n.status === 'approved' && n.nilai_final !== null && n.nilai_final !== n.nilai && (
                    <span className="block text-xs text-green-600">final: {n.nilai_final >= 0 ? '+' : ''}{n.nilai_final}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_MN_COLOR[n.status]}`}>
                    {STATUS_MN_LABEL[n.status]}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{n.created_at?.slice(0, 10)}</td>
                <td className="px-3 py-2">
                  {n.status === 'pending' && (
                    <button onClick={() => { setReviewModal(n); setReviewAction('approve'); setReviewNilai(n.nilai?.toString() ?? ''); setReviewCatatan(''); setReviewErr('') }}
                      className="text-xs text-primary-600 hover:underline">
                      Review
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Hal {meta.current_page} / {meta.last_page}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</Button>
            <Button size="sm" variant="outline" disabled={page === meta.last_page} onClick={() => setPage(p => p + 1)}>›</Button>
          </div>
        </div>
      )}

      {/* Review modal */}
      {reviewModal && (
        <Modal title="Review Catatan Manual" onClose={() => setReviewModal(null)}>
          <div className="space-y-3">
            <p className="text-sm"><strong>{reviewModal.student.nama}</strong> · {reviewModal.teacher.nama}</p>
            <p className="text-sm bg-muted/40 rounded p-2">{reviewModal.catatan}</p>
            <div className="flex gap-2">
              {(['approve', 'reject', 'adjust'] as const).map(a => (
                <button key={a} onClick={() => setReviewAction(a)}
                  className={`flex-1 py-1.5 rounded-md border text-xs font-medium transition-colors ${reviewAction === a ? 'bg-primary text-white border-primary' : 'border-border hover:bg-muted'}`}>
                  {a === 'approve' ? 'Setujui' : a === 'reject' ? 'Tolak' : 'Sesuaikan'}
                </button>
              ))}
            </div>
            {reviewAction !== 'reject' && (
              <Field label="Nilai Final (opsional, -20 s.d. +20)">
                <input type="number" min="-20" max="20" value={reviewNilai} onChange={e => setReviewNilai(e.target.value)} className={inputCls} placeholder="Kosongkan jika tidak ada nilai" />
              </Field>
            )}
            <Field label="Catatan Admin (opsional)">
              <input value={reviewCatatan} onChange={e => setReviewCatatan(e.target.value)} className={inputCls} placeholder="Alasan penolakan / penyesuaian..." />
            </Field>
            {reviewErr && <ErrMsg msg={reviewErr} />}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setReviewModal(null)}>Batal</Button>
              <Button size="sm" onClick={() => review.mutate()} disabled={review.isPending}>
                {review.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Simpan
              </Button>
            </div>
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
  const qc = useQueryClient()

  // Ganti tab kembali ke atas — kalau tab sebelumnya panjang (scroll turun) dan tab
  // baru masih memuat/kosong, tanpa ini area yang terlihat jadi kosong sampai user
  // sadar harus scroll naik sendiri (terkesan blank/freeze).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [activeTab])

  // Prefetch data ringan yang dipakai banyak tab — mount langsung
  useEffect(() => {
    qc.prefetchQuery({ queryKey: ['admin-classes'],        queryFn: adminApi.getClasses })
    qc.prefetchQuery({ queryKey: ['admin-students', '', '', 1, 25 as PerPageOpt], queryFn: () => adminApi.getStudents({ page: 1, per_page: 25 }) })
  }, [qc])

  // Prefetch on hover — data diambil saat user bergerak ke arah tab sebelum klik
  function prefetchTab(index: number) {
    switch (index) {
      case 0: // Guru
        qc.prefetchQuery({ queryKey: ['admin-teachers', '', 1, 25 as PerPageOpt], queryFn: () => adminApi.getTeachers({ page: 1, per_page: 25 }) })
        break
      case 1: // Siswa
        qc.prefetchQuery({ queryKey: ['admin-students', '', '', 1, 25 as PerPageOpt], queryFn: () => adminApi.getStudents({ page: 1, per_page: 25 }) })
        break
      case 2: // Kelas
        qc.prefetchQuery({ queryKey: ['admin-classes'], queryFn: adminApi.getClasses })
        qc.prefetchQuery({ queryKey: ['admin-teachers', 'all'], queryFn: () => adminApi.getTeachers({ per_page: 'all' }) })
        break
      case 3: // Mapel
        qc.prefetchQuery({ queryKey: ['admin-subjects'], queryFn: adminApi.getSubjects })
        break
      case 4: // Jadwal
        qc.prefetchQuery({ queryKey: ['admin-classes'],             queryFn: adminApi.getClasses })
        qc.prefetchQuery({ queryKey: ['admin-subjects'],            queryFn: adminApi.getSubjects })
        qc.prefetchQuery({ queryKey: ['admin-teachers', 'all'],    queryFn: () => adminApi.getTeachers({ per_page: 'all' }) })
        qc.prefetchQuery({ queryKey: ['admin-schedules', '', '', '', 1, 25 as PerPageOpt], queryFn: () => adminApi.getSchedules({ page: 1, per_page: 25 }) })
        break
      case 5: // Karakter
        qc.prefetchQuery({ queryKey: ['admin-char-cats'], queryFn: adminApi.getCharacterCategories })
        qc.prefetchQuery({ queryKey: ['admin-char-subs'], queryFn: () => adminApi.getCharacterSubitems() })
        break
      case 6: // Ambang
        qc.prefetchQuery({ queryKey: ['admin-thresholds'], queryFn: adminApi.getThresholds })
        break
      case 7: // Pengguna
        qc.prefetchQuery({ queryKey: ['admin-users'], queryFn: () => adminApi.getAdminUsers() })
        break
      case 10: // Nilai Manual
        qc.prefetchQuery({ queryKey: ['admin-manual-notes', 'all', 1], queryFn: () => adminApi.getManualNotes({ page: 1 }) })
        break
    }
  }

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
            onMouseEnter={() => prefetchTab(i)}
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
        {activeTab === 9 && <AscXmlImportTab onGoToTahunAjaran={() => setActiveTab(8)} />}
        {activeTab === 10 && <CatatanManualTab />}
        {activeTab === 11 && <KalenderAdminTab />}
        {activeTab === 12 && <BackupRestoreTab />}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT DATA TAB  (aSc XML + Dapodik Guru + Dapodik Siswa)
// ─────────────────────────────────────────────────────────────────────────────

type SimpleStats = { created: number; updated: number; skipped: number }
type PendingMatch = { key: string; nama_baru: string; matched_nama: string; matched_uuid: string }

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
  headerAction,
  onSuccess: onSuccessProp,
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
  headerAction?: React.ReactNode
  onSuccess?: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile]         = useState<File | null>(null)
  const [result, setResult]     = useState<Record<string, SimpleStats> | null>(null)
  const [rowErrors, setRowErrors] = useState<string[]>([])
  const [error, setError]       = useState<string | null>(null)
  const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([])
  const [decisions, setDecisions] = useState<Record<string, 'merge' | 'create'>>({})

  const mutation = useMutation({
    mutationFn: async ({ f, decisions: d }: { f: File; decisions?: Record<string, string> }) => {
      const form = new FormData()
      form.append('file', f)
      if (d && Object.keys(d).length > 0) form.append('decisions', JSON.stringify(d))
      const resp = await api.post<{ message: string; data: Record<string, SimpleStats>; errors?: string[]; pending_matches?: PendingMatch[] }>(
        endpoint,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      return resp.data
    },
    onSuccess: (data) => {
      setResult(data.data); setRowErrors(data.errors ?? []); setError(null)
      setPendingMatches(data.pending_matches ?? [])
      onSuccessProp?.()
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? err?.message ?? 'Terjadi kesalahan.')
      setResult(null); setRowErrors([]); setPendingMatches([])
    },
  })

  function reset() {
    setFile(null); setResult(null); setRowErrors([]); setError(null)
    setPendingMatches([]); setDecisions({})
    if (fileRef.current) fileRef.current.value = ''
  }

  const allDecided = pendingMatches.length > 0 && pendingMatches.every((p) => decisions[p.key])

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
        {headerAction && <div className="shrink-0">{headerAction}</div>}
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

      {/* Baris yang gagal/dilewati */}
      {rowErrors.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <AlertCircle className="h-3.5 w-3.5" /> {rowErrors.length} baris dilewati / gagal
          </div>
          <ul className="max-h-40 overflow-y-auto text-xs text-amber-800 space-y-0.5 pl-1">
            {rowErrors.map((e, i) => <li key={i} className="flex gap-1.5"><span className="shrink-0">•</span>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Guru yang perlu dikonfirmasi — cocok cuma karena ejaan mirip, BELUM diterapkan */}
      {pendingMatches.length > 0 && (
        <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2.5 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
            <AlertCircle className="h-3.5 w-3.5" /> {pendingMatches.length} guru perlu dikonfirmasi sebelum dilanjutkan
          </div>
          <p className="text-xs text-blue-800">
            Nama di file tidak sama persis dengan akun yang sudah ada. Pastikan dulu ini orang yang sama atau bukan —
            baris ini BELUM diproses sampai Anda pilih salah satu.
          </p>
          <div className="space-y-2">
            {pendingMatches.map((p) => (
              <div key={p.key} className="rounded bg-white border border-blue-200 px-3 py-2 space-y-1.5">
                <p className="text-xs">
                  <span className="font-medium">'{p.nama_baru}'</span> mirip dengan akun yang sudah ada:{' '}
                  <span className="font-medium">'{p.matched_nama}'</span>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDecisions((d) => ({ ...d, [p.key]: 'merge' }))}
                    className={cn(
                      'rounded px-2.5 py-1 text-xs font-medium border transition-colors',
                      decisions[p.key] === 'merge'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'border-input hover:bg-muted',
                    )}
                  >
                    Ya, orang yang sama
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisions((d) => ({ ...d, [p.key]: 'create' }))}
                    className={cn(
                      'rounded px-2.5 py-1 text-xs font-medium border transition-colors',
                      decisions[p.key] === 'create'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'border-input hover:bg-muted',
                    )}
                  >
                    Bukan, orang berbeda
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!file || mutation.isPending || (pendingMatches.length > 0 && !allDecided)}
          onClick={() => file && mutation.mutate({ f: file, decisions })}
          className="inline-flex items-center gap-1.5 rounded bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {mutation.isPending
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Mengimport...</>
            : pendingMatches.length > 0
              ? <><Upload className="h-3.5 w-3.5" />Lanjutkan Import</>
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

function AscXmlImportTab({ onGoToTahunAjaran }: { onGoToTahunAjaran: () => void }) {
  const qc = useQueryClient()

  const { data: years, isLoading: yearsLoading } = useQuery({
    queryKey: ['admin-academic-years'],
    queryFn: () => adminApi.getAcademicYears(),
  })
  const hasActiveYear = !!years?.some((y) => y.aktif)

  if (!yearsLoading && !hasActiveYear) {
    return (
      <div className="max-w-2xl">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-amber-900">Belum ada Tahun Ajaran aktif</h2>
              <p className="text-sm text-amber-800 mt-1">
                Semua import di halaman ini butuh Tahun Ajaran aktif (jadwal, kelas, dan siswa terikat ke tahun
                ajaran tersebut). Buat atau aktifkan salah satu tahun ajaran dulu sebelum mulai import.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={onGoToTahunAjaran}>Buka Tahun Ajaran</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-base font-semibold mb-1">Import Data</h2>
        <p className="text-sm text-muted-foreground">
          Tiga sumber import yang saling melengkapi. Urutan disarankan: <strong>1 → 2 → 3</strong>.
        </p>
      </div>

      {/* Langkah 1: Format Import Data Guru — sumber utama identitas guru */}
      <ImportCard
        title="1. Daftar Guru (Format Import Data Guru)"
        badge="Data Guru Utama"
        badgeColor="bg-blue-100 text-blue-700"
        description="Langkah pertama. Sumber utama identitas guru — NIP, NUPTK, dan data pribadi Dapodik. Satu file Excel berisi 3 sheet: Daftar Guru, Wali Kelas, dan Data Program Keahlian."
        bullets={[
          'Sheet "Daftar Guru" — cocokkan guru yang sudah ada lewat NIP → NUPTK → nama; sisanya dibuat baru',
          'Kolom "Jenis PTK" = Guru BK otomatis mengaktifkan menu khusus BK',
          'Sheet "Wali Kelas" — assign wali kelas per kelas (cocokkan lewat NIP, fallback nama)',
          'Sheet "Data Program Keahlian" — disimpan sebagai data referensi program keahlian',
          'Baris yang gagal dicocokkan dilaporkan satu per satu, baris lain tetap diproses',
        ]}
        warning={`Format file: "Format Import Data Guru.xlsx" — header baris 3 (Daftar Guru & Wali Kelas) / baris 2 (Data Program Keahlian). Sheet "Wali Kelas" butuh data Kelas yang baru dibuat di langkah 2 (XML) — kalau baris wali kelas gagal karena kelas belum ada, upload ulang file ini setelah langkah 2 selesai.`}
        accept=".xlsx,.xls"
        endpoint="/admin/import/dapodik-guru"
        resultLabels={['Program Keahlian', 'Guru', 'Wali Kelas']}
        icon={<Users className="h-8 w-8 text-blue-500" />}
        headerAction={
          <button
            type="button"
            onClick={() => adminApi.downloadDapodikGuruTemplate()}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline shrink-0"
          >
            <Download className="h-3.5 w-3.5" /> Download Format
          </button>
        }
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['admin-teachers'] })
          qc.invalidateQueries({ queryKey: ['admin-classes'] })
        }}
      />

      {/* Langkah 2: aSc XML — melengkapi jadwal, gelar, dan mapel yang diampu */}
      <ImportCard
        title="2. aSc Timetables XML"
        badge="Lengkapi Jadwal & Gelar"
        badgeColor="bg-purple-100 text-purple-700"
        description="Melengkapi data guru dari langkah 1 dengan jadwal mengajar, gelar, dan mata pelajaran yang diampu. Juga membuat data kelas & mata pelajaran dari file ekspor aSc."
        bullets={[
          'Mata pelajaran — nama, kode, kelompok',
          'Guru — dicocokkan ke akun dari langkah 1 lewat nama (fallback: ejaan mirip); dilengkapi gelar & mapel utama kalau belum ada',
          'Kelas — tingkat, jurusan, rombel untuk tahun ajaran aktif',
          'Jadwal — hari, jam, guru, kelas, mapel (750+ jadwal sekaligus)',
        ]}
        warning="Pastikan sudah ada Tahun Ajaran aktif sebelum import. Guru yang belum ada di langkah 1 akan tetap dibuat otomatis (tanpa NIP)."
        accept=".xml,application/xml,text/xml"
        endpoint="/admin/import/asc-xml"
        resultLabels={['Mata Pelajaran', 'Guru', 'Kelas', 'Jadwal']}
        icon={<FileCode2 className="h-8 w-8 text-purple-500" />}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['admin-classes'] })
          qc.invalidateQueries({ queryKey: ['admin-teachers'] })
          qc.invalidateQueries({ queryKey: ['admin-subjects'] })
          qc.invalidateQueries({ queryKey: ['admin-schedules'] })
        }}
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
        accept=".xlsx,.xls"
        endpoint="/admin/import/dapodik-siswa"
        resultLabels={['Siswa']}
        icon={<Users className="h-8 w-8 text-green-500" />}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['admin-students'] })
          qc.invalidateQueries({ queryKey: ['admin-classes'] }) // kelas baru bisa terbuat otomatis
        }}
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

// ─────────────────────────────────────────────────────────────────────────────
// KALENDER ADMIN TAB
// ─────────────────────────────────────────────────────────────────────────────
function KalenderAdminTab() {
  const qc = useQueryClient()
  const [syncMethod, setSyncMethod] = useState<'ics' | 'api_key' | 'service_account'>('ics')
  const [icsUrl, setIcsUrl]         = useState('')
  const [apiKey, setApiKey]         = useState('')
  const [calId, setCalId]           = useState('')
  const [syncAhead, setSyncAhead]   = useState(6)
  const [credFile, setCredFile]     = useState<File | null>(null)
  const [nedYear, setNedYear]       = useState(new Date().getFullYear())
  const [nedMonth, setNedMonth]     = useState(new Date().getMonth() + 1)
  const [nedFullYear, setNedFullYear] = useState(false)
  const [msg, setMsg]               = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const credRef = useRef<HTMLInputElement>(null)

  const { data: settings, isLoading: settingsLoading } = useQuery<{
    sync_method: 'ics' | 'api_key' | 'service_account'; ics_url: string | null
    api_key: string | null; calendar_id: string | null; has_credentials: boolean
    last_synced_at: string | null; sync_months_ahead: number
  }>({
    queryKey: ['admin-calendar-settings'],
    queryFn: () => api.get('/admin/calendar/settings').then(r => r.data),
  })

  const { data: nedData, isLoading: nedLoading } = useQuery<{ data: { id: number; tanggal: string; status: string; keterangan: string | null; event_title: string | null }[] }>({
    queryKey: ['admin-ned', nedYear, nedMonth],
    queryFn: () => api.get(`/admin/non-effective-days?year=${nedYear}&month=${nedMonth}`).then(r => r.data),
  })

  useEffect(() => {
    if (settings) {
      setSyncMethod(settings.sync_method ?? 'ics')
      setIcsUrl(settings.ics_url ?? '')
      setApiKey(settings.api_key ?? '')
      setCalId(settings.calendar_id ?? '')
      setSyncAhead(settings.sync_months_ahead)
    }
  }, [settings])

  const saveSettingsMut = useMutation({
    mutationFn: () => api.post('/admin/calendar/settings', {
      sync_method: syncMethod,
      ics_url: icsUrl || null,
      api_key: apiKey || null,
      calendar_id: calId || null,
      sync_months_ahead: syncAhead,
    }).then(r => r.data),
    onSuccess: (d) => { setMsg({ type: 'ok', text: d.message }); qc.invalidateQueries({ queryKey: ['admin-calendar-settings'] }) },
    onError: (e: any) => setMsg({ type: 'err', text: e.response?.data?.message ?? 'Gagal.' }),
  })

  const uploadCredMut = useMutation({
    mutationFn: () => {
      if (!credFile) throw new Error('Pilih file JSON')
      const form = new FormData(); form.append('file', credFile)
      return api.post('/admin/calendar/upload-credentials', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
    },
    onSuccess: (d) => { setMsg({ type: 'ok', text: d.message }); setCredFile(null); qc.invalidateQueries({ queryKey: ['admin-calendar-settings'] }) },
    onError: (e: any) => setMsg({ type: 'err', text: e.response?.data?.message ?? 'Upload gagal.' }),
  })

  const syncMut = useMutation({
    mutationFn: () => api.post('/admin/calendar/sync').then(r => r.data),
    onSuccess: (d) => { setMsg({ type: 'ok', text: d.message }); qc.invalidateQueries({ queryKey: ['calendar-events'] }) },
    onError: (e: any) => setMsg({ type: 'err', text: e.response?.data?.message ?? 'Sync gagal.' }),
  })

  const delNedMut = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/non-effective-days/${id}`).then(r => r.data),
    // "calendar-events" dipakai oleh halaman /kalender (terpisah dari tab admin ini) — tanpa
    // invalidate ini, perubahan hari tidak efektif tidak langsung kelihatan di sana.
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-ned'] }); qc.invalidateQueries({ queryKey: ['calendar-events'] }) },
  })

  const importNedRef = useRef<HTMLInputElement>(null)
  const [nedImportResult, setNedImportResult] = useState<{
    inserted: number; updated: number; reverted: number; errors: string[]
  } | null>(null)
  const importNedMut = useMutation({
    mutationFn: (f: File) => {
      const form = new FormData(); form.append('file', f)
      return api.post('/admin/non-effective-days/import', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
    },
    onSuccess: (d) => {
      setMsg({ type: 'ok', text: d.message })
      setNedImportResult({ inserted: d.inserted ?? 0, updated: d.updated ?? 0, reverted: d.reverted ?? 0, errors: d.errors ?? [] })
      qc.invalidateQueries({ queryKey: ['admin-ned'] })
      qc.invalidateQueries({ queryKey: ['calendar-events'] })
    },
    onError: (e: any) => {
      setMsg({ type: 'err', text: e.response?.data?.message ?? 'Import gagal.' })
      setNedImportResult(null)
    },
  })

  const autoMarkMut = useMutation({
    mutationFn: () => api.post('/admin/non-effective-days/auto-mark').then(r => r.data),
    onSuccess: (d) => {
      setMsg({ type: 'ok', text: d.message })
      qc.invalidateQueries({ queryKey: ['admin-ned'] })
      qc.invalidateQueries({ queryKey: ['calendar-events'] })
    },
    onError: (e: any) => setMsg({ type: 'err', text: e.response?.data?.message ?? 'Gagal.' }),
  })

  async function downloadTemplate() {
    const params = nedFullYear ? `year=${nedYear}` : `year=${nedYear}&month=${nedMonth}`
    const resp = await api.get(`/admin/non-effective-days/template?${params}`, { responseType: 'blob' })
    const url  = URL.createObjectURL(resp.data)
    const a    = document.createElement('a'); a.href = url
    a.download = nedFullYear ? `template_hari_tidak_efektif_${nedYear}.xlsx` : `template_hari_tidak_efektif_${nedYear}_${nedMonth}.xlsx`
    a.click(); URL.revokeObjectURL(url)
  }

  const canSync = syncMethod === 'ics' ? !!icsUrl
    : syncMethod === 'api_key' ? (!!apiKey && !!calId)
    : settings?.has_credentials

  return (
    <div className="space-y-6 max-w-2xl">
      {msg && (
        <div className={`rounded-md border px-3 py-2 text-sm flex items-center justify-between ${msg.type === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Settings */}
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" /> Pengaturan Kalender</h3>

        {settingsLoading ? <div className="h-20 animate-pulse bg-muted rounded" /> : (
          <>
            {/* Method selector */}
            <div>
              <label className="text-xs font-medium block mb-2">Metode Sinkronisasi</label>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setSyncMethod('ics')}
                  className={`rounded-lg border p-2.5 text-left transition-colors ${syncMethod === 'ics' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                  <div className="font-medium text-xs">ICS Feed URL</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Paling mudah, tapi detail event mungkin tidak muncul</div>
                </button>
                <button onClick={() => setSyncMethod('api_key')}
                  className={`rounded-lg border p-2.5 text-left transition-colors ${syncMethod === 'api_key' ? 'border-green-500 bg-green-50' : 'border-border hover:bg-muted/50'}`}>
                  <div className="font-medium text-xs text-green-700">API Key ✓ Rekomendasi</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Detail event lengkap, setup mudah</div>
                </button>
                <button onClick={() => setSyncMethod('service_account')}
                  className={`rounded-lg border p-2.5 text-left transition-colors ${syncMethod === 'service_account' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                  <div className="font-medium text-xs">Service Account</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Setup paling rumit, untuk private calendar</div>
                </button>
              </div>
            </div>

            {/* ICS Method */}
            {syncMethod === 'ics' && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 space-y-3">
                <div>
                  <label className="text-xs font-medium block mb-1">ICS Feed URL</label>
                  <input
                    className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-white"
                    placeholder="https://calendar.google.com/calendar/ical/...@.../basic.ics"
                    value={icsUrl}
                    onChange={e => setIcsUrl(e.target.value)}
                  />
                  <p className="text-xs text-amber-700 mt-1">
                    ⚠️ Google Workspace menyembunyikan detail event — event akan muncul sebagai "Busy". Gunakan metode <strong>API Key</strong> agar detail event muncul.
                    URL: Google Calendar → Settings → Integrate calendar → <strong>Public/Secret address in iCal format</strong>
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Sinkronisasi ke depan (bulan)</label>
                  <input type="number" min={1} max={24}
                    className="w-24 rounded-md border border-input px-3 py-2 text-sm bg-white focus:outline-none"
                    value={syncAhead} onChange={e => setSyncAhead(Number(e.target.value))} />
                </div>
              </div>
            )}

            {/* API Key Method - REKOMENDASI */}
            {syncMethod === 'api_key' && (
              <div className="rounded-md bg-green-50 border border-green-200 p-3 space-y-3">
                <div className="rounded-md bg-green-100 border border-green-300 p-2.5">
                  <p className="text-xs font-semibold text-green-800 mb-1">Cara mendapatkan API Key (5 menit):</p>
                  <ol className="text-xs text-green-700 space-y-0.5 list-decimal list-inside">
                    <li>Buka <strong>console.cloud.google.com</strong></li>
                    <li>Buat project baru (mis. "Kalender Sekolah")</li>
                    <li>Library → cari "Google Calendar API" → Enable</li>
                    <li>Credentials → + Create Credentials → <strong>API Key</strong></li>
                    <li>Copy API Key dan paste di bawah</li>
                    <li>Pastikan kalender Google <strong>dibagikan ke publik</strong> (Settings → Access permissions → Make available to public)</li>
                  </ol>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Google Calendar API Key</label>
                  <PasswordInput
                    className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-white"
                    placeholder="AIzaSy..."
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Calendar ID</label>
                  <input
                    className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-white"
                    placeholder="mis. kurikulum@smkn2cmi.sch.id atau xxxxx@group.calendar.google.com"
                    value={calId}
                    onChange={e => setCalId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Dapatkan di: Google Calendar → Settings → Integrate calendar → <strong>Calendar ID</strong>
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Sinkronisasi ke depan (bulan)</label>
                  <input type="number" min={1} max={24}
                    className="w-24 rounded-md border border-input px-3 py-2 text-sm bg-white focus:outline-none"
                    value={syncAhead} onChange={e => setSyncAhead(Number(e.target.value))} />
                </div>
              </div>
            )}

            {/* Service Account Method */}
            {syncMethod === 'service_account' && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 space-y-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Calendar ID</label>
                  <input className="w-full rounded-md border border-input px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="mis. kurikulum@smkn2cmi.sch.id"
                    value={calId} onChange={e => setCalId(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Sinkronisasi ke depan (bulan)</label>
                  <input type="number" min={1} max={24}
                    className="w-24 rounded-md border border-input px-3 py-2 text-sm bg-white focus:outline-none"
                    value={syncAhead} onChange={e => setSyncAhead(Number(e.target.value))} />
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Service Account JSON</p>
                  <p className="text-xs text-amber-700 mb-2">
                    Butuh Google Cloud Console → Service Account → download key JSON. Lebih lengkap dari ICS tapi setup lebih rumit.
                    {settings?.last_synced_at && ` Terakhir sync: ${settings.last_synced_at}.`}
                  </p>
                  <div className="flex items-center gap-2">
                    <input ref={credRef} type="file" accept=".json" className="hidden"
                      onChange={e => setCredFile(e.target.files?.[0] ?? null)} />
                    <Button size="sm" variant="outline" onClick={() => credRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5 mr-1" /> {credFile ? credFile.name : 'Pilih File JSON'}
                    </Button>
                    {credFile && (
                      <Button size="sm" onClick={() => uploadCredMut.mutate()} disabled={uploadCredMut.isPending}>
                        {uploadCredMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Upload
                      </Button>
                    )}
                    {settings?.has_credentials && !credFile && (
                      <span className="text-xs text-green-600 flex items-center gap-1"><Check className="h-3 w-3" /> Aktif</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Save + Sync */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button size="sm" onClick={() => saveSettingsMut.mutate()} disabled={saveSettingsMut.isPending}>
                {saveSettingsMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Simpan Pengaturan
              </Button>
              <Button variant="outline" size="sm" onClick={() => syncMut.mutate()} disabled={syncMut.isPending || !canSync}>
                {syncMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Sync Sekarang
              </Button>
              {settings?.last_synced_at && (
                <span className="text-xs text-muted-foreground">Terakhir: {settings.last_synced_at}</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Non-effective days */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="font-semibold">Hari Tidak Efektif</h3>
        <p className="text-xs text-muted-foreground">Kelola via kalender di halaman <strong>/kalender</strong> (klik tanggal) atau import Excel massal di sini.</p>

        <div className="flex flex-wrap gap-2 items-center">
          <select className="rounded-md border border-input px-2 py-1.5 text-sm bg-background"
            value={nedYear} onChange={e => setNedYear(Number(e.target.value))}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="rounded-md border border-input px-2 py-1.5 text-sm bg-background disabled:opacity-40"
            value={nedMonth} onChange={e => setNedMonth(Number(e.target.value))} disabled={nedFullYear}>
            {['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'].map((m, i) => (
              <option key={i} value={i+1}>{m}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <p className="text-xs text-muted-foreground mr-1">Template Excel untuk:</p>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="radio" checked={!nedFullYear} onChange={() => setNedFullYear(false)} />
            Bulan terpilih (bisa dipakai untuk revisi bulan tertentu juga)
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="radio" checked={nedFullYear} onChange={() => setNedFullYear(true)} />
            Satu tahun penuh
          </label>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" variant="outline" onClick={downloadTemplate}>
            <Download className="h-3.5 w-3.5 mr-1" /> Template Excel
          </Button>
          <input ref={importNedRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) importNedMut.mutate(f) }} />
          <Button size="sm" variant="outline" onClick={() => importNedRef.current?.click()} disabled={importNedMut.isPending}>
            {importNedMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
            Import Excel
          </Button>
          <Button size="sm" variant="outline"
            className="border-green-300 text-green-700 hover:bg-green-50"
            onClick={() => { if (confirm('Tandai SEMUA event kalender yang tersinkron sebagai hari tidak efektif? Tanggal yang sudah ada tidak akan diubah.')) autoMarkMut.mutate() }}
            disabled={autoMarkMut.isPending}>
            {autoMarkMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            ✓ Auto-tandai dari Kalender
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Template berisi status <strong>tidak_efektif</strong> (kalau sudah pernah ditandai) atau <strong>efektif</strong> (tanggal
          bertepatan dengan event kalender tapi tetap hari efektif). Ubah kolom status lalu import ulang untuk memperbarui —
          isi "efektif" untuk mengembalikan tanggal yang sudah terlanjur ditandai tidak efektif.
        </p>

        {/* Rekap hasil import — ditaruh persis di sini (bukan cuma banner di atas halaman)
            supaya langsung terlihat tanpa scroll ke atas setelah klik Import Excel. */}
        {nedImportResult && (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-green-800">Import selesai</p>
              <button onClick={() => setNedImportResult(null)} className="text-green-700 hover:text-green-900">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-green-800">
              <span>Ditambahkan: <strong>{nedImportResult.inserted}</strong></span>
              <span>Diperbarui: <strong>{nedImportResult.updated}</strong></span>
              <span>Dikembalikan efektif: <strong>{nedImportResult.reverted}</strong></span>
            </div>
            {nedImportResult.errors.length > 0 && (
              <div className="pt-1 border-t border-green-200">
                <p className="text-xs font-medium text-amber-800 mb-1">{nedImportResult.errors.length} baris bermasalah:</p>
                <ul className="max-h-32 overflow-y-auto text-xs text-amber-800 space-y-0.5 pl-1">
                  {nedImportResult.errors.map((e, i) => <li key={i} className="flex gap-1.5"><span className="shrink-0">•</span>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {nedLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}</div>
        ) : (nedData?.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Belum ada hari tidak efektif di bulan ini.</p>
        ) : (
          <div className="space-y-1.5">
            {(nedData?.data ?? []).map(n => (
              <div key={n.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">
                    {new Date(n.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                  <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700">Tidak Efektif</span>
                  {n.keterangan && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{n.keterangan}</span>}
                </div>
                <button onClick={() => { if (confirm(`Hapus hari tidak efektif ${n.tanggal}?`)) delNedMut.mutate(n.id) }}
                  className="text-destructive hover:text-destructive/80">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Backup & Restore ─────────────────────────────────────────────────────────
const RESTORE_CONFIRMATION = 'PULIHKAN'

function BackupRestoreTab() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dlLoading, setDlLoading]   = useState(false)
  const [file, setFile]             = useState<File | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [result, setResult]         = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)

  async function downloadBackup() {
    setDlLoading(true)
    try {
      const resp = await api.get('/admin/backup/download', { responseType: 'blob' })
      const url  = URL.createObjectURL(new Blob([resp.data]))
      const ts   = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
      const a    = document.createElement('a'); a.href = url; a.download = `backup-agenda-${ts}.dump`; a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDlLoading(false)
    }
  }

  const restoreMut = useMutation({
    mutationFn: async () => {
      const form = new FormData()
      form.append('file', file as File)
      form.append('confirmation', confirmText)
      const resp = await api.post('/admin/backup/restore', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return resp.data as { message: string }
    },
    onSuccess: (data) => {
      setResult(data.message); setError(null)
      setFile(null); setConfirmText('')
      if (fileRef.current) fileRef.current.value = ''
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? err?.message ?? 'Restore gagal.')
      setResult(null)
    },
  })

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1">Backup & Restore</h2>
        <p className="text-sm text-muted-foreground">
          Unduh cadangan seluruh data aplikasi, atau pulihkan dari file cadangan.
          Cadangan per-semester akan tersedia setelah data per tahun pelajaran
          dipisah sepenuhnya &mdash; untuk saat ini cakupannya seluruh data.
        </p>
      </div>

      {/* Download */}
      <div className="rounded-lg border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary-600" />
          <h3 className="text-sm font-semibold">Unduh Cadangan (Seluruh Data)</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Menghasilkan file <code className="px-1 py-0.5 rounded bg-muted">.dump</code> berisi
          seluruh data aplikasi saat ini. Simpan file ini di tempat aman.
        </p>
        <Button size="sm" onClick={downloadBackup} disabled={dlLoading}>
          {dlLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Download className="h-3.5 w-3.5 mr-1" />}
          Unduh Backup
        </Button>
      </div>

      {/* Restore */}
      <div className="rounded-lg border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-destructive" />
          <h3 className="text-sm font-semibold">Pulihkan dari Cadangan</h3>
        </div>

        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 flex gap-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Tindakan ini akan MENIMPA seluruh data yang sedang berjalan dengan isi file
            cadangan. Sistem akan otomatis membuat cadangan pengaman dari data saat ini
            sebelum memulihkan, tapi tindakan ini tetap berisiko tinggi. Hanya gunakan
            file <code className="px-1 py-0.5 rounded bg-red-100">.dump</code> hasil unduhan
            fitur ini.
          </span>
        </div>

        <div
          className="rounded-md border-2 border-dashed border-muted-foreground/25 p-4 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          {file ? (
            <p className="text-xs"><span className="font-medium">{file.name}</span> <span className="text-muted-foreground">({(file.size/1024/1024).toFixed(1)} MB)</span></p>
          ) : (
            <p className="text-xs text-muted-foreground">Klik pilih file .dump</p>
          )}
          <input ref={fileRef} type="file" accept=".dump" className="hidden"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(null) }} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Ketik <span className="font-semibold text-foreground">{RESTORE_CONFIRMATION}</span> untuk mengaktifkan tombol restore
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={RESTORE_CONFIRMATION}
            className="w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 flex gap-2 text-xs text-red-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{error}
          </div>
        )}

        {result && (
          <div className="rounded border border-green-200 bg-green-50 px-3 py-2 flex gap-2 text-xs text-green-800">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />{result}
          </div>
        )}

        <Button
          size="sm"
          variant="destructive"
          disabled={!file || confirmText !== RESTORE_CONFIRMATION || restoreMut.isPending}
          onClick={() => restoreMut.mutate()}
        >
          {restoreMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
          Pulihkan Sekarang
        </Button>
      </div>
    </div>
  )
}

