import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Calendar, CheckCircle2, Users, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, toLocalDateStr } from '@/lib/utils'

type StatusHarian = 'hadir' | 'sakit' | 'izin' | 'alpha'

const STATUS_CONFIG: Record<StatusHarian, { label: string; short: string; classes: string }> = {
  hadir: { label: 'Hadir', short: 'H', classes: 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200' },
  sakit: { label: 'Sakit', short: 'S', classes: 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200' },
  izin:  { label: 'Izin',  short: 'I', classes: 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200' },
  alpha: { label: 'Alpha', short: 'A', classes: 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200' },
}
const STATUS_CYCLE: StatusHarian[] = ['hadir', 'alpha', 'sakit', 'izin']

interface SiswaRecord {
  student_id: string
  nama: string
  nis: string
  status: StatusHarian
  catatan: string | null
}

interface DailyAttendanceResponse {
  data: {
    tanggal: string
    kelas: { id: string; label: string }
    is_filled: boolean
    siswa: SiswaRecord[]
  }
}

interface RekapSiswa {
  student_id: string
  nama: string
  nis: string
  hadir: number
  sakit: number
  izin: number
  alpha: number
}

function toDateStr(d: Date) {
  return toLocalDateStr(d)
}

function formatTanggal(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function PresensiHarianPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [tanggal, setTanggal] = useState(toDateStr(new Date()))
  const [records, setRecords] = useState<Record<string, StatusHarian>>({})
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<'input' | 'rekap'>('input')
  const [rekapMonth, setRekapMonth] = useState(toLocalDateStr(new Date()).slice(0, 7))

  const { data, isLoading } = useQuery({
    queryKey: ['daily-attendance', tanggal],
    queryFn: () => api.get<DailyAttendanceResponse>(`/daily-attendance?tanggal=${tanggal}`),
    select: (r) => r.data.data,
  })

  const { data: rekapData, isLoading: rekapLoading } = useQuery({
    queryKey: ['daily-attendance-rekap', rekapMonth],
    queryFn: () => api.get<{ data: { bulan: string; kelas: string; siswa: RekapSiswa[] } }>(`/daily-attendance/rekap?month=${rekapMonth}`),
    select: (r) => r.data.data,
    enabled: activeTab === 'rekap',
  })

  useEffect(() => {
    if (!data) return
    const init: Record<string, StatusHarian> = {}
    data.siswa.forEach((s) => { init[s.student_id] = s.status })
    setRecords(init)
    setSaved(data.is_filled)
  }, [data])

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/daily-attendance', {
        tanggal,
        records: data!.siswa.map((s) => ({
          student_id: s.student_id,
          status: records[s.student_id] ?? 'hadir',
          catatan: '',
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-attendance', tanggal] })
      setSaved(true)
    },
  })

  function cycleStatus(studentId: string) {
    setRecords((prev) => {
      const cur = prev[studentId] ?? 'hadir'
      const idx = STATUS_CYCLE.indexOf(cur)
      return { ...prev, [studentId]: STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length] }
    })
    setSaved(false)
  }

  function setAllHadir() {
    if (!data) return
    const reset: Record<string, StatusHarian> = {}
    data.siswa.forEach((s) => { reset[s.student_id] = 'hadir' })
    setRecords(reset)
    setSaved(false)
  }

  function shiftDate(days: number) {
    const d = new Date(tanggal)
    d.setDate(d.getDate() + days)
    setTanggal(toDateStr(d))
    setSaved(false)
  }

  function shiftMonth(months: number) {
    const [y, m] = rekapMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + months, 1)
    setRekapMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const totalHadir = Object.values(records).filter((s) => s === 'hadir').length
  const totalAlpha = Object.values(records).filter((s) => s === 'alpha').length
  const totalSakit = Object.values(records).filter((s) => s === 'sakit').length
  const totalIzin  = Object.values(records).filter((s) => s === 'izin').length
  const total = data?.siswa.length ?? 0

  return (
    <div className="max-w-lg space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Presensi Harian</h1>
          {data && <p className="text-xs text-muted-foreground">{data.kelas.label}</p>}
        </div>
      </div>

      {/* Tab */}
      <div className="flex rounded-lg border overflow-hidden">
        <button
          onClick={() => setActiveTab('input')}
          className={cn(
            'flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5',
            activeTab === 'input' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
          )}
        >
          <Calendar className="h-3.5 w-3.5" /> Input Harian
        </button>
        <button
          onClick={() => setActiveTab('rekap')}
          className={cn(
            'flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5',
            activeTab === 'rekap' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
          )}
        >
          <BarChart3 className="h-3.5 w-3.5" /> Rekap Bulanan
        </button>
      </div>

      {activeTab === 'input' && (
        <>
          {/* Date nav */}
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="icon" onClick={() => shiftDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-center">
              <input
                type="date"
                value={tanggal}
                onChange={(e) => { setTanggal(e.target.value); setSaved(false) }}
                className="text-sm font-medium text-center bg-transparent border-none outline-none cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">{formatTanggal(tanggal)}</p>
            </div>
            <Button variant="outline" size="icon" onClick={() => shiftDate(1)} disabled={tanggal >= toDateStr(new Date())}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {isLoading && (
            <div className="space-y-2">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && data && (
            <>
              {/* Ringkasan */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-2 flex-wrap">
                  <Chip label="Hadir" count={totalHadir} total={total} color="text-green-700 bg-green-50" />
                  {totalAlpha > 0 && <Chip label="Alpha" count={totalAlpha} total={total} color="text-red-700 bg-red-50" />}
                  {totalSakit > 0 && <Chip label="Sakit" count={totalSakit} total={total} color="text-blue-700 bg-blue-50" />}
                  {totalIzin  > 0 && <Chip label="Izin"  count={totalIzin}  total={total} color="text-yellow-700 bg-yellow-50" />}
                </div>
                <Button variant="outline" size="sm" onClick={setAllHadir} className="shrink-0">
                  <Users className="h-3 w-3 mr-1" /> Semua Hadir
                </Button>
              </div>

              <p className="text-xs text-muted-foreground -mt-1">
                Tap nama untuk ganti status: Hadir → Alpha → Sakit → Izin
              </p>

              {/* Daftar siswa */}
              <div className="space-y-2">
                {data.siswa.map((s) => {
                  const status = records[s.student_id] ?? 'hadir'
                  const cfg = STATUS_CONFIG[status]
                  return (
                    <button
                      key={s.student_id}
                      type="button"
                      onClick={() => cycleStatus(s.student_id)}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors text-left',
                        cfg.classes,
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.nama}</p>
                        <p className="text-xs opacity-70">{s.nis}</p>
                      </div>
                      <span className={cn(
                        'shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold border-2',
                        status === 'hadir' ? 'border-green-500 bg-green-500 text-white' :
                        status === 'alpha' ? 'border-red-500 bg-red-500 text-white' :
                        status === 'sakit' ? 'border-blue-500 bg-blue-500 text-white' :
                                             'border-yellow-500 bg-yellow-500 text-white',
                      )}>
                        {cfg.short}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Simpan */}
              {saved ? (
                <div className="flex items-center gap-2 justify-center py-3 rounded-lg bg-green-50 border border-green-200">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-medium text-green-700">Presensi sudah tersimpan</p>
                </div>
              ) : (
                <Button
                  className="w-full"
                  disabled={mutation.isPending || total === 0}
                  onClick={() => mutation.mutate()}
                >
                  {mutation.isPending ? 'Menyimpan...' : `Simpan Presensi (${total} Siswa)`}
                </Button>
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'rekap' && (
        <>
          {/* Month nav */}
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-semibold">
              {new Date(rekapMonth + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </p>
            <Button variant="outline" size="icon" onClick={() => shiftMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {rekapLoading && (
            <div className="space-y-2">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {!rekapLoading && rekapData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{rekapData.kelas}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Nama</th>
                        <th className="text-center p-3 font-medium text-green-700">H</th>
                        <th className="text-center p-3 font-medium text-blue-700">S</th>
                        <th className="text-center p-3 font-medium text-yellow-700">I</th>
                        <th className="text-center p-3 font-medium text-red-700">A</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rekapData.siswa.map((s, i) => (
                        <tr key={s.student_id} className={cn('border-b', i % 2 === 0 ? 'bg-white' : 'bg-muted/20')}>
                          <td className="p-3 font-medium">{s.nama}</td>
                          <td className="text-center p-3 text-green-700 font-semibold">{s.hadir}</td>
                          <td className="text-center p-3 text-blue-700">{s.sakit || '—'}</td>
                          <td className="text-center p-3 text-yellow-700">{s.izin || '—'}</td>
                          <td className={cn('text-center p-3 font-semibold', s.alpha > 0 ? 'text-red-700' : 'text-muted-foreground')}>
                            {s.alpha || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {!rekapLoading && rekapData?.siswa.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Belum ada data presensi bulan ini.
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Chip({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', color)}>
      {label}: {count}/{total}
    </span>
  )
}
