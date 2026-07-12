import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight, ChevronDown, ChevronUp, GraduationCap, Loader2, X,
  Users, CalendarRange, CheckCircle2, AlertTriangle, CopyPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { adminApi, type AdminAcademicYear, type PromotionPreviewClass } from '@/features/admin/api'

/**
 * Wizard "Naik Kelas" + modal "Salin Jadwal" — alat pergantian tahun ajaran.
 * Keduanya dipakai dari Panel Admin (tab Tahun Ajaran & tab Jadwal).
 */

// ── Kerangka modal besar yang responsif (mobile: full-height sheet) ───────────
function BigModal({ title, icon, onClose, children, footer }: {
  title: string
  icon?: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    // z-[60]: harus di ATAS BottomNav mobile (z-50) — kalau sama, footer modal
    // tertutup nav dan tombolnya tidak bisa diklik di HP.
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full sm:max-w-2xl bg-white sm:rounded-xl rounded-t-2xl shadow-2xl flex flex-col max-h-[94dvh] sm:max-h-[88vh]">
        <div className="flex items-center gap-2 border-b px-4 py-3 shrink-0">
          {icon}
          <h3 className="font-semibold text-sm sm:text-base">{title}</h3>
          <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 grow">{children}</div>
        {footer && <div className="border-t px-4 py-3 shrink-0 bg-muted/20">{footer}</div>}
      </div>
    </div>
  )
}

