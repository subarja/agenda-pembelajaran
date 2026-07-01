import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Plus, Trash2, UserCheck } from 'lucide-react'
import { agendaApi } from '@/features/agenda/api'
import type { AgendaFormData, StudentScoreInput } from '@/features/agenda/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { cn, toLocalDateStr } from '@/lib/utils'

export default function AgendaFormPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const preselected = searchParams.get('schedule') ?? ''

  const [form, setForm] = useState<AgendaFormData>({
    schedule_id: preselected,
    tanggal: toLocalDateStr(new Date()),
    resume_kbm: '',
    learning_objective_ids: [],
    status: 'submitted',
    student_scores: [],
  })
  const [error, setError] = useState('')
  const [showStudentPicker, setShowStudentPicker] = useState(false)
  const [pickerStudentId, setPickerStudentId] = useState('')
  const [pickerNilai, setPickerNilai] = useState('')
  const [pickerCatatan, setPickerCatatan] = useState('')

  const { data: schedulesRes } = useQuery({
    queryKey: ['schedules-today'],
    queryFn: () => agendaApi.getTodaySchedules(),
  })
  const schedules = schedulesRes?.data.data ?? []

  useEffect(() => {
    if (!form.schedule_id && schedules.length === 1 && !schedules[0].agenda_hari_ini) {
      setForm((f) => ({ ...f, schedule_id: schedules[0].id }))
    }
  }, [schedules, form.schedule_id])

  const selectedSchedule = schedules.find((s) => s.id === form.schedule_id)
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

  const mutation = useMutation({
    mutationFn: (data: AgendaFormData) => agendaApi.createAgenda(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendas'] })
      queryClient.invalidateQueries({ queryKey: ['schedules-today'] })
      navigate('/agenda')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setError(err.response?.data?.message ?? 'Gagal menyimpan agenda.')
    },
  })

  function toggleLO(id: string) {
    setForm((f) => ({
      ...f,
      learning_objective_ids: f.learning_objective_ids.includes(id)
        ? f.learning_objective_ids.filter((x) => x !== id)
        : [...f.learning_objective_ids, id],
    }))
  }

  function addStudentScore() {
    if (!pickerStudentId || pickerNilai === '') return
    const nilai = parseInt(pickerNilai, 10)
    if (isNaN(nilai)) return
    setForm((f) => {
      const updated: StudentScoreInput[] = f.student_scores.filter(
        (s) => s.student_id !== pickerStudentId,
      )
      updated.push({ student_id: pickerStudentId, nilai, catatan: pickerCatatan })
      return { ...f, student_scores: updated }
    })
    setPickerStudentId(''); setPickerNilai(''); setPickerCatatan('')
    setShowStudentPicker(false)
  }

  function removeScore(studentId: string) {
    setForm((f) => ({ ...f, student_scores: f.student_scores.filter((s) => s.student_id !== studentId) }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.schedule_id) { setError('Pilih jadwal terlebih dahulu.'); return }
    mutation.mutate(form)
  }

  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Isi Agenda</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Pilih Jadwal ─────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label>Jadwal Hari Ini</Label>
          {schedules.length === 0 && (
            <p className="text-sm text-muted-foreground">Tidak ada jadwal mengajar hari ini.</p>
          )}
          {schedules.map((s) => {
            const sudahDiisi = !!s.agenda_hari_ini
            return (
              <button
                key={s.id} type="button"
                disabled={sudahDiisi && form.schedule_id !== s.id}
                onClick={() => !sudahDiisi && setForm((f) => ({
                  ...f, schedule_id: s.id, learning_objective_ids: [], student_scores: [],
                }))}
                className={cn(
                  'w-full text-left rounded-lg border p-3 transition-colors',
                  form.schedule_id === s.id && !sudahDiisi
                    ? 'border-primary-600 bg-primary-50'
                    : sudahDiisi
                      ? 'border-border bg-muted opacity-70'
                      : 'border-border hover:border-primary-200',
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{s.subject.nama}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.class.label} · {s.jam_mulai.slice(0, 5)}–{s.jam_selesai.slice(0, 5)}
                    </p>
                  </div>
                  {sudahDiisi ? (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Sudah diisi</p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); navigate(`/agenda/${s.agenda_hari_ini!.id}`) }}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        Lihat / Edit →
                      </button>
                    </div>
                  ) : form.schedule_id === s.id ? (
                    <Check className="h-4 w-4 text-primary-600 shrink-0" />
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>

        {/* ── Konten form (hanya jika jadwal dipilih dan belum diisi) ────── */}
        {selectedSchedule && !existingAgendaId && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="tanggal">Tanggal</Label>
              <Input id="tanggal" type="date" value={form.tanggal}
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
                Resume KBM
                <span className="text-muted-foreground font-normal ml-1">(opsional)</span>
              </Label>
              <textarea id="resume" rows={3}
                value={form.resume_kbm}
                onChange={(e) => setForm((f) => ({ ...f, resume_kbm: e.target.value }))}
                placeholder="Ringkasan kegiatan belajar mengajar..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>

            {/* ── Nilai Siswa ────────────────────────────────────────────── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Nilai Siswa
                  <span className="text-muted-foreground font-normal ml-1">(boleh + atau −)</span>
                </Label>
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setShowStudentPicker(true)}
                  disabled={showStudentPicker}
                >
                  <Plus className="h-3 w-3" /> Tambah
                </Button>
              </div>

              {form.student_scores.map((score) => {
                const student = students.find((s) => s.id === score.student_id)
                return (
                  <div key={score.student_id}
                    className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
                  >
                    <UserCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{student?.nama ?? '—'}</p>
                      {score.catatan && (
                        <p className="text-xs text-muted-foreground truncate">{score.catatan}</p>
                      )}
                    </div>
                    <span className={cn(
                      'text-sm font-bold shrink-0 tabular-nums',
                      score.nilai >= 0 ? 'text-green-600' : 'text-red-600',
                    )}>
                      {score.nilai >= 0 ? '+' : ''}{score.nilai}
                    </span>
                    <button type="button" onClick={() => removeScore(score.student_id)}
                      className="text-muted-foreground hover:text-red-500 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}

              {showStudentPicker && (
                <Card className="border-primary-200">
                  <CardContent className="p-4 space-y-3">
                    <div className="space-y-1.5">
                      <Label>Pilih Siswa</Label>
                      <select value={pickerStudentId}
                        onChange={(e) => setPickerStudentId(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">— Pilih siswa —</option>
                        {students
                          .filter((s) => !form.student_scores.find((sc) => sc.student_id === s.id))
                          .map((s) => (
                            <option key={s.id} value={s.id}>{s.nama} ({s.nis})</option>
                          ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Nilai <span className="text-muted-foreground font-normal">(contoh: 85 atau -20)</span></Label>
                      <Input type="number" placeholder="mis: 85 atau -20"
                        value={pickerNilai} onChange={(e) => setPickerNilai(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Keterangan <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                      <Input placeholder="mis: Aktif berdiskusi / Tidak mengerjakan tugas"
                        value={pickerCatatan} onChange={(e) => setPickerCatatan(e.target.value)}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={addStudentScore}
                        disabled={!pickerStudentId || pickerNilai === ''}
                      >
                        Tambahkan
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => {
                        setShowStudentPicker(false)
                        setPickerStudentId(''); setPickerNilai(''); setPickerCatatan('')
                      }}>
                        Batal
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-3">
              <p className="text-sm text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}

        {selectedSchedule && !existingAgendaId && (
          <Button type="submit" disabled={mutation.isPending} className="w-full">
            {mutation.isPending ? 'Menyimpan...' : 'Simpan Agenda'}
          </Button>
        )}
      </form>
    </div>
  )
}
