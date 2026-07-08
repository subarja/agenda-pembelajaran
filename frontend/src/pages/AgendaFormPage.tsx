import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ChevronLeft } from 'lucide-react'
import { agendaApi } from '@/features/agenda/api'
import { presensiApi } from '@/features/presensi/api'
import type { AgendaFormData } from '@/features/agenda/types'
import type { PresensiSubmitRecord } from '@/features/presensi/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { AgendaPerluDiisiList } from '@/components/agenda/AgendaPerluDiisiList'
import { AgendaHariIniList } from '@/components/agenda/AgendaHariIniList'
import { PresensiToggleList, STATUS_CYCLE } from '@/components/presensi/PresensiToggleList'
import { cn, toLocalDateStr } from '@/lib/utils'

export default function AgendaFormPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const preselected = searchParams.get('schedule') ?? ''
  // Dulu TIDAK DIBACA sama sekali — link dari dashboard "Agenda Perlu Diisi" mengirim
  // ?schedule=...&tanggal=..., tapi form ini cuma pakai `schedule` lalu default tanggal
  // ke HARI INI. Kalau sesi yang dituju bukan hari ini, `selectedSchedule` gagal
  // ke-resolve (tidak match ke `schedules` [hari ini] ATAUPUN `selectedTertunda` yang
  // masih kosong) — makanya muncul "Tidak ada jadwal mengajar hari ini." walau sebenarnya
  // ada, cuma bukan hari ini.
  const preselectedTanggal = searchParams.get('tanggal') ?? ''

  const [form, setForm] = useState<AgendaFormData>({
    schedule_id: preselected,
    tanggal: preselectedTanggal || toLocalDateStr(new Date()),
    resume_kbm: '',
    learning_objective_ids: [],
    status: 'submitted',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { data: schedulesRes } = useQuery({
    queryKey: ['schedules-today'],
    queryFn: () => agendaApi.getTodaySchedules(),
  })
  const schedules = schedulesRes?.data.data ?? []

  // Sesi tertunda dari hari-hari sebelumnya (masih dalam batas waktu admin) — dulu
  // form ini HANYA menampilkan jadwal hari ini, jadi guru yang telat isi kemarin/H-2
  // tidak punya cara memilihnya sama sekali walau backend masih mengizinkan.
  const { data: perluDiisiRes } = useQuery({
    queryKey: ['agendas-perlu-diisi'],
    queryFn: () => agendaApi.getPerluDiisi(),
  })
  const todayStr = toLocalDateStr(new Date())
  const sesiTertunda = (perluDiisiRes?.data.data ?? []).filter((s) => s.tanggal !== todayStr && s.bisa_diisi)

  const [selectedTertunda, setSelectedTertunda] = useState<typeof sesiTertunda[number] | null>(null)

  useEffect(() => {
    if (!form.schedule_id && schedules.length === 1 && !schedules[0].agenda_hari_ini) {
      setForm((f) => ({ ...f, schedule_id: schedules[0].id }))
    }
  }, [schedules, form.schedule_id])

  // Kalau dibuka dari link dashboard (?schedule=...&tanggal=...) yang menunjuk ke sesi
  // BUKAN hari ini, cari objeknya di daftar perlu-diisi supaya `selectedSchedule` bisa
  // ke-resolve dan form-nya benar-benar terbuka (bukan "Tidak ada jadwal mengajar hari
  // ini." padahal sesinya ada, cuma bukan hari ini).
  useEffect(() => {
    if (!preselected || !preselectedTanggal || preselectedTanggal === todayStr) return
    if (selectedTertunda) return
    const match = (perluDiisiRes?.data.data ?? []).find(
      (s) => s.schedule_id === preselected && s.tanggal === preselectedTanggal,
    )
    if (match) pilihTertunda(match)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perluDiisiRes, preselected, preselectedTanggal])

  function pilihTertunda(s: typeof sesiTertunda[number]) {
    setSelectedTertunda(s)
    setForm((f) => ({
      ...f, schedule_id: s.schedule_id, tanggal: s.tanggal,
      learning_objective_ids: [],
    }))
  }

  function pilihHariIni(s: (typeof schedules)[number]) {
    setSelectedTertunda(null)
    setForm((f) => ({
      ...f, schedule_id: s.id, tanggal: todayStr,
      learning_objective_ids: [],
    }))
  }

  function gantiSesi() {
    setSelectedTertunda(null)
    setForm((f) => ({ ...f, schedule_id: '', learning_objective_ids: [] }))
    setError('')
  }

  const scheduleHariIni = schedules.find((s) => s.id === form.schedule_id)
  // Normalisasi 2 sumber data (jadwal hari ini vs sesi tertunda) ke bentuk yang sama
  // supaya bagian form di bawah tidak perlu tahu asalnya dari mana.
  const selectedSchedule = scheduleHariIni
    ? scheduleHariIni
    : (selectedTertunda && selectedTertunda.schedule_id === form.schedule_id)
      ? {
          id: selectedTertunda.schedule_id,
          subject: { id: '', kode: '', nama: selectedTertunda.mapel },
          class: { id: selectedTertunda.class_id, tingkat: '', jurusan: '', rombel: '', label: selectedTertunda.kelas },
          jam_mulai: selectedTertunda.jam_mulai, jam_selesai: selectedTertunda.jam_selesai,
          agenda_hari_ini: null,
        }
      : undefined
  const existingAgendaId = selectedSchedule?.agenda_hari_ini?.id ?? null

  const { data: loRes } = useQuery({
    queryKey: ['learning-objectives', form.schedule_id],
    queryFn: () => agendaApi.getLearningObjectives(form.schedule_id),
    enabled: !!form.schedule_id && !existingAgendaId,
  })
  const learningObjectives = loRes?.data.data ?? []

  const { data: studentsRes } = useQuery({
    queryKey: ['students', selectedSchedule?.class.id],
    queryFn: () => agendaApi.getStudents(selectedSchedule!.class.id),
    enabled: !!selectedSchedule && !existingAgendaId,
  })
  const students = studentsRes?.data.data ?? []

  // ── Presensi (GK13/GK22): diisi LANGSUNG saat isi agenda, bukan langkah terpisah
  // setelahnya — default semua hadir, guru tap yang tidak hadir saja.
  const [presensiRecords, setPresensiRecords] = useState<Record<string, PresensiSubmitRecord>>({})
  useEffect(() => {
    setPresensiRecords((prev) => {
      const next: Record<string, PresensiSubmitRecord> = {}
      students.forEach((s) => {
        next[s.id] = prev[s.id] ?? { student_id: s.id, status: 'hadir', durasi_terlambat: 0, catatan: '' }
      })
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentsRes])

  function cyclePresensi(studentId: string) {
    setPresensiRecords((prev) => {
      const current = prev[studentId]?.status ?? 'hadir'
      const idx = STATUS_CYCLE.indexOf(current)
      const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
      return { ...prev, [studentId]: { ...prev[studentId], student_id: studentId, status: next, durasi_terlambat: 0, catatan: '' } }
    })
  }

  function setAllHadir() {
    const reset: Record<string, PresensiSubmitRecord> = {}
    students.forEach((s) => {
      reset[s.id] = { student_id: s.id, status: 'hadir', durasi_terlambat: 0, catatan: '' }
    })
    setPresensiRecords(reset)
  }

  function toggleLO(id: string) {
    setForm((f) => ({
      ...f,
      learning_objective_ids: f.learning_objective_ids.includes(id)
        ? f.learning_objective_ids.filter((x) => x !== id)
        : [...f.learning_objective_ids, id],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.schedule_id) { setError('Pilih jadwal terlebih dahulu.'); return }
    setSubmitting(true)
    try {
      const res = await agendaApi.createAgenda(form)
      const newAgendaId = res.data.data.id
      if (students.length > 0) {
        await presensiApi.submitPresensi(newAgendaId, Object.values(presensiRecords))
      }
      queryClient.invalidateQueries({ queryKey: ['agendas'] })
      queryClient.invalidateQueries({ queryKey: ['schedules-today'] })
      queryClient.invalidateQueries({ queryKey: ['agendas-perlu-diisi'] })
      navigate('/agenda')
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(message ?? 'Gagal menyimpan agenda.')
    } finally {
      setSubmitting(false)
    }
  }

  const belumPilihSesi = !selectedSchedule

  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Isi Agenda</h1>
      </div>

      {/* ── Pilih sesi (hanya sebelum ada yang terpilih) ───────────────────
          GK13: jangan munculkan agenda hari ini/lalu lain saat sedang fokus mengisi
          satu sesi — list ini disembunyikan begitu satu sesi dipilih. */}
      {belumPilihSesi && (
        <div className="space-y-5">
          {sesiTertunda.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Sesi Tertunda
                <span className="rounded-full bg-orange-100 text-orange-700 text-xs font-medium px-1.5 py-0.5">{sesiTertunda.length}</span>
              </Label>
              <AgendaPerluDiisiList items={sesiTertunda} onSelect={pilihTertunda} scrollCap={false} />
            </div>
          )}

          <div className="space-y-2">
            <Label>Jadwal Hari Ini</Label>
            <AgendaHariIniList
              items={schedules}
              onSelect={pilihHariIni}
              onViewFilled={(s) => navigate(`/agenda/${s.agenda_hari_ini!.id}`)}
              scrollCap={false}
            />
          </div>
        </div>
      )}

      {/* ── Sesi terpilih: ringkas + form fokus ─────────────────────────── */}
      {selectedSchedule && !existingAgendaId && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <button
            type="button" onClick={gantiSesi}
            className="w-full flex items-center justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2.5 text-left"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{selectedSchedule.subject.nama} · {selectedSchedule.class.label}</p>
              <p className="text-xs text-muted-foreground">
                {form.tanggal} · {selectedSchedule.jam_mulai.slice(0, 5)}–{selectedSchedule.jam_selesai.slice(0, 5)}
              </p>
            </div>
            <span className="shrink-0 flex items-center gap-1 text-xs text-primary-700">
              <ChevronLeft className="h-3.5 w-3.5" /> Ganti sesi
            </span>
          </button>

          <div className="space-y-1.5">
            <Label htmlFor="tanggal">Tanggal</Label>
            {/* max=hari ini: agenda tidak boleh diisi untuk tanggal yang belum terjadi. */}
            <Input id="tanggal" type="date" value={form.tanggal} max={toLocalDateStr(new Date())}
              onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))}
            />
          </div>

          {/* ── TP ─────────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label>
              Tujuan Pembelajaran Dicapai
              <span className="text-muted-foreground font-normal ml-1">(opsional)</span>
            </Label>
            {learningObjectives.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada TP untuk jadwal ini.</p>
            ) : (
              <div className="space-y-2">
                {learningObjectives.map((lo) => {
                  const selected = form.learning_objective_ids.includes(lo.id)
                  return (
                    <button key={lo.id} type="button" onClick={() => toggleLO(lo.id)}
                      className={cn(
                        'w-full text-left rounded-lg border p-3 transition-colors',
                        selected ? 'border-primary-600 bg-primary-50' : 'border-border hover:border-primary-200',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className={cn(
                          'mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center',
                          selected ? 'border-primary-600 bg-primary-600' : 'border-muted-foreground',
                        )}>
                          {selected && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">{lo.kode}</p>
                          <p className="text-sm">{lo.deskripsi}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Resume KBM ─────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="resume">
              Catatan Kegiatan
              <span className="text-muted-foreground font-normal ml-1">(opsional)</span>
            </Label>
            <textarea id="resume" rows={3}
              value={form.resume_kbm}
              onChange={(e) => setForm((f) => ({ ...f, resume_kbm: e.target.value }))}
              placeholder="Ringkasan kegiatan belajar mengajar..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* ── Presensi ───────────────────────────────────────────────── */}
          {students.length > 0 && (
            <div className="space-y-2">
              <Label>Presensi Siswa</Label>
              <PresensiToggleList
                students={students.map((s) => ({ student_id: s.id, nama: s.nama, nis: s.nis }))}
                records={presensiRecords}
                onCycle={cyclePresensi}
                onSetAllHadir={setAllHadir}
              />
            </div>
          )}

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-3">
                <p className="text-sm text-red-600">{error}</p>
              </CardContent>
            </Card>
          )}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Menyimpan...' : 'Simpan Agenda'}
          </Button>
        </form>
      )}
    </div>
  )
}