// ── Wizard Naik Kelas ─────────────────────────────────────────────────────────
export function NaikKelasWizard({ years, onClose }: {
  years: AdminAcademicYear[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const aktif = years.find(y => y.aktif)

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [sourceId, setSourceId] = useState(aktif?.id ?? '')
  const [targetId, setTargetId] = useState('')
  // Map class uuid → Set of student uuid yang TINGGAL kelas (sisanya naik/lulus)
  const [tinggal, setTinggal] = useState<Record<string, Set<string>>>({})
  const [openClass, setOpenClass] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<{ message: string; data: Record<string, number> } | null>(null)

  const targetOptions = years.filter(y => y.id !== sourceId)

  const { data: preview, isLoading: previewLoading, error: previewError } = useQuery({
    queryKey: ['promotion-preview', sourceId, targetId],
    queryFn: () => adminApi.getPromotionPreview(sourceId, targetId),
    enabled: step === 2 && !!sourceId && !!targetId,
  })

  const totals = useMemo(() => {
    if (!preview) return { naik: 0, tinggal: 0, lulus: 0 }
    let naik = 0, ting = 0, lulus = 0
    for (const c of preview.classes) {
      const t = tinggal[c.id]?.size ?? 0
      ting += t
      if (c.tingkat === 'XII') lulus += c.jumlah_siswa - t
      else naik += c.jumlah_siswa - t
    }
    return { naik, tinggal: ting, lulus }
  }, [preview, tinggal])

  const exec = useMutation({
    mutationFn: () => adminApi.executePromotion({
      source_academic_year_id: sourceId,
      target_academic_year_id: targetId,
      tinggal: Object.fromEntries(
        Object.entries(tinggal).filter(([, s]) => s.size > 0).map(([k, s]) => [k, Array.from(s)]),
      ),
    }),
    onSuccess: (d) => {
      setResult(d)
      setStep(3)
      // Kelas, siswa, dan EWS berubah — segarkan semuanya
      qc.invalidateQueries({ queryKey: ['admin-classes'] })
      qc.invalidateQueries({ queryKey: ['admin-students'] })
      qc.invalidateQueries({ queryKey: ['admin-academic-years'] })
    },
    onError: (e: any) => alert(e.response?.data?.message ?? 'Gagal menjalankan naik kelas.'),
  })

  function toggleTinggal(classId: string, studentId: string) {
    setTinggal(prev => {
      const next = { ...prev }
      const set = new Set(next[classId] ?? [])
      if (set.has(studentId)) set.delete(studentId); else set.add(studentId)
      next[classId] = set
      return next
    })
  }

  const sourceLabel = years.find(y => y.id === sourceId)
  const targetLabel = years.find(y => y.id === targetId)
  const fmtYear = (y?: AdminAcademicYear) => y ? `${y.tahun} ${y.semester[0].toUpperCase()}${y.semester.slice(1)}` : ''

  return (
    <BigModal
      title="Wizard Naik Kelas"
      icon={<GraduationCap className="h-5 w-5 text-primary" />}
      onClose={onClose}
      footer={
        step === 1 ? (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Batal</Button>
            <Button size="sm" disabled={!sourceId || !targetId} onClick={() => setStep(2)}>
              Lihat Pratinjau<ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        ) : step === 2 ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs text-muted-foreground">
              <strong className="text-green-700">{totals.naik}</strong> naik ·{' '}
              <strong className="text-amber-700">{totals.tinggal}</strong> tinggal ·{' '}
              <strong className="text-blue-700">{totals.lulus}</strong> lulus
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setStep(1); setConfirming(false) }}>Kembali</Button>
              {!confirming ? (
                <Button size="sm" disabled={!preview || preview.classes.length === 0} onClick={() => setConfirming(true)}>
                  Jalankan Naik Kelas
                </Button>
              ) : (
                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={exec.isPending} onClick={() => exec.mutate()}>
                  {exec.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                  Ya, Proses Sekarang
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button size="sm" onClick={onClose}>Selesai</Button>
          </div>
        )
      }
    >
      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs sm:text-sm text-blue-800 space-y-1">
            <p className="font-semibold">Apa yang dilakukan wizard ini?</p>
            <p>Siswa X → XI dan XI → XII dipindahkan ke kelas padanannya (jurusan &amp; rombel sama) di tahun ajaran tujuan — kelasnya dibuat otomatis bila belum ada. Siswa XII ditandai <strong>Lulus</strong> (data tetap tersimpan sebagai arsip, akunnya dinonaktifkan). Siswa yang tinggal kelas bisa Anda tandai satu per satu di langkah pratinjau.</p>
            <p>Data tahun ajaran lama (kelas, jadwal, agenda, presensi, poin, EWS) <strong>tidak disentuh sama sekali</strong>.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold mb-1.5 block">Dari tahun ajaran (sumber)</span>
              <select
                className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background"
                value={sourceId} onChange={e => { setSourceId(e.target.value); setTinggal({}) }}>
                {years.map(y => (
                  <option key={y.id} value={y.id}>{fmtYear(y)}{y.aktif ? ' (aktif)' : ''}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold mb-1.5 block">Ke tahun ajaran (tujuan)</span>
              <select
                className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background"
                value={targetId} onChange={e => { setTargetId(e.target.value); setTinggal({}) }}>
                <option value="">— Pilih tahun ajaran tujuan —</option>
                {targetOptions.map(y => (
                  <option key={y.id} value={y.id}>{fmtYear(y)}{y.aktif ? ' (aktif)' : ''}</option>
                ))}
              </select>
            </label>
          </div>

          {targetOptions.length === 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Belum ada tahun ajaran lain. Buat dulu tahun ajaran baru (tombol <strong>Tambah</strong> di tab ini), lalu jalankan wizard ini.
            </p>
          )}

          <div className="rounded-lg border p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Urutan ganti tahun yang disarankan:</p>
            <ol className="list-decimal ml-4 space-y-0.5">
              <li>Buat tahun ajaran baru (mis. 2026/2027 Ganjil) + isi tanggal semester.</li>
              <li>Jalankan wizard ini (tandai siswa tinggal kelas bila ada).</li>
              <li>Set tahun ajaran baru sebagai <strong>Aktif</strong>.</li>
              <li>Isi jadwal: impor aSc XML / Excel, atau <strong>Salin Jadwal</strong> dari semester lama (tab Jadwal) bila tidak berubah.</li>
              <li>Impor Dapodik siswa kelas X baru.</li>
            </ol>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-2">
          {previewLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />Memuat pratinjau…
            </div>
          )}
          {!!previewError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {(previewError as any)?.response?.data?.message ?? 'Gagal memuat pratinjau.'}
            </p>
          )}
          {preview && (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                <strong>{fmtYear(sourceLabel)}</strong> → <strong>{fmtYear(targetLabel)}</strong>.
                Buka kelas untuk menandai siswa yang <strong>tinggal kelas</strong> (default: semua naik).
              </p>
              {preview.classes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Tidak ada kelas berisi siswa aktif di tahun ajaran sumber — mungkin naik kelas sudah pernah dijalankan.
                </p>
              )}
              {preview.classes.map(c => (
                <KelasPreviewCard key={c.id} c={c}
                  open={openClass === c.id}
                  onToggle={() => setOpenClass(o => o === c.id ? null : c.id)}
                  tinggalSet={tinggal[c.id] ?? new Set()}
                  onToggleStudent={sid => toggleTinggal(c.id, sid)}
                />
              ))}
              {confirming && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs sm:text-sm text-red-700 flex gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Pastikan daftar tinggal kelas sudah benar. Aksi ini memindahkan <strong>{totals.naik + totals.tinggal}</strong> siswa
                    dan meluluskan <strong>{totals.lulus}</strong> siswa XII. Tekan <strong>“Ya, Proses Sekarang”</strong> untuk melanjutkan.
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {step === 3 && result && (
        <div className="space-y-4 py-4 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
          <p className="text-sm font-medium">{result.message}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-md mx-auto text-center">
            {[
              ['Naik', result.data.naik, 'text-green-700 bg-green-50 border-green-200'],
              ['Tinggal', result.data.tinggal, 'text-amber-700 bg-amber-50 border-amber-200'],
              ['Lulus', result.data.lulus, 'text-blue-700 bg-blue-50 border-blue-200'],
              ['Kelas Baru', result.data.kelasBaru, 'text-purple-700 bg-purple-50 border-purple-200'],
            ].map(([label, val, cls]) => (
              <div key={label as string} className={cn('rounded-lg border px-2 py-3', cls as string)}>
                <p className="text-xl font-bold">{val as number}</p>
                <p className="text-[11px]">{label as string}</p>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground text-left max-w-md mx-auto rounded-lg border p-3 space-y-1">
            <p className="font-semibold text-foreground">Langkah selanjutnya:</p>
            <ol className="list-decimal ml-4 space-y-0.5">
              <li>Set <strong>{fmtYear(targetLabel)}</strong> sebagai tahun ajaran Aktif (kolom Status).</li>
              <li>Isi jadwal TA baru: impor aSc XML/Excel, atau Salin Jadwal (tab Jadwal).</li>
              <li>Impor Dapodik untuk siswa kelas X baru.</li>
            </ol>
          </div>
        </div>
      )}
    </BigModal>
  )
}

function KelasPreviewCard({ c, open, onToggle, tinggalSet, onToggleStudent }: {
  c: PromotionPreviewClass
  open: boolean
  onToggle: () => void
  tinggalSet: Set<string>
  onToggleStudent: (id: string) => void
}) {
  const lulus = c.tingkat === 'XII'
  return (
    <div className="rounded-lg border overflow-hidden">
      <button type="button" onClick={onToggle}
        className="w-full flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors">
        <span className="text-sm font-semibold">{c.label}</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded',
          lulus ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700')}>
          {c.tujuan}
        </span>
        {c.tujuan_ada === false && !lulus && (
          <span className="text-[10px] text-purple-700 bg-purple-50 border border-purple-200 rounded px-1">kelas baru</span>
        )}
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />{c.jumlah_siswa}
          {tinggalSet.size > 0 && (
            <span className="text-amber-700 font-semibold">{tinggalSet.size} tinggal</span>
          )}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div className="border-t bg-muted/10 px-3 py-2">
          <p className="text-[11px] text-muted-foreground mb-1.5">
            Centang siswa yang <strong>tinggal kelas</strong> — mereka masuk kelas {c.tingkat} padanannya di TA baru{lulus ? ' (mengulang, tidak lulus)' : ''}.
          </p>
          <div className="grid sm:grid-cols-2 gap-x-4">
            {c.students.map(s => (
              <label key={s.id}
                className="flex items-center gap-2 py-1 text-xs cursor-pointer hover:bg-muted/40 rounded px-1">
                <input type="checkbox" className="rounded border-input"
                  checked={tinggalSet.has(s.id)}
                  onChange={() => onToggleStudent(s.id)} />
                <span className={cn(tinggalSet.has(s.id) && 'text-amber-700 font-semibold')}>
                  {s.nama} <span className="text-muted-foreground">({s.nis})</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal Salin Jadwal ────────────────────────────────────────────────────────
export function SalinJadwalModal({ years, onClose }: {
  years: AdminAcademicYear[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const aktif = years.find(y => y.aktif)
  const sourceOptions = years.filter(y => !y.aktif)
  const [sourceId, setSourceId] = useState('')
  const [result, setResult] = useState<string | null>(null)

  const fmtYear = (y?: AdminAcademicYear) => y ? `${y.tahun} ${y.semester[0].toUpperCase()}${y.semester.slice(1)}` : ''

  const { data: preview, isLoading } = useQuery({
    queryKey: ['schedule-copy-preview', sourceId],
    queryFn: () => adminApi.getScheduleCopyPreview(sourceId),
    enabled: !!sourceId,
  })

  const copy = useMutation({
    mutationFn: () => adminApi.copySchedules(sourceId),
    onSuccess: (d) => {
      setResult(d.message)
      qc.invalidateQueries({ queryKey: ['admin-schedules'] })
    },
    onError: (e: any) => alert(e.response?.data?.message ?? 'Gagal menyalin jadwal.'),
  })

  return (
    <BigModal
      title={`Salin Jadwal ke ${fmtYear(aktif)}`}
      icon={<CopyPlus className="h-5 w-5 text-primary" />}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>{result ? 'Tutup' : 'Batal'}</Button>
          {!result && (
            <Button size="sm" disabled={!preview || preview.jumlah_jadwal === 0 || copy.isPending}
              onClick={() => copy.mutate()}>
              {copy.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CopyPlus className="mr-1 h-4 w-4" />}
              Salin {preview?.jumlah_jadwal ?? 0} Jadwal
            </Button>
          )}
        </div>
      }
    >
      {result ? (
        <div className="py-6 text-center space-y-3">
          <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
          <p className="text-sm">{result}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Untuk pergantian semester yang jadwalnya tidak berubah (mis. ganjil → genap): salin seluruh
            jadwal dari semester lama ke kelas padanannya di tahun ajaran <strong>aktif</strong> —
            guru &amp; mapel tetap. Aman diulang (tidak menduplikat), dan revisi kecil bisa
            dilakukan setelahnya di tab Jadwal.
          </p>

          <label className="block">
            <span className="text-xs font-semibold mb-1.5 block flex items-center gap-1">
              <CalendarRange className="h-3.5 w-3.5" />Salin dari semester
            </span>
            <select className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background"
              value={sourceId} onChange={e => { setSourceId(e.target.value); setResult(null) }}>
              <option value="">— Pilih semester sumber —</option>
              {sourceOptions.map(y => <option key={y.id} value={y.id}>{fmtYear(y)}</option>)}
            </select>
          </label>

          {isLoading && sourceId && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />Memuat pratinjau…
            </div>
          )}
          {preview && (
            <div className="rounded-lg border p-3 text-xs sm:text-sm space-y-1.5">
              <p><strong>{preview.jumlah_jadwal}</strong> jadwal aktif dari <strong>{preview.kelas_cocok}</strong> kelas akan disalin ke {preview.target.label}.</p>
              {preview.tanpa_padanan.length > 0 && (
                <p className="text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                  Tanpa kelas padanan di TA aktif (dilewati): {preview.tanpa_padanan.join(', ')}.
                  Jalankan <strong>Wizard Naik Kelas</strong> atau buat kelasnya dulu bila perlu.
                </p>
              )}
              {preview.jumlah_jadwal === 0 && (
                <p className="text-amber-700">Tidak ada jadwal yang bisa disalin — pastikan kelas TA aktif sudah dibuat (via Wizard Naik Kelas / impor).</p>
              )}
            </div>
          )}
        </div>
      )}
    </BigModal>
  )
}
