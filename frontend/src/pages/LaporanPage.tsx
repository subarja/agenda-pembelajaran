import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, FileSpreadsheet, Loader2, Info } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type ReportType = 'jurnal' | 'rekap_agenda' | 'kehadiran' | 'karakter' | 'ews'

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
    id: 'jurnal',
    label: 'Jurnal Mengajar (Resmi)',
    desc: 'Laporan jurnal mengajar sesuai format Bab XIII — kop sekolah, tabel pertemuan, ringkasan TP, blok tanda tangan. Siap diserahkan ke Kepala Sekolah.',
    needsClass: true,
    needsDate: true,
    classLabel: 'Kelas (kosong = semua kelas diampu)',
    allowAllClass: true,
    roles: ['guru', 'wali_kelas', 'wakasek'],
  },
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
    id: 'ews',
    label: 'Laporan EWS',
    desc: 'Status Early Warning System per siswa — 4 dimensi: Kehadiran, Karakter, Catatan, Nilai.',
    needsClass: true,
    needsDate: false,
    roles: ['wali_kelas', 'wakasek', 'bk', 'admin'],
  },
]

interface ClassItem { id: string; label: string }

export default function LaporanPage() {
  const user = useAuthStore((s) => s.user)
  const userRole = user?.role ?? ''

  const availableReports = REPORTS.filter((r) => r.roles.includes(userRole))

  const [type, setType]       = useState<ReportType>(availableReports[0]?.id ?? 'jurnal')
  const [classId, setClassId] = useState('')
  const [mulai, setMulai]     = useState(() => new Date().toISOString().slice(0, 8) + '01')
  const [akhir, setAkhir]     = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState<'pdf' | 'excel' | null>(null)
  const [error, setError]     = useState('')

  const selected = availableReports.find((r) => r.id === type) ?? availableReports[0]

  // Untuk laporan jurnal — kelas yang diajar guru
  const { data: guruContextsRes } = useQuery({
    queryKey: ['guru-contexts'],
    queryFn: () => api.get<{ data: ClassItem[] }>('/reports/guru-contexts'),
    enabled: type === 'jurnal',
  })
  const guruClasses = guruContextsRes?.data.data ?? []

  // Untuk laporan lain — semua kelas
  const { data: classesRes } = useQuery({
    queryKey: ['report-classes'],
    queryFn: () => api.get<{ data: ClassItem[] }>('/reports/classes'),
    enabled: selected?.needsClass && type !== 'jurnal',
  })
  const allClasses = classesRes?.data.data ?? []

  const displayClasses = type === 'jurnal' ? guruClasses : allClasses

  async function download(format: 'pdf' | 'excel') {
    if (selected?.needsClass && !selected.allowAllClass && !classId) {
      setError('Pilih kelas terlebih dahulu.')
      return
    }
    setError('')
    setLoading(format)

    try {
      let endpoint = '/reports/agenda'
      if (type === 'jurnal')       endpoint = '/reports/jurnal'
      else if (type === 'rekap_agenda') endpoint = '/reports/agenda'
      else                         endpoint = `/reports/${type}`

      const params: Record<string, string> = { format }
      if (selected?.needsClass && classId) params.class_id = classId
      if (selected?.needsDate) { params.tanggal_mulai = mulai; params.tanggal_akhir = akhir }

      const res = await api.get(endpoint, { params, responseType: 'blob' })

      const ext  = format === 'pdf' ? 'pdf' : 'xlsx'
      const mime = format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const blob = new Blob([res.data], { type: mime })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `laporan_${type}_${Date.now()}.${ext}`
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

      {/* Pilih jenis laporan */}
      <div className="space-y-2">
        <Label>Jenis Laporan</Label>
        <div className="space-y-2">
          {availableReports.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { setType(r.id); setClassId(''); setError('') }}
              className={cn(
                'w-full text-left rounded-lg border p-3 transition-colors',
                type === r.id
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-border hover:border-primary-200',
              )}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{r.desc}</p>
                </div>
                {r.id === 'jurnal' && (
                  <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Resmi</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Tombol unduh */}
      <div className="grid grid-cols-2 gap-3">
        <button
          disabled={!!loading}
          onClick={() => download('pdf')}
          className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-4 hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          {loading === 'pdf'
            ? <Loader2 className="h-6 w-6 text-red-500 animate-spin shrink-0" />
            : <FileText className="h-6 w-6 text-red-500 shrink-0" />}
          <div className="text-left">
            <p className="text-sm font-semibold text-red-700">Unduh PDF</p>
            <p className="text-xs text-red-500">Siap cetak · A4 Landscape</p>
          </div>
        </button>

        <button
          disabled={!!loading}
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
            {type === 'jurnal' && (
              <p className="text-xs text-muted-foreground mt-1">
                Format sesuai <strong>Bab XIII RPD</strong>: kop SMK Negeri 2 Cimahi, tabel 1 baris/pertemuan,
                ringkasan otomatis (total sesi, TP dibahas, % kehadiran mengajar), dan blok tanda tangan 3 kolom.
              </p>
            )}
            {type === 'kehadiran' && (
              <p className="text-xs text-muted-foreground mt-1">
                Kolom <strong>Tanggal Tidak Hadir</strong>: S=Sakit · I=Izin · A=Alpha
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
