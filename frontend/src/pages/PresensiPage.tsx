import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, ClipboardList, Clock } from 'lucide-react'
import { agendaApi } from '@/features/agenda/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

function formatTanggal(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export default function PresensiPage() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['agendas'],
    queryFn: () => agendaApi.getAgendas(),
  })

  const agendas = data?.data.data ?? []

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Presensi</h1>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && agendas.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <ClipboardList className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Belum ada agenda</p>
          <p className="text-xs text-muted-foreground mt-1">
            Isi agenda terlebih dahulu untuk mengisi presensi.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/agenda/baru')}>
            Isi Agenda
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {agendas.map((agenda) => (
          <Card key={agenda.id}
            className="cursor-pointer hover:border-primary-200 transition-colors"
            onClick={() => navigate(`/presensi/${agenda.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold truncate">
                      {agenda.schedule?.subject.nama ?? '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{agenda.schedule?.class.label}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTanggal(agenda.tanggal)}
                    </span>
                  </div>
                  {agenda.learning_objectives.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {agenda.learning_objectives.length} TP
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <Badge variant="secondary" className="text-xs">
                    <ClipboardCheck className="h-3 w-3 mr-1" />
                    Isi Presensi
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
