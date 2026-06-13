import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Calendar, Clock, Users, CheckCircle2,
  ClipboardCheck, FileText, Star, AlertCircle, Target,
} from 'lucide-react'
import { agendaApi } from '@/features/agenda/api'
import { presensiApi } from '@/features/presensi/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

  const { data: agendaResp, isLoading: loadAgenda } = useQuery({
    queryKey: ['agenda', id],
    queryFn: () => agendaApi.getAgenda(id!),
    enabled: !!id,
  })

  const agenda = agendaResp?.data.data

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

      {/* Nilai Siswa */}
      {agenda.student_scores && agenda.student_scores.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              Nilai Aktivitas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1.5">
            {agenda.student_scores.map((s) => (
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}

