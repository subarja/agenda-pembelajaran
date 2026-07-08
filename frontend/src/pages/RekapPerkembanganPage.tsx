import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, TrendingDown, Minus, FileSpreadsheet, Loader2, ChevronLeft, ChevronRight, Info,
  PieChart, Users,
} from 'lucide-react'
import api from '@/lib/api'
import { adminApi } from '@/features/admin/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type SemesterCol = { id: number; label: string; tahun: string; semester: string }
type SemesterCell = { level: string; karakter: number; kehadiran: number; catatan: number; nilai: number | null }
type RekapRow = {
  nis: string | null
  nama: string
  kelas: string | null
  angkatan: number | null
  semesters: Record<string, SemesterCell>
  level_terkini: string | null
  trend_karakter: 'naik' | 'turun' | 'stabil' | null
  delta_karakter: number | null
}
type RekapResp = { semesters: SemesterCol[]; data: RekapRow[]; meta: { total: number; current_page: number; last_page: number; per_page: number } }
type ChartStudent = { nama: string; nis: string | null; kelas: string | null; karakter: number; level: string }
type ChartResp = {
  semester: string | null
  total: number
  distribusi: Record<string, number>
  perhatian: ChartStudent[]
  terbaik: ChartStudent[]
}

// EWS = STATUS palette (hijau→merah). Selalu dibarengi label (bukan warna saja).
const LEVEL: Record<string, { label: string; cls: string; hex: string }> = {
  hijau:  { label: 'Hijau',  cls: 'bg-green-100 text-green-700',   hex: '#22c55e' },
  kuning: { label: 'Kuning', cls: 'bg-yellow-100 text-yellow-700', hex: '#eab308' },
  oranye: { label: 'Oranye', cls: 'bg-orange-100 text-orange-700', hex: '#f97316' },
  merah:  { label: 'Merah',  cls: 'bg-red-100 text-red-700',       hex: '#ef4444' },
}
const LEVEL_KEYS = ['hijau', 'kuning', 'oranye', 'merah'] as const

const PER_PAGE = [25, 50, 100] as const
type PerPage = typeof PER_PAGE[number]

function LevelBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-muted-foreground">–</span>
  const c = LEVEL[level] ?? { label: level, cls: 'bg-muted text-muted-foreground' }
  return <Badge className={cn('text-[10px]', c.cls)}>{c.label}</Badge>
}

function Trend({ trend, delta }: { trend: RekapRow['trend_karakter']; delta: number | null }) {
  if (trend === 'naik')  return <span className="inline-flex items-center gap-0.5 text-green-600 font-medium text-xs"><TrendingUp className="h-3.5 w-3.5" />+{delta}</span>
  if (trend === 'turun') return <span className="inline-flex items-center gap-0.5 text-red-600 font-medium text-xs"><TrendingDown className="h-3.5 w-3.5" />{delta}</span>
  if (trend === 'stabil') return <span className="inline-flex items-center gap-0.5 text-muted-foreground text-xs"><Minus className="h-3.5 w-3.5" />0</span>
  return <span className="text-[11px] text-muted-foreground italic" title="Perlu minimal 2 semester berdata">–</span>
}

