import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, ClipboardList, Clock, Info, X } from 'lucide-react'
import { agendaApi } from '@/features/agenda/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

function formatTanggal(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export default function PresensiPage() {
  const navigate = useNavigate()

  // GK22: filter riwayat presensi (rentang tanggal + kelas)
  const [kelas, setKelas] = useState('')
  const [tanggalDari, setTanggalDari] = useState('')
  const [tanggalSampai, setTanggalSampai] = useState('')
  const hasFilter = kelas !== '' || tanggalDari !== '' || tanggalSampai !== ''

  const { data: classesRes } = useQuery({
    queryKey: ['agenda-my-classes'],
    queryFn: () => agendaApi.getMyClasses(),
  })
  const myClasses = classesRes?.data.data ?? []

  const { data, isLoading } = useQuery({
    queryKey: ['agendas', 'presensi', kelas, tanggalDari, tanggalSampai],
    queryFn: () => agendaApi.getAgendas({
      kelas: kelas || undefined,
      tanggal_dari: tanggalDari || undefined,
      tanggal_sampai: tanggalSampai || undefined,
    }),
  })

  const agendas = data?.data.data ?? []

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Presensi</h1>

      {/* GK22: presensi otomatis terisi saat isi agenda — halaman ini utk lihat/edit */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 flex items-start gap-1.5">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>Presensi siswa terisi otomatis saat Anda mengisi Agenda. Halaman ini untuk melihat &amp; mengedit presensi yang sudah ada.</span>
      </div>

      {/* Filter kelas + rentang tanggal */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Kelas</Label>
          <select
            value={kelas}
            onChange={(e) => setKelas(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Semua Kelas —</option>
            {myClasses.map((c) => (
              <option key={c.id} value={c.label}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Dari Tanggal</Label>
          <input type="date" value={tanggalDari} onChange={(e) => setTanggalDari(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">s.d. Tanggal</Label>
          <input type="date" value={tanggalSampai} min={tanggalDari || undefined} onChange={(e) => setTanggalSampai(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>
      {hasFilter && (
        <button
          onClick={() => { setKelas(''); setTanggalDari(''); setTanggalSampai('') }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground -mt-3"
        >
          <X className="h-3.5 w-3.5" /> Reset semua filter
        </button>
      )}

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
          <p className="text-sm font-medium">
            {hasFilter ? 'Tidak ada agenda yang cocok dengan filter.' : 'Belum ada agenda'}
          </p>
          {!hasFilter && (
            <>
              <p className="text-xs text-muted-foreground mt-1">
                Isi agenda terlebih dahulu untuk mengisi presensi.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/agenda/baru')}>
                Isi Agenda
              </Button>
            </>
          )}
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
