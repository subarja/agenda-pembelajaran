import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, RefreshCw, X, Loader2, CalendarDays, AlertCircle, ListChecks, Check } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { cn, toLocalDateStr } from '@/lib/utils'

interface CalEvent {
  id: number; title: string; description: string | null
  start_date: string; end_date: string; color: string | null
  all_day: boolean; source: 'google' | 'manual'
}
interface NonEffective {
  id: number; tanggal: string; status: string
  keterangan: string | null; event_title: string | null; libur_nasional?: boolean
}
interface CalendarData {
  events: CalEvent[]; non_effective: NonEffective[]; last_synced: string | null
}
interface EffClass {
  class_id: string; class_label: string; total_mapel: number
  rekap: { subject_id: string; subject_nama: string; hari_jadwal: string[] }[]
}

const WEEK_DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const HARI_DOW: Record<string, number> = { senin:1, selasa:2, rabu:3, kamis:4, jumat:5, sabtu:6, minggu:0 }

const DEFAULT_EVENT_COLOR = '#4285f4'

function dateStr(y: number, m: number, d: number) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}
function dowOf(ds: string) { return new Date(ds + 'T00:00:00').getDay() }
function colOf(ds: string) { return (dowOf(ds) + 6) % 7 }

function buildGrid(year: number, month: number): string[] {
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const startCol = (firstDay.getDay() + 6) % 7
  const total    = Math.ceil((startCol + lastDay.getDate()) / 7) * 7
  return Array.from({ length: total }, (_, i) => {
    const d = i - startCol + 1
    return d < 1 || d > lastDay.getDate() ? '' : dateStr(year, month, d)
  })
}

