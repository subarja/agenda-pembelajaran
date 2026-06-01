import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, Clock, CheckCircle2, FileEdit } from 'lucide-react'
import { agendaApi } from '@/features/agenda/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const statusBadge = {
  submitted: { label: 'Selesai',  variant: 'hijau'   as const },
  draft:     { label: 'Draft',    variant: 'kuning'  as const },
}

function formatTanggal(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function AgendaPage() {
  const navigate = useNavigate()

  const { data: schedulesRes } = useQuery({
    queryKey: ['schedules-today'],
    queryFn: () => agendaApi.getTodaySchedules(),
  })

  const { data: agendasRes, isLoading } = useQuery({
    queryKey: ['agendas'],
    queryFn: () => agendaApi.getAgendas(),
  })

  const todaySchedules = schedulesRes?.data.data ?? []
  const agendas = agendasRes?.data.data ?? []

  const unfilledToday = todaySchedules.filter((s) => !s.agenda_hari_ini)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Agenda Pembelajaran</h1>
        <Button size="sm" onClick={() => navigate('/agenda/baru')}>
          <Plus className="h-4 w-4" />
          Isi Agenda
        </Button>
      </div>

      {/* Jadwal belum diisi hari ini */}
      {unfilledToday.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Belum diisi hari ini
          </p>
          {unfilledToday.map((s) => (
            <Card key={s.id} className="border-amber-200 bg-amber-50">
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    {s.jam_mulai.slice(0, 5)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.subject.nama}</p>
                    <p className="text-xs text-muted-foreground">{s.class.label}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-amber-400 text-amber-700 hover:bg-amber-100"
                  onClick={() => navigate(`/agenda/baru?schedule=${s.id}`)}
                >
                  Isi Sekarang
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Riwayat agenda */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Riwayat
        </p>

        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && agendas.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Belum ada agenda</p>
            <p className="text-xs text-muted-foreground mt-1">
              Isi agenda pertama Anda hari ini.
            </p>
          </div>
        )}

        {agendas.map((agenda) => {
          const badge = statusBadge[agenda.status]
          return (
            <Card
              key={agenda.id}
              className="cursor-pointer hover:border-primary-200 transition-colors"
              onClick={() => navigate(`/agenda/${agenda.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold truncate">
                        {agenda.schedule?.subject.nama ?? '—'}
                      </p>
                      <Badge variant={badge.variant} className="shrink-0">
                        {badge.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {agenda.schedule?.class.label} · {formatTanggal(agenda.tanggal)}
                    </p>
                    {agenda.learning_objectives.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {agenda.learning_objectives.length} TP dicapai
                      </p>
                    )}
                    {agenda.resume_kbm && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {agenda.resume_kbm}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {agenda.status === 'submitted'
                      ? <CheckCircle2 className="h-5 w-5 text-ews-hijau" />
                      : <FileEdit className="h-5 w-5 text-ews-kuning" />
                    }
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
