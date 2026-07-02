import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, FileSpreadsheet, Loader2, Info, Search } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toLocalDateStr } from '@/lib/utils'
import { usePdfPreview } from '@/hooks/usePdfPreview'

type ReportType = 'rekap_agenda' | 'kehadiran' | 'karakter' | 'nilai_tambah' | 'ews'

interface ReportMeta {
  id: ReportType
  label: string
  desc: string
  needsClass: boolean
  needsDate: boolean
  classLabel?: string
  allowAllClass?: boolean
  roles: string[]
}

const REPORTS: ReportMeta[] = [
  {
    id: 'rekap_agenda',
    label: 'Rekap Agenda Saya',
    desc: 'Daftar agenda yang telah diisi beserta TP, resume KBM, dan status.',
    needsClass: false,
    needsDate: true,
    roles: ['guru', 'wali_kelas', 'wakasek', 'admin'],
  },
  {
    id: 'kehadiran',
    label: 'Rekap Kehadiran Siswa',
    desc: 'Hadir, Sakit, Izin, Alpha per siswa — termasuk tanggal kapan saja tidak hadir.',
    needsClass: true,
    needsDate: true,
    roles: ['guru', 'wali_kelas', 'wakasek', 'bk', 'admin'],
  },
  {
    id: 'karakter',
    label: 'Rekap Karakter Siswa',
    desc: 'Akumulasi poin karakter per siswa dan per kategori.',
    needsClass: true,
    needsDate: false,
    roles: ['guru', 'wali_kelas', 'wakasek', 'bk', 'admin'],
  },
  {
    id: 'nilai_tambah',
    label: 'Laporan Nilai Tambah',
    desc: 'Daftar poin karakter manual (Nilai Tambah) yang sudah diberikan ke siswa — langsung final, tanpa approval admin.',
    needsClass: true,
    needsDate: false,
    roles: ['guru', 'wali_kelas', 'wakasek', 'bk', 'admin'],
  },
  {
    id: 'ews',
    label: 'Laporan EWS',
    desc: 'Status Early Warning System per siswa — 4 dimensi: Kehadiran, Karakter, Catatan, Nilai.',
    needsClass: true,
    needsDate: false,
    roles: ['wali_kelas', 'wakasek', 'bk', 'admin'],
  },
]

interface ClassItem { id: string; label: string }
interface TeacherItem { id: string; nama: string; nip: string }

