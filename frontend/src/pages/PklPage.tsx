import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Briefcase, Download, FileText, CheckCircle2, Circle, Loader2, ChevronRight, ChevronDown, Pencil, Plus, X, Users, Flag } from 'lucide-react'
import { pklApi, type PklStudentRow, type PklWeek } from '@/features/pkl/api'
import { usePdfPreview } from '@/hooks/usePdfPreview'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { WhatsAppLink } from '@/components/ui/whatsapp-link'
import PklStatusBadge from '@/components/pkl/PklStatusBadge'
import PklStatusDialog from '@/components/pkl/PklStatusDialog'

export default function PklPage() {
  const navigate = useNavigate()
  const pdf = usePdfPreview()
  const [busy, setBusy] = useState<string | null>(null)
  const [unduhErr, setUnduhErr] = useState<string | null>(null)

  const { data: overviewRes, isLoading } = useQuery({
    queryKey: ['pkl-overview'],
    queryFn: () => pklApi.overview(),
  })
  const classes = overviewRes?.data.data.classes ?? []

  // Seluruh siswa bimbingan lintas kelas — tanpa harus memilih kelas dulu.
  const { data: studentsRes } = useQuery({
    queryKey: ['pkl-students', 'semua'],
    queryFn: () => pklApi.myStudents(),
  })
  const students = studentsRes?.data.data ?? []

  // Agenda PKL kini AGREGAT: satu daftar minggu untuk semua kelas bimbingan.
  const { data: weeksRes, isLoading: loadingWeeks } = useQuery({
    queryKey: ['pkl-weeks'],
    queryFn: () => pklApi.weeks(),
  })
  const allWeeks: PklWeek[] = weeksRes?.data.data.weeks ?? []

  // Prioritas: (1) minggu yang harus segera diisi (sudah Jumat, belum diisi, belum
  // lewat batas), (2) yang lewat batas & belum diisi, lalu riwayat terisi di balik
  // toggle. Minggu yang belum masuk hari Jumat disembunyikan total.
  const perluIsi = allWeeks.filter((w) => w.bisa_diisi && !w.terisi)
    .sort((a, b) => a.minggu_mulai.localeCompare(b.minggu_mulai))
  const telat = allWeeks.filter((w) => !w.terisi && w.lewat_batas)
    .sort((a, b) => b.minggu_mulai.localeCompare(a.minggu_mulai))
  const riwayat = allWeeks.filter((w) => w.terisi)
    .sort((a, b) => b.minggu_mulai.localeCompare(a.minggu_mulai))

  const [showAllTelat, setShowAllTelat] = useState(false)
  const [showRiwayat, setShowRiwayat] = useState(false)
  const telatShown = showAllTelat ? telat : telat.slice(0, 4)

  // ── Filter daftar siswa bimbingan (kelas & industri, saling mempersempit) ──
  const [fKelas, setFKelas] = useState('')
  const [fIndustri, setFIndustri] = useState('')

  const kelasOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of students) if ((!fIndustri || s.tempat_pkl === fIndustri) && s.class_id && s.kelas) map.set(s.class_id, s.kelas)
    return [...map.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, 'id'))
  }, [students, fIndustri])

  const industriOptions = useMemo(() =>
    [...new Set(students.filter((s) => !fKelas || s.class_id === fKelas).map((s) => s.tempat_pkl).filter((t): t is string => !!t))]
      .sort((a, b) => a.localeCompare(b, 'id')),
  [students, fKelas])

  const filteredStudents = students.filter((s) =>
    (!fKelas || s.class_id === fKelas) && (!fIndustri || s.tempat_pkl === fIndustri))

  // ── Edit / tambah tempat PKL oleh pembimbing ────────────────────────────────
  const qc = useQueryClient()
  const [placeForm, setPlaceForm] = useState<{
    mode: 'edit' | 'add'
    placementId?: string
    studentId: string
    anchor: string          // placement_id baris tempat form ditampilkan
    tempat: string; alamat: string; telpon: string; mulai: string; selesai: string
  } | null>(null)
  const [placeErr, setPlaceErr] = useState('')
  const [placeSaving, setPlaceSaving] = useState(false)
  const [statusRow, setStatusRow] = useState<PklStudentRow | null>(null)

  function openEdit(s: PklStudentRow) {
    setPlaceErr('')
    setPlaceForm({
      mode: 'edit', placementId: s.placement_id, studentId: s.id, anchor: s.placement_id,
      tempat: s.tempat_pkl ?? '', alamat: s.alamat_pkl === '—' ? '' : (s.alamat_pkl ?? ''),
      telpon: s.telpon ?? '', mulai: s.mulai ?? '', selesai: s.selesai ?? '',
    })
  }

  function openAdd(s: PklStudentRow) {
    setPlaceErr('')
    setPlaceForm({
      mode: 'add', studentId: s.id, anchor: s.placement_id,
      tempat: '', alamat: '', telpon: s.telpon ?? '', mulai: '', selesai: '',
    })
  }

  async function savePlace() {
    if (!placeForm) return
    setPlaceSaving(true); setPlaceErr('')
    try {
      const payload = {
        tempat_pkl: placeForm.tempat, alamat_pkl: placeForm.alamat || null,
        telpon: placeForm.telpon || null, tanggal_mulai: placeForm.mulai, tanggal_selesai: placeForm.selesai,
      }
      if (placeForm.mode === 'edit' && placeForm.placementId) {
        await pklApi.updatePlacement(placeForm.placementId, payload)
      } else {
        await pklApi.createPlacement({ ...payload, student_id: placeForm.studentId })
      }
      setPlaceForm(null)
      qc.invalidateQueries({ queryKey: ['pkl-students'] })
      qc.invalidateQueries({ queryKey: ['pkl-weeks'] })
    } catch (e: any) {
      setPlaceErr(e?.response?.data?.message ?? 'Gagal menyimpan.')
    } finally {
      setPlaceSaving(false)
    }
  }

  const inputCls = 'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  // Unduhan mengikuti filter kelas: tanpa filter = seluruh bimbingan.
  async function unduh(kind: 'siswa' | 'rekap', format: 'excel' | 'pdf') {
    const classParam = fKelas || null
    const slug = classParam ? (kelasOptions.find((c) => c.id === classParam)?.label ?? 'kelas').replace(/\s+/g, '_') : 'bimbingan'
    setBusy(`${kind}-${format}`)
    setUnduhErr(null)
    try {
      if (format === 'excel') {
        if (kind === 'siswa') await pklApi.downloadStudents(classParam, `data_pkl_${slug}.xlsx`)
        else await pklApi.downloadRekap(classParam ?? 'semua', `rekap_absen_pkl_${slug}.xlsx`)
      } else {
        const qs = kind === 'siswa'
          ? `${classParam ? `class_id=${classParam}&` : ''}format=pdf`
          : `class_id=${classParam ?? 'semua'}&format=pdf`
        await pdf.openPreview(`/pkl/${kind === 'siswa' ? 'students' : 'rekap-absen'}/export?${qs}`,
          `${kind === 'siswa' ? 'data_pkl' : 'rekap_absen_pkl'}_${slug}.pdf`)
      }
    } catch (e) {
      setUnduhErr((e as Error).message || 'Gagal mengunduh berkas.')
    } finally {
      setBusy(null)
    }
  }

  if (isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground p-4"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Briefcase className="h-5 w-5 text-primary-600" />
        <div>
          <h1 className="text-xl font-bold">PKL — Praktik Kerja Lapangan</h1>
          <p className="text-xs text-muted-foreground">Siswa bimbingan, agenda mingguan, dan rekap absen.</p>
        </div>
      </div>

      {classes.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          Anda belum ditetapkan sebagai pembimbing PKL. Data penempatan PKL diimpor
          atau ditambahkan oleh admin.
        </CardContent></Card>
      ) : (
        // Desktop lebar: agenda mingguan jadi kolom kiri yang lebih ramping, daftar
        // siswa mengisi sisa lebar layar (grid) — tidak menyisakan ruang kosong.
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
          {/* ── Agenda PKL mingguan — daftar prioritas ── */}
          <div className="lg:sticky lg:top-4">
            <h2 className="text-sm font-semibold mb-2">Agenda PKL Mingguan</h2>
            {loadingWeeks ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Memuat minggu…</div>
            ) : allWeeks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada rentang minggu PKL dalam semester ini.</p>
            ) : (
              <div className="space-y-1.5">
                {perluIsi.length === 0 && telat.length === 0 && (
                  <p className="flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Semua agenda PKL sampai minggu ini sudah diisi.</p>
                )}

                {perluIsi.map((w) => <WeekButton key={w.minggu_mulai} w={w} onClick={() => navigate(`/pkl/agenda?minggu=${w.minggu_mulai}`)} />)}

                {telatShown.map((w) => <WeekButton key={w.minggu_mulai} w={w} onClick={() => navigate(`/pkl/agenda?minggu=${w.minggu_mulai}`)} />)}
                {telat.length > telatShown.length && (
                  <button onClick={() => setShowAllTelat(true)} className="w-full rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-accent">
                    Tampilkan semua yang lewat batas ({telat.length})
                  </button>
                )}

                {riwayat.length > 0 && (
                  <button onClick={() => setShowRiwayat((v) => !v)}
                    className="flex w-full items-center gap-1 rounded-lg px-1 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !showRiwayat && '-rotate-90')} />
                    Riwayat terisi ({riwayat.length})
                  </button>
                )}
                {showRiwayat && riwayat.map((w) => <WeekButton key={w.minggu_mulai} w={w} onClick={() => navigate(`/pkl/agenda?minggu=${w.minggu_mulai}`)} />)}
              </div>
            )}
          </div>

          {/* ── Siswa bimbingan — semua langsung tampil + filter ── */}
          <div className="min-w-0">
            <div className="flex flex-col gap-2 mb-2 sm:flex-row sm:items-center">
              <h2 className="text-sm font-semibold shrink-0">Siswa Bimbingan ({filteredStudents.length}{filteredStudents.length !== students.length ? ` dari ${students.length}` : ''})</h2>
              <div className="flex flex-wrap gap-2 sm:ml-auto">
                <select className="min-w-0 flex-1 sm:flex-none rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={fKelas} onChange={(e) => setFKelas(e.target.value)} aria-label="Filter kelas">
                  <option value="">Semua Kelas</option>
                  {kelasOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <select className="min-w-0 flex-1 sm:flex-none sm:max-w-[170px] rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={fIndustri} onChange={(e) => setFIndustri(e.target.value)} aria-label="Filter industri">
                  <option value="">Semua Industri</option>
                  {industriOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {(fKelas || fIndustri) && (
                  <button onClick={() => { setFKelas(''); setFIndustri('') }} aria-label="Reset filter" className="p-1.5 text-muted-foreground hover:text-foreground shrink-0"><X className="h-4 w-4" /></button>
                )}
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
              {filteredStudents.map((s) => (
                <div key={s.placement_id} className="rounded-lg border bg-card px-4 py-2.5 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {s.nama} {s.kelas && <span className="text-xs font-normal text-muted-foreground">· {s.kelas}</span>}
                        {!s.belum_diplot && s.status_efektif !== 'berlangsung' && (
                          <PklStatusBadge status={s.status_efektif} label={s.status_label} className="ml-1.5 align-middle" />
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground break-words">NIS {s.nis ?? '—'} · NISN {s.nisn ?? '—'}</p>
                      {s.belum_diplot ? (
                        <p className="text-xs mt-0.5">
                          <span className="inline-flex items-center rounded bg-amber-100 text-amber-700 px-1.5 py-0.5 font-medium">Belum ada tempat PKL</span>
                        </p>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground break-words">{s.tempat_pkl}</p>
                          {s.alamat_pkl && s.alamat_pkl !== '—' && <p className="text-xs text-muted-foreground break-words">{s.alamat_pkl}</p>}
                          <p className="text-xs text-muted-foreground">
                            {s.mulai} → {s.berakhir_aktual && s.berakhir_aktual !== s.selesai ? `${s.berakhir_aktual} (berhenti)` : s.selesai}
                          </p>
                          {s.alasan_berakhir && <p className="text-xs text-muted-foreground italic break-words">{s.alasan_berakhir}</p>}
                        </>
                      )}
                      {s.telpon && <WhatsAppLink telpon={s.telpon} className="text-xs text-muted-foreground" />}
                      {!s.belum_diplot && (
                        <p className="text-xs mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className={cn('font-medium', s.pct_hadir >= 90 ? 'text-green-600' : s.pct_hadir >= 75 ? 'text-amber-600' : 'text-red-600')}>Hadir {s.pct_hadir}%</span>
                          <span className="text-muted-foreground">H {s.hadir}/{s.hari_kerja} hari kerja</span>
                          {(s.sakit + s.izin + s.alpha) > 0 && <span className="text-muted-foreground">· S{s.sakit} I{s.izin} A{s.alpha}</span>}
                        </p>
                      )}
                    </div>
                    <span className="flex items-center gap-0.5 text-muted-foreground shrink-0">
                      {!s.belum_diplot && (
                        <button onClick={() => setStatusRow(s)} aria-label="Ubah status PKL" title="Tandai selesai / mengundurkan diri / pindah" className="p-1.5 hover:text-foreground"><Flag className="h-3.5 w-3.5" /></button>
                      )}
                      <button onClick={() => openEdit(s)} aria-label="Edit penempatan" className="p-1.5 hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => openAdd(s)} aria-label="Tambah tempat PKL" title="Tambah tempat PKL lain untuk siswa ini" className="p-1.5 hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
                    </span>
                  </div>

                  {placeForm && (placeForm.mode === 'edit' ? placeForm.placementId === s.placement_id : placeForm.studentId === s.id && placeForm.anchor === s.placement_id) && (
                    <div className="mt-2 rounded-md border bg-muted/30 p-3 space-y-2">
                      <p className="text-xs font-medium">{placeForm.mode === 'edit' ? 'Edit penempatan' : `Tambah tempat PKL baru untuk ${s.nama}`}</p>
                      <input className={inputCls} placeholder="Nama perusahaan / tempat PKL" value={placeForm.tempat} onChange={(e) => setPlaceForm({ ...placeForm, tempat: e.target.value })} />
                      <input className={inputCls} placeholder="Alamat (opsional)" value={placeForm.alamat} onChange={(e) => setPlaceForm({ ...placeForm, alamat: e.target.value })} />
                      <input className={inputCls} placeholder="No. HP siswa (08…)" value={placeForm.telpon} onChange={(e) => setPlaceForm({ ...placeForm, telpon: e.target.value })} />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" className={inputCls} value={placeForm.mulai} onChange={(e) => setPlaceForm({ ...placeForm, mulai: e.target.value })} />
                        <input type="date" className={inputCls} value={placeForm.selesai} onChange={(e) => setPlaceForm({ ...placeForm, selesai: e.target.value })} />
                      </div>
                      {placeErr && <p className="text-xs text-red-600">{placeErr}</p>}
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => { setPlaceForm(null); setPlaceErr('') }}>Batal</Button>
                        <Button size="sm" disabled={!placeForm.tempat.trim() || !placeForm.mulai || !placeForm.selesai || placeSaving} onClick={savePlace}>
                          {placeSaving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Simpan
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {filteredStudents.length === 0 && (
                <div className="md:col-span-2 2xl:col-span-3 rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">
                  {students.length === 0 ? 'Belum ada siswa bimbingan.' : 'Tidak ada siswa yang cocok dengan filter.'}
                </div>
              )}
            </div>

            {/* ── Unduhan (mengikuti filter kelas; tanpa filter = semua bimbingan) ── */}
            <Card className="mt-4"><CardContent className="p-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                Unduh {fKelas ? `kelas ${kelasOptions.find((c) => c.id === fKelas)?.label ?? ''}` : 'seluruh siswa bimbingan'}:
              </p>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => unduh('siswa', 'excel')}>
                  <Download className="h-4 w-4 mr-1 shrink-0" /> Data Siswa (Excel)
                </Button>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => unduh('siswa', 'pdf')}>
                  <FileText className="h-4 w-4 mr-1 shrink-0" /> Data Siswa (PDF)
                </Button>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => unduh('rekap', 'excel')}>
                  <Download className="h-4 w-4 mr-1 shrink-0" /> Rekap Absen (Excel)
                </Button>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => unduh('rekap', 'pdf')}>
                  <FileText className="h-4 w-4 mr-1 shrink-0" /> Rekap Absen (PDF)
                </Button>
              </div>
              {unduhErr && <p className="text-sm text-red-600">{unduhErr}</p>}
            </CardContent></Card>
          </div>
        </div>
      )}

      <PklStatusDialog
        open={statusRow !== null}
        target={statusRow ? {
          id: statusRow.placement_id, nama: statusRow.nama, mulai: statusRow.mulai, selesai: statusRow.selesai,
          status: statusRow.status, berakhir_aktual: statusRow.berakhir_aktual, alasan_berakhir: statusRow.alasan_berakhir,
        } : null}
        onClose={() => setStatusRow(null)}
        onSubmit={async (payload) => {
          if (!statusRow) return
          await pklApi.changeStatus(statusRow.placement_id, payload)
          qc.invalidateQueries({ queryKey: ['pkl-students'] })
          qc.invalidateQueries({ queryKey: ['pkl-weeks'] })
        }}
      />

      {pdf.modal}
    </div>
  )
}

/**
 * Satu baris minggu agenda (AGREGAT semua kelas). Menampilkan rentang tanggal, badge
 * status, daftar kelas + jumlah siswa. Satu tombol menampung semua kelas bimbingan.
 */
function WeekButton({ w, onClick }: { w: PklWeek; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn('w-full flex items-start justify-between gap-2 rounded-lg border px-3 sm:px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent',
        !w.terisi && w.lewat_batas ? 'border-red-200 bg-red-50/40'
          : !w.terisi ? 'border-orange-200 bg-orange-50/40'
          : 'border-border')}>
      <span className="flex items-start gap-2 min-w-0">
        {w.terisi
          ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
          : <Circle className={cn('h-4 w-4 shrink-0 mt-0.5', w.lewat_batas ? 'text-red-500' : 'text-orange-500')} />}
        <span className="min-w-0">
          <span className="block font-medium">{w.label}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1">
            <Users className="h-3 w-3 text-muted-foreground" />
            {w.classes.map((c) => (
              <span key={c.label} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {c.label} <span className="font-semibold text-foreground">{c.jumlah_siswa}</span>
              </span>
            ))}
          </span>
        </span>
      </span>
      <span className="flex items-center gap-2 shrink-0">
        {w.terisi
          ? <Badge variant="secondary" className="text-emerald-700">Terisi</Badge>
          : w.lewat_batas
            ? <Badge variant="destructive">Lewat batas</Badge>
            : <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Isi sekarang</Badge>}
        <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
      </span>
    </button>
  )
}