// Distribusi Level EWS — satu batang bertumpuk (proporsi) + legenda berlabel angka.
function DistribusiLevel({ distribusi, total }: { distribusi: Record<string, number>; total: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm font-semibold flex items-center gap-1.5 mb-3"><PieChart className="h-4 w-4" /> Distribusi Level EWS</p>
      {total === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Belum ada data pada filter ini.</p>
      ) : (
        <>
          <div className="flex h-6 w-full gap-0.5 overflow-hidden rounded-md" role="img" aria-label="Distribusi level EWS">
            {LEVEL_KEYS.map(k => {
              const v = distribusi[k] ?? 0
              if (!v) return null
              return <div key={k} title={`${LEVEL[k].label}: ${v}`} style={{ width: `${(v / total) * 100}%`, background: LEVEL[k].hex }} className="first:rounded-l-md last:rounded-r-md" />
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
            {LEVEL_KEYS.map(k => (
              <div key={k} className="flex items-center gap-1.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: LEVEL[k].hex }} />
                <span className="text-muted-foreground">{LEVEL[k].label}</span>
                <span className="ml-auto font-semibold tabular-nums">{distribusi[k] ?? 0}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// 5 siswa (poin karakter) — bar horizontal, panjang ∝ |poin|, warna hijau(≥0)/merah(<0),
// tiap baris berlabel nama + level + nilai bertanda. Responsif (nama di atas, bar penuh).
function LimaSiswaChart({ perhatian, terbaik }: { perhatian: ChartStudent[]; terbaik: ChartStudent[] }) {
  const [mode, setMode] = useState<'perhatian' | 'terbaik'>('perhatian')
  const list = mode === 'perhatian' ? perhatian : terbaik
  const maxAbs = Math.max(1, ...list.map(s => Math.abs(s.karakter)))
  const semuaNol = list.every(s => s.karakter === 0)

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-sm font-semibold flex items-center gap-1.5"><Users className="h-4 w-4" /> 5 Siswa</p>
        <div className="flex rounded-md border overflow-hidden text-xs">
          <button onClick={() => setMode('perhatian')} className={cn('px-2.5 py-1', mode === 'perhatian' ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted')}>Perlu Perhatian</button>
          <button onClick={() => setMode('terbaik')} className={cn('px-2.5 py-1', mode === 'terbaik' ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted')}>Terbaik</button>
        </div>
      </div>
      {!list.length ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Belum ada data pada filter ini.</p>
      ) : semuaNol ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Belum ada poin karakter tercatat pada semester ini.</p>
      ) : (
        <div className="space-y-2.5">
          {list.map((s, i) => {
            const pos = s.karakter >= 0
            return (
              <div key={(s.nis ?? s.nama) + i}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Badge className={cn('text-[9px] shrink-0', LEVEL[s.level]?.cls ?? 'bg-muted')}>{LEVEL[s.level]?.label ?? s.level}</Badge>
                    <span className="text-xs font-medium truncate">{s.nama}</span>
                  </span>
                  <span className={cn('text-xs font-semibold tabular-nums shrink-0', pos ? 'text-green-600' : 'text-red-600')}>{pos ? '+' : ''}{s.karakter}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(Math.abs(s.karakter) / maxAbs) * 100}%`, background: pos ? '#22c55e' : '#ef4444' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function RekapPerkembanganPage() {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filterTingkat, setFilterTingkat] = useState('')
  const [filterJurusan, setFilterJurusan] = useState('')
  const [filterKelas, setFilterKelas] = useState('')
  const [perPage, setPerPage] = useState<PerPage>(25)
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 350); return () => clearTimeout(t) }, [search])
  useEffect(() => { setPage(1) }, [debounced, filterTingkat, filterJurusan, filterKelas, perPage])

  const { data: classes } = useQuery({ queryKey: ['admin-classes'], queryFn: adminApi.getClasses })
  const tingkatList = useMemo(() => Array.from(new Set((classes ?? []).map(c => c.tingkat))).sort(), [classes])
  const jurusanList = useMemo(() => Array.from(new Set((classes ?? []).map(c => c.jurusan))).sort(), [classes])
  // Dropdown kelas mengerucut mengikuti tingkat & jurusan yang dipilih (cascade).
  const kelasOptions = useMemo(() => (classes ?? [])
    .filter(c => (!filterTingkat || c.tingkat === filterTingkat) && (!filterJurusan || c.jurusan === filterJurusan)),
    [classes, filterTingkat, filterJurusan])
  // Kalau kelas terpilih tak lagi cocok dgn tingkat/jurusan, reset.
  useEffect(() => {
    if (filterKelas && !kelasOptions.some(c => c.id === filterKelas)) setFilterKelas('')
  }, [kelasOptions, filterKelas])

  const groupFilters = { class_id: filterKelas || undefined, tingkat: filterTingkat || undefined, jurusan: filterJurusan || undefined }

  const { data, isLoading } = useQuery({
    queryKey: ['rekap-perkembangan', debounced, filterTingkat, filterJurusan, filterKelas, page, perPage],
    queryFn: () => api.get('/rekap-perkembangan', {
      params: { search: debounced || undefined, ...groupFilters, page, per_page: perPage },
    }).then(r => r.data as RekapResp),
    placeholderData: (prev) => prev,
  })

  const { data: chart } = useQuery({
    queryKey: ['rekap-perkembangan-chart', filterTingkat, filterJurusan, filterKelas],
    queryFn: () => api.get('/rekap-perkembangan/chart', { params: groupFilters }).then(r => r.data as ChartResp),
    placeholderData: (prev) => prev,
  })

  const semesters = data?.semesters ?? []
  const rows = data?.data ?? []
  const meta = data?.meta
  const oneSemester = semesters.length < 2

  async function exportExcel() {
    setExporting(true)
    try {
      const params = new URLSearchParams({ format: 'excel' })
      if (filterKelas) params.set('class_id', filterKelas)
      if (filterTingkat) params.set('tingkat', filterTingkat)
      if (filterJurusan) params.set('jurusan', filterJurusan)
      if (debounced) params.set('search', debounced)
      const resp = await api.get(`/rekap-perkembangan/export?${params.toString()}`, { responseType: 'blob' })
      const url = URL.createObjectURL(resp.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Rekap_Perkembangan_Siswa.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Rekap Perkembangan Siswa Lintas Semester</h1>
          <p className="text-sm text-muted-foreground">Level EWS &amp; poin karakter tiap siswa dari semester ke semester.</p>
        </div>
        <Button size="sm" onClick={exportExcel} disabled={exporting || !rows.length}>
          {exporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1.5" />}
          Excel
        </Button>
      </div>

      {oneSemester && (
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p>Saat ini baru ada <strong>{semesters.length || 0} semester</strong> berdata. Kolom perbandingan &amp; tren antar-semester akan bertambah otomatis seiring bertambahnya tahun ajaran/semester.</p>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama / NIS siswa..."
          className="h-9 flex-1 min-w-[180px] max-w-sm rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <select value={filterTingkat} onChange={e => setFilterTingkat(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">Semua Tingkat</option>
          {tingkatList.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterJurusan} onChange={e => setFilterJurusan(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-w-[200px]">
          <option value="">Semua Jurusan</option>
          {jurusanList.map(j => <option key={j} value={j}>{j}</option>)}
        </select>
        <select value={filterKelas} onChange={e => setFilterKelas(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-w-[200px]">
          <option value="">Semua Kelas</option>
          {kelasOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>Tampilkan:</span>
          <div className="flex rounded-md border overflow-hidden">
            {PER_PAGE.map(o => (
              <button key={o} onClick={() => setPerPage(o)}
                className={cn('px-2.5 py-1', perPage === o ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted')}>{o}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabel */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading && !data ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" /><p className="text-sm">Memuat rekap...</p>
          </div>
        ) : !rows.length ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
            <TrendingUp className="h-8 w-8" />
            <p className="text-sm">Tidak ada data yang cocok.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-3 py-2">#</th>
                  <th className="text-left font-medium px-3 py-2">Nama</th>
                  <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Kelas (kini)</th>
                  {semesters.map(s => (
                    <th key={s.id} className="text-center font-medium px-3 py-2 whitespace-nowrap border-l">{s.label}</th>
                  ))}
                  <th className="text-center font-medium px-3 py-2 border-l whitespace-nowrap">Tren Karakter</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r, i) => (
                  <tr key={r.nis ?? r.nama} className="hover:bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground">{perPage * ((meta?.current_page ?? 1) - 1) + i + 1}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium leading-tight">{r.nama}</p>
                      <p className="text-[11px] text-muted-foreground">{r.nis ?? '-'}</p>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.kelas ?? '-'}</td>
                    {semesters.map(s => {
                      const cell = r.semesters[s.id]
                      return (
                        <td key={s.id} className="px-3 py-2 text-center border-l">
                          {cell ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <LevelBadge level={cell.level} />
                              <span className={cn('text-[11px] font-medium', cell.karakter < 0 ? 'text-red-600' : 'text-muted-foreground')}>
                                {cell.karakter >= 0 ? '+' : ''}{cell.karakter} poin
                              </span>
                            </div>
                          ) : <span className="text-muted-foreground">–</span>}
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-center border-l"><Trend trend={r.trend_karakter} delta={r.delta_karakter} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{meta.total} siswa · Hal. {meta.current_page}/{meta.last_page}</p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs disabled:opacity-40 hover:bg-muted"><ChevronLeft className="h-3.5 w-3.5" /> Prev</button>
            <button onClick={() => setPage(p => Math.min(meta.last_page, p + 1))} disabled={page >= meta.last_page}
              className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs disabled:opacity-40 hover:bg-muted">Next <ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}

      {/* ── Visualisasi (semester aktif, mengikuti filter tingkat/jurusan/kelas) ── */}
      <div className="pt-1">
        <p className="text-sm font-semibold mb-2">
          Visualisasi{chart?.semester ? ` — ${chart.semester}` : ''}
          {chart ? <span className="ml-1 font-normal text-muted-foreground">({chart.total} siswa)</span> : null}
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DistribusiLevel distribusi={chart?.distribusi ?? {}} total={chart?.total ?? 0} />
          <LimaSiswaChart perhatian={chart?.perhatian ?? []} terbaik={chart?.terbaik ?? []} />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Poin karakter = akumulasi apresiasi (+) dikurangi pelanggaran (−) pada semester itu. Tren membandingkan poin semester terlama vs terbaru yang berdata.
      </p>
    </div>
  )
}
