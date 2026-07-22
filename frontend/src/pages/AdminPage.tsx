import { useRef, useState, useMemo, useEffect, Fragment } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Loader2, X, Check, AlertCircle, Upload, Download, FileCode2, CheckCircle2, XCircle, Key, Users, Search, ChevronUp, ChevronDown, ChevronsUpDown, RefreshCw, Calendar, ImageIcon, FolderOpen, FileText, BellRing, GraduationCap, CopyPlus, Copy, Lock, LockOpen, Database, Star, Settings, BookOpen, CalendarClock, CalendarRange, UserCog, Gauge, ClipboardEdit, DatabaseBackup, Timer, Cloud, UserPlus, Wrench, Briefcase, Sparkles, School, FolderUp, AlarmClock, type LucideIcon } from 'lucide-react'
import api from '@/lib/api'
import { adminApi } from '@/features/admin/api'
import { fcmAdminApi } from '@/features/notifikasi/api'
import { invalAdminApi, type InvalAdminRow } from '@/features/inval/api'
import type {
  AdminTeacher, AdminStudent, AdminClass, AdminSubject,
  AdminSchedule, AdminCharacterCategory, AdminCharacterSubitem, AdminThreshold,
  AdminUser, AdminAcademicYear, ImportResult, AdminManualNote,
} from '@/features/admin/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PasswordInput } from '@/components/ui/password-input'
import PhotoEditWidget from '@/components/PhotoEditWidget'
import PklAdminTab from '@/components/admin/PklAdminTab'
import BelAdminTab from '@/components/admin/BelAdminTab'
import KokurikulerAdminTab from '@/components/admin/KokurikulerAdminTab'
import { NaikKelasWizard, SalinJadwalModal } from '@/components/GantiTahunAjaran'
import { cn } from '@/lib/utils'

// ── Tab labels ────────────────────────────────────────────────────────────────
// Blok render & prefetch memetakan tab lewat LABEL, jadi urutan array ini bebas
// diubah — tapi label harus konsisten dengan TAB_META, TAB_GROUPS, dan blok render.
const TABS = ['Guru', 'Siswa', 'Kelas', 'Mapel', 'Jadwal', 'Karakter', 'Ambang', 'Pengguna', 'Tahun Ajaran', 'TA Arsip', 'Nilai Manual', 'Kalender', 'Backup & Restore', 'Pengaturan Agenda', 'Foto Siswa & Guru', 'Jadwal PDF', 'Penyimpanan', 'Notifikasi Push', 'Guru Inval', 'Deploy & Maintenance', 'PKL', 'Kokurikuler', 'Jam & Bel']

// Metadata tiap tab: slug (URL ?tab=), ikon, dan deskripsi satu kalimat.
// Slug lama (nilai-manual, pkl, kokurikuler) TIDAK boleh berubah — dipakai deep-link
// notifikasi (GK26).
const TAB_META: Record<string, { slug: string; icon: LucideIcon; desc: string }> = {
  'Guru':               { slug: 'guru',             icon: Users,          desc: 'Data guru: biodata, akun, gelar, dan status.' },
  'Siswa':              { slug: 'siswa',            icon: GraduationCap,  desc: 'Data siswa per kelas: biodata, akun, dan status.' },
  'Kelas':              { slug: 'kelas',            icon: School,         desc: 'Rombongan belajar per tahun ajaran beserta wali kelasnya.' },
  'Mapel':              { slug: 'mapel',            icon: BookOpen,       desc: 'Daftar mata pelajaran.' },
  'Jadwal':             { slug: 'jadwal',           icon: CalendarClock,  desc: 'Jadwal pelajaran per kelas, per hari, per guru.' },
  'Karakter':           { slug: 'karakter',         icon: Star,           desc: 'Induk & sub-karakter beserta bobot poin plus/minusnya.' },
  'Ambang':             { slug: 'ambang',           icon: Gauge,          desc: 'Ambang poin pemicu rekomendasi tindakan & EWS siswa.' },
  'Pengguna':           { slug: 'pengguna',         icon: UserCog,        desc: 'Akun login: peran, reset password, aktif/nonaktif.' },
  'Tahun Ajaran':       { slug: 'tahun-ajaran',     icon: CalendarRange,  desc: 'Ganti semester/TA, wizard naik kelas, salin jadwal, kunci arsip.' },
  'TA Arsip':           { slug: 'ta-arsip',         icon: Lock,           desc: 'Saklar akses tulis tahun ajaran non-aktif (arsip baca-saja).' },
  'Nilai Manual':       { slug: 'nilai-manual',     icon: ClipboardEdit,  desc: 'Tinjau & setujui usulan nilai karakter manual dari guru.' },
  'Kalender':           { slug: 'kalender',         icon: Calendar,       desc: 'Kalender pendidikan, sinkronisasi Google, hari tidak efektif.' },
  'Backup & Restore':   { slug: 'backup-restore',   icon: DatabaseBackup, desc: 'Cadangkan dan pulihkan seluruh database.' },
  'Pengaturan Agenda':  { slug: 'pengaturan-agenda', icon: Timer,         desc: 'Batas waktu (hari + jam) pengisian agenda setelah jadwal.' },
  'Foto Siswa & Guru':  { slug: 'foto',             icon: ImageIcon,      desc: 'Unggah foto profil massal (ZIP) maupun satuan.' },
  'Jadwal PDF':         { slug: 'jadwal-pdf',       icon: FileText,       desc: 'Unggah berkas jadwal PDF untuk halaman "Jadwal Saya".' },
  'Penyimpanan':        { slug: 'penyimpanan',      icon: Cloud,          desc: 'Penyimpanan objek Cloudflare R2 untuk foto & dokumen (opsional).' },
  'Notifikasi Push':    { slug: 'notifikasi-push',  icon: BellRing,       desc: 'Firebase Cloud Messaging untuk notifikasi ke HP.' },
  'Guru Inval':         { slug: 'guru-inval',       icon: UserPlus,       desc: 'Pantau permintaan & persetujuan guru pengganti.' },
  'Deploy & Maintenance': { slug: 'deploy',         icon: Wrench,         desc: 'Alat rilis, cache, dan pemeliharaan aplikasi.' },
  'PKL':                { slug: 'pkl',              icon: Briefcase,      desc: 'Mode PKL kelas XII: saklar, TP khusus, impor penempatan.' },
  'Kokurikuler':        { slug: 'kokurikuler',      icon: Sparkles,       desc: 'Projek kokurikuler: periode, tingkat, dimensi, fasilitator, rekap.' },
  'Jam & Bel':          { slug: 'jam-bel',          icon: AlarmClock,     desc: 'Bel per hari (jam ke-), mode Apel/Tanpa Apel, istirahat terkunci, bank audio & pemutar kiosk.' },
}

// Pengelompokan navigasi — 22 tab datar terlalu membingungkan; dua tingkat
// (kategori → menu) membuat semuanya terlihat tanpa scroll horizontal.
const TAB_GROUPS: { label: string; icon: LucideIcon; tabs: string[] }[] = [
  { label: 'Data Master',     icon: Database,      tabs: ['Guru', 'Siswa', 'Kelas', 'Mapel', 'Jadwal', 'Pengguna'] },
  { label: 'Akademik',        icon: GraduationCap, tabs: ['Tahun Ajaran', 'TA Arsip', 'Kalender', 'Jam & Bel', 'Pengaturan Agenda', 'Guru Inval', 'PKL', 'Kokurikuler'] },
  { label: 'Karakter & Nilai', icon: Star,         tabs: ['Karakter', 'Ambang', 'Nilai Manual'] },
  { label: 'Import & Berkas', icon: FolderUp,      tabs: ['Foto Siswa & Guru', 'Jadwal PDF'] },
  { label: 'Sistem',          icon: Settings,      tabs: ['Backup & Restore', 'Penyimpanan', 'Notifikasi Push', 'Deploy & Maintenance'] },
]

const TAB_SLUG_TO_LABEL: Record<string, string> =
  Object.fromEntries(Object.entries(TAB_META).map(([label, m]) => [m.slug, label]))

const groupIndexOfTab = (label: string) =>
  Math.max(0, TAB_GROUPS.findIndex((g) => g.tabs.includes(label)))

