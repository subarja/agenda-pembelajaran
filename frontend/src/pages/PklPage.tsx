import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Briefcase, Download, FileText, CheckCircle2, Circle, Loader2, ChevronRight, Pencil, Plus } from 'lucide-react'
import { pklApi, type PklStudentRow } from '@/features/pkl/api'
import { usePdfPreview } from '@/hooks/usePdfPreview'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { WhatsAppLink } from '@/components/ui/whatsapp-link'

export default function PklPage() {
  const navigate = useNavigate()
  const pdf = usePdfPreview()
  const [classId, setClassId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [unduhErr, setUnduhErr] = useState<string | null>(null)

  const { data: overviewRes, isLoading } = useQuery({
    queryKey: ['pkl-overview'],
    queryFn: () => pklApi.overview(),
  })
  const classes = overviewRes?.data.data.classes ?? []

  // Auto-pilih bila hanya satu kelas.
  useEffect(() => {
    if (!classId && classes.length > 0) setClassId(classes[0].id)
  }, [classes, classId])

  const selected = classes.find((c) => c.id === classId) ?? null

  const { data: studentsRes } = useQuery({
    queryKey: ['pkl-students', classId],
    queryFn: () => pklApi.myStudents(classId!),
    enabled: !!classId,
  })
  const students = studentsRes?.data.data ?? []

  const { data: weeksRes, isFetching: loadingWeeks } = useQuery({
    queryKey: ['pkl-weeks', classId],
    queryFn: () => pklApi.weeks(classId!),
    enabled: !!classId,
  })
  const weeks = weeksRes?.data.data.weeks ?? []

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

  function openEdit(s: PklStudentRow) {
    setPlaceErr('')
    setPlaceForm({
      mode: 'edit', placementId: s.placement_id, studentId: s.id, anchor: s.placement_id,
      tempat: s.tempat_pkl, alamat: s.alamat_pkl === '—' ? '' : (s.alamat_pkl ?? ''),
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

  async function unduh(kind: 'siswa' | 'rekap', format: 'excel' | 'pdf') {
    if (!selected) return
    const slug = selected.label.replace(/\s+/g, '_')
    setBusy(`${kind}-${format}`)
    setUnduhErr(null)
    try {
      if (format === 'excel') {
        if (kind === 'siswa') await pklApi.downloadStudents(selected.id, `data_pkl_${slug}.xlsx`)
        else await pklApi.downloadRekap(selected.id, `rekap_absen_pkl_${slug}.xlsx`)
      } else {
        const ep = kind === 'siswa' ? 'students' : 'rekap-absen'
        await pdf.openPreview(`/pkl/${ep === 'students' ? 'students' : 'rekap-absen'}/export?class_id=${selected.id}&format=pdf`,
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
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <Briefcase className="h-5 w-5 text-primary-600" />
        <div>
          <h1 className="text-xl font-bold">PKL — Praktik Kerja Lapangan</h1>
          <p className="text-xs text-muted-foreground">Siswa bimbingan, agenda mingguan, dan rekap absen.</p>
        </div>
      </div>

      {classes.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          Anda belum ditetapkan sebagai pembimbing PKL dan tidak punya ploting jadwal di kelas XII
          yang siswanya sudah ditempatkan. Data penempatan PKL diimpor oleh admin.
        </CardContent></Card>
      ) : (
        <>
          {/* Pilih kelas bila lebih dari satu */}
          {classes.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => (
                <button key={c.id} onClick={() => setClassId(c.id)}
                  className={cn('rounded-lg border px-3 py-1.5 text-sm transition-colors',
                    c.id === classId ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-border hover:bg-accent')}>
                  {c.label} <span className="text-muted-foreground">({c.jumlah_siswa}{c.sebagai === 'pengajar' ? ' · pengajar' : ''})</span>
                </button>
              ))}
            </div>
          )}

          {/* Tombol unduh — grid 2 kolom di HP agar rapi, baris fleksibel di desktop */}
          <Card><CardContent className="p-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
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
          </CardContent></Card>
          {unduhErr && <p className="text-sm text-red-600">{unduhErr}</p>}

          {/* Daftar minggu → isi agenda */}
          <div>
            <h2 className="text-sm font-semibold mb-2">Agenda PKL Mingguan</h2>
            {loadingWeeks ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Memuat minggu…</div>
            ) : weeks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada rentang minggu PKL untuk kelas ini.</p>
            ) : (
              <div className="space-y-1.5">
                {weeks.map((w) => (
                  <button key={w.minggu_mulai}
                    disabled={!w.sudah_mulai}
                    onClick={() => navigate(`/pkl/agenda?class_id=${classId}&minggu=${w.minggu_mulai}`)}
                    className={cn('w-full flex items-center justify-between gap-2 rounded-lg border px-3 sm:px-4 py-2.5 text-left text-sm transition-colors',
                      w.sudah_mulai ? 'hover:bg-accent' : 'opacity-50 cursor-not-allowed', 'border-border')}>
                    <span className="flex items-center gap-2 min-w-0">
                      {w.terisi
                        ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <span className="truncate">{w.label}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {w.terisi
                        ? <Badge variant="secondary" className="text-emerald-700">Terisi</Badge>
                        : w.lewat_batas
                          ? <Badge variant="destructive">Lewat batas</Badge>
                          : !w.sudah_mulai
                            ? <Badge variant="outline">Belum mulai</Badge>
                            : <Badge variant="outline">Belum diisi</Badge>}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ringkasan siswa bimbingan — satu baris per TEMPAT PKL (siswa bisa >1 tempat,
              periode berbeda); pembimbing bisa edit & menambah tempat secara manual. */}
          <div>
            <h2 className="text-sm font-semibold mb-2">Siswa Bimbingan {selected ? `— ${selected.label}` : ''} ({students.length})</h2>
            <Card><CardContent className="p-0 divide-y">
              {students.map((s) => (
                <div key={s.placement_id} className="px-4 py-2.5 text-sm">
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">{s.nama}</p>
                      <p className="text-xs text-muted-foreground break-words">NIS {s.nis ?? '—'} · NISN {s.nisn ?? '—'} · {s.tempat_pkl}</p>
                      {s.telpon && <WhatsAppLink telpon={s.telpon} className="text-xs text-muted-foreground" />}
                    </div>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground sm:whitespace-nowrap sm:shrink-0">
                      {s.mulai} → {s.selesai}
                      <button onClick={() => openEdit(s)} aria-label="Edit penempatan" className="p-1.5 -m-0.5 hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => openAdd(s)} aria-label="Tambah tempat PKL" title="Tambah tempat PKL lain untuk siswa ini" className="p-1.5 -m-0.5 hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
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
              {students.length === 0 && <div className="px-4 py-6 text-center text-sm text-muted-foreground">Belum ada siswa bimbingan.</div>}
            </CardContent></Card>
          </div>
        </>
      )}

      {pdf.modal}
    </div>
  )
}
