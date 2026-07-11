import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Loader2, ChevronDown, ChevronUp, CalendarX, CheckCircle2, XCircle, FileText, FileSpreadsheet,
} from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePdfPreview } from '@/hooks/usePdfPreview'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BulanRow {
  no: number
  bulan: string
  jumlah_minggu: number
  efektif: number
  tidak_efektif: number
  keterangan: string
  detail_tidak_efektif: { tanggal: string; minggu_ke: string; keterangan: string }[]
}

interface MapelRow {
  subject_id: string
  subject_nama: string
  subject_kode: string
  hari_jadwal: string[]
  total_minggu: number
  total_efektif: number
  total_tidak_efektif: number
  bulan: BulanRow[]
}

interface ClassSummary {
  class_id: string
  class_label: string
  total_mapel: number
  total_minggu: number
  total_efektif: number
  rekap: MapelRow[]
  // Hanya terisi saat multi-guru dipilih di tab admin "Per Guru" — dipakai untuk
  // mengelompokkan tampilan per guru.
  teacher_id?: string
  teacher_nama?: string
}

interface AcademicYear {
  id: string; tahun: string; semester: string
  tanggal_mulai: string | null; tanggal_selesai: string | null
}

interface AdminClass {
  id: string; label: string; jurusan: string; tingkat: string; rombel: string
}

