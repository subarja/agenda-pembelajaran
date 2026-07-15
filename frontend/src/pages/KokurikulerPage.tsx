import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sparkles, Loader2, ClipboardCheck, FileText, BookOpenCheck, Users, Star,
  Save, Shuffle, Trash2, ExternalLink, CheckCircle2, Circle, Download,
} from 'lucide-react'
import { kokurikulerApi, type KkProject, type KkLevel } from '@/features/kokurikuler/api'
import { usePdfPreview } from '@/hooks/usePdfPreview'
import { PresensiToggleList, STATUS_CYCLE } from '@/components/presensi/PresensiToggleList'
import type { PresensiSubmitRecord, StatusPresensi } from '@/features/presensi/types'
import { useAuthStore } from '@/store/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, toLocalDateStr } from '@/lib/utils'
import KokurikulerSiswaPage from '@/pages/KokurikulerSiswaPage'

/**
 * Halaman Kokurikuler. Siswa → refleksi & dokumen tim (KokurikulerSiswaPage);
 * selain itu → tampilan fasilitator (absen, laporan harian, refleksi siswa, tim).
 */
export default function KokurikulerPage() {
  const user = useAuthStore((s) => s.user)
  if (user?.role === 'siswa') return <KokurikulerSiswaPage />
  return <FasilitatorView />
}

const TABS = [
  { key: 'absen',    label: 'Absen',    icon: ClipboardCheck },
  { key: 'laporan',  label: 'Laporan',  icon: FileText },
  { key: 'refleksi', label: 'Refleksi', icon: BookOpenCheck },
  { key: 'nilai',    label: 'Nilai',    icon: Star },
  { key: 'tim',      label: 'Tim & Dokumen', icon: Users },
] as const