// ── Simple modal ──────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    // z-[60]: di atas BottomNav mobile (z-50) supaya isi/footer modal tidak tertutup nav
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-lg bg-white shadow-xl max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
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
            // Kosongkan value tiap klik agar memilih ulang file BERNAMA SAMA (mis. file
            // yang baru diperbaiki lalu disimpan dgn nama yang sama) tetap memicu onChange.
            // Tanpa ini, browser menganggap path tak berubah → onChange tak menyala →
            // File lama tetap dipakai saat Import (terasa seperti "data ke-cache").
            onClick={e => { (e.target as HTMLInputElement).value = ''; setFile(null) }}
            onChange={e => { setFile(e.target.files?.[0] || null); setResult(null) }}
          />
        </Field>

        {result && (
          <div className={`rounded-lg p-3 text-sm ${result.error_count === 0 ? 'border border-green-200 bg-green-50' : 'border border-yellow-200 bg-yellow-50'}`}>
            <p className="font-medium">
              {result.success_count} baris berhasil diimpor
              {(result.completed_count ?? 0) > 0 && `, ${result.completed_count} data lama dilengkapi`}
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
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" />Import Guru
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
                  <td className="px-3 py-2"><Badge variant="outline" className="capitalize">{t.role?.replace(/_/g, ' ') ?? '-'}</Badge></td>
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
          {modal === 'edit' && selected && (
            <Field label="Foto Guru">
              <PhotoEditWidget
                fotoUrl={selected.foto_url}
                uploadEndpoint={`/admin/teachers/${selected.id}/photo`}
                onUploaded={() => qc.invalidateQueries({ queryKey: ['admin-teachers'] })}
              />
            </Field>
          )}
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

      {/* Import guru memakai "Format Import Data Guru" (3 sheet, upsert lewat NIP/NUPTK/
          nama) — pindahan dari tab Import Data. Import Excel generik yang lama dihapus
          karena formatnya lebih miskin dan tidak upsert. */}
      {importOpen && (
        <Modal wide title="Import Guru" onClose={() => setImportOpen(false)}>
          <GuruLengkapImportCard />
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
  const [importOpen, setImportOpen] = useState(false)
  const [importDapodikOpen, setImportDapodikOpen] = useState(false)
  const [selected, setSelected] = useState<AdminStudent | null>(null)
  const [form, setForm] = useState({ nama: '', email: '', nis: '', nisn: '', jenis_kelamin: '', class_id: '', angkatan: '', wali_nama: '', wali_kontak: '', password: '' })
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')
  const [filterKelas, setFilterKelas] = useState('')
  // aktif (default) | lulus | pindah | keluar | semua — alumni tidak memenuhi daftar kerja
  const [filterStatus, setFilterStatus] = useState('aktif')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<PerPageOpt>(25)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const debouncedSearch = useDebounce(search, 350)

  useEffect(() => { setPage(1) }, [debouncedSearch, filterKelas, filterStatus, perPage])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-students', debouncedSearch, filterKelas, filterStatus, page, perPage],
    queryFn: () => adminApi.getStudents({ search: debouncedSearch || undefined, class_id: filterKelas || undefined, status_siswa: filterStatus, page, per_page: perPage === 'semua' ? 'all' : perPage }),
    placeholderData: (prev) => prev,
  })
  const { data: classes } = useQuery({ queryKey: ['admin-classes'], queryFn: () => adminApi.getClasses() })

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const rows = useMemo(() => applySort(data?.data ?? [], sortCol, sortDir, (s, col) => {
    if (col === 'nama') return s.nama
    if (col === 'nis') return s.nis ?? ''
    if (col === 'nisn') return s.nisn ?? ''
    if (col === 'jk') return s.jenis_kelamin ?? ''
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
    setForm({ nama: '', email: '', nis: '', nisn: '', jenis_kelamin: '', class_id: '', angkatan: '', wali_nama: '', wali_kontak: '', password: '' })
    setModal('add')
  }
  function openEdit(s: AdminStudent) {
    setSelected(s); setErr('')
    setForm({ nama: s.nama, email: s.email, nis: s.nis, nisn: s.nisn || '', jenis_kelamin: s.jenis_kelamin || '', class_id: s.kelas?.id || '', angkatan: String(s.angkatan || ''), wali_nama: s.wali_nama || '', wali_kontak: s.wali_kontak || '', password: '' })
    setModal('edit')
  }
  function handleSubmit() {
    const payload: any = { ...form, angkatan: form.angkatan ? Number(form.angkatan) : undefined }
    if (!payload.password) delete payload.password
    if (!payload.email) delete payload.email
    if (!payload.nisn) delete payload.nisn
    if (!payload.jenis_kelamin) delete payload.jenis_kelamin
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
        <select className={selectCls + ' max-w-[140px]'} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          title="Siswa lulus/pindah tersimpan sebagai arsip — tidak dihapus">
          <option value="aktif">Aktif</option>
          <option value="lulus">Lulus</option>
          <option value="pindah">Pindah</option>
          <option value="keluar">Keluar</option>
          <option value="semua">Semua Status</option>
        </select>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportDapodikOpen(true)}>
            <FileCode2 className="mr-1 h-4 w-4" />Import Dapodik
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" />Import Excel
          </Button>
          <Button size="sm" onClick={openAdd}><Plus className="mr-1 h-4 w-4" />Tambah Siswa</Button>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton cols={[16, 160, 80, 80, 40, 120, 60, 60, 40]} rows={8} />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <Th label="#" />
                <SortTh label="Nama" col="nama" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="NIS" col="nis" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="NISN" col="nisn" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="JK" col="jk" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
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
                  <td className="px-3 py-2 text-muted-foreground">{s.jenis_kelamin ?? '-'}</td>
                  <td className="px-3 py-2">{s.kelas?.label ?? <span className="text-muted-foreground italic">—</span>}</td>
                  <td className="px-3 py-2">{s.angkatan ?? '-'}</td>
                  <td className="px-3 py-2">
                    {s.status_siswa && s.status_siswa !== 'aktif' ? (
                      <Badge className={s.status_siswa === 'lulus' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}>
                        {s.status_siswa}{s.status_siswa === 'lulus' && s.tanggal_keluar ? ` ${s.tanggal_keluar.slice(0, 4)}` : ''}
                      </Badge>
                    ) : (
                      <Badge className={s.status === 'aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{s.status}</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(s)} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => window.confirm('Nonaktifkan siswa ini?') && del.mutate(s.id)} className="rounded p-1 hover:bg-red-100 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada data</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {data?.meta && <Pagination meta={data.meta} page={page} onPage={setPage} perPage={perPage} onPerPage={(pp) => { setPerPage(pp); setPage(1) }} />}

      {modal && (
        <Modal title={modal === 'add' ? 'Tambah Siswa' : 'Edit Siswa'} onClose={() => setModal(null)}>
          {modal === 'edit' && selected && (
            <Field label="Foto Siswa">
              <PhotoEditWidget
                fotoUrl={selected.foto_url}
                uploadEndpoint={`/students/${selected.id}/photo`}
                onUploaded={() => qc.invalidateQueries({ queryKey: ['admin-students'] })}
              />
            </Field>
          )}
          <Field label="Nama"><input className={inputCls} value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} /></Field>
          <Field label="NIS"><input className={inputCls} value={form.nis} onChange={e => setForm(f => ({ ...f, nis: e.target.value }))} /></Field>
          <Field label="NISN (opsional)"><input className={inputCls} value={form.nisn} onChange={e => setForm(f => ({ ...f, nisn: e.target.value }))} /></Field>
          <Field label="Jenis Kelamin">
            <select className={selectCls} value={form.jenis_kelamin} onChange={e => setForm(f => ({ ...f, jenis_kelamin: e.target.value }))}>
              <option value="">-- Belum diisi --</option>
              <option value="L">Laki-laki (L)</option>
              <option value="P">Perempuan (P)</option>
            </select>
          </Field>
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

      {/* Import Dapodik — pindahan dari tab Import Data; saling melengkapi dgn Import
          Excel: cocokkan NISN/NIS, siswa yang sudah ada dilengkapi bukan digandakan. */}
      {importDapodikOpen && (
        <Modal wide title="Import Siswa dari Dapodik" onClose={() => setImportDapodikOpen(false)}>
          <DapodikSiswaImportCard />
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

  // '' = TA aktif; uuid TA lain = mode ARSIP (baca-saja) untuk melihat roster tahun lalu
  const [taFilter, setTaFilter] = useState('')
  const [rosterId, setRosterId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-classes', taFilter],
    queryFn: () => adminApi.getClasses(taFilter ? { academic_year_id: taFilter } : undefined),
  })
  const { data: teachers } = useQuery({ queryKey: ['admin-teachers', 'all'], queryFn: () => adminApi.getTeachers({ per_page: 'all' }) })
  const { data: yearsKelas } = useQuery({ queryKey: ['admin-academic-years'], queryFn: () => adminApi.getAcademicYears() })
  const { data: roster, isLoading: rosterLoading } = useQuery({
    queryKey: ['class-roster', rosterId],
    queryFn: () => adminApi.getClassRoster(rosterId!),
    enabled: !!rosterId,
  })
  const isArsip = taFilter !== '' && !yearsKelas?.find(y => y.id === taFilter)?.aktif

  useEffect(() => { setPage(1) }, [q, perPage, taFilter])

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
        <select className={selectCls + ' max-w-[190px]'} value={taFilter} onChange={e => setTaFilter(e.target.value)}
          title="Lihat kelas tahun ajaran lain (arsip, baca-saja)">
          <option value="">TA Aktif</option>
          {yearsKelas?.filter(y => !y.aktif).map(y => (
            <option key={y.id} value={y.id}>Arsip: {y.tahun} {y.semester}</option>
          ))}
        </select>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
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
                      <button onClick={() => setRosterId(c.id)} className="rounded p-1 hover:bg-accent text-blue-600"
                        title="Daftar siswa (riwayat keanggotaan)"><Users className="h-3.5 w-3.5" /></button>
                      {!isArsip && (
                        <>
                          <button onClick={() => openEdit(c)} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => window.confirm('Hapus kelas ini?') && del.mutate(c.id)} className="rounded p-1 hover:bg-red-100 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                        </>
                      )}
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

      {/* Roster dari riwayat enrollment — kelas TA lama pun tetap punya daftar siswa
          lengkap dengan bagaimana keanggotaannya berakhir (naik/tinggal/lulus/pindah) */}
      {rosterId && (
        <Modal title={roster ? `Daftar Siswa — ${roster.kelas.label} (${roster.kelas.tahun_ajaran ?? ''})` : 'Daftar Siswa'} onClose={() => setRosterId(null)}>
          {rosterLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />Memuat…
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
              {(roster?.siswa ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Belum ada riwayat siswa di kelas ini.</p>
              )}
              {(roster?.siswa ?? []).map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 py-1.5 border-b last:border-0 text-sm">
                  <span className="w-6 text-right text-xs text-muted-foreground shrink-0">{i + 1}</span>
                  <span className="min-w-0 truncate">{s.nama}</span>
                  <span className="text-xs text-muted-foreground shrink-0">({s.nis})</span>
                  <Badge className={
                    'ml-auto shrink-0 ' + (
                      s.status === 'aktif' ? 'bg-green-100 text-green-700'
                      : s.status === 'naik' ? 'bg-blue-100 text-blue-700'
                      : s.status === 'lulus' ? 'bg-purple-100 text-purple-700'
                      : s.status === 'tinggal' ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                    )
                  }>{s.status}</Badge>
                </div>
              ))}
            </div>
          )}
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
      const res = await api.post('/admin/import/wali-kelas', form, { headers: { 'Content-Type': 'multipart/form-data' } })
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
            // Kosongkan value tiap klik agar memilih ulang file BERNAMA SAMA (mis. file
            // yang baru diperbaiki lalu disimpan dgn nama yang sama) tetap memicu onChange.
            // Tanpa ini, browser menganggap path tak berubah → onChange tak menyala →
            // File lama tetap dipakai saat Import (terasa seperti "data ke-cache").
            onClick={e => { (e.target as HTMLInputElement).value = ''; setFile(null) }}
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
        <div className="ml-auto flex flex-wrap justify-end gap-2">
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
                  <td className="px-3 py-2"><Badge className={kelompokColor[s.kelompok] || ''}>{s.kelompok?.replace(/_/g, ' ') ?? '-'}</Badge></td>
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
  const [importXmlOpen, setImportXmlOpen] = useState(false)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [salinOpen, setSalinOpen] = useState(false)
  // Daftar TA untuk modal Salin Jadwal — fetch saat modal dibuka saja
  const { data: yearsForCopy } = useQuery({
    queryKey: ['admin-academic-years'],
    queryFn: () => adminApi.getAcademicYears(),
    enabled: salinOpen,
  })
  const [selected, setSelected] = useState<AdminSchedule | null>(null)
  const [form, setForm] = useState({ class_id: '', subject_id: '', teacher_id: '', hari: 'senin', jam_mulai: '08:00', jam_selesai: '09:30', ruangan: '' })
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
  const { data: classes } = useQuery({ queryKey: ['admin-classes'], queryFn: () => adminApi.getClasses() })
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
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setSalinOpen(true)}>
            <CopyPlus className="mr-1 h-4 w-4" />Salin dari Semester
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportXmlOpen(true)}>
            <FileCode2 className="mr-1 h-4 w-4" />Import XML
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" />Import Excel
          </Button>
          <Button size="sm" onClick={() => { setSelected(null); setErr(''); setForm({ class_id: '', subject_id: '', teacher_id: '', hari: 'senin', jam_mulai: '08:00', jam_selesai: '09:30', ruangan: '' }); setModal('add') }}>
            <Plus className="mr-1 h-4 w-4" />Tambah Jadwal
          </Button>
        </div>
      </div>

      {salinOpen && <SalinJadwalModal years={yearsForCopy ?? []} onClose={() => setSalinOpen(false)} />}
      {isLoading ? <TableSkeleton cols={[16, 70, 90, 120, 120, 120, 40]} rows={8} /> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <Th label="#" />
                <Th label="Hari" />
                <Th label="Jam" />
                <Th label="Ruangan" />
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
                  <td className="px-3 py-2 text-muted-foreground">{s.ruangan ?? '—'}</td>
                  <td className="px-3 py-2">{s.kelas.label}</td>
                  <td className="px-3 py-2">{s.mapel.nama}</td>
                  <td className="px-3 py-2">{s.guru.nama}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => { setSelected(s); setErr(''); setForm({ class_id: s.kelas.id, subject_id: s.mapel.id, teacher_id: s.guru.id, hari: s.hari, jam_mulai: s.jam_mulai, jam_selesai: s.jam_selesai, ruangan: s.ruangan ?? '' }); setModal('edit') }} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => window.confirm('Hapus jadwal ini?') && del.mutate(s.id)} className="rounded p-1 hover:bg-red-100 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada data</td></tr>}
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
          <Field label="Ruangan (opsional)"><input className={inputCls} type="text" placeholder="mis. Ruang E1" value={form.ruangan} onChange={e => setForm(f => ({ ...f, ruangan: e.target.value }))} /></Field>
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

      {/* Import XML aSc — pindahan dari tab Import Data; melengkapi Import Excel:
          XML utk jadwal masal hasil ekspor aSc, Excel utk koreksi/penambahan kecil. */}
      {importXmlOpen && (
        <Modal wide title="Import Jadwal dari XML (aSc Timetables)" onClose={() => setImportXmlOpen(false)}>
          <JadwalXmlImportCard />
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
          <div className="ml-auto flex flex-wrap justify-end gap-2">
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
          <div className="ml-auto flex flex-wrap justify-end gap-2">
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
        <div className="ml-auto flex flex-wrap justify-end gap-2">
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
// TAB: PENGATURAN AGENDA (batas waktu pengisian agenda pasca jadwal)
// ─────────────────────────────────────────────────────────────────────────────
function ArsipWriteTab() {
  const qc = useQueryClient()
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const { data, isLoading } = useQuery<{ izinkan_tulis: boolean }>({
    queryKey: ['admin-archive-write-settings'],
    queryFn: () => api.get('/admin/archive-write-settings').then(r => r.data.data),
  })

  const save = useMutation({
    mutationFn: (izinkan: boolean) => api.put('/admin/archive-write-settings', { izinkan_tulis: izinkan }).then(r => r.data),
    onSuccess: (d) => {
      setMsg({ type: 'ok', text: d.message })
      qc.invalidateQueries({ queryKey: ['admin-archive-write-settings'] })
    },
    onError: (e: any) => setMsg({ type: 'err', text: e.response?.data?.message ?? 'Gagal menyimpan.' }),
  })

  const terbuka = data?.izinkan_tulis ?? false

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h3 className="font-semibold text-sm">Akses Tulis Tahun Ajaran Arsip</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Tahun ajaran <strong>non-aktif</strong> bersifat <strong>baca-saja</strong>: seluruh data
          semester lama bisa dilihat (login dengan memilih semester itu), tapi tidak bisa diubah.
          Buka saklar ini sementara bila perlu koreksi data susulan (presensi, agenda, poin) di
          semester lama, lalu tutup kembali. Kunci Semester di tab Tahun Ajaran tetap berlaku
          lebih kuat — TA terkunci tidak bisa ditulis walau saklar ini terbuka.
        </p>
      </div>

      {isLoading ? (
        <div className="h-24 rounded-lg bg-muted animate-pulse" />
      ) : (
        <div className="rounded-lg border p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            {terbuka
              ? <LockOpen className="h-4 w-4 text-amber-600" />
              : <Lock className="h-4 w-4 text-muted-foreground" />}
            <span className={terbuka ? 'font-medium text-amber-700' : 'text-muted-foreground'}>
              {terbuka ? 'Tulis di TA arsip sedang DIBUKA' : 'TA arsip baca-saja (tertutup)'}
            </span>
          </div>
          <Button
            size="sm"
            variant={terbuka ? 'outline' : 'default'}
            onClick={() => { setMsg(null); save.mutate(!terbuka) }}
            disabled={save.isPending}
          >
            {save.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {terbuka ? 'Tutup Akses Tulis' : 'Buka Akses Tulis'}
          </Button>
        </div>
      )}

      {msg && (
        <div className={`rounded-md border px-3 py-2 text-sm ${msg.type === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}
    </div>
  )
}

function PengaturanAgendaTab() {
  const qc = useQueryClient()
  const [batasHari, setBatasHari] = useState('3')
  const [batasJam, setBatasJam]   = useState('0')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const { data, isLoading } = useQuery<{ batas_hari: number; batas_jam: number }>({
    queryKey: ['admin-agenda-fill-settings'],
    queryFn: () => api.get('/admin/agenda-fill-settings').then(r => r.data.data),
  })

  useEffect(() => {
    if (data) {
      setBatasHari(String(data.batas_hari))
      setBatasJam(String(data.batas_jam))
    }
  }, [data])

  const save = useMutation({
    mutationFn: () => api.put('/admin/agenda-fill-settings', {
      batas_hari: Number(batasHari) || 0,
      batas_jam: Number(batasJam) || 0,
    }).then(r => r.data),
    onSuccess: (d) => {
      setMsg({ type: 'ok', text: d.message })
      qc.invalidateQueries({ queryKey: ['admin-agenda-fill-settings'] })
    },
    onError: (e: any) => setMsg({ type: 'err', text: e.response?.data?.message ?? 'Gagal menyimpan.' }),
  })

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h3 className="font-semibold text-sm">Batas Waktu Pengisian Agenda</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Tentukan berapa lama setelah jadwal mengajar berakhir, guru masih boleh mengisi
          agenda untuk sesi tersebut. Setelah batas ini lewat, guru tidak bisa lagi membuat
          agenda baru untuk sesi itu (agenda yang sudah dibuat sebelum batas tetap bisa diedit).
        </p>
      </div>

      {isLoading ? (
        <div className="h-24 rounded-lg bg-muted animate-pulse" />
      ) : (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Batas Hari">
              <input
                type="number" min={0} max={365} className={inputCls}
                value={batasHari} onChange={e => setBatasHari(e.target.value)}
              />
            </Field>
            <Field label="Batas Jam (0–23)">
              <input
                type="number" min={0} max={23} className={inputCls}
                value={batasJam} onChange={e => setBatasJam(e.target.value)}
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            Contoh: 1 hari 0 jam berarti guru bisa mengisi agenda sampai 1×24 jam setelah
            jadwal selesai. Isi 0 &amp; 0 kalau ingin batasnya sangat ketat (harus langsung
            setelah jadwal selesai), atau angka besar (mis. 365 hari) untuk praktis tanpa batas.
          </p>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setMsg(null); save.mutate() }} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Simpan
            </Button>
          </div>
        </div>
      )}

      {msg && (
        <div className={`rounded-md border px-3 py-2 text-sm ${msg.type === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: FOTO SISWA & GURU (upload masal)
// ─────────────────────────────────────────────────────────────────────────────
interface PhotoUploadResult {
  message: string
  summary: { total: number; berhasil: number; gagal: number }
  berhasil: { file: string; nama: string; nisn?: string; cocok_dengan?: string }[]
  gagal: { file: string; alasan: string }[]
}

function FotoBulkUploadTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Ketentuan foto:</p>
        <p>Format JPG, JPEG, atau PNG — maksimal <strong>50KB per foto</strong>.</p>
        <p>Rasio yang disarankan <strong>3x4</strong> (potret, seperti pas foto ukuran 3x4 cm) supaya tampil rapi di semua tempat (nilai, EWS, laporan cetak).</p>
        <p>Nama file foto <strong>siswa</strong> harus persis sama dengan <strong>NISN</strong> siswa (mis. <code>0012345678.jpg</code>). Nama file foto <strong>guru</strong> harus sama dengan <strong>NIP</strong>, atau <strong>email</strong> kalau guru tidak punya NIP.</p>
        <p>Foto yang berhasil dicocokkan akan <strong>menimpa foto lama</strong> (kalau ada) atau <strong>mengisi yang masih kosong</strong>. File yang tidak cocok dengan siapa pun, atau tidak ada fotonya sama sekali, cukup dilewati — tidak perlu upload sekaligus semua, bisa bertahap kapan saja.</p>
        <p>Tombol "Pilih Folder Foto" otomatis menelusuri <strong>semua sub-folder di dalamnya</strong> (sub, sub-sub, dst.) — jadi foto boleh dikelompokkan per kelas/rombel dalam folder-folder terpisah, tidak ada yang terlewat.</p>
      </div>

      <BulkPhotoUploadSection
        title="Upload Foto Siswa"
        description="Cocokkan berdasarkan NISN"
        endpoint="/admin/students/photos/bulk"
        matchColumnLabel="NISN"
      />

      <BulkPhotoUploadSection
        title="Upload Foto Guru"
        description="Cocokkan berdasarkan NIP (atau email kalau tidak punya NIP)"
        endpoint="/admin/teachers/photos/bulk"
        matchColumnLabel="NIP / Email"
      />
    </div>
  )
}

// Kirim dalam batch, BUKAN satu request raksasa — sekolah bisa punya 1700+ siswa, dan
// satu request berisi ribuan file gampang kena limit server (max_file_uploads,
// post_max_size) atau timeout, hasilnya blank/gagal tanpa pesan jelas. Batch juga kasih
// progress yang terlihat ke admin, bukan cuma "loading" diam selama beberapa menit.
// ≤ default PHP `max_file_uploads` (20). Batch lebih besar bikin server DIAM-DIAM
// membuang file ke-21+ tiap request (mis. 100/batch → cuma 20 masuk, sisanya hilang
// tanpa error) — insiden 2026-07-21: dari 1100 foto hanya ~240 masuk. Jangan naikkan
// tanpa memastikan max_file_uploads server juga dinaikkan.
const PHOTO_BATCH_SIZE = 20

function BulkPhotoUploadSection({ title, description, endpoint, matchColumnLabel }: {
  title: string; description: string; endpoint: string; matchColumnLabel: string
}) {
  const [files, setFiles] = useState<File[]>([])
  const [result, setResult] = useState<PhotoUploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{ batch: number; totalBatch: number; filesDone: number } | null>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function startUpload() {
    setUploading(true)
    setError(null)
    setResult(null)

    // Batch dibatasi JUMLAH (≤ max_file_uploads) DAN UKURAN (jaga di bawah post_max_size
    // server untuk foto besar) — mana yang lebih dulu tercapai.
    const MAX_BATCH_BYTES = 15 * 1024 * 1024
    const batches: File[][] = []
    {
      let cur: File[] = []
      let bytes = 0
      for (const f of files) {
        if (cur.length > 0 && (cur.length >= PHOTO_BATCH_SIZE || bytes + f.size > MAX_BATCH_BYTES)) {
          batches.push(cur); cur = []; bytes = 0
        }
        cur.push(f); bytes += f.size
      }
      if (cur.length > 0) batches.push(cur)
    }

    const merged: PhotoUploadResult = { message: '', summary: { total: 0, berhasil: 0, gagal: 0 }, berhasil: [], gagal: [] }

    let filesDone = 0
    for (let i = 0; i < batches.length; i++) {
      setProgress({ batch: i + 1, totalBatch: batches.length, filesDone })
      try {
        const form = new FormData()
        batches[i].forEach(f => form.append('photos[]', f))
        const resp = await api.post<PhotoUploadResult>(endpoint, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        merged.berhasil.push(...resp.data.berhasil)
        merged.gagal.push(...resp.data.gagal)
        // Deteksi file yang DIBUANG server diam-diam (request melebihi max_file_uploads /
        // upload limit): terkirim tapi tak muncul di berhasil MAUPUN gagal. Tanpa ini
        // kegagalan tak terlihat sama sekali (kasus 2026-07-21: 1100 foto, hanya ~240 masuk).
        const diproses = new Set([...resp.data.berhasil, ...resp.data.gagal].map(x => x.file))
        for (const f of batches[i]) {
          if (!diproses.has(f.name)) {
            merged.gagal.push({ file: f.name, alasan: 'Tidak diproses server (kemungkinan melebihi batas upload/max_file_uploads server). Upload ulang file ini.' })
          }
        }
      } catch (err: any) {
        // Satu batch gagal (mis. jaringan putus) TIDAK membatalkan batch lain — catat
        // semua file di batch itu sebagai gagal, lanjut ke batch berikutnya.
        const reason = err?.response?.data?.message ?? 'Gagal mengunggah batch ini (kemungkinan jaringan terputus) — coba upload ulang file yang gagal.'
        batches[i].forEach(f => merged.gagal.push({ file: f.name, alasan: reason }))
      }
      filesDone += batches[i].length
    }

    merged.summary = {
      total: merged.berhasil.length + merged.gagal.length,
      berhasil: merged.berhasil.length,
      gagal: merged.gagal.length,
    }
    merged.message = 'Proses upload selesai.'

    setResult(merged)
    setProgress(null)
    setUploading(false)
  }

  function pickFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    // Cuma ambil file gambar — folder bisa berisi file lain yang bukan foto (mis. .DS_Store).
    setFiles(Array.from(list).filter(f => /\.(jpg|jpeg|png)$/i.test(f.name)))
    setResult(null)
    setError(null)
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-sm flex items-center gap-1.5"><ImageIcon className="h-4 w-4" />{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => folderRef.current?.click()}>
          <FolderOpen className="mr-1.5 h-4 w-4" />Pilih Folder Foto
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" />Pilih File Satu-satu
        </Button>
        {/* @ts-expect-error webkitdirectory bukan atribut React standar tapi didukung Chrome/Edge */}
        <input ref={folderRef} type="file" webkitdirectory="" multiple className="hidden"
          onClick={e => { (e.currentTarget as HTMLInputElement).value = '' }}
          onChange={(e) => pickFiles(e.target.files)} />
        <input ref={fileRef} type="file" accept="image/jpeg,image/png" multiple className="hidden"
          onClick={e => { (e.currentTarget as HTMLInputElement).value = '' }}
          onChange={(e) => pickFiles(e.target.files)} />
      </div>

      {files.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {files.length} file foto dipilih (termasuk dari sub-folder di dalamnya, sampai sub-sub-folder — tidak ada yang terlewat; file lain yang bukan .jpg/.jpeg/.png otomatis diabaikan).
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" disabled={files.length === 0 || uploading} onClick={startUpload}>
          {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
          Upload {files.length > 0 ? `(${files.length} foto)` : ''}
        </Button>
        {(files.length > 0 || result || error) && !uploading && (
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { setFiles([]); setResult(null); setError(null); if (folderRef.current) folderRef.current.value = ''; if (fileRef.current) fileRef.current.value = '' }}
          >
            Reset
          </button>
        )}
      </div>

      {progress && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Mengupload batch {progress.batch} dari {progress.totalBatch}
            {' '}({progress.filesDone} / {files.length} foto)...
          </p>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, ((progress.batch) / progress.totalBatch) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 flex gap-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <PhotoStatCard label="Total File" value={result.summary.total} tone="muted" />
            <PhotoStatCard label="Berhasil" value={result.summary.berhasil} tone="green" />
            <PhotoStatCard label="Gagal" value={result.summary.gagal} tone="red" />
          </div>

          {result.berhasil.length > 0 && (
            <div className="rounded-md border border-green-200 bg-green-50 p-2.5 max-h-48 overflow-y-auto">
              <p className="text-xs font-medium text-green-800 mb-1.5">Berhasil ({result.berhasil.length})</p>
              <ul className="text-xs text-green-700 space-y-0.5">
                {result.berhasil.slice(0, 300).map((b, i) => (
                  <li key={i}>{b.file} → {b.nama} ({matchColumnLabel}: {b.nisn ?? b.cocok_dengan})</li>
                ))}
                {result.berhasil.length > 300 && (
                  <li className="italic text-green-600">...dan {result.berhasil.length - 300} lainnya (daftar dipersingkat, semua tetap tersimpan).</li>
                )}
              </ul>
            </div>
          )}

          {result.gagal.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 max-h-48 overflow-y-auto">
              <p className="text-xs font-medium text-amber-800 mb-1.5">Gagal / dilewati ({result.gagal.length})</p>
              <ul className="text-xs text-amber-700 space-y-0.5">
                {result.gagal.slice(0, 300).map((g, i) => (
                  <li key={i}>{g.file} — {g.alasan}</li>
                ))}
                {result.gagal.length > 300 && (
                  <li className="italic text-amber-600">...dan {result.gagal.length - 300} lainnya (daftar dipersingkat).</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PhotoStatCard({ label, value, tone }: { label: string; value: number; tone: 'muted' | 'green' | 'red' }) {
  const toneCls = tone === 'green' ? 'text-green-700' : tone === 'red' ? 'text-red-700' : 'text-foreground'
  return (
    <div className="rounded-md border bg-white p-3 text-center">
      <p className={cn('text-xl font-bold', toneCls)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: JADWAL PDF (upload masal file PDF jadwal guru & kelas)
// ─────────────────────────────────────────────────────────────────────────────
interface ScheduleUploadResult {
  message: string
  summary: { total: number; berhasil: number; gagal: number }
  berhasil: { file: string; nama?: string; nip?: string; kelas?: string }[]
  gagal: { file: string; alasan: string }[]
}

function JadwalPdfBulkUploadTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Ketentuan file jadwal:</p>
        <p>File harus <strong>PDF</strong>, maksimal <strong>10MB per file</strong>.</p>
        <p>Nama file jadwal <strong>guru</strong> harus diawali <strong>NIP</strong>, format <code>NIP-Nama.pdf</code> (mis. <code>196701052025212001-Cucu Lasmanawati.pdf</code>) — bagian nama boleh apa saja, yang dibaca cuma NIP di depan.</p>
        <p>Nama file jadwal <strong>kelas</strong> harus format <code>Tingkat-KodeJurusan-Rombel.pdf</code> (mis. <code>XII-RPL-A.pdf</code>) — kode jurusan dicocokkan ke kolom "Inisial Kelas" di data Program Keahlian.</p>
        <p>File yang berhasil dicocokkan akan <strong>menimpa jadwal lama</strong> (kalau ada). File yang tidak cocok cukup dilewati dengan alasan yang jelas — tidak membatalkan file lain.</p>
        <p>Jadwal yang sudah terupload akan muncul di halaman <strong>"Jadwal Saya"</strong> milik guru/siswa terkait (bisa dilihat langsung/embed di halaman, dan diunduh).</p>
      </div>

      <BulkScheduleUploadSection
        title="Upload Jadwal Guru"
        description="Cocokkan berdasarkan NIP di awal nama file"
        endpoint="/admin/teachers/schedules/bulk"
        renderBerhasil={(b) => `${b.file} → ${b.nama} (NIP: ${b.nip})`}
      />

      <BulkScheduleUploadSection
        title="Upload Jadwal Kelas"
        description="Cocokkan berdasarkan tingkat + kode jurusan + rombel"
        endpoint="/admin/classes/schedules/bulk"
        renderBerhasil={(b) => `${b.file} → ${b.kelas}`}
      />
    </div>
  )
}

// PDF jauh lebih besar dari foto (sampai 10MB/file) — batasi tiap batch berdasarkan
// TOTAL ukuran (bukan cuma jumlah file) supaya tidak melebihi post_max_size server,
// mengikuti pelajaran dari kasus upload 1700+ foto sekaligus yang bikin blank putih.
const PDF_BATCH_MAX_BYTES = 40 * 1024 * 1024 // 40MB/batch
const PDF_BATCH_MAX_COUNT = 20

function buildSizeAwareBatches(files: File[]): File[][] {
  const batches: File[][] = []
  let current: File[] = []
  let currentBytes = 0
  for (const f of files) {
    if (current.length > 0 && (currentBytes + f.size > PDF_BATCH_MAX_BYTES || current.length >= PDF_BATCH_MAX_COUNT)) {
      batches.push(current)
      current = []
      currentBytes = 0
    }
    current.push(f)
    currentBytes += f.size
  }
  if (current.length > 0) batches.push(current)
  return batches
}

function BulkScheduleUploadSection({ title, description, endpoint, renderBerhasil }: {
  title: string; description: string; endpoint: string
  renderBerhasil: (b: ScheduleUploadResult['berhasil'][number]) => string
}) {
  const [files, setFiles] = useState<File[]>([])
  const [result, setResult] = useState<ScheduleUploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{ batch: number; totalBatch: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function startUpload() {
    setUploading(true)
    setError(null)
    setResult(null)

    const batches = buildSizeAwareBatches(files)
    const merged: ScheduleUploadResult = { message: '', summary: { total: 0, berhasil: 0, gagal: 0 }, berhasil: [], gagal: [] }

    for (let i = 0; i < batches.length; i++) {
      setProgress({ batch: i + 1, totalBatch: batches.length })
      try {
        const form = new FormData()
        batches[i].forEach(f => form.append('files[]', f))
        const resp = await api.post<ScheduleUploadResult>(endpoint, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        merged.berhasil.push(...resp.data.berhasil)
        merged.gagal.push(...resp.data.gagal)
      } catch (err: any) {
        const reason = err?.response?.data?.message ?? 'Gagal mengunggah batch ini (kemungkinan jaringan terputus) — coba upload ulang file yang gagal.'
        batches[i].forEach(f => merged.gagal.push({ file: f.name, alasan: reason }))
      }
    }

    merged.summary = {
      total: merged.berhasil.length + merged.gagal.length,
      berhasil: merged.berhasil.length,
      gagal: merged.gagal.length,
    }
    merged.message = 'Proses upload selesai.'

    setResult(merged)
    setProgress(null)
    setUploading(false)
  }

  function pickFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    setFiles(Array.from(list).filter(f => /\.pdf$/i.test(f.name)))
    setResult(null)
    setError(null)
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-sm flex items-center gap-1.5"><FileText className="h-4 w-4" />{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" />Pilih File PDF
        </Button>
        <input ref={fileRef} type="file" accept="application/pdf" multiple className="hidden"
          onClick={e => { (e.currentTarget as HTMLInputElement).value = '' }}
          onChange={(e) => pickFiles(e.target.files)} />
      </div>

      {files.length > 0 && (
        <p className="text-xs text-muted-foreground">{files.length} file PDF dipilih.</p>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" disabled={files.length === 0 || uploading} onClick={startUpload}>
          {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
          Upload {files.length > 0 ? `(${files.length} file)` : ''}
        </Button>
        {(files.length > 0 || result || error) && !uploading && (
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { setFiles([]); setResult(null); setError(null); if (fileRef.current) fileRef.current.value = '' }}
          >
            Reset
          </button>
        )}
      </div>

      {progress && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Mengupload batch {progress.batch} dari {progress.totalBatch}...</p>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (progress.batch / progress.totalBatch) * 100)}%` }} />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 flex gap-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <PhotoStatCard label="Total File" value={result.summary.total} tone="muted" />
            <PhotoStatCard label="Berhasil" value={result.summary.berhasil} tone="green" />
            <PhotoStatCard label="Gagal" value={result.summary.gagal} tone="red" />
          </div>

          {result.berhasil.length > 0 && (
            <div className="rounded-md border border-green-200 bg-green-50 p-2.5 max-h-48 overflow-y-auto">
              <p className="text-xs font-medium text-green-800 mb-1.5">Berhasil ({result.berhasil.length})</p>
              <ul className="text-xs text-green-700 space-y-0.5">
                {result.berhasil.slice(0, 300).map((b, i) => <li key={i}>{renderBerhasil(b)}</li>)}
                {result.berhasil.length > 300 && (
                  <li className="italic text-green-600">...dan {result.berhasil.length - 300} lainnya (daftar dipersingkat, semua tetap tersimpan).</li>
                )}
              </ul>
            </div>
          )}

          {result.gagal.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 max-h-48 overflow-y-auto">
              <p className="text-xs font-medium text-amber-800 mb-1.5">Gagal / dilewati ({result.gagal.length})</p>
              <ul className="text-xs text-amber-700 space-y-0.5">
                {result.gagal.slice(0, 300).map((g, i) => <li key={i}>{g.file} — {g.alasan}</li>)}
                {result.gagal.length > 300 && (
                  <li className="italic text-amber-600">...dan {result.gagal.length - 300} lainnya (daftar dipersingkat).</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL: PASSWORD DEFAULT GURU & SISWA
// Dipakai oleh tombol "Generate Akun" dan reset password per-akun. Ditempatkan
// di tab Pengguna (bukan tab Sistem sendiri) supaya sebaris dengan aksi yang
// memakainya. Nilai lama tidak pernah dikirim balik dari server — hanya bentuk
// tersamar — jadi input kosong berarti "jangan diubah".
// ─────────────────────────────────────────────────────────────────────────────
interface PasswordDefaultInfo {
  masked: string | null
  is_set: boolean
  sumber: 'panel' | 'env' | null
  env_key: string
  env_is_set: boolean
  rusak: boolean
}

function PasswordDefaultPanel() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [guruPw, setGuruPw] = useState('')
  const [siswaPw, setSiswaPw] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const { data, isLoading } = useQuery<{ guru: PasswordDefaultInfo; siswa: PasswordDefaultInfo }>({
    queryKey: ['admin-password-defaults'],
    queryFn: () => api.get('/admin/password-defaults').then(r => r.data.data),
    // Sengaja TIDAK menunggu panel dibuka: lencana peringatan di kepala panel harus
    // terlihat tanpa admin perlu mengklik apa pun. Kalau baru ketahuan saat Generate
    // Akun / import gagal, itu sudah terlambat.
  })

  const save = useMutation({
    mutationFn: () => api.put('/admin/password-defaults', {
      ...(guruPw ? { teacher_password: guruPw } : {}),
      ...(siswaPw ? { student_password: siswaPw } : {}),
    }).then(r => r.data),
    onSuccess: (d: any) => {
      setGuruPw(''); setSiswaPw('')
      setMsg({ type: 'ok', text: d.message })
      qc.invalidateQueries({ queryKey: ['admin-password-defaults'] })
    },
    onError: (e: any) => setMsg({ type: 'err', text: e.response?.data?.message ?? 'Gagal menyimpan.' }),
  })

  const clear = useMutation({
    mutationFn: (which: 'guru' | 'siswa') => api.put('/admin/password-defaults',
      which === 'guru' ? { clear_teacher: true } : { clear_student: true }).then(r => r.data),
    onSuccess: () => {
      setMsg({ type: 'ok', text: 'Password default dari panel dihapus — sistem kembali memakai nilai di .env server (bila ada).' })
      qc.invalidateQueries({ queryKey: ['admin-password-defaults'] })
    },
    onError: (e: any) => setMsg({ type: 'err', text: e.response?.data?.message ?? 'Gagal menghapus.' }),
  })

  // Generate Akun & import massal menolak jalan tanpa nilai ini, jadi keadaannya
  // harus terbaca sekilas — bukan baru ketahuan lewat error saat dipakai.
  const belum = data && !data.guru.is_set && !data.siswa.is_set
  const rusak = data && (data.guru.rusak || data.siswa.rusak)
  const peringatan = rusak ? 'Perlu diisi ulang' : belum ? 'Belum diatur' : null

  function row(label: string, info: PasswordDefaultInfo | undefined, which: 'guru' | 'siswa',
    value: string, onChange: (v: string) => void) {
    return (
      <div className="space-y-1.5">
        <Field label={`Password Default ${label}`}>
          <PasswordInput
            className={inputCls}
            placeholder={info?.is_set ? `${info.masked} (sudah diisi — kosongkan bila tidak diubah)` : 'Belum diatur — min. 8 karakter'}
            value={value} onChange={e => onChange(e.target.value)}
          />
        </Field>
        {info?.rusak && (
          <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
            <strong>Tersimpan tapi tidak terbaca.</strong> Nilai di panel dienkripsi dengan APP_KEY
            server yang lama — kemungkinan APP_KEY berganti saat deploy. Untuk sementara sistem
            memakai {info.env_is_set ? <code>{info.env_key}</code> : 'tidak ada nilai sama sekali'}.
            Isi ulang kolom ini untuk memperbaiki.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {info?.sumber === 'panel' && (
            <>Sumber: <strong>panel admin</strong> ·{' '}
              <button type="button" className="underline hover:text-foreground"
                onClick={() => { setMsg(null); if (window.confirm(`Hapus password default ${label} dari panel?`)) clear.mutate(which) }}>
                hapus &amp; kembali ke .env
              </button>
            </>
          )}
          {info?.sumber === 'env' && <>Sumber: <code>{info.env_key}</code> di .env server. Mengisi kolom ini akan menggantikannya.</>}
          {info && !info.sumber && <>Belum diatur di panel maupun <code>{info.env_key}</code> — Generate Akun &amp; reset ke default akan ditolak.</>}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted/50">
        <Key className="h-4 w-4 text-muted-foreground" />
        Password Default Guru &amp; Siswa
        {/* Peringatan muncul tanpa panel perlu dibuka — lihat komentar di useQuery. */}
        {peringatan && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
            {peringatan}
          </span>
        )}
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {open ? 'Tutup' : 'Atur'}
        </span>
      </button>

      {open && (
        <div className="border-t px-3 py-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Password ini dipakai saat tombol <strong>Generate Akun</strong> ditekan dan saat reset password
            per-akun dikosongkan. Mengubahnya <strong>tidak</strong> mengubah password akun yang sudah ada —
            jalankan Generate Akun bila ingin menerapkannya ke semua. Semua akun tetap wajib ganti password
            saat login pertama.
          </p>

          {isLoading ? <div className="h-24 rounded-lg bg-muted animate-pulse" /> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {row('Guru', data?.guru, 'guru', guruPw, setGuruPw)}
              {row('Siswa', data?.siswa, 'siswa', siswaPw, setSiswaPw)}
            </div>
          )}

          <div className="flex justify-end">
            <Button size="sm" disabled={save.isPending || (!guruPw && !siswaPw)}
              onClick={() => { setMsg(null); save.mutate() }}>
              {save.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Simpan
            </Button>
          </div>

          {msg && (
            <div className={`rounded-md border px-3 py-2 text-xs ${msg.type === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {msg.text}
            </div>
          )}
        </div>
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
  const [genLoading, setGenLoading] = useState(false)
  // Popup hasil generate/reset — blocking sampai admin klik OK, memberitahu
  // untuk siapa, nama pengguna apa, dan passwordnya apa.
  const [pwResult, setPwResult] = useState<{ mode: 'generate' | 'reset'; target: string; username: string; password: string; isDefault?: boolean } | null>(null)
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
    mutationFn: ({ uuid, password }: { uuid: string; password?: string }) =>
      api.put(`/admin/users/${uuid}/reset-password`, password ? { password } : {}).then(r => r.data),
    onSuccess: (data: any) => {
      setModal(null); setResetPw(''); setErr('')
      setPwResult({ mode: 'reset', target: data.target, username: data.username, password: data.password, isDefault: data.is_default })
    },
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
    setGenLoading(true)
    try {
      const r = await api.post('/admin/generate-accounts', null, { params: { type } })
      const d = r.data
      setPwResult({ mode: 'generate', target: d.target, username: d.username, password: d.password })
      if (type === 'guru') refetchGuru(); else refetchSiswa()
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal generate akun.')
    } finally { setGenLoading(false) }
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
          <PasswordDefaultPanel />
          {subTab === 'guru' && (
            <p className="text-xs text-muted-foreground">Username login guru = <strong>NIP</strong> · Password default diatur di panel di atas — akun wajib ganti password saat login pertama</p>
          )}
          {subTab === 'siswa' && (
            <p className="text-xs text-muted-foreground">Username login siswa = <strong>NISN</strong> · Password default diatur di panel di atas — akun wajib ganti password saat login pertama</p>
          )}
          {detailLoading ? <TableSkeleton cols={[16, 140, 90, 120, 80, 70, 90, 80, 40]} rows={8} /> : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <Th label="#" />
                    <Th label="Nama" />
                    <Th label="Nama Pengguna" />
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
                      <td className="px-3 py-2 font-mono">{u.username || '—'}</td>
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
          <p className="-mt-1 text-xs text-muted-foreground">Kosongkan untuk memakai <strong>password default</strong> (sesuai peran).</p>
          {err && <ErrMsg msg={err} />}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Batal</Button>
            <Button size="sm" disabled={doResetPw.isPending || (resetPw.length > 0 && resetPw.length < 8)}
              onClick={() => selected && doResetPw.mutate({ uuid: selected.id, password: resetPw || undefined })}>
              {doResetPw.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              {resetPw ? 'Reset Password' : 'Pakai Default'}
            </Button>
          </div>
        </Modal>
      ) : null}

      {/* ── Popup hasil generate / reset — blocking, tutup dengan OK ──────────── */}
      {pwResult && (
        <Modal
          title={pwResult.mode === 'generate' ? 'Akun Berhasil Digenerate' : (pwResult.isDefault ? 'Password Direset ke Default' : 'Password Berhasil Direset')}
          onClose={() => setPwResult(null)}>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-green-800">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <p>Catat informasi berikut dan sampaikan kepada pengguna. Password ini <strong>wajib diganti</strong> saat login pertama.</p>
            </div>
            <dl className="rounded-lg border divide-y">
              <div className="flex gap-3 px-3 py-2">
                <dt className="w-28 shrink-0 text-muted-foreground">Untuk</dt>
                <dd className="font-medium break-words">{pwResult.target}</dd>
              </div>
              <div className="flex gap-3 px-3 py-2">
                <dt className="w-28 shrink-0 text-muted-foreground">Nama Pengguna</dt>
                <dd className="font-mono break-all">{pwResult.username}</dd>
              </div>
              <div className="flex items-center gap-3 px-3 py-2">
                <dt className="w-28 shrink-0 text-muted-foreground">Password</dt>
                <dd className="font-mono font-semibold break-all">{pwResult.password}</dd>
              </div>
            </dl>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm"
              onClick={() => navigator.clipboard?.writeText(`Nama Pengguna: ${pwResult.username}\nPassword: ${pwResult.password}`)}>
              <Copy className="h-4 w-4 mr-1" /> Salin Username &amp; Password
            </Button>
            <Button size="sm" onClick={() => setPwResult(null)}><Check className="h-4 w-4 mr-1" /> OK, Sudah Dicatat</Button>
          </div>
        </Modal>
      )}
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
  const [wizardOpen, setWizardOpen] = useState(false)
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

  // Kunci semester: TA lama dibekukan (read-only) supaya arsipnya tidak terkorup.
  const setLocked = useMutation({
    mutationFn: ({ id, locked }: { id: string; locked: boolean }) =>
      adminApi.updateAcademicYear(id, { locked }),
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
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
            <GraduationCap className="mr-1 h-4 w-4" />Naik Kelas
          </Button>
          <Button size="sm" onClick={openAdd}><Plus className="mr-1 h-4 w-4" />Tambah</Button>
        </div>
      </div>

      {wizardOpen && <NaikKelasWizard years={years ?? []} onClose={() => setWizardOpen(false)} />}

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
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {y.aktif
                        ? <Badge className="bg-green-100 text-green-700">Aktif</Badge>
                        : y.locked
                          ? <Badge className="bg-slate-200 text-slate-700"><Lock className="h-3 w-3 mr-0.5" />Terkunci</Badge>
                          : <button
                              onClick={() => setAktif.mutate(y.id)}
                              className="text-xs text-primary hover:underline"
                              disabled={setAktif.isPending}
                            >Set Aktif</button>
                      }
                    </div>
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
                          onClick={() => {
                            const pesan = y.locked
                              ? 'Buka kunci tahun ajaran ini? Data arsipnya akan bisa diubah lagi.'
                              : 'Kunci tahun ajaran ini? Semua datanya menjadi arsip baca-saja (agenda, presensi, jadwal tidak bisa diubah).'
                            if (window.confirm(pesan)) setLocked.mutate({ id: y.id, locked: !y.locked })
                          }}
                          disabled={setLocked.isPending}
                          title={y.locked ? 'Buka kunci (arsip bisa diubah lagi)' : 'Kunci sebagai arsip baca-saja'}
                          className={`rounded p-1 hover:bg-accent ${y.locked ? 'text-slate-700' : 'text-muted-foreground'}`}
                        >{y.locked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}</button>
                      )}
                      {!y.aktif && !y.locked && (
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(() => {
    const slug  = searchParams.get('tab')
    const label = slug ? TAB_SLUG_TO_LABEL[slug] : null
    const idx   = label ? TABS.indexOf(label) : -1
    return idx >= 0 ? idx : 0
  })
  // Kategori yang sedang DILIHAT (boleh beda dari kategori tab aktif — user bisa
  // mengintip kategori lain tanpa kehilangan tab yang sedang terbuka).
  const [activeGroup, setActiveGroup] = useState(() => groupIndexOfTab(TABS[activeTab] ?? 'Guru'))
  const qc = useQueryClient()

  // Ganti tab kembali ke atas — kalau tab sebelumnya panjang (scroll turun) dan tab
  // baru masih memuat/kosong, tanpa ini area yang terlihat jadi kosong sampai user
  // sadar harus scroll naik sendiri (terkesan blank/freeze).
  // Sekaligus: URL selalu menyimpan tab aktif (?tab=slug) supaya refresh, tombol
  // back, dan share link mendarat di tab yang sama — dulu cuma 3 tab yang bisa.
  useEffect(() => {
    window.scrollTo(0, 0)
    setActiveGroup(groupIndexOfTab(TABS[activeTab] ?? 'Guru'))
    const slug = TAB_META[TABS[activeTab]]?.slug
    if (slug && searchParams.get('tab') !== slug) {
      setSearchParams({ tab: slug }, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Prefetch data ringan yang dipakai banyak tab — mount langsung
  useEffect(() => {
    qc.prefetchQuery({ queryKey: ['admin-classes'],        queryFn: () => adminApi.getClasses() })
    qc.prefetchQuery({ queryKey: ['admin-students', '', '', 'aktif', 1, 25 as PerPageOpt], queryFn: () => adminApi.getStudents({ status_siswa: 'aktif', page: 1, per_page: 25 }) })
  }, [qc])

  // Prefetch on hover — data diambil saat user bergerak ke arah tab sebelum klik
  function prefetchTab(index: number) {
    // Switch berbasis LABEL — indeks bergeser tiap TABS berubah.
    switch (TABS[index]) {
      case 'Guru':
        qc.prefetchQuery({ queryKey: ['admin-teachers', '', 1, 25 as PerPageOpt], queryFn: () => adminApi.getTeachers({ page: 1, per_page: 25 }) })
        break
      case 'Siswa':
        qc.prefetchQuery({ queryKey: ['admin-students', '', '', 'aktif', 1, 25 as PerPageOpt], queryFn: () => adminApi.getStudents({ status_siswa: 'aktif', page: 1, per_page: 25 }) })
        break
      case 'Kelas':
        qc.prefetchQuery({ queryKey: ['admin-classes'], queryFn: () => adminApi.getClasses() })
        qc.prefetchQuery({ queryKey: ['admin-teachers', 'all'], queryFn: () => adminApi.getTeachers({ per_page: 'all' }) })
        break
      case 'Mapel':
        qc.prefetchQuery({ queryKey: ['admin-subjects'], queryFn: adminApi.getSubjects })
        break
      case 'Jadwal':
        qc.prefetchQuery({ queryKey: ['admin-classes'],             queryFn: () => adminApi.getClasses() })
        qc.prefetchQuery({ queryKey: ['admin-subjects'],            queryFn: adminApi.getSubjects })
        qc.prefetchQuery({ queryKey: ['admin-teachers', 'all'],    queryFn: () => adminApi.getTeachers({ per_page: 'all' }) })
        qc.prefetchQuery({ queryKey: ['admin-schedules', '', '', '', 1, 25 as PerPageOpt], queryFn: () => adminApi.getSchedules({ page: 1, per_page: 25 }) })
        break
      case 'Karakter':
        qc.prefetchQuery({ queryKey: ['admin-char-cats'], queryFn: adminApi.getCharacterCategories })
        qc.prefetchQuery({ queryKey: ['admin-char-subs'], queryFn: () => adminApi.getCharacterSubitems() })
        break
      case 'Ambang':
        qc.prefetchQuery({ queryKey: ['admin-thresholds'], queryFn: adminApi.getThresholds })
        break
      case 'Pengguna':
        qc.prefetchQuery({ queryKey: ['admin-users'], queryFn: () => adminApi.getAdminUsers() })
        break
      case 'Nilai Manual':
        qc.prefetchQuery({ queryKey: ['admin-manual-notes', 'all', 1], queryFn: () => adminApi.getManualNotes({ page: 1 }) })
        break
    }
  }

  const activeLabel = TABS[activeTab]
  const activeMeta  = TAB_META[activeLabel]
  const group       = TAB_GROUPS[activeGroup]

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Panel Admin</h1>
      <p className="mb-4 text-sm text-muted-foreground">Kelola data master aplikasi</p>

      {/* ── Navigasi HP: dropdown bergrup — 22 tab tidak muat sebagai baris ── */}
      <div className="mb-4 md:hidden">
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm font-medium"
          value={activeTab}
          onChange={(e) => setActiveTab(Number(e.target.value))}
        >
          {TAB_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.tabs.map((t) => (
                <option key={t} value={TABS.indexOf(t)}>{t}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* ── Navigasi desktop dua tingkat: kategori → menu ── */}
      <div className="hidden md:block mb-2">
        <div className="flex flex-wrap gap-1.5">
          {TAB_GROUPS.map((g, gi) => (
            <button
              key={g.label}
              onClick={() => setActiveGroup(gi)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                gi === activeGroup
                  ? 'border-primary bg-primary text-primary-foreground'
                  : g.tabs.includes(activeLabel)
                    ? 'border-primary/40 text-primary hover:bg-primary/5'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent',
              )}
            >
              <g.icon className="h-3.5 w-3.5" /> {g.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1 border-b">
          {group.tabs.map((t) => {
            const i    = TABS.indexOf(t)
            const Icon = TAB_META[t].icon
            return (
              <button
                key={t}
                onClick={() => setActiveTab(i)}
                onMouseEnter={() => prefetchTab(i)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
                  activeTab === i
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" /> {t}
              </button>
            )
          })}
        </div>
      </div>

      {/* Judul + deskripsi tab aktif — menjawab "tab ini buat apa?" tanpa menebak */}
      {activeMeta && (
        <p className="mb-4 text-xs text-muted-foreground flex items-center gap-1.5">
          <activeMeta.icon className="h-3.5 w-3.5 shrink-0" />
          <span><strong className="text-foreground">{activeLabel}</strong> — {activeMeta.desc}</span>
        </p>
      )}

      {/* Render berbasis LABEL (bukan indeks) — supaya menambah/menghapus tab di TABS
          tidak menggeser pemetaan komponen secara diam-diam. */}
      <div>
        {activeLabel === 'Guru' && <GuruTab />}
        {activeLabel === 'Siswa' && <SiswaTab />}
        {activeLabel === 'Kelas' && <KelasTab />}
        {activeLabel === 'Mapel' && <MapelTab />}
        {activeLabel === 'Jadwal' && <JadwalTab />}
        {activeLabel === 'Karakter' && <KarakterAdminTab />}
        {activeLabel === 'Ambang' && <AmbangTab />}
        {activeLabel === 'Pengguna' && <PenggunaTab />}
        {activeLabel === 'Tahun Ajaran' && <TahunAjaranTab />}
        {activeLabel === 'TA Arsip' && <ArsipWriteTab />}
        {activeLabel === 'Nilai Manual' && <CatatanManualTab />}
        {activeLabel === 'Kalender' && <KalenderAdminTab />}
        {activeLabel === 'Backup & Restore' && <BackupRestoreTab />}
        {activeLabel === 'Pengaturan Agenda' && <PengaturanAgendaTab />}
        {activeLabel === 'Foto Siswa & Guru' && <FotoBulkUploadTab />}
        {activeLabel === 'Jadwal PDF' && <JadwalPdfBulkUploadTab />}
        {activeLabel === 'Penyimpanan' && <R2StorageAdminTab />}
        {activeLabel === 'Notifikasi Push' && <FcmPushAdminTab />}
        {activeLabel === 'Guru Inval' && <InvalAdminTab />}
        {activeLabel === 'Deploy & Maintenance' && <DeployToolsTab />}
        {activeLabel === 'PKL' && <PklAdminTab />}
        {activeLabel === 'Kokurikuler' && <KokurikulerAdminTab />}
        {activeLabel === 'Jam & Bel' && <BelAdminTab />}
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
          onClick={e => { (e.currentTarget as HTMLInputElement).value = '' }}
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

// Guard bersama: import XML & Dapodik siswa butuh Tahun Ajaran aktif (jadwal, kelas,
// dan siswa terikat ke sana). Dulu guard ini milik tab "Import Data"; sekarang tiap
// kartu berdiri sendiri di tab Guru/Jadwal/Siswa.
function TanpaTahunAjaranAktif() {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <h2 className="text-sm font-semibold text-amber-900">Belum ada Tahun Ajaran aktif</h2>
        <p className="text-sm text-amber-800 mt-1">
          Import ini butuh Tahun Ajaran aktif. Buat atau aktifkan dulu lewat Panel Admin →
          kategori Akademik → tab <strong>Tahun Ajaran</strong>.
        </p>
      </div>
    </div>
  )
}

function useHasActiveYear() {
  const { data: years, isLoading } = useQuery({
    queryKey: ['admin-academic-years'],
    queryFn: () => adminApi.getAcademicYears(),
  })

  return { hasActiveYear: !!years?.some((y) => y.aktif), yearsLoading: isLoading }
}

// Kartu "Format Import Data Guru" (3 sheet: Daftar Guru, Wali Kelas, Program Keahlian)
// — satu-satunya jalur import guru; menggantikan import Excel guru generik yang lama.
function GuruLengkapImportCard() {
  const qc = useQueryClient()

  return (
      <ImportCard
        title="Daftar Guru (Format Import Data Guru)"
        badge="Data Guru Utama"
        badgeColor="bg-blue-100 text-blue-700"
        description="Sumber utama identitas guru — NIP, NUPTK, dan data pribadi Dapodik. Satu file Excel berisi 3 sheet: Daftar Guru, Wali Kelas, dan Data Program Keahlian. Upload ulang aman: guru yang sudah ada diperbarui/dilengkapi, bukan digandakan."
        bullets={[
          'Sheet "Daftar Guru" — cocokkan guru yang sudah ada lewat NIP → NUPTK → nama; sisanya dibuat baru',
          'Kolom "Jenis PTK" = Guru BK otomatis mengaktifkan menu khusus BK',
          'Sheet "Wali Kelas" — assign wali kelas per kelas (cocokkan lewat NIP, fallback nama)',
          'Sheet "Data Program Keahlian" — disimpan sebagai data referensi program keahlian',
          'Baris yang gagal dicocokkan dilaporkan satu per satu, baris lain tetap diproses',
        ]}
        warning={`Format file: "Format Import Data Guru.xlsx" — header baris 3 (Daftar Guru & Wali Kelas) / baris 2 (Data Program Keahlian). Sheet "Wali Kelas" butuh data Kelas (dari Import XML di tab Jadwal) — kalau baris wali kelas gagal karena kelas belum ada, upload ulang file ini setelah import XML selesai.`}
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
  )
}

// Kartu import XML aSc Timetables — dipakai tombol "Import XML" di tab Jadwal.
function JadwalXmlImportCard() {
  const qc = useQueryClient()
  const { hasActiveYear, yearsLoading } = useHasActiveYear()

  if (!yearsLoading && !hasActiveYear) return <TanpaTahunAjaranAktif />

  return (
      <ImportCard
        title="aSc Timetables XML"
        badge="Lengkapi Jadwal & Gelar"
        badgeColor="bg-purple-100 text-purple-700"
        description="Melengkapi data guru (dari import di tab Guru) dengan jadwal mengajar, gelar, dan mata pelajaran yang diampu. Juga membuat data kelas & mata pelajaran dari file ekspor aSc. Urutan disarankan: import guru dulu, baru XML ini."
        bullets={[
          'Mata pelajaran — nama, kode, kelompok',
          'Guru — dicocokkan ke akun yang sudah ada lewat nama (fallback: ejaan mirip); dilengkapi gelar & mapel utama kalau belum ada',
          'Kelas — tingkat, jurusan, rombel untuk tahun ajaran aktif',
          'Jadwal — hari, jam, guru, kelas, mapel (750+ jadwal sekaligus); upload ulang memperbarui jadwal yang sama, bel yang sudah dikustom tidak ditimpa',
        ]}
        warning="Guru yang belum pernah diimport akan tetap dibuat otomatis (tanpa NIP) — sebaiknya import guru dulu di tab Guru."
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
  )
}

// Kartu import Dapodik siswa — dipakai tombol "Import Dapodik" di tab Siswa.
function DapodikSiswaImportCard() {
  const qc = useQueryClient()
  const { hasActiveYear, yearsLoading } = useHasActiveYear()

  if (!yearsLoading && !hasActiveYear) return <TanpaTahunAjaranAktif />

  return (
      <ImportCard
        title="Daftar Peserta Didik (Dapodik Excel)"
        badge="Import Semua Siswa"
        badgeColor="bg-green-100 text-green-700"
        description="Import seluruh siswa aktif dari Dapodik. Assign otomatis ke kelas berdasarkan kolom Rombel. Mendukung 1.700+ siswa sekaligus. Saling melengkapi dengan Import Excel: siswa yang sudah ada hanya dilengkapi datanya, tidak diduplikasi."
        bullets={[
          'Nama, NISN (ID nasional), NIPD (nomor induk lokal/NIS), jenis kelamin',
          'Assign ke kelas berdasarkan "Rombel Saat Ini" (contoh: XI RPL A)',
          'Angkatan otomatis dihitung dari tingkat kelas',
          'Nama ayah & ibu (untuk kebutuhan BK dan data orang tua)',
          'HP siswa — kontak langsung',
          'Email (jika tersedia); default: NISN@siswa.smkn2cimahi.sch.id',
          'Upload ulang aman — siswa dicocokkan lewat NISN/NIS lalu diperbarui, bukan digandakan',
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
  )
}

const SKIP_LABELS: Record<string, string> = {
  mapel_tak_dikenal: 'Mapel tak dikenal',
  kelas_tak_dikenal: 'Kelas tak dikenal',
  tanpa_guru: 'Tanpa guru',
  guru_tak_dikenal: 'Guru tak dikenal',
  jam_tak_dikenal: 'Jam tak dikenal',
}

function ResultCard({
  label, stats,
}: { label: string; stats: { created: number; updated: number; skipped: number; dinonaktifkan?: number; skip_detail?: Record<string, number> } }) {
  const skipDetail = Object.entries(stats.skip_detail ?? {}).filter(([, v]) => v > 0)
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
        {(stats.dinonaktifkan ?? 0) > 0 && (
          <div className="flex justify-between">
            <span className="text-amber-700">Dinonaktifkan (guru diganti)</span>
            <span className="font-semibold text-amber-700">{stats.dinonaktifkan}</span>
          </div>
        )}
        {stats.skipped > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dilewati</span>
            <span className="font-semibold text-muted-foreground">{stats.skipped}</span>
          </div>
        )}
        {skipDetail.map(([k, v]) => (
          <div key={k} className="flex justify-between pl-3 text-xs">
            <span className="text-muted-foreground">↳ {SKIP_LABELS[k] ?? k}</span>
            <span className="text-muted-foreground">{v}</span>
          </div>
        ))}
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
    api_key_masked: string | null; api_key_set: boolean; calendar_id: string | null; has_credentials: boolean
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
      // Kunci tidak pernah dikirim balik dari server (dimask). Biarkan kosong:
      // kosong berarti "jangan diubah", nilai tersimpan tetap dipakai.
      setApiKey('')
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

  // Berapa hari kerja dari acara kalender yang belum jadi hari tidak efektif. Menyinkronkan
  // kalender TIDAK otomatis menandainya (admin berhak menolak sebagian), dan diamnya layar
  // soal ini membuat admin mengira hari efektif guru sudah berkurang padahal belum.
  const { data: unmarked } = useQuery<{ data: {
    belum_ditandai: number; di_luar_semester: number
    semester_label: string | null; semester_mulai: string | null; semester_selesai: string | null
  } }>({
    queryKey: ['admin-ned-unmarked'],
    queryFn: () => api.get('/admin/non-effective-days/unmarked-count').then(r => r.data),
  })
  const belumDitandai   = unmarked?.data.belum_ditandai ?? 0
  const diLuarSemester  = unmarked?.data.di_luar_semester ?? 0
  const semesterLabel   = unmarked?.data.semester_label

  const autoMarkMut = useMutation({
    mutationFn: () => api.post('/admin/non-effective-days/auto-mark').then(r => r.data),
    onSuccess: (d) => {
      setMsg({ type: 'ok', text: d.message })
      qc.invalidateQueries({ queryKey: ['admin-ned'] })
      qc.invalidateQueries({ queryKey: ['calendar-events'] })
      qc.invalidateQueries({ queryKey: ['admin-ned-unmarked'] })
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
    // apiKey selalu kosong saat halaman dimuat (nilainya dimask di server), jadi
    // kunci yang SUDAH tersimpan harus ikut dihitung — kalau tidak, tombol Sinkronkan
    // mati padahal konfigurasinya lengkap.
    : syncMethod === 'api_key' ? ((!!apiKey || !!settings?.api_key_set) && !!calId)
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
                    placeholder={settings?.api_key_set
                      ? `${settings.api_key_masked} (tersimpan — kosongkan bila tidak diubah)`
                      : 'AIzaSy...'}
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
                      onClick={e => { (e.currentTarget as HTMLInputElement).value = '' }}
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

        {belumDitandai > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />
              {belumDitandai} hari dari kalender belum dihitung sebagai hari tidak efektif
            </p>
            <p className="mt-1 text-xs">
              Menyinkronkan kalender saja <strong>tidak</strong> mengurangi hari efektif guru — acara
              kalender baru berlaku setelah ditandai. Selama belum ditandai, guru melihat semua hari
              sebagai hari efektif.
            </p>
            <Button size="sm" className="mt-2"
              onClick={() => { if (confirm(`Tandai ${belumDitandai} hari dari kalender sebagai hari tidak efektif? Tanggal yang sudah ditandai tidak akan diubah.`)) autoMarkMut.mutate() }}
              disabled={autoMarkMut.isPending}>
              {autoMarkMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Tandai sekarang
            </Button>
          </div>
        )}

        {/* Kasus yang paling membingungkan: acara kalendernya ADA, penandaannya berhasil,
            tapi angka guru tidak bergerak sama sekali — karena hari efektif hanya dihitung
            di dalam rentang semester aktif. Tanpa peringatan ini, gejalanya tak bisa
            dibedakan dari bug. */}
        {diLuarSemester > 0 && (
          <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />
              {diLuarSemester} hari kalender berada di luar semester aktif
            </p>
            <p className="mt-1 text-xs">
              Hari efektif hanya dihitung di dalam rentang semester{semesterLabel ? <> <strong>{semesterLabel}</strong></> : ' aktif'}
              {unmarked?.data.semester_mulai && <> ({unmarked.data.semester_mulai} s/d {unmarked.data.semester_selesai})</>}.
              Menandai tanggal di luar rentang itu <strong>tidak akan mengubah angka apa pun</strong> yang
              dilihat guru. Kalau ini kalender semester berikutnya, buat dulu tahun ajaran/semester
              barunya di tab <strong>Tahun Ajaran</strong>, lalu aktifkan.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" variant="outline" onClick={downloadTemplate}>
            <Download className="h-3.5 w-3.5 mr-1" /> Template Excel
          </Button>
          <input ref={importNedRef} type="file" accept=".xlsx,.xls" className="hidden"
            onClick={e => { (e.currentTarget as HTMLInputElement).value = '' }}
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

// ── Penyimpanan R2 ────────────────────────────────────────────────────────────
type R2Settings = {
  access_key_id_masked: string | null; secret_access_key_set: boolean
  account_id: string | null; bucket: string | null; public_url: string | null
  aktif: boolean; is_configured: boolean
}

function R2StorageAdminTab() {
  const qc = useQueryClient()
  const [accessKeyId, setAccessKeyId] = useState('')
  const [secretKey, setSecretKey]     = useState('')
  const [accountId, setAccountId]     = useState('')
  const [bucket, setBucket]           = useState('')
  const [publicUrl, setPublicUrl]     = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const { data: settings, isLoading } = useQuery<{ data: R2Settings }>({
    queryKey: ['admin-r2-settings'],
    queryFn: () => api.get('/admin/r2/settings').then(r => r.data),
  })
  const s = settings?.data

  useEffect(() => {
    if (s) {
      setAccountId(s.account_id ?? '')
      setBucket(s.bucket ?? '')
      setPublicUrl(s.public_url ?? '')
      // access_key_id/secret_access_key SENGAJA tidak di-prefill — server tidak pernah
      // kirim nilai aslinya balik (lihat R2SettingController::show), cuma placeholder
      // masked yang ditampilkan lewat label di bawah field.
    }
  }, [s])

  const saveMut = useMutation({
    mutationFn: (aktif?: boolean) => api.put('/admin/r2/settings', {
      ...(accessKeyId ? { access_key_id: accessKeyId } : {}),
      ...(secretKey ? { secret_access_key: secretKey } : {}),
      account_id: accountId || null,
      bucket: bucket || null,
      public_url: publicUrl || null,
      ...(aktif !== undefined ? { aktif } : {}),
    }).then(r => r.data),
    onSuccess: (d) => {
      setMsg({ type: 'ok', text: d.message })
      setAccessKeyId(''); setSecretKey('')
      qc.invalidateQueries({ queryKey: ['admin-r2-settings'] })
    },
    onError: (e: any) => setMsg({ type: 'err', text: e.response?.data?.message ?? 'Gagal menyimpan.' }),
  })

  const testMut = useMutation({
    mutationFn: () => api.post('/admin/r2/test').then(r => r.data),
    onSuccess: (d) => setMsg({ type: 'ok', text: d.message }),
    onError: (e: any) => setMsg({ type: 'err', text: e.response?.data?.message ?? 'Tes koneksi gagal.' }),
  })

  const inputCls = 'w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-white'

  return (
    <div className="space-y-6 max-w-2xl">
      {msg && (
        <div className={`rounded-md border px-3 py-2 text-sm flex items-center justify-between ${msg.type === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><FolderOpen className="h-4 w-4" /> Penyimpanan Foto & Dokumen (Cloudflare R2)</h3>
          {s?.aktif && <Badge className="bg-green-100 text-green-700">Aktif</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          Foto siswa/guru, jadwal PDF, dan dokumentasi penanganan siswa disimpan di sini alih-alih di disk server —
          supaya file tidak hilang kalau server migrasi/ganti. Kredensial disimpan terenkripsi di database, bukan file.
          Kosongkan field kredensial dan biarkan nonaktif kalau tidak mau pakai R2 (file tetap di disk server seperti biasa).
        </p>

        {isLoading ? <div className="h-20 animate-pulse bg-muted rounded" /> : (
          <>
            <div>
              <label className="text-xs font-medium block mb-1">Access Key ID</label>
              <PasswordInput className={inputCls} placeholder={s?.access_key_id_masked ?? 'Belum diisi'} value={accessKeyId} onChange={e => setAccessKeyId(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Secret Access Key</label>
              <PasswordInput className={inputCls} placeholder={s?.secret_access_key_set ? '•••••••••••••••• (sudah diisi)' : 'Belum diisi'} value={secretKey} onChange={e => setSecretKey(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Account ID Cloudflare</label>
              <input className={inputCls} placeholder="32 karakter hex, dari dashboard Cloudflare → R2" value={accountId} onChange={e => setAccountId(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Bucket Name</label>
              <input className={inputCls} placeholder="mis. agenda-smk2" value={bucket} onChange={e => setBucket(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Public Development URL / Custom Domain</label>
              <input className={inputCls} placeholder="https://pub-xxxx.r2.dev" value={publicUrl} onChange={e => setPublicUrl(e.target.value)} />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={() => saveMut.mutate(undefined)} disabled={saveMut.isPending}>
                {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Simpan
              </Button>
              <Button variant="outline" onClick={() => testMut.mutate()} disabled={testMut.isPending || !s?.is_configured}>
                {testMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Tes Koneksi
              </Button>
              {s?.aktif ? (
                <Button variant="outline" onClick={() => saveMut.mutate(false)} disabled={saveMut.isPending}>Nonaktifkan</Button>
              ) : (
                <Button variant="outline" onClick={() => saveMut.mutate(true)} disabled={saveMut.isPending || !s?.is_configured}>Aktifkan</Button>
              )}
            </div>
            {!s?.is_configured && <p className="text-xs text-muted-foreground">Lengkapi & simpan semua field dulu sebelum bisa tes koneksi/aktifkan.</p>}
          </>
        )}
      </div>
    </div>
  )
}


// ── Guru Inval (pemantauan kurikulum) ────────────────────────────────────────
const INVAL_STATUS: Record<string, string> = {
  diajukan: 'bg-amber-100 text-amber-800',
  disetujui: 'bg-green-100 text-green-800',
  ditolak: 'bg-red-100 text-red-800',
  dibatalkan: 'bg-muted text-muted-foreground',
  kedaluwarsa: 'bg-muted text-muted-foreground',
}

function InvalAdminTab() {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [mulai, setMulai]   = useState('')
  const [akhir, setAkhir]   = useState('')
  const [page, setPage]     = useState(1)
  const [buka, setBuka]     = useState<string | null>(null)

  const debounced = useDebounce(search, 300)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-inval', status, debounced, mulai, akhir, page],
    queryFn: () => invalAdminApi.list({
      status: status || undefined,
      search: debounced || undefined,
      tanggal_mulai: mulai || undefined,
      tanggal_akhir: akhir || undefined,
      page,
    }),
  })

  const inputCls = 'rounded-md border border-input px-3 py-2 text-sm bg-white'

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />

  const rows = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(data?.ringkasan ?? {}).map(([k, v]) => (
          <Badge key={k} className={INVAL_STATUS[k] ?? ''}>{k}: {v}</Badge>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <input className={inputCls} placeholder="Cari nama guru…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        <select className={inputCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">Semua status</option>
          {Object.keys(INVAL_STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {/* Rentang menyaring TANGGAL SESI, bukan tanggal pengajuan — yang dicari kurikulum
            adalah siapa yang diganti minggu ini, bukan siapa yang mengetik formulir. */}
        <input type="date" className={inputCls} value={mulai} onChange={(e) => { setMulai(e.target.value); setPage(1) }} title="Tanggal sesi dari" />
        <input type="date" className={inputCls} value={akhir} onChange={(e) => { setAkhir(e.target.value); setPage(1) }} title="Tanggal sesi sampai" />
      </div>

      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Belum ada pengajuan guru inval.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Pengaju</th>
                <th className="px-3 py-2 font-medium">Pengganti</th>
                <th className="px-3 py-2 font-medium">Sesi</th>
                <th className="px-3 py-2 font-medium">Alasan</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Diajukan</th>
                <th className="px-3 py-2 font-medium">Dijawab</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r: InvalAdminRow) => (
                // Fragment WAJIB ber-key: ia elemen terluar dari map(). Tanpa ini React
                // tidak punya identitas baris dan bisa mencocokkan ulang baris yang salah
                // saat filter berubah — detail yang terbuka ikut melompat ke baris lain.
                <Fragment key={r.id}>
                  <tr className="border-t">
                    <td className="px-3 py-2">{r.pengaju}</td>
                    <td className="px-3 py-2">{r.pengganti}</td>
                    <td className="px-3 py-2">{r.jumlah_sesi} sesi</td>
                    <td className="max-w-[16rem] truncate px-3 py-2" title={r.alasan}>{r.alasan}</td>
                    <td className="px-3 py-2"><Badge className={INVAL_STATUS[r.status]}>{r.status_label}</Badge></td>
                    <td className="px-3 py-2 text-xs">{r.diajukan_pada}</td>
                    <td className="px-3 py-2 text-xs">{r.dijawab_pada ?? '—'}</td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="ghost" onClick={() => setBuka(buka === r.id ? null : r.id)}>
                        {buka === r.id ? 'Tutup' : 'Detail'}
                      </Button>
                    </td>
                  </tr>
                  {buka === r.id && (
                    <tr className="border-t bg-muted/30">
                      <td colSpan={8} className="px-3 py-3">
                        <div className="space-y-2 text-xs">
                          <div>
                            <p className="font-semibold">Sesi yang digantikan</p>
                            {r.sesi.map((s, i) => (
                              <p key={i}>{s.tanggal} • {s.jam_mulai}–{s.jam_selesai} • {s.kelas}{s.mapel ? ` • ${s.mapel}` : ''}</p>
                            ))}
                          </div>
                          {r.pesan && (
                            <div>
                              <p className="font-semibold">Pesan untuk pengganti</p>
                              <p className="whitespace-pre-wrap">{r.pesan}</p>
                            </div>
                          )}
                          {r.link_tugas && (
                            <div>
                              <p className="font-semibold">Lampiran tugas</p>
                              <a href={r.link_tugas} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                                {r.link_tugas}
                              </a>
                            </div>
                          )}
                          {r.alasan_penolakan && (
                            <div>
                              <p className="font-semibold text-red-700">Alasan penolakan</p>
                              <p>{r.alasan_penolakan}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.meta.last_page > 1 && (
        <Pagination meta={data.meta} page={page} onPage={setPage} />
      )}
    </div>
  )
}

// ── Notifikasi Push (Firebase Cloud Messaging) ───────────────────────────────
function FcmPushAdminTab() {
  const qc = useQueryClient()
  const [serviceAccount, setServiceAccount] = useState('')
  const [webApiKey, setWebApiKey]           = useState('')
  const [webAppId, setWebAppId]             = useState('')
  const [senderId, setSenderId]             = useState('')
  const [vapidKey, setVapidKey]             = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const { data: s, isLoading } = useQuery({
    queryKey: ['admin-fcm-settings'],
    queryFn: fcmAdminApi.getSettings,
  })

  useEffect(() => {
    if (!s) return
    setWebApiKey(s.web_api_key ?? '')
    setWebAppId(s.web_app_id ?? '')
    setSenderId(s.messaging_sender_id ?? '')
    setVapidKey(s.vapid_public_key ?? '')
    // service_account_json SENGAJA tidak di-prefill — server tidak pernah mengirim
    // isinya balik (berisi private key). Yang ditampilkan hanya email-nya di bawah field.
  }, [s])

  const saveMut = useMutation({
    mutationFn: (aktif?: boolean) => fcmAdminApi.updateSettings({
      ...(serviceAccount ? { service_account_json: serviceAccount } : {}),
      web_api_key: webApiKey,
      web_app_id: webAppId,
      messaging_sender_id: senderId,
      vapid_public_key: vapidKey,
      ...(aktif !== undefined ? { aktif } : {}),
    }),
    onSuccess: (d) => {
      setMsg({ type: 'ok', text: d.message })
      setServiceAccount('')
      qc.invalidateQueries({ queryKey: ['admin-fcm-settings'] })
      // Frontend meng-cache /push/config selamanya (staleTime: Infinity) — tanpa ini,
      // admin harus memuat ulang halaman sebelum tombol "Aktifkan" muncul untuk guru.
      qc.invalidateQueries({ queryKey: ['push-config'] })
    },
    onError: (e: any) => setMsg({ type: 'err', text: e.response?.data?.message ?? 'Gagal menyimpan.' }),
  })

  const testMut = useMutation({
    mutationFn: fcmAdminApi.test,
    onSuccess: (d) => setMsg({ type: 'ok', text: d.message }),
    onError: (e: any) => setMsg({ type: 'err', text: e.response?.data?.message ?? 'Tes push gagal.' }),
  })

  const inputCls = 'w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-white'

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />

  return (
    <div className="space-y-6 max-w-2xl">
      {msg && (
        <div className={`rounded-md border px-3 py-2 text-sm flex items-center justify-between ${msg.type === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><BellRing className="h-4 w-4" /> Notifikasi Push (Firebase)</h3>
          {s?.aktif && <Badge className="bg-green-100 text-green-700">Aktif</Badge>}
        </div>

        <p className="text-xs text-muted-foreground">
          Mengirim peringatan alpha, eskalasi EWS, dan pengajuan konseling langsung ke HP guru
          walau aplikasi tertutup. Selama belum diaktifkan, semua notifikasi tetap masuk ke lonceng
          di dalam aplikasi — tidak ada informasi yang hilang.
        </p>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Service Account JSON</label>
          <textarea
            rows={5}
            className={`${inputCls} font-mono text-xs`}
            placeholder={s?.service_account_set ? 'Terisi — isi hanya bila ingin mengganti' : '{ "type": "service_account", "project_id": "...", ... }'}
            value={serviceAccount}
            onChange={(e) => setServiceAccount(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Firebase Console → Project Settings → Service Accounts → <em>Generate new private key</em>,
            lalu tempel seluruh isi filenya di sini.
            {s?.service_account_email && <> Terpasang: <code className="text-[11px]">{s.service_account_email}</code></>}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Web API Key</label>
            <input className={inputCls} value={webApiKey} onChange={(e) => setWebApiKey(e.target.value)} placeholder="AIza…" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Messaging Sender ID</label>
            <input className={inputCls} value={senderId} onChange={(e) => setSenderId(e.target.value)} placeholder="1234567890" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium">Web App ID</label>
            <input className={inputCls} value={webAppId} onChange={(e) => setWebAppId(e.target.value)} placeholder="1:1234567890:web:abc123" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium">VAPID Public Key (Web Push certificate)</label>
            <input className={inputCls} value={vapidKey} onChange={(e) => setVapidKey(e.target.value)} placeholder="B…" />
            <p className="text-xs text-muted-foreground">
              Firebase Console → Project Settings → Cloud Messaging → Web configuration → Key pair.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" onClick={() => saveMut.mutate(undefined)} disabled={saveMut.isPending}>
            {saveMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
            Simpan
          </Button>

          <Button
            size="sm"
            variant={s?.aktif ? 'destructive' : 'secondary'}
            onClick={() => saveMut.mutate(!s?.aktif)}
            disabled={saveMut.isPending}
          >
            {s?.aktif ? 'Nonaktifkan' : 'Aktifkan'}
          </Button>

          {/* Tes memakai kredensial yang TERSIMPAN, bukan yang baru diketik — simpan dulu. */}
          <Button size="sm" variant="outline" onClick={() => testMut.mutate()} disabled={testMut.isPending || !s?.aktif}>
            {testMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Kirim Push Percobaan
          </Button>

          <span className="ml-auto text-xs text-muted-foreground">
            {s?.total_perangkat ?? 0} perangkat terdaftar
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
        <p className="font-semibold">Wajib: worker antrean harus berjalan</p>
        <p className="mt-1">
          Push dikirim lewat antrean agar guru tidak menunggu. Di cPanel, buat Cron Job tiap 1 menit:
        </p>
        <code className="mt-2 block rounded bg-amber-100 px-2 py-1.5 font-mono">
          /usr/local/bin/php ~/agenda/artisan queue:work --stop-when-empty --max-time=55
        </code>
        <p className="mt-2">
          Tanpa cron ini (dan dengan <code>QUEUE_CONNECTION=database</code>), notifikasi akan menumpuk
          di antrean dan tidak pernah terkirim.
        </p>
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
            onClick={e => { (e.currentTarget as HTMLInputElement).value = '' }}
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

      <CredentialTransferCard />
    </div>
  )
}

// ── Ekspor/Impor Kredensial (R2 + Push FCM + Kalender) ────────────────────────
// Kredensial R2 & FCM tersimpan TERENKRIPSI dengan APP_KEY. Kalau update server
// sampai mengganti APP_KEY (mis. cpanel-deploy.php?action=all ikut `key:generate`),
// semuanya tak terbaca lagi dan tampak "hilang" — admin harus mengetik ulang dari
// dashboard Cloudflare/Firebase. Kartu ini: ekspor sekali SEBELUM update, impor lagi
// setelahnya — nilai dienkripsi ulang otomatis dengan APP_KEY yang baru.
function CredentialTransferCard() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile]       = useState<File | null>(null)
  const [result, setResult]   = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [exLoading, setExLoading] = useState(false)

  async function exportCredentials() {
    setExLoading(true)
    try {
      const resp = await api.get('/admin/credentials/export')
      const blob = new Blob([JSON.stringify(resp.data, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const ts   = new Date().toISOString().slice(0, 10)
      const a    = document.createElement('a'); a.href = url; a.download = `kredensial-agenda-${ts}.json`; a.click()
      URL.revokeObjectURL(url)
      setError(null)
      setResult('File kredensial terunduh. Simpan di tempat aman — isinya TIDAK terenkripsi.')
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Ekspor gagal.')
      setResult(null)
    } finally {
      setExLoading(false)
    }
  }

  const importMut = useMutation({
    mutationFn: async () => {
      const form = new FormData()
      form.append('file', file as File)
      const resp = await api.post('/admin/credentials/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return resp.data as { message: string }
    },
    onSuccess: (data) => {
      setResult(data.message); setError(null); setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      qc.invalidateQueries({ queryKey: ['admin-r2-settings'] })
      qc.invalidateQueries({ queryKey: ['admin-fcm-settings'] })
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? err?.message ?? 'Impor gagal.')
      setResult(null)
    },
  })

  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Key className="h-5 w-5 text-primary-600" />
        <h3 className="text-sm font-semibold">Ekspor / Impor Kredensial (R2, Push, Kalender)</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Kredensial Penyimpanan R2 dan Notifikasi Push disimpan terenkripsi dengan kunci
        aplikasi (APP_KEY) — bila kunci itu berganti saat update server, kredensial tidak
        terbaca lagi dan harus diisi ulang. Ekspor dulu sebelum update, lalu impor lagi
        setelahnya tanpa perlu membuka dashboard Cloudflare/Firebase.
      </p>

      <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 flex gap-2 text-xs text-amber-800">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          File ekspor berisi kredensial dalam bentuk asli (tidak terenkripsi) supaya bisa
          diimpor ke server dengan kunci berbeda. Simpan di tempat aman, jangan dibagikan.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={exportCredentials} disabled={exLoading}>
          {exLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Download className="h-3.5 w-3.5 mr-1" />}
          Ekspor Kredensial
        </Button>
      </div>

      <div
        className="rounded-md border-2 border-dashed border-muted-foreground/25 p-4 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        {file ? (
          <p className="text-xs"><span className="font-medium">{file.name}</span> <span className="text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span></p>
        ) : (
          <p className="text-xs text-muted-foreground">Klik pilih file .json hasil ekspor untuk impor</p>
        )}
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
          onClick={e => { (e.currentTarget as HTMLInputElement).value = '' }}
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(null) }} />
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
        variant="outline"
        disabled={!file || importMut.isPending}
        onClick={() => {
          if (window.confirm('Impor akan MENIMPA kredensial R2/Push/Kalender yang tersimpan sekarang dengan isi file. Lanjutkan?')) {
            importMut.mutate()
          }
        }}
      >
        {importMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
        Impor Kredensial
      </Button>
    </div>
  )
}

// ── Tools Deploy & Maintenance ────────────────────────────────────────────────
// Dipakai utk update kode di cPanel tanpa Terminal/SSH: ganti vendor/dist dari zip
// yang sudah ada di repo (lihat backend/vendor.zip, frontend/dist.zip), migrate,
// dan jalankan seeder — semua lewat tombol, bukan URL manual seperti cpanel-deploy.php.
const ALLOWED_SEEDERS = ['AdminOnlySeeder', 'CharacterSeeder', 'KokurikulerDimensionSeeder']

type DeployStatus = {
  vendor: { zip_exists: boolean; zip_updated_at: string | null; dir_exists: boolean }
  dist: { zip_exists: boolean; zip_updated_at: string | null; dir_exists: boolean }
  migrations: { applied_count: number; pending_count: number; pending: string[] }
  backup_supported: boolean
}
type VerifyCheck = { nama: string; ok: boolean; detail?: string }
type VerifyData = { ok: boolean; checks: VerifyCheck[]; migrations: { pending_count: number } }
type SchemaDiff = { in_sync: boolean; missing_tables: string[]; extra_tables: string[]; missing_columns: string[]; extra_columns: string[]; type_diff: string[] }

function DeployToolsTab() {
  const [log, setLog] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [seederOpen, setSeederOpen] = useState(false)
  const [seederClass, setSeederClass] = useState(ALLOWED_SEEDERS[0])
  const [manualBackup, setManualBackup] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerifyData | null>(null)
  const [schemaResult, setSchemaResult] = useState<SchemaDiff | null>(null)

  const statusQ = useQuery({
    queryKey: ['deploy-status'],
    queryFn: async () => (await api.get('/admin/deploy-tools/status')).data.data as DeployStatus,
  })
  const mig = statusQ.data?.migrations

  function onResult(data: { log: string[] }) { setLog(data.log ?? []); setError(null); setVerifyResult(null); statusQ.refetch() }
  function onErr(err: any) { setError(err?.response?.data?.message ?? err?.message ?? 'Gagal menjalankan aksi.') }

  const body = () => ({ skip_backup: manualBackup })
  const deployMut      = useMutation({ mutationFn: async () => (await api.post('/admin/deploy-tools/deploy', body())).data, onSuccess: onResult, onError: onErr })
  const buildDistMut   = useMutation({ mutationFn: async () => (await api.post('/admin/deploy-tools/build-dist')).data, onSuccess: onResult, onError: onErr })
  const buildVendorMut = useMutation({ mutationFn: async () => (await api.post('/admin/deploy-tools/build-vendor')).data, onSuccess: onResult, onError: onErr })
  const migrateMut     = useMutation({ mutationFn: async () => (await api.post('/admin/deploy-tools/migrate', body())).data, onSuccess: onResult, onError: onErr })
  const verifyMut      = useMutation({ mutationFn: async () => (await api.post('/admin/deploy-tools/verify')).data.data as VerifyData, onSuccess: (d) => { setVerifyResult(d); setError(null) }, onError: onErr })
  const schemaMut      = useMutation({ mutationFn: async () => (await api.post('/admin/deploy-tools/schema-diff')).data.data as SchemaDiff, onSuccess: (d) => { setSchemaResult(d); setError(null) }, onError: onErr })
  const seedMut = useMutation({
    mutationFn: async () => (await api.post('/admin/deploy-tools/seed', { class: seederClass })).data,
    onSuccess: (data: { log: string[] }) => { onResult(data); setSeederOpen(false) },
    onError: onErr,
  })
  const pruneMut = useMutation({
    mutationFn: async () => (await api.post('/admin/deploy-tools/prune-jadwal-pdf')).data as { message: string },
    onSuccess: (d) => { setLog([d.message]); setError(null); setVerifyResult(null) },
    onError: onErr,
  })

  const anyPending = deployMut.isPending || buildDistMut.isPending || buildVendorMut.isPending || migrateMut.isPending || seedMut.isPending || pruneMut.isPending || verifyMut.isPending || schemaMut.isPending

  const actions: Array<{
    key: string; label: string; icon: typeof RefreshCw; tone: 'green' | 'yellow' | 'blue'
    desc: string; confirm: string; mut: { mutate: () => void; isPending: boolean }
  }> = [
    {
      key: 'deploy', label: 'Deploy', icon: RefreshCw, tone: 'green',
      desc: 'Backup DB otomatis → migrate + extract dist.zip + clear cache — sekaligus.',
      confirm: 'Jalankan Deploy?\n\nUrutan: BACKUP database dulu (otomatis), lalu migrate, MENGHAPUS folder frontend/dist lalu ganti dari dist.zip, clear cache. Data lama tidak dihapus (migrasi aditif). Pastikan dist.zip sudah versi terbaru (git pull dulu).',
      mut: deployMut,
    },
    {
      key: 'build-dist', label: 'Build Dist', icon: Upload, tone: 'yellow',
      desc: 'Hapus folder frontend/dist lama, extract dist.zip.',
      confirm: 'Hapus folder frontend/dist saat ini dan gantikan dari dist.zip?',
      mut: buildDistMut,
    },
    {
      key: 'build-vendor', label: 'Build Vendor', icon: FolderOpen, tone: 'yellow',
      desc: 'Hapus folder backend/vendor lama, extract vendor.zip.',
      confirm: 'Hapus folder vendor saat ini dan gantikan dari vendor.zip? Pastikan vendor.zip sudah versi terbaru.',
      mut: buildVendorMut,
    },
    {
      key: 'migrate', label: 'Migrate', icon: FileCode2, tone: 'blue',
      desc: 'Backup DB otomatis → migrate --force (aditif, tidak menghapus data).',
      confirm: 'Jalankan migrasi database?\n\nBackup otomatis dibuat dulu, lalu migrate --force (hanya menambah kolom/tabel — data lama aman).',
      mut: migrateMut,
    },
    {
      key: 'prune-jadwal', label: 'Bersihkan PDF Jadwal Yatim', icon: Trash2, tone: 'yellow',
      desc: 'Hapus berkas PDF jadwal yang tak lagi tertaut ke guru/kelas (sisa reset/re-import DB).',
      confirm: 'Hapus berkas PDF jadwal yatim?\n\nHanya berkas yang TIDAK direferensikan guru/kelas mana pun yang dihapus. Berkas yang masih dipakai tetap aman.',
      mut: pruneMut,
    },
  ]

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1">Tools Deploy & Maintenance</h2>
        <p className="text-sm text-muted-foreground">
          Update kode & database langsung dari sini — tanpa Terminal/SSH di cPanel.
          Semua tombol di sini mengandalkan{' '}
          <code className="px-1 py-0.5 rounded bg-muted">vendor.zip</code> /{' '}
          <code className="px-1 py-0.5 rounded bg-muted">dist.zip</code> yang sudah
          ter-update di server (lewat Git pull) — build ulang & commit dulu dari lokal
          sebelum menekan tombol di sini.
        </p>
      </div>

      {/* Preflight: status server & migrasi pending */}
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold flex items-center gap-1.5"><FileCode2 className="h-3.5 w-3.5" /> Status Server</h3>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={statusQ.isFetching} onClick={() => statusQ.refetch()}>
            {statusQ.isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Muat ulang'}
          </Button>
        </div>
        {mig ? (
          mig.pending_count > 0 ? (
            <div className="rounded border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              <p className="font-medium flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {mig.pending_count} migrasi belum diterapkan (perubahan database menunggu):</p>
              <ul className="mt-1 pl-4 list-disc space-y-0.5 max-h-28 overflow-y-auto">
                {mig.pending.map(m => <li key={m} className="font-mono">{m}</li>)}
              </ul>
              <p className="mt-1.5">Tekan <span className="font-medium">Deploy</span> atau <span className="font-medium">Migrate</span> untuk menerapkannya (backup otomatis dulu).</p>
            </div>
          ) : (
            <p className="text-xs text-green-700 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Semua migrasi sudah diterapkan ({mig.applied_count}). Tidak ada perubahan DB menunggu.</p>
          )
        ) : (
          <p className="text-xs text-muted-foreground">{statusQ.isLoading ? 'Memuat status…' : 'Status tidak tersedia.'}</p>
        )}
        {statusQ.data && (
          <p className="text-[11px] text-muted-foreground">
            dist.zip: {statusQ.data.dist.zip_updated_at ?? '—'} · vendor.zip: {statusQ.data.vendor.zip_updated_at ?? '—'}
            {statusQ.data.backup_supported ? '' : ' · ⚠ backup otomatis tidak didukung driver DB ini'}
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {actions.map(a => (
            <Button
              key={a.key}
              size="sm"
              disabled={anyPending}
              onClick={() => window.confirm(a.confirm) && a.mut.mutate()}
              className={cn(
                a.tone === 'green' && 'bg-green-600 hover:bg-green-700 text-white',
                a.tone === 'yellow' && 'bg-amber-500 hover:bg-amber-600 text-white',
                a.tone === 'blue' && 'bg-blue-600 hover:bg-blue-700 text-white',
              )}
            >
              {a.mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <a.icon className="h-3.5 w-3.5 mr-1" />}
              {a.label}
            </Button>
          ))}
          <Button size="sm" variant="outline" disabled={anyPending} onClick={() => verifyMut.mutate()}>
            {verifyMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
            Verifikasi
          </Button>
          <Button size="sm" variant="outline" disabled={anyPending} onClick={() => schemaMut.mutate()}>
            {schemaMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileCode2 className="h-3.5 w-3.5 mr-1" />}
            Bandingkan Skema
          </Button>
          <Button size="sm" variant="outline" disabled={anyPending} onClick={() => setSeederOpen(true)}>
            <Users className="h-3.5 w-3.5 mr-1" />
            Seeder
          </Button>
        </div>

        {/* Fallback: lewati backup otomatis bila server tak bisa mysqldump */}
        <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" className="mt-0.5" checked={manualBackup} onChange={e => setManualBackup(e.target.checked)} />
          <span>
            <span className="font-medium text-foreground">Saya sudah backup manual</span> — lewati backup otomatis sebelum Migrate/Deploy.
            Centang HANYA jika Anda sudah mengunduh backup lewat menu <span className="font-medium">Backup Database</span>
            {' '}(mis. server tidak mendukung backup otomatis).
          </span>
        </label>

        <ul className="text-xs text-muted-foreground space-y-0.5">
          {actions.map(a => <li key={a.key}><span className="font-medium text-foreground">{a.label}:</span> {a.desc}</li>)}
          <li><span className="font-medium text-foreground">Seeder:</span> pilih seeder yang aman dijalankan ulang di produksi (bukan data demo/fiktif).</li>
        </ul>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 flex gap-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{error}
        </div>
      )}

      {verifyResult && (
        <div className={cn('rounded-lg border p-4', verifyResult.ok ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50')}>
          <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            {verifyResult.ok
              ? <><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Verifikasi: semua sehat</>
              : <><AlertCircle className="h-3.5 w-3.5 text-amber-600" /> Verifikasi: ada yang perlu diperbaiki</>}
          </h3>
          <ul className="space-y-1 text-xs">
            {verifyResult.checks.map(c => (
              <li key={c.nama} className="flex items-start gap-1.5">
                {c.ok
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                  : <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />}
                <span className={c.ok ? '' : 'text-red-700'}>{c.nama}{c.detail ? <span className="text-muted-foreground"> — {c.detail}</span> : null}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {schemaResult && (
        <div className={cn('rounded-lg border p-4', schemaResult.in_sync ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50')}>
          <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            {schemaResult.in_sync
              ? <><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Skema server = lokal (tidak ada kolom/tabel yang beda)</>
              : <><AlertCircle className="h-3.5 w-3.5 text-amber-600" /> Skema server BERBEDA dari lokal</>}
          </h3>
          {schemaResult.in_sync ? (
            <p className="text-xs text-muted-foreground">Semua tabel & kolom di server cocok dengan snapshot lokal.</p>
          ) : (
            <div className="space-y-2 text-xs">
              {schemaResult.missing_tables.length > 0 && (
                <div><p className="font-medium text-red-700">Tabel belum ada di server ({schemaResult.missing_tables.length}) — perlu migrate:</p>
                  <p className="font-mono text-red-600 break-words">{schemaResult.missing_tables.join(', ')}</p></div>
              )}
              {schemaResult.missing_columns.length > 0 && (
                <div><p className="font-medium text-red-700">Kolom belum ada di server ({schemaResult.missing_columns.length}) — perlu migrate:</p>
                  <ul className="mt-0.5 pl-4 list-disc font-mono text-red-600 max-h-32 overflow-y-auto">{schemaResult.missing_columns.map(c => <li key={c}>{c}</li>)}</ul></div>
              )}
              {schemaResult.extra_tables.length > 0 && (
                <div><p className="font-medium text-amber-700">Tabel hanya ada di server ({schemaResult.extra_tables.length}):</p>
                  <p className="font-mono text-amber-700 break-words">{schemaResult.extra_tables.join(', ')}</p></div>
              )}
              {schemaResult.extra_columns.length > 0 && (
                <div><p className="font-medium text-amber-700">Kolom hanya ada di server ({schemaResult.extra_columns.length}):</p>
                  <p className="font-mono text-amber-700 break-words">{schemaResult.extra_columns.join(', ')}</p></div>
              )}
              <p className="text-muted-foreground pt-1">Kolom/tabel yang hilang di server biasanya karena migrasi belum jalan — tekan <span className="font-medium">Deploy</span> atau <span className="font-medium">Migrate</span>.</p>
            </div>
          )}
          {schemaResult.type_diff.length > 0 && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-muted-foreground">Beda tipe kolom ({schemaResult.type_diff.length}) — biasanya sekadar beda versi MySQL, bukan masalah</summary>
              <ul className="mt-1 pl-4 list-disc font-mono text-muted-foreground max-h-32 overflow-y-auto">{schemaResult.type_diff.map(t => <li key={t}>{t}</li>)}</ul>
            </details>
          )}
        </div>
      )}

      {log.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Hasil Terakhir
          </h3>
          <pre className="text-xs bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap">{log.join('\n')}</pre>
        </div>
      )}

      <Dialog open={seederOpen} onOpenChange={setSeederOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Jalankan Seeder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Hanya seeder yang aman dijalankan ulang di produksi yang tersedia di sini
              — tidak termasuk data demo/fiktif (DatabaseSeeder, FullDemoSeeder).
            </p>
            <select
              className="w-full rounded-md border px-3 py-1.5 text-sm"
              value={seederClass}
              onChange={(e) => setSeederClass(e.target.value)}
            >
              {ALLOWED_SEEDERS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <Button
              size="sm"
              disabled={seedMut.isPending}
              onClick={() => window.confirm(`Jalankan seeder ${seederClass}?`) && seedMut.mutate()}
            >
              {seedMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Users className="h-3.5 w-3.5 mr-1" />}
              Jalankan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