interface UmumBulan {
  no: number; bulan: string
  jumlah_minggu: number; efektif: number; tidak_efektif: number
  keterangan: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const HARI_LABEL: Record<string, string> = {
  senin: 'Sen', selasa: 'Sel', rabu: 'Rab', kamis: 'Kam', jumat: 'Jum', sabtu: 'Sab',
}

function formatTanggal(ds: string) {
  return new Date(ds + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

// ── Komponen detail tidak efektif ─────────────────────────────────────────────

function DetailTidakEfektif({ bulan }: { bulan: BulanRow[] }) {
  const tidakEfektifMonths = bulan.filter(b => b.tidak_efektif > 0)
  if (tidakEfektifMonths.length === 0) return (
    <div className="flex items-center gap-2 py-3 px-4 text-xs text-green-700">
      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
      Semua minggu efektif, tidak ada minggu tidak efektif.
    </div>
  )

  return (
    <div className="py-2 px-4 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground mb-1">Rincian Minggu Tidak Efektif:</p>
      {tidakEfektifMonths.map(b => (
        <div key={b.bulan} className="rounded-lg border border-red-100 bg-red-50 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold text-red-700">{b.bulan}</span>
            <span className="rounded-full bg-red-100 text-red-700 text-[10px] font-semibold px-2 py-0.5">
              {b.tidak_efektif} tidak efektif
            </span>
          </div>
          {b.detail_tidak_efektif.map((d, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-red-800">
              <span className="font-bold shrink-0 min-w-[20px]">{d.minggu_ke}</span>
              <span className="text-muted-foreground shrink-0">{formatTanggal(d.tanggal)}</span>
              {d.keterangan && d.keterangan !== 'Tidak Efektif' && (
                <span className="text-red-700">— {d.keterangan}</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Komponen tabel per-bulan ──────────────────────────────────────────────────

function BulanTable({ bulan, totalMinggu, totalEfektif, totalTidakEfektif }: {
  bulan: BulanRow[]
  totalMinggu: number
  totalEfektif: number
  totalTidakEfektif: number
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/40 border-b">
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-6">No</th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Bulan</th>
            <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Minggu</th>
            <th className="text-center px-3 py-2 font-semibold text-green-700">Efektif</th>
            <th className="text-center px-3 py-2 font-semibold text-red-600">Tdk Efektif</th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Keterangan</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {bulan.map(b => (
            <tr key={b.no} className={cn('hover:bg-muted/20', b.tidak_efektif > 0 && 'bg-red-50/40')}>
              <td className="px-3 py-1.5 text-muted-foreground">{b.no}</td>
              <td className="px-3 py-1.5 font-medium">{b.bulan}</td>
              <td className="px-3 py-1.5 text-center">{b.jumlah_minggu}</td>
              <td className="px-3 py-1.5 text-center font-semibold text-green-700">{b.efektif}</td>
              <td className="px-3 py-1.5 text-center font-semibold text-red-600">
                {b.tidak_efektif > 0 ? b.tidak_efektif : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-3 py-1.5 text-muted-foreground whitespace-pre-line leading-tight">
                {b.keterangan && b.keterangan !== '-' ? b.keterangan : <span className="text-muted-foreground/50">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-muted/30 border-t font-semibold text-sm">
            <td className="px-3 py-2" colSpan={2}>Jumlah</td>
            <td className="px-3 py-2 text-center">{totalMinggu}</td>
            <td className="px-3 py-2 text-center text-green-700">{totalEfektif}</td>
            <td className="px-3 py-2 text-center text-red-600">{totalTidakEfektif}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Komponen card guru per-mapel ──────────────────────────────────────────────

function MapelCard({ mapel }: { mapel: MapelRow }) {
  const [open, setOpen] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      {/* Header mapel */}
      <button
        className="w-full flex items-start justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{mapel.subject_nama}</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {mapel.subject_kode}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <span className="text-[10px] text-muted-foreground">Jadwal:</span>
            {mapel.hari_jadwal.map(h => (
              <span key={h} className="rounded bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[10px] font-medium">
                {HARI_LABEL[h] ?? h}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 ml-4 shrink-0">
          {/* Summary stats */}
          <div className="flex items-center gap-3 text-xs">
            <div className="text-center">
              <div className="font-bold text-base text-foreground">{mapel.total_minggu}</div>
              <div className="text-muted-foreground text-[10px]">Total</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-base text-green-600">{mapel.total_efektif}</div>
              <div className="text-muted-foreground text-[10px]">Efektif</div>
            </div>
            {mapel.total_tidak_efektif > 0 && (
              <div className="text-center">
                <div className="font-bold text-base text-red-600">{mapel.total_tidak_efektif}</div>
                <div className="text-muted-foreground text-[10px]">Tdk Eff</div>
              </div>
            )}
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expandable: tabel bulan + detail */}
      {open && (
        <div className="border-t">
          <BulanTable
            bulan={mapel.bulan}
            totalMinggu={mapel.total_minggu}
            totalEfektif={mapel.total_efektif}
            totalTidakEfektif={mapel.total_tidak_efektif}
          />

          {/* Toggle detail tidak efektif */}
          {mapel.total_tidak_efektif > 0 && (
            <>
              <button
                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-700 hover:bg-red-50 border-t transition-colors"
                onClick={() => setShowDetail(d => !d)}
              >
                <CalendarX className="h-3.5 w-3.5" />
                {showDetail ? 'Sembunyikan' : 'Lihat'} detail minggu tidak efektif
                {showDetail ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
              </button>
              {showDetail && (
                <div className="border-t">
                  <DetailTidakEfektif bulan={mapel.bulan} />
                </div>
              )}
            </>
          )}
          {mapel.total_tidak_efektif === 0 && (
            <div className="border-t px-4 py-2 flex items-center gap-2 text-xs text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              Semua minggu efektif
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HariEfektifPage() {
  const user    = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin' || user?.role === 'wakasek'
  // GK30: pengaturan kertas sekarang per-akun (endpoint /print-settings terbuka utk
  // semua role login, lihat PrintSetting::instance($userId)) — guru boleh atur miliknya
  // sendiri tanpa memengaruhi user lain.
  const pdfPreview = usePdfPreview({ printSettings: true })

  const [selClassId, setSelClassId] = useState('')
  const [selAyId, setSelAyId]       = useState<string>('')
  const [exporting, setExporting]   = useState<'excel' | 'pdf' | null>(null)
  const [exportError, setExportError] = useState('')
  const [adminTab, setAdminTab]     = useState<'per-kelas' | 'per-guru' | 'umum'>('per-kelas')
  const [selTeacherIds, setSelTeacherIds] = useState<string[]>([])
  const [teacherQ, setTeacherQ]     = useState('')
  // Filter kelas admin: 3 dimensi checkbox (Isu-1) — kosong = semua
  const [selJurusan, setSelJurusan] = useState<string[]>([])
  const [selTingkat, setSelTingkat] = useState<string[]>([])
  const [selRombel, setSelRombel]   = useState<string[]>([])

  // ── Academic years (untuk admin) ──────────────────────────────────────────
  const { data: ayData } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => api.get('/admin/academic-years').then(r => r.data.data as AcademicYear[]),
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
  })
  const years = ayData ?? []

  // ── Admin: all classes list ────────────────────────────────────────────────
  const { data: classData } = useQuery({
    queryKey: ['admin-classes-list'],
    queryFn: () => api.get('/admin/classes?per_page=all').then(r => r.data.data as AdminClass[]),
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
  })
  const allClasses = classData ?? []
  const jurusanOptions = useMemo(() => Array.from(new Set(allClasses.map(c => c.jurusan))).sort(), [allClasses])
  const tingkatOptions = useMemo(() => Array.from(new Set(allClasses.map(c => c.tingkat))).sort(), [allClasses])
  const rombelOptions  = useMemo(() => Array.from(new Set(allClasses.map(c => c.rombel))).sort(), [allClasses])

  // Kelas hasil filter 3 dimensi — kosong di satu dimensi berarti "semua" utk dimensi itu.
  const hasClassFilter = selJurusan.length > 0 || selTingkat.length > 0 || selRombel.length > 0
  const filteredClassIds = useMemo(() => allClasses.filter(c =>
    (selJurusan.length === 0 || selJurusan.includes(c.jurusan)) &&
    (selTingkat.length === 0 || selTingkat.includes(c.tingkat)) &&
    (selRombel.length === 0 || selRombel.includes(c.rombel))
  ).map(c => c.id), [allClasses, selJurusan, selTingkat, selRombel])
  // Kalau tidak ada filter aktif sama sekali, JANGAN enumerasi semua UUID kelas ke query
  // string (bisa puluhan/ratusan ID → URL raksasa → request gagal sebelum sempat sampai
  // ke Laravel, browser salah lapor sebagai error CORS). Backend sudah otomatis anggap
  // "semua kelas" kalau class_ids tidak dikirim sama sekali.
  const classIdsForQuery = hasClassFilter ? filteredClassIds : []

  // ── Admin: teachers list ───────────────────────────────────────────────────
  // PENTING: /admin/teachers mengembalikan field "id" (bukan "uuid") dan "nama" (bukan
  // "nama_lengkap") — sebelumnya interface ini salah nama field, jadi setiap tombol guru
  // di picker ini tampil kosong (key={undefined}) dan pencarian nama CRASH karena
  // t.nama_lengkap selalu undefined.
  // Key HARUS beda dari EwsDetailPage.tsx yg juga pakai key ini tapi per_page=100 —
  // key literal sama + parameter beda = react-query bisa pakai cache "salah" punya
  // halaman lain (data guru kepotong 100 vs seharusnya semua), tergantung halaman
  // mana yang duluan di-visit dalam sesi yang sama. Sama kelas bug dengan
  // [[agenda_perlu_diisi_deadline_visibility]].
  const { data: teacherListData } = useQuery({
    queryKey: ['admin-teachers-list-all'],
    queryFn: () => api.get('/admin/teachers?per_page=all').then(r => r.data.data as { id: string; nama: string; nip: string }[]),
    enabled: isAdmin && adminTab === 'per-guru',
    staleTime: 5 * 60 * 1000,
  })
  const allTeachers = teacherListData ?? []
  const filteredTeachers = teacherQ
    ? allTeachers.filter(t => t.nama.toLowerCase().includes(teacherQ.toLowerCase()) || t.nip?.includes(teacherQ))
    : allTeachers

  function toggleTeacher(id: string) {
    setSelTeacherIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // ── Admin: minggu efektif guru terpilih (bisa lebih dari satu) ────────────
  const { data: guruMingguData, isLoading: guruMingguLoading } = useQuery<{ data: ClassSummary[]; academic_year: AcademicYear | null }>({
    queryKey: ['effective-weeks-guru', selTeacherIds],
    queryFn: () => {
      const params = new URLSearchParams()
      selTeacherIds.forEach(id => params.append('teacher_ids[]', id))
      return api.get(`/effective-days/my-minggu?${params.toString()}`).then(r => r.data)
    },
    enabled: isAdmin && adminTab === 'per-guru' && selTeacherIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })
  // Kelompokkan hasil per guru untuk render (guruMingguData.data flat, ada teacher_id/teacher_nama)
  const guruMingguGrouped = useMemo(() => {
    const map = new Map<string, { teacher_id: string; teacher_nama: string; classes: ClassSummary[] }>()
    for (const cls of guruMingguData?.data ?? []) {
      const key = cls.teacher_id ?? ''
      if (!map.has(key)) map.set(key, { teacher_id: key, teacher_nama: cls.teacher_nama ?? '', classes: [] })
      map.get(key)!.classes.push(cls)
    }
    return Array.from(map.values())
  }, [guruMingguData])

  // ── Guru: minggu efektif per kelas+mapel ──────────────────────────────────
  const { data: myData, isLoading: myLoading } = useQuery<{ data: ClassSummary[]; academic_year: AcademicYear | null }>({
    queryKey: ['effective-weeks-my'],
    queryFn: () => api.get('/effective-days/my-minggu').then(r => r.data),
    enabled: !isAdmin,
    staleTime: 5 * 60 * 1000,
  })

  // ── Admin: summary by class ────────────────────────────────────────────────
  const effectiveAyId = selAyId || (years[0]?.id ?? '')
  const { data: adminData, isLoading: adminLoading } = useQuery<{ data: ClassSummary[]; academic_year: AcademicYear | null }>({
    queryKey: ['effective-days-admin', effectiveAyId, classIdsForQuery],
    queryFn: () => {
      const params = new URLSearchParams({ academic_year_id: effectiveAyId })
      classIdsForQuery.forEach(id => params.append('class_ids[]', id))
      return api.get(`/admin/effective-days/summary?${params.toString()}`).then(r => r.data)
    },
    enabled: isAdmin && !!effectiveAyId,
    staleTime: 5 * 60 * 1000,
  })

  // ── Admin: umum (school-wide) effective weeks ────────────────────────────
  const { data: umumData, isLoading: umumLoading } = useQuery<{
    data: { bulan: UmumBulan[]; total_minggu: number; total_efektif: number; total_tidak_efektif: number }
    academic_year: AcademicYear | null
  }>({
    queryKey: ['effective-days-umum', effectiveAyId],
    queryFn: () => api.get('/admin/effective-days/umum', { params: { academic_year_id: effectiveAyId } }).then(r => r.data),
    enabled: isAdmin && !!effectiveAyId && adminTab === 'umum',
    staleTime: 5 * 60 * 1000,
  })

  const isLoading = isAdmin
    ? (adminTab === 'umum' ? umumLoading : adminTab === 'per-guru' ? guruMingguLoading : adminLoading)
    : myLoading
  const ay        = isAdmin
    ? (adminTab === 'umum' ? umumData?.academic_year : adminTab === 'per-guru' ? guruMingguData?.academic_year : adminData?.academic_year)
    : myData?.academic_year

  // ── Filter guru: kelas ────────────────────────────────────────────────────
  const allMyClasses: ClassSummary[] = myData?.data ?? []
  const filteredClasses = useMemo(() =>
    selClassId ? allMyClasses.filter(c => c.class_id === selClassId) : allMyClasses,
    [allMyClasses, selClassId]
  )

  // ── Export guru ───────────────────────────────────────────────────────────
  async function blobErrMsg(err: any, fallback: string): Promise<string> {
    try {
      const blob: Blob = err?.response?.data
      if (blob instanceof Blob) {
        const text = await blob.text()
        const json = JSON.parse(text)
        return json.message || fallback
      }
    } catch { /* ignore */ }
    return fallback
  }

  async function downloadBlob(resp: any, filename: string) {
    const url = URL.createObjectURL(resp.data)
    const a   = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleExportGuru(format: 'excel' | 'pdf') {
    const params = new URLSearchParams()
    if (selClassId) params.append('class_ids[]', selClassId)
    if (format === 'pdf') {
      await pdfPreview.openPreview(`/effective-days/export-teacher-pdf?${params}`, 'minggu_efektif.pdf')
      return
    }
    setExportError('')
    setExporting(format)
    try {
      const resp = await api.get(`/effective-days/export-teacher?${params}`, { responseType: 'blob' })
      await downloadBlob(resp, 'minggu_efektif.xlsx')
    } catch (e) {
      setExportError(await blobErrMsg(e, 'Gagal mengunduh. Pastikan akun sudah punya jadwal aktif.'))
    } finally {
      setExporting(null)
    }
  }

  // ── Export admin ──────────────────────────────────────────────────────────
  async function handleExportAdmin(format: 'excel' | 'pdf') {
    if (!effectiveAyId) return
    const params = new URLSearchParams({ academic_year_id: effectiveAyId })
    classIdsForQuery.forEach(id => params.append('class_ids[]', id))
    if (format === 'pdf') {
      await pdfPreview.openPreview(`/admin/effective-days/export-pdf?${params.toString()}`, 'minggu_efektif_kelas.pdf')
      return
    }
    setExportError('')
    setExporting(format)
    try {
      const resp = await api.get(`/admin/effective-days/export?${params.toString()}`, { responseType: 'blob' })
      await downloadBlob(resp, 'minggu_efektif_kelas.xlsx')
    } catch (e) {
      setExportError(await blobErrMsg(e, 'Gagal mengunduh export admin.'))
    } finally {
      setExporting(null)
    }
  }

  async function handleExportGuruAdmin(format: 'excel' | 'pdf') {
    if (selTeacherIds.length === 0) return
    const params = new URLSearchParams()
    selTeacherIds.forEach(id => params.append('teacher_ids[]', id))
    if (format === 'pdf') {
      await pdfPreview.openPreview(`/effective-days/export-teacher-pdf?${params}`, 'minggu_efektif_guru.pdf')
      return
    }
    setExportError('')
    setExporting(format)
    try {
      const resp = await api.get(`/effective-days/export-teacher?${params}`, { responseType: 'blob' })
      await downloadBlob(resp, 'minggu_efektif_guru.xlsx')
    } catch (e) {
      setExportError(await blobErrMsg(e, 'Gagal mengunduh. Pastikan guru memiliki jadwal aktif.'))
    } finally {
      setExporting(null)
    }
  }

  async function handleExportUmum(format: 'excel' | 'pdf') {
    if (!effectiveAyId) return
    if (format === 'pdf') {
      const params = new URLSearchParams({ academic_year_id: effectiveAyId, format })
      await pdfPreview.openPreview(`/admin/effective-days/export-umum?${params}`, 'minggu_efektif_umum.pdf')
      return
    }
    setExportError('')
    setExporting(format)
    try {
      const params = new URLSearchParams({ academic_year_id: effectiveAyId, format })
      const resp   = await api.get(`/admin/effective-days/export-umum?${params}`, { responseType: 'blob' })
      await downloadBlob(resp, 'minggu_efektif_umum.xlsx')
    } catch (e) {
      setExportError(await blobErrMsg(e, 'Gagal mengunduh export umum.'))
    } finally {
      setExporting(null)
    }
  }

  function toggleFilter(setter: (fn: (prev: string[]) => string[]) => void, value: string) {
    setter(prev => prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value])
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Minggu Efektif</h1>
          {ay && (
            <p className="text-sm text-muted-foreground">
              {ay.tahun} · Semester {ay.semester === 'ganjil' ? 'Ganjil' : 'Genap'}
              {ay.tanggal_mulai && ` · ${ay.tanggal_mulai} – ${ay.tanggal_selesai}`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin ? (
            adminTab === 'umum' ? (
              <>
                <Button size="sm" variant="outline"
                  onClick={() => handleExportUmum('excel')}
                  disabled={!!exporting || !effectiveAyId}>
                  {exporting === 'excel' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
                  Excel
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => handleExportUmum('pdf')}
                  disabled={pdfPreview.loading || !effectiveAyId}>
                  {pdfPreview.loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
                  PDF
                </Button>
              </>
            ) : adminTab === 'per-guru' ? (
              <>
                <Button size="sm" variant="outline"
                  onClick={() => handleExportGuruAdmin('excel')}
                  disabled={!!exporting || selTeacherIds.length === 0}>
                  {exporting === 'excel' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
                  Excel
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => handleExportGuruAdmin('pdf')}
                  disabled={pdfPreview.loading || selTeacherIds.length === 0}>
                  {pdfPreview.loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
                  PDF
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline"
                  onClick={() => handleExportAdmin('excel')}
                  disabled={!!exporting || !effectiveAyId}>
                  {exporting === 'excel' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
                  Excel
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => handleExportAdmin('pdf')}
                  disabled={pdfPreview.loading || !effectiveAyId}>
                  {pdfPreview.loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
                  PDF
                </Button>
              </>
            )
          ) : (
            <>
              <Button size="sm" variant="outline"
                onClick={() => handleExportGuru('excel')}
                disabled={!!exporting}>
                {exporting === 'excel' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
                Excel
              </Button>
              <Button size="sm" variant="outline"
                onClick={() => handleExportGuru('pdf')}
                disabled={pdfPreview.loading}>
                {pdfPreview.loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
                PDF A4
              </Button>
            </>
          )}
        </div>
      </div>

      {(exportError || pdfPreview.error) && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{exportError || pdfPreview.error}</div>
      )}
      {pdfPreview.modal}
      {pdfPreview.loadingOverlay}

      {/* ── Admin filters ──────────────────────────────────────────────────── */}
      {isAdmin && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <label className="text-xs font-medium block mb-1">Tahun Ajaran</label>
              <select
                className="rounded-md border border-input px-3 py-1.5 text-sm bg-background max-w-full"
                value={selAyId}
                onChange={e => setSelAyId(e.target.value)}
              >
                {years.map(y => (
                  <option key={y.id} value={y.id}>{y.tahun} - {y.semester}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Tampilan</label>
              <div className="flex rounded-md border border-input overflow-hidden">
                <button
                  onClick={() => setAdminTab('per-kelas')}
                  className={cn('px-3 py-1.5 text-xs transition-colors',
                    adminTab === 'per-kelas' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
                >Per Kelas</button>
                <button
                  onClick={() => setAdminTab('per-guru')}
                  className={cn('px-3 py-1.5 text-xs transition-colors',
                    adminTab === 'per-guru' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
                >Per Guru</button>
                <button
                  onClick={() => setAdminTab('umum')}
                  className={cn('px-3 py-1.5 text-xs transition-colors',
                    adminTab === 'umum' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
                >Umum</button>
              </div>
            </div>
          </div>
          {adminTab === 'per-kelas' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium">Filter Kelas (kosong di tiap grup = semua)</label>
                <button
                  className="text-xs text-muted-foreground hover:underline ml-auto"
                  onClick={() => { setSelJurusan([]); setSelTingkat([]); setSelRombel([]) }}
                >Reset Filter</button>
                <span className="text-xs text-muted-foreground">{filteredClassIds.length} kelas dipilih</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Program Keahlian</p>
                  <div className="flex flex-wrap gap-1">
                    {jurusanOptions.map(j => (
                      <button key={j} onClick={() => toggleFilter(setSelJurusan, j)}
                        className={cn('rounded px-2 py-1 text-xs border transition-colors',
                          selJurusan.includes(j) ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted')}>
                        {j}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Tingkat</p>
                  <div className="flex flex-wrap gap-1">
                    {tingkatOptions.map(t => (
                      <button key={t} onClick={() => toggleFilter(setSelTingkat, t)}
                        className={cn('rounded px-2 py-1 text-xs border transition-colors',
                          selTingkat.includes(t) ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted')}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Rombel</p>
                  <div className="flex flex-wrap gap-1">
                    {rombelOptions.map(r => (
                      <button key={r} onClick={() => toggleFilter(setSelRombel, r)}
                        className={cn('rounded px-2 py-1 text-xs border transition-colors',
                          selRombel.includes(r) ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted')}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {adminTab === 'per-guru' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium block">Cari &amp; Pilih Guru (bisa lebih dari satu)</label>
                <button className="text-xs text-muted-foreground hover:underline ml-auto"
                  onClick={() => setSelTeacherIds([])} disabled={selTeacherIds.length === 0}>
                  Lepas Semua
                </button>
                <span className="text-xs text-muted-foreground">{selTeacherIds.length} dipilih</span>
              </div>
              <input
                type="text"
                placeholder="Nama atau NIP..."
                value={teacherQ}
                onChange={e => setTeacherQ(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {filteredTeachers.slice(0, 50).map(t => (
                  <button key={t.id}
                    onClick={() => toggleTeacher(t.id)}
                    className={cn(
                      'rounded px-2 py-1 text-xs border transition-colors',
                      selTeacherIds.includes(t.id)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-muted'
                    )}
                  >
                    {t.nama}
                  </button>
                ))}
              </div>
            </div>
          )}
          {adminTab === 'umum' && (
            <p className="text-xs text-muted-foreground">
              Minggu dihitung <strong>tidak efektif</strong> jika &gt;3 hari sekolah dalam minggu tersebut adalah hari tidak efektif.
            </p>
          )}
        </div>
      )}

      {/* ── Guru filter kelas ──────────────────────────────────────────────── */}
      {!isAdmin && allMyClasses.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Filter kelas:</span>
          <button
            onClick={() => setSelClassId('')}
            className={cn(
              'rounded-full px-3 py-1 text-xs border transition-colors',
              selClassId === '' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
            )}
          >
            Semua
          </button>
          {allMyClasses.map(c => (
            <button
              key={c.class_id}
              onClick={() => setSelClassId(c.class_id)}
              className={cn(
                'rounded-full px-3 py-1 text-xs border transition-colors',
                selClassId === c.class_id ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
              )}
            >
              {c.class_label}
            </button>
          ))}
        </div>
      )}

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isAdmin && adminTab === 'umum' ? (
        <UmumView data={umumData?.data} />
      ) : isAdmin && adminTab === 'per-guru' ? (
        selTeacherIds.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            Pilih satu atau lebih guru di panel filter untuk melihat minggu efektif.
          </div>
        ) : (
          <div className="space-y-8">
            {guruMingguGrouped.map(g => (
              <div key={g.teacher_id} className="space-y-4">
                <h2 className="text-sm font-bold text-primary border-b pb-1">{g.teacher_nama}</h2>
                <div className="space-y-6">
                  {g.classes.map(cls => <ClassSection key={cls.class_id} cls={cls} />)}
                </div>
              </div>
            ))}
          </div>
        )
      ) : isAdmin ? (
        /* ── Admin view: ringkasan per kelas — struktur sama dgn tampilan guru ── */
        (adminData?.data ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            Tidak ada data untuk filter ini.
          </div>
        ) : (
          <div className="space-y-6">
            {(adminData?.data ?? []).map(cls => <ClassSection key={cls.class_id} cls={cls} />)}
          </div>
        )
      ) : filteredClasses.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {allMyClasses.length === 0 ? 'Belum ada jadwal aktif.' : 'Tidak ada data untuk kelas ini.'}
        </div>
      ) : (
        /* ── Guru view: per kelas > per mapel > per bulan ────────────────── */
        <div className="space-y-6">
          {filteredClasses.map(cls => <ClassSection key={cls.class_id} cls={cls} />)}
        </div>
      )}
    </div>
  )
}

// ── Kelas + daftar mapel (dipakai guru sendiri, admin per-kelas, admin per-guru) ──────

function ClassSection({ cls }: { cls: ClassSummary }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-bold">{cls.class_label}</h2>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {cls.total_mapel} mata pelajaran
        </span>
        <div className="flex items-center gap-2 ml-auto text-xs">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-semibold">{cls.total_minggu}</span>
          <span className="text-muted-foreground mx-1">·</span>
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span className="font-semibold text-green-600">{cls.total_efektif}</span>
          {cls.total_minggu - cls.total_efektif > 0 && (
            <>
              <XCircle className="h-3.5 w-3.5 text-red-500 ml-1" />
              <span className="font-semibold text-red-600">
                {cls.total_minggu - cls.total_efektif}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2 pl-2 border-l-2 border-muted">
        {cls.rekap.map(mapel => (
          <MapelCard key={mapel.subject_id} mapel={mapel} />
        ))}
      </div>
    </div>
  )
}

// ── Umum view component ───────────────────────────────────────────────────────

function UmumView({ data }: {
  data?: { bulan: UmumBulan[]; total_minggu: number; total_efektif: number; total_tidak_efektif: number }
}) {
  if (!data || data.bulan.length === 0) return (
    <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
      Tidak ada data. Pastikan tanggal semester sudah diisi.
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40 border-b">
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-6">No</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Bulan</th>
              <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Minggu</th>
              <th className="text-center px-3 py-2 font-semibold text-green-700">Efektif</th>
              <th className="text-center px-3 py-2 font-semibold text-red-600">Tidak Efektif</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Keterangan</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.bulan.map(b => (
              <tr key={b.no} className={cn('hover:bg-muted/20', b.tidak_efektif > 0 && 'bg-red-50/40')}>
                <td className="px-3 py-1.5 text-muted-foreground">{b.no}</td>
                <td className="px-3 py-1.5 font-medium">{b.bulan}</td>
                <td className="px-3 py-1.5 text-center">{b.jumlah_minggu}</td>
                <td className="px-3 py-1.5 text-center font-semibold text-green-700">{b.efektif}</td>
                <td className="px-3 py-1.5 text-center font-semibold text-red-600">
                  {b.tidak_efektif > 0 ? b.tidak_efektif : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground whitespace-pre-line leading-tight">
                  {b.keterangan && b.keterangan !== '-' ? b.keterangan : <span className="text-muted-foreground/50">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 border-t font-semibold text-sm">
              <td className="px-3 py-2" colSpan={2}>Jumlah</td>
              <td className="px-3 py-2 text-center">{data.total_minggu}</td>
              <td className="px-3 py-2 text-center text-green-700">{data.total_efektif}</td>
              <td className="px-3 py-2 text-center text-red-600">{data.total_tidak_efektif || '—'}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
