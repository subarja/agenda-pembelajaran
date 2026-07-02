import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Calendar, Clock, Users, CheckCircle2,
  ClipboardCheck, FileText, Star, AlertCircle, Target, Plus, Trash2,
} from 'lucide-react'
import { agendaApi } from '@/features/agenda/api'
import { presensiApi } from '@/features/presensi/api'
import type { StudentScoreInput } from '@/features/agenda/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

function formatTanggal(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

const STATUS_COLORS: Record<string, string> = {
  hadir: 'bg-green-100 text-green-700',
  sakit: 'bg-blue-100 text-blue-700',
  izin:  'bg-yellow-100 text-yellow-700',
  alpha: 'bg-red-100 text-red-700',
}

export default function AgendaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: agendaResp, isLoading: loadAgenda } = useQuery({
    queryKey: ['agenda', id],
    queryFn: () => agendaApi.getAgenda(id!),
    enabled: !!id,
  })

  const agenda = agendaResp?.data.data

  // ── Isi Nilai Aktivitas (GK13): dipindah kesini dari form isi-agenda cepat supaya
  // pengisian agenda tetap fokus TP + kegiatan + presensi. Opsional, kapan saja.
  const [editingNilai, setEditingNilai] = useState(false)
  const [scores, setScores] = useState<StudentScoreInput[]>([])
  const [pickerStudentId, setPickerStudentId] = useState('')
  const [pickerNilai, setPickerNilai] = useState('')
  const [pickerCatatan, setPickerCatatan] = useState('')
  const [showPicker, setShowPicker] = useState(false)

  const { data: studentsRes } = useQuery({
    queryKey: ['students', agenda?.schedule?.class.id],
    queryFn: () => agendaApi.getStudents(agenda!.schedule!.class.id),
    enabled: editingNilai && !!agenda?.schedule?.class.id,
  })
  const students = studentsRes?.data.data ?? []

  const nilaiMutation = useMutation({
    mutationFn: (data: StudentScoreInput[]) => agendaApi.updateAgenda(id!, { student_scores: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda', id] })
      setEditingNilai(false)
    },
  })

  function startEditNilai() {
    setScores((agenda?.student_scores ?? []).map((s) => ({ student_id: s.student_id, nilai: s.nilai, catatan: s.catatan ?? '' })))
    setEditingNilai(true)
  }

  function addScore() {
    if (!pickerStudentId || pickerNilai === '') return
    const nilai = parseInt(pickerNilai, 10)
    if (isNaN(nilai)) return
    setScores((prev) => [
      ...prev.filter((s) => s.student_id !== pickerStudentId),
      { student_id: pickerStudentId, nilai, catatan: pickerCatatan },
    ])
    setPickerStudentId(''); setPickerNilai(''); setPickerCatatan('')
    setShowPicker(false)
  }

  function removeScore(studentId: string) {
    setScores((prev) => prev.filter((s) => s.student_id !== studentId))
  }

  const { data: presensiResp, isLoading: loadPresensi } = useQuery({
    queryKey: ['presensi', id],
    queryFn: () => presensiApi.getPresensi(id!),
    enabled: !!id,
  })

  const presensi = presensiResp?.data.data

  const isLoading = loadAgenda || loadPresensi

  if (isLoading) {
    return (
      <div className="max-w-lg space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-7 w-48 bg-muted rounded animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />)}
      </div>
    )
  }

  if (!agenda) return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Detail Agenda</h1>
      </div>
      <div className="flex flex-col items-center py-16 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Agenda tidak ditemukan atau akses ditolak.</p>
      </div>
    </div>
  )

  const totalHadir = presensi?.records.filter((r) => r.status === 'hadir').length ?? 0
  const totalAlpha = presensi?.records.filter((r) => r.status === 'alpha').length ?? 0
  const totalSakit = presensi?.records.filter((r) => r.status === 'sakit').length ?? 0
  const totalIzin  = presensi?.records.filter((r) => r.status === 'izin').length ?? 0
  const total      = presensi?.total_siswa ?? 0

  return (
    <div className="max-w-lg space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold truncate">
              {agenda.schedule?.subject.nama ?? 'Detail Agenda'}
            </h1>
            <Badge variant={agenda.status === 'submitted' ? 'default' : 'secondary'} className="shrink-0">
              {agenda.status === 'submitted' ? 'Selesai' : 'Draft'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{agenda.schedule?.class.label}</p>
        </div>
      </div>

      {/* Info singkat */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{formatTanggal(agenda.tanggal)}</span>
          </div>
          {agenda.schedule && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{agenda.schedule.jam_mulai} – {agenda.schedule.jam_selesai}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>
              {total > 0
                ? `${totalHadir}/${total} hadir${totalAlpha > 0 ? ` · ${totalAlpha} alpha` : ''}${totalSakit > 0 ? ` · ${totalSakit} sakit` : ''}${totalIzin > 0 ? ` · ${totalIzin} izin` : ''}`
                : 'Presensi belum diisi'}
            </span>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline" size="sm"
              onClick={() => navigate(`/presensi/${id}`)}
            >
              <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
              {presensi?.sudah_diisi ? 'Lihat / Edit Presensi' : 'Isi Presensi'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tujuan Pembelajaran */}
      {agenda.learning_objectives && agenda.learning_objectives.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Tujuan Pembelajaran ({agenda.learning_objectives.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {agenda.learning_objectives.map((tp) => (
              <div key={tp.id} className="flex gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-xs text-muted-foreground">{tp.kode} </span>
                  {tp.deskripsi}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Resume KBM */}
      {agenda.resume_kbm && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Catatan / Resume KBM
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm whitespace-pre-wrap">{agenda.resume_kbm}</p>
          </CardContent>
        </Card>
      )}

      {/* Presensi Siswa */}
      {presensi && presensi.sudah_diisi && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Presensi Siswa
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1.5">
            {presensi.records.map((s) => (
              <div key={s.student_id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <span className="font-medium truncate block">{s.nama}</span>
                  <span className="text-xs text-muted-foreground">{s.nis}</span>
                </div>
                <Badge className={cn('shrink-0 text-xs', STATUS_COLORS[s.status] ?? '')}>
                  {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Nilai Aktivitas — opsional, terpisah dari alur isi-agenda cepat (GK13) */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              Nilai Aktivitas
            </CardTitle>
            {!editingNilai && (
              <Button variant="outline" size="sm" onClick={startEditNilai}>
                {agenda.student_scores.length > 0 ? 'Edit' : 'Isi Nilai Aktivitas'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-1.5">
          {!editingNilai && agenda.student_scores.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada nilai aktivitas untuk sesi ini.</p>
          )}

          {!editingNilai && agenda.student_scores.map((s) => (
            <div key={s.student_id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{s.nama}</span>
                {s.catatan && <span className="text-xs text-muted-foreground ml-2">— {s.catatan}</span>}
              </div>
              <span className={cn(
                'font-bold text-sm shrink-0',
                s.nilai >= 80 ? 'text-green-700' : s.nilai >= 60 ? 'text-yellow-700' : 'text-red-700',
              )}>
                {s.nilai}
              </span>
            </div>
          ))}

          {editingNilai && (
            <div className="space-y-2">
              {scores.map((score) => {
                const student = students.find((s) => s.id === score.student_id)
                    ?? agenda.student_scores.find((s) => s.student_id === score.student_id)
                return (
                  <div key={score.student_id}
                    className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
                  >
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

              {showPicker ? (
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
                          .filter((s) => !scores.find((sc) => sc.student_id === s.id))
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
                      <Button type="button" size="sm" onClick={addScore}
                        disabled={!pickerStudentId || pickerNilai === ''}
                      >
                        Tambahkan
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => {
                        setShowPicker(false)
                        setPickerStudentId(''); setPickerNilai(''); setPickerCatatan('')
                      }}>
                        Batal
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => setShowPicker(true)}>
                  <Plus className="h-3 w-3" /> Tambah Nilai Siswa
                </Button>
              )}

              <div className="flex gap-2 pt-1">
                <Button size="sm" disabled={nilaiMutation.isPending} onClick={() => nilaiMutation.mutate(scores)}>
                  {nilaiMutation.isPending ? 'Menyimpan...' : 'Simpan Nilai'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingNilai(false)}>
                  Batal
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