function formatTanggalPanjang(ds: string) {
  return new Date(ds + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function KalenderPage() {
  const qc      = useQueryClient()
  const user    = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin' || user?.role === 'wakasek'
  const isGuru  = user?.role === 'guru'

  const today = new Date()
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const [selClassId, setSelClassId]     = useState('')
  const [selDay, setSelDay]             = useState<string | null>(null)
  const [nedEdit, setNedEdit]           = useState<NonEffective | null>(null)
  const [nedKeterangan, setNedKeterangan] = useState('')
  const [nedLibur, setNedLibur]         = useState(false)
  const [syncMsg, setSyncMsg]           = useState<{ type: 'ok'|'err', text: string } | null>(null)
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)
  // Mode pilih-banyak-tanggal: klik sel tanggal menambah/melepas dari selectedDates,
  // bukan buka modal 1-tanggal. Satu batch cuma bisa dikirim dengan SATU status
  // (efektif ATAU tidak efektif) — tidak bisa dicampur dalam 1x aksi.
  const [bulkMode, setBulkMode]     = useState(false)
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [bulkKeterangan, setBulkKeterangan] = useState('')
  // Default collapsed — daftar panjang dulu selalu terbuka dan mendorong tooltip event
  // (di bawahnya) keluar dari layar saat hover tanggal.
  const [nedListOpen, setNedListOpen] = useState(false)

  const from = `${year}-${String(month+1).padStart(2,'0')}-01`
  const to   = toLocalDateStr(new Date(year, month+1, 0))

  const { data: calData, isLoading: calLoading, refetch: refetchCal } = useQuery<CalendarData>({
    queryKey: ['calendar-events', from, to],
    queryFn: () => api.get(`/calendar/events?from=${from}&to=${to}`).then(r => r.data),
    staleTime: 0,
    refetchOnWindowFocus: false,
  })

  const { data: effData } = useQuery<{ data: EffClass[] }>({
    queryKey: ['effective-days-my-classes'],
    queryFn: () => api.get('/effective-days/my-classes').then(r => r.data),
    enabled: isGuru,
    staleTime: 10 * 60 * 1000,
  })
  const myClasses = effData?.data ?? []

  // ── Lookup maps ───────────────────────────────────────────────────────────
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {}
    for (const ev of (calData?.events ?? [])) {
      let cur = new Date(ev.start_date + 'T00:00:00')
      const end = new Date(ev.end_date + 'T00:00:00')
      while (cur <= end) {
        const ds = toLocalDateStr(cur)
        if (!map[ds]) map[ds] = []
        map[ds].push(ev)
        cur.setDate(cur.getDate() + 1)
      }
    }
    return map
  }, [calData?.events])

  const nedByDate = useMemo(() => {
    const map: Record<string, NonEffective> = {}
    for (const n of (calData?.non_effective ?? [])) map[n.tanggal] = n
    return map
  }, [calData?.non_effective])

  const teachingDays = useMemo(() => {
    if (!isGuru || !selClassId) return new Set<string>()
    const cls = myClasses.find(c => c.class_id === selClassId)
    if (!cls) return new Set<string>()
    const hariSet = new Set(cls.rekap.flatMap(r => r.hari_jadwal))
    const set = new Set<string>()
    const days = new Date(year, month+1, 0).getDate()
    for (let d = 1; d <= days; d++) {
      const ds = dateStr(year, month, d)
      for (const h of Array.from(hariSet)) {
        if (HARI_DOW[h] === dowOf(ds)) { set.add(ds); break }
      }
    }
    return set
  }, [isGuru, selClassId, myClasses, year, month])

  const nedList = useMemo(() => {
    return (calData?.non_effective ?? []).sort((a,b) => a.tanggal.localeCompare(b.tanggal))
  }, [calData?.non_effective])

  // Resume event bulan ini utk dropdown Rekap — di layar HP event di sel kalender cuma
  // tampil sebagai titik kecil, jadi daftar inilah satu-satunya tempat judulnya terbaca.
  const eventList = useMemo(() => {
    return [...(calData?.events ?? [])].sort((a,b) => a.start_date.localeCompare(b.start_date))
  }, [calData?.events])

  // Akhir pekan (Sabtu/Minggu) tidak pernah dihitung sebagai hari efektif MAUPUN tidak
  // efektif — walau ada event kalender yang jatuh/ditandai di hari itu. Hari efektif =
  // total hari kerja (Sen-Jum) bulan ini dikurangi yang ditandai tidak efektif. Hari tidak
  // efektif = jumlah tanggal yang ditandai tidak efektif YANG JATUH di hari kerja saja.
  const monthStats = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const nedDates = new Set(nedList.map(n => n.tanggal))
    let weekend = 0
    let nedOnWeekday = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = dateStr(year, month, d)
      if (colOf(ds) >= 5) weekend++
      else if (nedDates.has(ds)) nedOnWeekday++
    }
    return { efektif: daysInMonth - weekend - nedOnWeekday, tidakEfektif: nedOnWeekday }
  }, [year, month, nedList])

  // Minggu efektif: sebuah minggu (baris grid kalender, Sen-Min) dianggap "efektif" kalau
  // jumlah hari efektif (hari kerja & tidak ditandai tidak efektif) di minggu itu >= 3.
  // Akhir pekan tidak ikut dihitung sebagai hari efektif ataupun tidak efektif di sini juga.
  const weekStats = useMemo(() => {
    const nedDates = new Set(nedList.map(n => n.tanggal))
    const gridCells = buildGrid(year, month)
    let efektif = 0
    let tidakEfektif = 0
    for (let i = 0; i < gridCells.length; i += 7) {
      const week = gridCells.slice(i, i + 7)
      if (!week.some(ds => ds)) continue
      let effDays = 0
      for (const ds of week) {
        if (!ds || colOf(ds) >= 5) continue
        if (!nedDates.has(ds)) effDays++
      }
      if (effDays >= 3) efektif++
      else tidakEfektif++
    }
    return { efektif, tidakEfektif }
  }, [year, month, nedList])

  // ── Sync ─────────────────────────────────────────────────────────────────
  const syncMut = useMutation({
    mutationFn: () => api.post('/admin/calendar/sync').then(r => r.data),
    onSuccess: d => { setSyncMsg({ type: 'ok', text: d.message }); refetchCal() },
    onError: (e: any) => setSyncMsg({ type: 'err', text: e.response?.data?.message ?? 'Sync gagal.' }),
  })

  // ── NED CRUD ─────────────────────────────────────────────────────────────
  // "admin-ned" dipakai tab Kalender di Panel Admin (halaman terpisah) — invalidate juga
  // supaya perubahan di sini langsung kelihatan di sana, bukan cuma sebaliknya.
  const savNedMut = useMutation({
    mutationFn: (payload: object) => nedEdit
      ? api.put(`/admin/non-effective-days/${nedEdit.id}`, payload).then(r => r.data)
      : api.post('/admin/non-effective-days', payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-events'] })
      qc.invalidateQueries({ queryKey: ['admin-ned'] })
      closeForm()
    },
    onError: (e: any) => alert(e.response?.data?.message ?? 'Gagal menyimpan.'),
  })
  const delNedMut = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/non-effective-days/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-events'] })
      qc.invalidateQueries({ queryKey: ['admin-ned'] })
      closeForm()
    },
  })

  const bulkNedMut = useMutation({
    mutationFn: (status: 'efektif' | 'tidak_efektif') =>
      api.post('/admin/non-effective-days/bulk', {
        tanggal: Array.from(selectedDates), status,
        keterangan: status === 'tidak_efektif' ? (bulkKeterangan || undefined) : undefined,
      }).then(r => r.data),
    onSuccess: (d) => {
      setSyncMsg({ type: 'ok', text: d.message })
      setSelectedDates(new Set())
      setBulkKeterangan('')
      qc.invalidateQueries({ queryKey: ['calendar-events'] })
      qc.invalidateQueries({ queryKey: ['admin-ned'] })
    },
    onError: (e: any) => setSyncMsg({ type: 'err', text: e.response?.data?.message ?? 'Gagal.' }),
  })

  function toggleSelectedDate(ds: string) {
    setSelectedDates(prev => {
      const next = new Set(prev)
      if (next.has(ds)) next.delete(ds); else next.add(ds)
      return next
    })
  }

  function exitBulkMode() { setBulkMode(false); setSelectedDates(new Set()); setBulkKeterangan('') }

  function openDayForm(ds: string) {
    const existing = nedByDate[ds]
    const eventsOnDay = eventsByDate[ds] ?? []
    const autoKet = eventsOnDay.length > 0 ? eventsOnDay.map(e => e.title).join(', ') : ''
    if (existing) {
      setNedEdit(existing)
      setNedKeterangan(existing.keterangan ?? '')
      setNedLibur(existing.libur_nasional ?? false)
    } else {
      setNedEdit(null)
      setNedKeterangan(autoKet)
      setNedLibur(false)
    }
    setSelDay(ds)
  }

  function closeForm() { setSelDay(null); setNedEdit(null) }

  const cells    = buildGrid(year, month)
  const todayStr = toLocalDateStr(today)

  return (
    <div className="space-y-3">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setViewDate(new Date(year, month-1, 1))}
            className="rounded-md border p-1.5 hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[170px] text-center">
            <h2 className="text-xl font-bold">{MONTHS_ID[month]} {year}</h2>
            <p className="text-xs text-muted-foreground">{monthStats.efektif} hari efektif</p>
          </div>
          <button onClick={() => setViewDate(new Date(year, month+1, 1))}
            className="rounded-md border p-1.5 hover:bg-muted transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
          <Button variant="outline" size="sm"
            onClick={() => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))}>
            Hari Ini
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isGuru && myClasses.length > 0 && (
            <select className="rounded-md border border-input px-2 py-1.5 text-sm bg-background"
              value={selClassId} onChange={e => setSelClassId(e.target.value)}>
              <option value="">Semua Kelas</option>
              {myClasses.map(c => <option key={c.class_id} value={c.class_id}>{c.class_label}</option>)}
            </select>
          )}
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
              {syncMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Sync Kalender
            </Button>
          )}
          {isAdmin && (
            <Button variant={bulkMode ? 'default' : 'outline'} size="sm"
              onClick={() => bulkMode ? exitBulkMode() : setBulkMode(true)}>
              <ListChecks className="h-3.5 w-3.5 mr-1" />
              {bulkMode ? 'Selesai Pilih Tanggal' : 'Pilih Banyak Tanggal'}
            </Button>
          )}
        </div>
      </div>

      {/* Sync message */}
      {syncMsg && (
        <div className={cn('rounded-md border px-3 py-2 text-sm flex items-center justify-between',
          syncMsg.type === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700')}>
          <span>{syncMsg.text}</span>
          <button onClick={() => setSyncMsg(null)}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Bulk action bar — muncul saat mode pilih-banyak aktif. Satu batch hanya bisa
          dikirim dengan SATU status; tidak ada cara mencampur efektif & tidak efektif
          dalam satu aksi karena cuma ada 2 tombol aksi terpisah. Satu keterangan berlaku
          untuk SEMUA tanggal terpilih (dipakai saat "Tandai Tidak Efektif" saja — status
          efektif menghapus penanda, jadi keterangan tidak relevan). */}
      {bulkMode && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{selectedDates.size} tanggal dipilih</span>
            <span className="text-xs text-muted-foreground">Klik tanggal di kalender untuk memilih/melepas (Sabtu/Minggu tidak bisa dipilih).</span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setSelectedDates(new Set())} disabled={selectedDates.size === 0}>
              Lepas Semua
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="flex-1 min-w-[180px] rounded-md border border-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Keterangan untuk semua tanggal terpilih (mis. Ujian Nasional)…"
              value={bulkKeterangan}
              onChange={e => setBulkKeterangan(e.target.value)}
            />
            <Button size="sm" className="bg-green-600 text-white hover:bg-green-700"
              onClick={() => bulkNedMut.mutate('efektif')}
              disabled={selectedDates.size === 0 || bulkNedMut.isPending}>
              {bulkNedMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Tandai Efektif
            </Button>
            <Button variant="destructive" size="sm"
              onClick={() => bulkNedMut.mutate('tidak_efektif')}
              disabled={selectedDates.size === 0 || bulkNedMut.isPending}>
              {bulkNedMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Tandai Tidak Efektif
            </Button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500" />Tidak Efektif</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500" />Kegiatan Kalender</span>
        {isGuru && selClassId && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-400" />Hari Mengajar</span>}
        {calData?.last_synced && <span className="ml-auto">Sync: {calData.last_synced}</span>}
      </div>

      {/* ── Main layout: calendar + side panel ───────────────────────────────
          Mobile (<lg): satu kolom — kalender dulu, panel rekap/detail di bawahnya.
          Desktop (lg+): kalender fleksibel + panel samping 16rem. */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-start">

        {/* ── Calendar ─────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {calLoading ? (
            <div className="rounded-xl border overflow-hidden">
              <div className="grid grid-cols-7 bg-muted/50">
                {WEEK_DAYS.map(d => <div key={d} className="py-3 text-center text-xs font-semibold text-muted-foreground">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 divide-x divide-y border-t">
                {Array.from({length:35}).map((_,i) => (
                  <div key={i} className="min-h-[56px] sm:min-h-[110px] p-1 sm:p-2 bg-background">
                    <div className="h-4 w-6 rounded bg-muted animate-pulse mb-2" />
                    <div className="h-3 w-full rounded bg-muted animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden shadow-sm">
              {/* Day headers */}
              <div className="grid grid-cols-7 bg-muted/40 border-b">
                {WEEK_DAYS.map((d, i) => (
                  <div key={d} className={cn(
                    'py-2.5 text-center text-xs font-bold tracking-wide',
                    i >= 5 ? 'text-red-500' : 'text-muted-foreground',
                  )}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 divide-x divide-y">
                {cells.map((ds, idx) => {
                  if (!ds) return (
                    <div key={idx} className="min-h-[56px] sm:min-h-[110px] bg-muted/10" />
                  )

                  const ned        = nedByDate[ds]
                  const events     = eventsByDate[ds] ?? []
                  const isToday    = ds === todayStr
                  const isTeaching = teachingDays.has(ds)
                  const isWeekend  = colOf(ds) >= 5
                  const dayNum     = parseInt(ds.slice(8))
                  const isSelected = selectedDates.has(ds)
                  const canClick   = isAdmin && !isWeekend

                  return (
                    <div key={ds}
                      onClick={() => {
                        if (canClick) {
                          if (bulkMode) toggleSelectedDate(ds)
                          else openDayForm(ds)
                        } else if (events.length > 0) {
                          // Perangkat sentuh tidak punya hover — tap tanggal ber-event
                          // toggle panel detail (di bawah kalender saat layar sempit).
                          setHoveredDate(prev => prev === ds ? null : ds)
                        }
                      }}
                      onMouseEnter={() => events.length > 0 && setHoveredDate(ds)}
                      onMouseLeave={() => setHoveredDate(null)}
                      className={cn(
                        'min-h-[56px] sm:min-h-[110px] p-1 sm:p-1.5 flex flex-col gap-0.5 transition-colors',
                        isSelected ? 'bg-blue-100 ring-2 ring-inset ring-blue-500'
                                   : ned ? 'bg-red-50'
                                   : isTeaching ? 'bg-blue-50/60'
                                   : isWeekend  ? 'bg-slate-50'
                                   : 'bg-white',
                        canClick || events.length > 0 ? 'cursor-pointer hover:brightness-95' : '',
                      )}
                    >
                      {/* Day number */}
                      <div className="flex items-start justify-between mb-0.5">
                        <span className={cn(
                          'w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full text-xs sm:text-sm font-semibold',
                          isSelected ? 'bg-blue-500 text-white shadow-sm'
                                     : isToday ? 'bg-primary text-primary-foreground shadow-sm'
                                     : isWeekend ? 'text-red-500'
                                     : 'text-foreground',
                        )}>
                          {isSelected ? <Check className="h-4 w-4" /> : dayNum}
                        </span>
                        {ned && !isSelected && (
                          <span className="w-2 h-2 rounded-full mt-1 mr-0.5 shrink-0 bg-red-500" />
                        )}
                      </div>

                      {/* Tidak Efektif label — layar sempit cukup latar merah + titik */}
                      {ned && (
                        <div className="hidden sm:block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                          Tidak Efektif
                        </div>
                      )}

                      {/* Calendar events — mobile: deret titik warna, desktop: pill berjudul */}
                      {events.length > 0 && (
                        <div className="flex flex-wrap items-center gap-0.5 mt-auto sm:hidden">
                          {events.slice(0, 3).map(ev => (
                            <span key={ev.id} className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: ev.color ?? DEFAULT_EVENT_COLOR }} />
                          ))}
                          {events.length > 3 && (
                            <span className="text-[9px] leading-none text-muted-foreground">+{events.length - 3}</span>
                          )}
                        </div>
                      )}
                      {events.slice(0, ned ? 2 : 4).map(ev => (
                        <div key={ev.id}
                          className="hidden sm:block text-[11px] px-1.5 py-0.5 rounded font-medium truncate text-white leading-tight"
                          style={{ backgroundColor: ev.color ?? DEFAULT_EVENT_COLOR }}
                          title={ev.title + (ev.description ? '\n' + ev.description : '')}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {events.length > (ned ? 2 : 4) && (
                        <div className="hidden sm:block text-[10px] text-muted-foreground px-1">
                          +{events.length - (ned ? 2 : 4)} lainnya
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {isAdmin && (
            <p className="text-xs text-muted-foreground mt-2">
              Klik tanggal untuk tandai hari tidak efektif. Pengaturan sync di <strong>Panel Admin → Kalender</strong>.
            </p>
          )}
        </div>

        {/* ── Side panel: Hari Tidak Efektif ──────────────────────────────── */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-3">
          <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
            <button type="button" onClick={() => setNedListOpen(o => !o)}
              className="w-full bg-muted/40 px-3 py-2.5 border-b flex items-center gap-2 text-left hover:bg-muted/60 transition-colors">
              <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-semibold">Rekap {MONTHS_ID[month]}</span>
              {nedListOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />}
            </button>

            {/* Ringkasan tetap terlihat walau daftar detail di-minimize */}
            <div className="px-3 py-2 space-y-1.5 text-xs border-b bg-white">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground w-14 shrink-0">Minggu</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                  Efektif: <strong>{weekStats.efektif}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                  Tdk Efektif: <strong>{weekStats.tidakEfektif}</strong>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground w-14 shrink-0">Hari</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                  Efektif: <strong>{monthStats.efektif}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                  Tdk Efektif: <strong>{monthStats.tidakEfektif}</strong>
                </span>
              </div>
            </div>

            {!nedListOpen ? null : nedList.length === 0 && eventList.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Tidak ada hari tidak efektif maupun kegiatan bulan ini.</p>
              </div>
            ) : (
              <div className="max-h-72 lg:max-h-96 overflow-y-auto">
              {nedList.length > 0 && (
              <div className="divide-y">
                <div className="px-3 py-1.5 bg-muted/30 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Hari Tidak Efektif
                </div>
                {nedList.map(n => {
                  const evs = eventsByDate[n.tanggal] ?? []
                  const d   = new Date(n.tanggal + 'T00:00:00')
                  return (
                    <div key={n.id}
                      className="px-3 py-2.5 cursor-pointer hover:brightness-95 transition-colors bg-red-50 border-l-4 border-l-red-400"
                      onClick={() => isAdmin && !bulkMode && openDayForm(n.tanggal)}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-red-700">
                          {d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {d.toLocaleDateString('id-ID', { weekday: 'short' })}
                        </span>
                        <span className="ml-auto text-[10px] font-semibold rounded px-1 bg-red-500 text-white">
                          Tdk Efektif
                        </span>
                      </div>
                      {n.keterangan && (
                        <p className="text-[11px] text-muted-foreground leading-tight">{n.keterangan}</p>
                      )}
                      {evs.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {evs.map(ev => (
                            <div key={ev.id} className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: ev.color ?? DEFAULT_EVENT_COLOR }} />
                              <span className="text-[10px] text-muted-foreground truncate">{ev.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              )}

              {/* Resume kegiatan kalender bulan ini — penting di HP karena event di sel
                  kalender cuma tampil sebagai titik warna kecil tanpa judul. Klik item
                  menyorot tanggalnya (buka panel detail event). */}
              {eventList.length > 0 && (
              <div className="divide-y border-t">
                <div className="px-3 py-1.5 bg-muted/30 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Kegiatan Kalender
                </div>
                {eventList.map(ev => {
                  const d1 = new Date(ev.start_date + 'T00:00:00')
                  const d2 = new Date(ev.end_date + 'T00:00:00')
                  const sameDay = ev.start_date === ev.end_date
                  return (
                    <div key={ev.id}
                      className="px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setHoveredDate(prev => prev === ev.start_date ? null : ev.start_date)}
                    >
                      <div className="flex items-start gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
                          style={{ backgroundColor: ev.color ?? DEFAULT_EVENT_COLOR }} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium leading-tight">{ev.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {sameDay
                              ? d1.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
                              : `${d1.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – ${d2.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              )}
              </div>
            )}
          </div>

          {/* Event tooltip — semua event di tanggal yang disorot, bukan cuma satu.
              Di layar sempit dinaikkan ke atas panel (order-first) supaya hasil tap
              tanggal langsung terlihat tepat di bawah kalender. */}
          {hoveredDate && (eventsByDate[hoveredDate]?.length ?? 0) > 0 && (
            <div className="rounded-xl border bg-card p-3 shadow-md space-y-3 max-h-80 overflow-y-auto order-first lg:order-none">
              <p className="text-xs font-semibold text-muted-foreground">{formatTanggalPanjang(hoveredDate)}</p>
              {eventsByDate[hoveredDate]!.map(ev => (
                <div key={ev.id} className="space-y-1 pb-2 border-b last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: ev.color ?? DEFAULT_EVENT_COLOR }} />
                    <p className="text-sm font-semibold">{ev.title}</p>
                  </div>
                  {ev.start_date !== ev.end_date && (
                    <p className="text-xs text-muted-foreground">
                      {`${new Date(ev.start_date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – ${new Date(ev.end_date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </p>
                  )}
                  {ev.description && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{ev.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Teacher kelas info */}
          {isGuru && selClassId && (
            <div className="rounded-xl border bg-card p-3 space-y-1">
              <p className="text-xs font-semibold text-blue-700">Kelas terpilih:</p>
              <p className="text-xs">{myClasses.find(c => c.class_id === selClassId)?.class_label}</p>
              <p className="text-xs text-muted-foreground">Hari biru = hari mengajar kelas ini</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Admin Day Form Modal ──────────────────────────────────────────────── */}
      {isAdmin && selDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={e => e.target === e.currentTarget && closeForm()}>
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold">
                {nedEdit ? 'Kelola Hari Tidak Efektif' : 'Tandai Hari Ini'}
              </h3>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{formatTanggalPanjang(selDay)}</p>

            {/* Status saat ini — hijau = efektif, merah = tidak efektif. Warna ini konsisten
                dengan tombol aksi di bawah supaya tidak ambigu mana yang menuju status mana. */}
            <div className="mb-4 flex items-center gap-2">
              <span className={cn(
                'rounded-lg text-white text-xs font-semibold px-3 py-1.5',
                nedEdit ? 'bg-red-500' : 'bg-green-500',
              )}>
                {nedEdit ? 'Tidak Efektif' : 'Efektif'}
              </span>
              <span className="text-xs text-muted-foreground">Status saat ini</span>
            </div>

            {/* Events on this day */}
            {(eventsByDate[selDay] ?? []).length > 0 && (
              <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-2.5">
                <p className="text-xs font-semibold text-blue-700 mb-1.5 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Kegiatan Kalender Akademik:
                </p>
                {(eventsByDate[selDay] ?? []).map(ev => (
                  <button key={ev.id}
                    className="w-full text-left text-xs text-blue-700 hover:text-blue-900 py-0.5 flex items-center gap-2"
                    onClick={() => setNedKeterangan(ev.title)}>
                    <span className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: ev.color ?? DEFAULT_EVENT_COLOR }} />
                    {ev.title}
                    <span className="ml-auto text-[10px] text-blue-400">← klik isi</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mb-5">
              <label className="text-xs font-semibold mb-1.5 block">Keterangan / Alasan</label>
              <input
                className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="mis. Hari Kemerdekaan, Ujian Nasional, Rapat Dinas..."
                value={nedKeterangan}
                onChange={e => setNedKeterangan(e.target.value)}
              />
              <label className="mt-2 flex items-start gap-2 text-xs cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={nedLibur} onChange={e => setNedLibur(e.target.checked)} />
                <span><span className="font-medium">Libur Nasional</span> — hari ini juga tidak dihitung sebagai hari kerja PKL (mengurangi denominator % hadir siswa PKL). Hari tidak efektif internal biasa TIDAK memengaruhi PKL.</span>
              </label>
            </div>

            {/* Aksi — merah SELALU berarti "jadikan tidak efektif", hijau SELALU berarti
                "jadikan efektif". Tombol netral (outline) cuma untuk simpan keterangan saja. */}
            <div className="flex gap-2">
              {nedEdit ? (
                <>
                  <Button variant="outline" size="sm" className="flex-1"
                    onClick={() => savNedMut.mutate({ keterangan: nedKeterangan || undefined, libur_nasional: nedLibur })}
                    disabled={savNedMut.isPending}>
                    {savNedMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan Keterangan'}
                  </Button>
                  <Button size="sm" className="bg-green-600 text-white hover:bg-green-700"
                    onClick={() => { if (confirm('Tandai hari ini sebagai efektif?')) delNedMut.mutate(nedEdit.id) }}
                    disabled={delNedMut.isPending}>
                    {delNedMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tandai Efektif'}
                  </Button>
                </>
              ) : (
                <Button variant="destructive" size="sm" className="flex-1"
                  onClick={() => savNedMut.mutate({ tanggal: selDay, keterangan: nedKeterangan || undefined, libur_nasional: nedLibur })}
                  disabled={savNedMut.isPending}>
                  {savNedMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tandai Tidak Efektif'}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={closeForm}>Batal</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