function FasilitatorView() {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [classId, setClassId]     = useState<string | null>(null)
  const [tab, setTab]             = useState<(typeof TABS)[number]['key']>('absen')

  const { data: res, isLoading } = useQuery({
    queryKey: ['kokurikuler-overview'],
    queryFn: () => kokurikulerApi.overview(),
  })
  const projects = res?.data.data.projects ?? []
  const project  = projects.find((p) => p.id === projectId) ?? null

  useEffect(() => {
    if (!projectId && projects.length > 0) setProjectId(projects[0].id)
  }, [projects, projectId])
  useEffect(() => {
    if (project && (!classId || !project.classes.some((c) => c.id === classId))) {
      setClassId(project.classes[0]?.id ?? null)
    }
  }, [project, classId])

  if (isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground p-4"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</div>
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary-600" />
        <div>
          <h1 className="text-xl font-bold">Kokurikuler</h1>
          <p className="text-xs text-muted-foreground">Absen, laporan harian fasilitator, refleksi siswa, dan dokumen tim.</p>
        </div>
      </div>

      {projects.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          Tidak ada projek kokurikuler berjalan yang Anda fasilitasi.
        </CardContent></Card>
      ) : (
        <>
          {projects.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {projects.map((p) => (
                <button key={p.id} onClick={() => setProjectId(p.id)}
                  className={cn('rounded-lg border px-3 py-1.5 text-sm transition-colors',
                    p.id === projectId ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-border hover:bg-accent')}>
                  {p.judul}
                </button>
              ))}
            </div>
          )}

          {project && (
            <>
              <Card><CardContent className="p-4">
                <p className="font-semibold text-sm">{project.judul}</p>
                {project.tema && <p className="text-xs text-muted-foreground mt-0.5">Tema: {project.tema}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {project.tanggal_mulai} s.d. {project.tanggal_selesai}
                  {project.status === 'selesai' && <Badge variant="secondary" className="ml-2">Selesai</Badge>}
                </p>
              </CardContent></Card>

              {project.classes.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {project.classes.map((c) => (
                    <button key={c.id} onClick={() => setClassId(c.id)}
                      className={cn('rounded-lg border px-3 py-1.5 text-sm transition-colors',
                        c.id === classId ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-border hover:bg-accent')}>
                      {c.label} <span className="text-muted-foreground">({c.jumlah_siswa})</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Tab bar */}
              <div className="flex flex-wrap gap-1 border-b">
                {TABS.map((t) => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={cn('flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors',
                      tab === t.key ? 'border-primary-500 text-primary-700 font-medium' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                    <t.icon className="h-4 w-4" /> {t.label}
                  </button>
                ))}
              </div>

              {classId && tab === 'absen'    && <AbsenTab project={project} classId={classId} />}
              {classId && tab === 'laporan'  && <LaporanTab project={project} classId={classId} />}
              {classId && tab === 'refleksi' && <RefleksiTab project={project} classId={classId} />}
              {classId && tab === 'nilai'    && <NilaiTab project={project} classId={classId} />}
              {classId && tab === 'tim'      && <TimTab project={project} classId={classId} />}
            </>
          )}
        </>
      )}
    </div>
  )
}

/** Tanggal projek yang sudah/sedang berjalan (≤ hari ini) — untuk pilihan isi data. */
function pastDates(project: KkProject) {
  const today = toLocalDateStr(new Date())
  return project.hari.filter((h) => h.tanggal <= today)
}

function TanggalSelect({ project, value, onChange }: { project: KkProject; value: string; onChange: (v: string) => void }) {
  const options = pastDates(project)
  return (
    <select className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((h) => <option key={h.tanggal} value={h.tanggal}>{h.label}</option>)}
    </select>
  )
}

function defaultTanggal(project: KkProject): string {
  const past = pastDates(project)
  return past.length > 0 ? past[past.length - 1].tanggal : (project.hari[0]?.tanggal ?? toLocalDateStr(new Date()))
}

// ── Tab Absen ─────────────────────────────────────────────────────────────────
function AbsenTab({ project, classId }: { project: KkProject; classId: string }) {
  const qc = useQueryClient()
  const [tanggal, setTanggal] = useState(() => defaultTanggal(project))
  const [records, setRecords] = useState<Record<string, PresensiSubmitRecord>>({})
  const [saved, setSaved]     = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['kokurikuler-absen', project.id, classId, tanggal],
    queryFn: () => kokurikulerApi.absen(project.id, classId, tanggal),
  })
  const students = useMemo(() => data?.data.data.students ?? [], [data])

  useEffect(() => {
    const next: Record<string, PresensiSubmitRecord> = {}
    for (const s of students) {
      next[s.id] = { student_id: s.id, status: (s.status ?? 'hadir') as StatusPresensi, durasi_terlambat: 0, catatan: '' }
    }
    setRecords(next)
    setSaved(false)
  }, [students])

  const save = useMutation({
    mutationFn: () => kokurikulerApi.simpanAbsen({
      project_id: project.id, class_id: classId, tanggal,
      records: Object.values(records).map((r) => ({ student_id: r.student_id, status: r.status })),
    }),
    onSuccess: () => {
      setSaved(true)
      qc.invalidateQueries({ queryKey: ['kokurikuler-absen', project.id, classId, tanggal] })
    },
  })

  const cycle = (id: string) => {
    setSaved(false)
    setRecords((prev) => {
      const cur  = prev[id]?.status ?? 'hadir'
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length]
      return { ...prev, [id]: { ...prev[id], status: next } }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Tanggal:</span>
        <TanggalSelect project={project} value={tanggal} onChange={setTanggal} />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</div>
      ) : (
        <>
          <PresensiToggleList
            students={students.map((s) => ({ student_id: s.id, nama: s.nama, nis: s.nis }))}
            records={records}
            onCycle={cycle}
            onSetAllHadir={() => {
              setSaved(false)
              setRecords((prev) => Object.fromEntries(
                Object.entries(prev).map(([k, v]) => [k, { ...v, status: 'hadir' as StatusPresensi }])))
            }}
          />
          <Button className="w-full" disabled={save.isPending || students.length === 0 || project.status !== 'aktif'} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Simpan Absen
          </Button>
          {saved && <p className="text-sm text-emerald-600 text-center">Absensi tersimpan.</p>}
          {save.isError && <p className="text-sm text-red-600 text-center">{(save.error as any)?.response?.data?.message ?? 'Gagal menyimpan.'}</p>}
        </>
      )}
    </div>
  )
}

// ── Tab Laporan Harian ────────────────────────────────────────────────────────
function LaporanTab({ project, classId }: { project: KkProject; classId: string }) {
  const qc = useQueryClient()
  const [tanggal, setTanggal] = useState(() => defaultTanggal(project))
  const [isi, setIsi]         = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['kokurikuler-laporan', project.id, classId],
    queryFn: () => kokurikulerApi.laporan(project.id, classId),
  })
  const rows = useMemo(() => data?.data.data.laporan ?? [], [data])

  useEffect(() => {
    setIsi(rows.find((r) => r.tanggal === tanggal)?.isi ?? '')
  }, [rows, tanggal])

  const save = useMutation({
    mutationFn: () => kokurikulerApi.simpanLaporan({ project_id: project.id, class_id: classId, tanggal, isi }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kokurikuler-laporan', project.id, classId] }),
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Tanggal:</span>
        <TanggalSelect project={project} value={tanggal} onChange={setTanggal} />
      </div>

      <textarea
        className="w-full rounded-md border border-input bg-background p-3 text-sm min-h-28"
        placeholder="Laporan singkat kegiatan hari ini (maks. 2000 karakter)…"
        maxLength={2000}
        value={isi}
        onChange={(e) => setIsi(e.target.value)}
      />
      <Button disabled={!isi.trim() || save.isPending || project.status !== 'aktif'} onClick={() => save.mutate()}>
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Simpan Laporan
      </Button>
      {save.isSuccess && <span className="text-sm text-emerald-600 ml-2">Tersimpan.</span>}
      {save.isError && <p className="text-sm text-red-600">{(save.error as any)?.response?.data?.message ?? 'Gagal menyimpan.'}</p>}

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</div>
      ) : (
        <div className="divide-y border rounded-lg">
          {rows.map((r) => (
            <button key={r.tanggal} onClick={() => setTanggal(r.tanggal)}
              className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent',
                r.tanggal === tanggal && 'bg-primary-50')}>
              {r.isi
                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className="font-medium shrink-0">{r.label}</span>
              <span className="text-muted-foreground truncate">{r.isi ?? 'Belum ada laporan'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab Refleksi Siswa (dibaca fasilitator) ───────────────────────────────────
function RefleksiTab({ project, classId }: { project: KkProject; classId: string }) {
  const [jenis, setJenis]     = useState<'harian' | 'akhir'>('harian')
  const [tanggal, setTanggal] = useState(() => defaultTanggal(project))

  const { data, isLoading } = useQuery({
    queryKey: ['kokurikuler-refleksi', project.id, classId, jenis, jenis === 'harian' ? tanggal : 'akhir'],
    queryFn: () => kokurikulerApi.refleksi(project.id, classId, jenis, jenis === 'harian' ? tanggal : undefined),
  })
  const students = data?.data.data.students ?? []
  const terisi   = data?.data.data.terisi ?? 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          value={jenis} onChange={(e) => setJenis(e.target.value as 'harian' | 'akhir')}>
          <option value="harian">Refleksi Harian</option>
          <option value="akhir">Refleksi Akhir Projek</option>
        </select>
        {jenis === 'harian' && <TanggalSelect project={project} value={tanggal} onChange={setTanggal} />}
        {!isLoading && <Badge variant="secondary">{terisi}/{students.length} terisi</Badge>}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</div>
      ) : (
        <div className="divide-y border rounded-lg">
          {students.map((s) => (
            <div key={s.id} className="px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                {s.isi
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <span className="font-medium">{s.nama}</span>
                <span className="text-xs text-muted-foreground">{s.nis}</span>
              </div>
              {s.isi && <p className="text-muted-foreground mt-1 ml-6 whitespace-pre-wrap">{s.isi}</p>}
            </div>
          ))}
          {students.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada siswa.</div>}
        </div>
      )}
    </div>
  )
}

// ── Tab Nilai (dimensi profil lulusan, level SB/B/C/K) ────────────────────────
const LEVELS: KkLevel[] = ['SB', 'B', 'C', 'K']
const LEVEL_CLASSES: Record<KkLevel, string> = {
  SB: 'bg-emerald-500 text-white border-emerald-500',
  B:  'bg-green-100 text-green-700 border-green-300',
  C:  'bg-yellow-100 text-yellow-700 border-yellow-300',
  K:  'bg-red-100 text-red-700 border-red-300',
}

function NilaiTab({ project, classId }: { project: KkProject; classId: string }) {
  const qc  = useQueryClient()
  const pdf = usePdfPreview()
  const [levels, setLevels] = useState<Record<string, KkLevel | null>>({}) // key: studentId|dimUuid
  const [dirty, setDirty]   = useState(false)
  const [unduhErr, setUnduhErr] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['kokurikuler-nilai', project.id, classId],
    queryFn: () => kokurikulerApi.nilai(project.id, classId),
  })
  const dimensi  = useMemo(() => data?.data.data.dimensi ?? [], [data])
  const students = useMemo(() => data?.data.data.students ?? [], [data])

  useEffect(() => {
    const next: Record<string, KkLevel | null> = {}
    for (const s of students) for (const d of dimensi) next[`${s.id}|${d.id}`] = s.nilai[d.id]?.level ?? null
    setLevels(next)
    setDirty(false)
  }, [students, dimensi])

  const save = useMutation({
    mutationFn: () => kokurikulerApi.simpanNilai({
      project_id: project.id, class_id: classId,
      nilai: students.flatMap((s) => dimensi.map((d) => ({
        student_id: s.id, dimension_id: d.id, level: levels[`${s.id}|${d.id}`] ?? null,
      }))),
    }),
    onSuccess: () => {
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['kokurikuler-nilai', project.id, classId] })
    },
  })

  function setLevel(studentId: string, dimId: string, level: KkLevel) {
    setDirty(true)
    setLevels((prev) => {
      const key = `${studentId}|${dimId}`
      return { ...prev, [key]: prev[key] === level ? null : level } // tap ulang = kosongkan
    })
  }

  /** "Samakan satu kolom": set semua siswa ke level tertentu untuk satu dimensi. */
  function setAll(dimId: string, level: KkLevel) {
    setDirty(true)
    setLevels((prev) => {
      const next = { ...prev }
      for (const s of students) next[`${s.id}|${dimId}`] = level
      return next
    })
  }

  async function unduhPdf() {
    setUnduhErr(null)
    try {
      await pdf.openPreview(kokurikulerApi.nilaiPdfUrl(project.id, classId), 'nilai_kokurikuler.pdf')
    } catch (e) {
      setUnduhErr((e as Error).message || 'Gagal membuka PDF.')
    }
  }

  if (isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</div>
  }
  if (dimensi.length === 0) {
    return <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
      Projek ini belum punya dimensi penilaian — minta admin menambahkannya di Panel Admin → Kokurikuler.
    </CardContent></Card>
  }

  return (
    <div className="space-y-3">
      {/* Panduan mengamati */}
      <Card><CardContent className="p-3 text-xs text-muted-foreground space-y-1">
        {dimensi.map((d) => (
          <p key={d.id}><strong className="text-foreground">{d.nama}</strong>
            {d.aspek ? ` — ${d.aspek}` : ''}
            {d.subdimensi.length > 0 && <span> ({d.subdimensi.join(' · ')})</span>}
          </p>
        ))}
        <p className="pt-1">SB = Sangat Baik · B = Baik · C = Cukup · K = Perlu Bimbingan. Tap ulang level yang sama untuk mengosongkan.</p>
      </CardContent></Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!dirty || save.isPending || project.status !== 'aktif'} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Simpan Nilai
        </Button>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => {
            setUnduhErr(null)
            kokurikulerApi.downloadNilaiExcel(project.id, classId, 'nilai_kokurikuler.xlsx')
              .catch((e: Error) => setUnduhErr(e.message || 'Gagal mengunduh.'))
          }}>
            <Download className="h-4 w-4 mr-1" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={unduhPdf}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>
      </div>
      {save.isSuccess && !dirty && <p className="text-sm text-emerald-600">Penilaian tersimpan.</p>}
      {save.isError && <p className="text-sm text-red-600">{(save.error as any)?.response?.data?.message ?? 'Gagal menyimpan nilai.'}</p>}
      {unduhErr && <p className="text-sm text-red-600">{unduhErr}</p>}

      <div className="overflow-x-auto border rounded-lg">
        <table className="text-sm w-full min-w-max">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 sticky left-0 bg-muted/50 z-10">Siswa</th>
              {dimensi.map((d) => (
                <th key={d.id} className="px-3 py-2 text-center">
                  <div>{d.nama}</div>
                  <div className="flex justify-center gap-0.5 mt-1">
                    {LEVELS.map((lv) => (
                      <button key={lv} title={`Samakan kolom: semua ${lv}`} onClick={() => setAll(d.id, lv)}
                        className="rounded border px-1 text-[10px] text-muted-foreground hover:bg-accent">
                        {lv}
                      </button>
                    ))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {students.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-1.5 sticky left-0 bg-background whitespace-nowrap">
                  <p className="font-medium">{s.nama}</p>
                  <p className="text-xs text-muted-foreground">{s.nis}</p>
                </td>
                {dimensi.map((d) => {
                  const cur = levels[`${s.id}|${d.id}`]
                  return (
                    <td key={d.id} className="px-2 py-1.5 text-center whitespace-nowrap">
                      <div className="inline-flex gap-1">
                        {LEVELS.map((lv) => (
                          <button key={lv} onClick={() => setLevel(s.id, d.id, lv)}
                            disabled={project.status !== 'aktif'}
                            className={cn('h-8 w-9 rounded-md border text-xs font-bold transition-colors',
                              cur === lv ? LEVEL_CLASSES[lv] : 'border-border text-muted-foreground hover:bg-accent')}>
                            {lv}
                          </button>
                        ))}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pdf.modal}
    </div>
  )
}

// ── Tab Tim & Dokumen ─────────────────────────────────────────────────────────
function TimTab({ project, classId }: { project: KkProject; classId: string }) {
  const qc = useQueryClient()
  const [jumlahTim, setJumlahTim]     = useState(6)
  const [assignments, setAssignments] = useState<Record<string, number>>({}) // 0 = belum bertim
  const [dirty, setDirty]             = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['kokurikuler-tim', project.id, classId],
    queryFn: () => kokurikulerApi.tim(project.id, classId),
  })
  const board = data?.data.data ?? null

  // Daftar semua siswa kelas (dari tim + belum bertim), urut nama.
  const allStudents = useMemo(() => {
    if (!board) return []
    const fromTeams = board.teams.flatMap((t) => t.anggota.map((a) => ({ ...a, nomor: t.nomor })))
    const unassigned = board.unassigned.map((a) => ({ ...a, nomor: 0 }))
    return [...fromTeams, ...unassigned].sort((a, b) => a.nama.localeCompare(b.nama))
  }, [board])

  useEffect(() => {
    if (!board) return
    setJumlahTim(Math.max(board.teams.length, 1) || 6)
    setAssignments(Object.fromEntries(allStudents.map((s) => [s.id, s.nomor])))
    setDirty(false)
  }, [board, allStudents])

  const save = useMutation({
    mutationFn: (payload: { jumlah_tim: number; assignments: { student_id: string; nomor: number | null }[] }) =>
      kokurikulerApi.simpanTim({
        project_id: project.id, class_id: classId,
        jumlah_tim: payload.jumlah_tim,
        teams: Array.from({ length: payload.jumlah_tim }, (_, i) => ({
          nomor: i + 1,
          nama: board?.teams.find((t) => t.nomor === i + 1)?.nama ?? null,
        })),
        assignments: payload.assignments,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kokurikuler-tim', project.id, classId] }),
  })

  function bagiOtomatis() {
    const ids = allStudents.map((s) => s.id)
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
    }
    setAssignments(Object.fromEntries(ids.map((id, i) => [id, (i % jumlahTim) + 1])))
    setDirty(true)
  }

  const del = useMutation({
    mutationFn: (id: string) => kokurikulerApi.hapusDokumen(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kokurikuler-tim', project.id, classId] }),
  })

  if (isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</div>
  }
  if (!board) return null

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Susunan Tim</h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Jumlah tim:</span>
          <input type="number" min={1} max={12} value={jumlahTim}
            onChange={(e) => { setJumlahTim(Math.max(1, Math.min(12, Number(e.target.value) || 1))); setDirty(true) }}
            className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
          <Button size="sm" variant="outline" onClick={bagiOtomatis} disabled={project.status !== 'aktif'}>
            <Shuffle className="h-4 w-4 mr-1" /> Bagi Otomatis
          </Button>
          <Button size="sm" disabled={!dirty || save.isPending || project.status !== 'aktif'}
            onClick={() => save.mutate({
              jumlah_tim: jumlahTim,
              assignments: Object.entries(assignments).map(([student_id, nomor]) => ({ student_id, nomor: nomor || null })),
            })}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Simpan Tim
          </Button>
        </div>
        {save.isError && <p className="text-sm text-red-600">{(save.error as any)?.response?.data?.message ?? 'Gagal menyimpan tim.'}</p>}
        {save.isSuccess && !dirty && <p className="text-sm text-emerald-600">Susunan tim tersimpan.</p>}

        <div className="divide-y border rounded-lg max-h-96 overflow-y-auto">
          {allStudents.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
              <span className="min-w-0 truncate">{s.nama} <span className="text-xs text-muted-foreground">{s.nis}</span></span>
              <select className="rounded-md border border-input bg-background px-2 py-1 text-sm shrink-0"
                value={assignments[s.id] ?? 0}
                onChange={(e) => { setAssignments((p) => ({ ...p, [s.id]: Number(e.target.value) })); setDirty(true) }}>
                <option value={0}>—</option>
                {Array.from({ length: jumlahTim }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Tim {i + 1}</option>
                ))}
              </select>
            </div>
          ))}
          {allStudents.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada siswa.</div>}
        </div>
      </CardContent></Card>

      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Dokumen Hasil per Tim</h3>
        {board.teams.map((t) => (
          <Card key={t.nomor}><CardContent className="p-3">
            <p className="text-sm font-medium">Tim {t.nomor}{t.nama ? ` — ${t.nama}` : ''} <span className="text-xs text-muted-foreground">({t.anggota.length} anggota)</span></p>
            {t.dokumen.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1">Belum ada tautan dokumen.</p>
            ) : (
              <div className="mt-1 divide-y">
                {t.dokumen.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 py-1.5 text-sm">
                    <a href={d.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary-700 hover:underline min-w-0">
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{d.judul}</span>
                    </a>
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">{d.oleh ?? ''}</span>
                    <button onClick={() => del.mutate(d.id)} aria-label="Hapus dokumen"
                      className="p-1.5 -m-1 shrink-0 text-muted-foreground hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        ))}
        {board.teams.length === 0 && <p className="text-sm text-muted-foreground">Belum ada tim — susun tim di atas dulu.</p>}
      </div>
    </div>
  )
}