function TeacherCombobox({ teachers, value, onChange }: {
  teachers: TeacherItem[]; value: string; onChange: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const selectedTeacher = teachers.find(t => t.id === value)

  const filtered = useMemo(() => {
    if (!q) return teachers.slice(0, 30)
    const l = q.toLowerCase()
    return teachers.filter(t => t.nama.toLowerCase().includes(l) || t.nip?.toLowerCase().includes(l)).slice(0, 30)
  }, [teachers, q])

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder={selectedTeacher ? selectedTeacher.nama : 'Ketik nama atau NIP guru...'}
          value={selectedTeacher && !open ? `${selectedTeacher.nama}${selectedTeacher.nip ? ` (${selectedTeacher.nip})` : ''}` : q}
          onFocus={() => { setOpen(true); setQ('') }}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="flex h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {value && (
          <button
            onMouseDown={e => { e.preventDefault(); onChange(''); setQ('') }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >×</button>
        )}
      </div>
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-52 overflow-y-auto rounded-md border bg-background shadow-lg">
          <div
            onMouseDown={e => e.preventDefault()}
            className="py-1"
          >
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Tidak ada guru yang cocok.</div>
            )}
            {filtered.map(t => (
              <button key={t.id}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${value === t.id ? 'bg-muted font-medium' : ''}`}
                onMouseDown={() => { onChange(t.id); setQ(''); setOpen(false) }}>
                {t.nama}{t.nip ? <span className="text-xs text-muted-foreground ml-1">({t.nip})</span> : ''}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function LaporanPage() {
  const user     = useAuthStore((s) => s.user)
  const userRole = user?.role ?? ''
  const kap      = user?.kapabilitas
  const isAdmin  = userRole === 'admin'
  // GK30: pengaturan kertas per-akun — semua role login boleh atur miliknya sendiri.
  const pdfPreview = usePdfPreview({ printSettings: true })

  const availableReports = REPORTS.filter((r) => {
    if (r.roles.includes(userRole)) return true
    if (userRole === 'guru' && kap?.is_bk && r.roles.includes('bk')) return true
    if (userRole === 'guru' && kap?.is_wali_kelas && r.roles.includes('wali_kelas')) return true
    return false
  })

  const [type, setType]           = useState<ReportType>(availableReports[0]?.id ?? 'jurnal')
  const [classId, setClassId]     = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [mulai, setMulai]         = useState(() => toLocalDateStr(new Date()).slice(0, 8) + '01')
  const [akhir, setAkhir]         = useState(() => toLocalDateStr(new Date()))
  const [loading, setLoading]     = useState<'pdf' | 'excel' | null>(null)
  const [error, setError]         = useState('')

  const selected = availableReports.find((r) => r.id === type) ?? availableReports[0]

  // Daftar guru untuk admin
  const { data: teachersRes } = useQuery({
    queryKey: ['report-teachers'],
    queryFn: () => api.get<{ data: TeacherItem[] }>('/reports/teachers'),
    enabled: isAdmin,
  })
  const allTeachers = teachersRes?.data.data ?? []

  // Laporan yang menggunakan kelas dari jadwal guru (bukan semua kelas)
  const useGuruClasses = !isAdmin && (type === 'kehadiran' || type === 'karakter' || type === 'nilai_tambah' || type === 'ews')

  // Untuk laporan jurnal/kehadiran/karakter guru — kelas berdasarkan guru terpilih (atau guru sendiri)
  const { data: guruContextsRes } = useQuery({
    queryKey: ['guru-contexts', teacherId],
    queryFn: () => api.get<{ data: ClassItem[] }>('/reports/guru-contexts', { params: teacherId ? { teacher_id: teacherId } : undefined }),
    enabled: useGuruClasses,
  })
  const guruClasses = guruContextsRes?.data.data ?? []

  // Untuk laporan lain (admin) — semua kelas
  const { data: classesRes } = useQuery({
    queryKey: ['report-classes'],
    queryFn: () => api.get<{ data: ClassItem[] }>('/reports/classes'),
    enabled: selected?.needsClass && !useGuruClasses,
  })
  const allClasses = classesRes?.data.data ?? []

  const displayClasses = useGuruClasses ? guruClasses : allClasses

  // Tipe laporan yang butuh guru (untuk admin)
  const needsTeacher = isAdmin && type === 'rekap_agenda'

  async function download(format: 'pdf' | 'excel') {
    if (needsTeacher && !teacherId) {
      setError('Pilih guru terlebih dahulu.')
      return
    }
    if (selected?.needsClass && !selected.allowAllClass && !classId) {
      setError('Pilih kelas terlebih dahulu.')
      return
    }

    let endpoint = '/reports/agenda'
    if (type === 'rekap_agenda') endpoint = '/reports/agenda'
    else                         endpoint = `/reports/${type}`

    const params = new URLSearchParams({ format })
    if (needsTeacher && teacherId)    params.set('teacher_id', teacherId)
    if (selected?.needsClass && classId) params.set('class_id', classId)
    if (selected?.needsDate) { params.set('tanggal_mulai', mulai); params.set('tanggal_akhir', akhir) }

    if (format === 'pdf') {
      setError('')
      await pdfPreview.openPreview(`${endpoint}?${params.toString()}`, `laporan_${type}.pdf`)
      return
    }

    setError('')
    setLoading(format)
    try {
      const res = await api.get(`${endpoint}?${params.toString()}`, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `laporan_${type}_${Date.now()}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Gagal mengunduh laporan. Pastikan filter sudah benar dan coba lagi.')
    } finally {
      setLoading(null)
    }
  }

  if (availableReports.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <p className="text-sm text-muted-foreground">Tidak ada laporan yang tersedia untuk role Anda.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-5">
      <h1 className="text-xl font-bold">Laporan</h1>

      {/* Pilih jenis laporan (GK28: dropdown, bukan daftar kartu) */}
      <div className="space-y-1.5">
        <Label htmlFor="jenis-laporan">Jenis Laporan</Label>
        <select
          id="jenis-laporan"
          value={type}
          onChange={(e) => { setType(e.target.value as ReportType); setClassId(''); setTeacherId(''); setError('') }}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {availableReports.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
        {selected && (
          <p className="text-xs text-muted-foreground leading-relaxed">{selected.desc}</p>
        )}
      </div>

      {/* Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pilih Guru — hanya admin untuk laporan jurnal/rekap */}
          {needsTeacher && (
            <div className="space-y-1.5">
              <Label>Nama Guru</Label>
              <TeacherCombobox
                teachers={allTeachers}
                value={teacherId}
                onChange={(id) => { setTeacherId(id); setClassId('') }}
              />
            </div>
          )}

          {selected?.needsClass && (
            <div className="space-y-1.5">
              <Label htmlFor="kelas">{selected.classLabel ?? 'Kelas'}</Label>
              <select
                id="kelas"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {selected.allowAllClass
                  ? <option value="">— Semua kelas yang diampu —</option>
                  : <option value="">— Pilih kelas —</option>
                }
                {displayClasses.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          )}

          {selected?.needsDate && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mulai">Dari Tanggal</Label>
                <input
                  id="mulai" type="date" value={mulai}
                  onChange={(e) => setMulai(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="akhir">Sampai Tanggal</Label>
                <input
                  id="akhir" type="date" value={akhir}
                  onChange={(e) => setAkhir(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
          )}

          {(error || pdfPreview.error) && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error || pdfPreview.error}</p>
          )}
        </CardContent>
      </Card>

      {/* Tombol unduh */}
      <div className="grid grid-cols-2 gap-3">
        <button
          disabled={!!loading || pdfPreview.loading}
          onClick={() => download('pdf')}
          className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-4 hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          {pdfPreview.loading
            ? <Loader2 className="h-6 w-6 text-red-500 animate-spin shrink-0" />
            : <FileText className="h-6 w-6 text-red-500 shrink-0" />}
          <div className="text-left">
            <p className="text-sm font-semibold text-red-700">Unduh PDF</p>
            <p className="text-xs text-red-500">Siap cetak · A4 Landscape</p>
          </div>
        </button>

        <button
          disabled={!!loading || pdfPreview.loading}
          onClick={() => download('excel')}
          className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-4 hover:bg-green-100 transition-colors disabled:opacity-50"
        >
          {loading === 'excel'
            ? <Loader2 className="h-6 w-6 text-green-600 animate-spin shrink-0" />
            : <FileSpreadsheet className="h-6 w-6 text-green-600 shrink-0" />}
          <div className="text-left">
            <p className="text-sm font-semibold text-green-700">Unduh Excel</p>
            <p className="text-xs text-green-500">Format .xlsx · dapat diedit</p>
          </div>
        </button>
      </div>

      {/* Info kontekstual */}
      {selected && (
        <div className="flex gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-medium">{selected.label}</p>
            <p className="text-xs text-muted-foreground">{selected.desc}</p>
            {type === 'kehadiran' && (
              <p className="text-xs text-muted-foreground mt-1">
                Kolom <strong>Tanggal Tidak Hadir</strong>: S=Sakit · I=Izin · A=Alpha
              </p>
            )}
          </div>
        </div>
      )}

      {pdfPreview.modal}
      {pdfPreview.loadingOverlay}
    </div>
  )
}
