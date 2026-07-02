import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react'
import { presensiApi } from '@/features/presensi/api'
import type { PresensiSubmitRecord } from '@/features/presensi/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PresensiToggleList, STATUS_CYCLE } from '@/components/presensi/PresensiToggleList'

export default function PresensiFormPage() {
  const { agendaId } = useParams<{ agendaId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['presensi', agendaId],
    queryFn: () => presensiApi.getPresensi(agendaId!),
    enabled: !!agendaId,
  })

  const presensiData = data?.data.data
  const [records, setRecords]   = useState<Record<string, PresensiSubmitRecord>>({})
  const [saved, setSaved]       = useState(false)
  const [alphaAlerts, setAlphaAlerts] = useState<{ nama: string; streak: number }[]>([])

  // Inisialisasi records dari data API
  useEffect(() => {
    if (!presensiData) return
    const init: Record<string, PresensiSubmitRecord> = {}
    presensiData.records.forEach((r) => {
      init[r.student_id] = {
        student_id: r.student_id,
        status: r.status,
        durasi_terlambat: r.durasi_terlambat,
        catatan: r.catatan ?? '',
      }
    })
    setRecords(init)
    setSaved(presensiData.sudah_diisi)
  }, [presensiData])

  const mutation = useMutation({
    mutationFn: () =>
      presensiApi.submitPresensi(agendaId!, Object.values(records)),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['presensi', agendaId] })
      setSaved(true)
      const alerts = res?.data?.data?.alerts ?? []
      if (alerts.length > 0) setAlphaAlerts(alerts)
    },
  })

  function cycleStatus(studentId: string) {
    setRecords((prev) => {
      const current = prev[studentId]?.status ?? 'hadir'
      const idx = STATUS_CYCLE.indexOf(current)
      const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
      return { ...prev, [studentId]: { ...prev[studentId], student_id: studentId, status: next, durasi_terlambat: 0, catatan: '' } }
    })
    setSaved(false)
  }

  function setAllHadir() {
    if (!presensiData) return
    const reset: Record<string, PresensiSubmitRecord> = {}
    presensiData.records.forEach((r) => {
      reset[r.student_id] = { student_id: r.student_id, status: 'hadir', durasi_terlambat: 0, catatan: '' }
    })
    setRecords(reset)
    setSaved(false)
  }

  if (isLoading) {
    return (
      <div className="space-y-3 max-w-lg">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (!presensiData) return null

  const totalHadir  = Object.values(records).filter((r) => r.status === 'hadir').length
  const totalAlpha  = Object.values(records).filter((r) => r.status === 'alpha').length
  const totalSakit  = Object.values(records).filter((r) => r.status === 'sakit').length
  const totalIzin   = Object.values(records).filter((r) => r.status === 'izin').length
  const total       = presensiData.total_siswa

  return (
    <div className="max-w-lg space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold leading-tight">Presensi</h1>
          <p className="text-xs text-muted-foreground">
            {presensiData.agenda.subject} · {presensiData.agenda.class}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(presensiData.agenda.tanggal).toLocaleDateString('id-ID', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Alert alpha berturut-turut */}
      {alphaAlerts.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Peringatan Alpha Berturut-turut</p>
              <p className="text-xs text-red-600 mb-2">Siswa berikut perlu tindak lanjut segera dari wali kelas:</p>
              <ul className="space-y-1">
                {alphaAlerts.map((a) => (
                  <li key={a.nama} className="text-xs text-red-700">
                    • <strong>{a.nama}</strong> — alpha <strong>{a.streak} sesi</strong> berturut-turut
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <PresensiToggleList
        students={presensiData.records}
        records={records}
        onCycle={cycleStatus}
        onSetAllHadir={setAllHadir}
      />

      {/* Simpan */}
      {saved ? (
        <div className="flex items-center gap-2 justify-center py-3 rounded-lg bg-green-50 border border-green-200">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <p className="text-sm font-medium text-green-700">Presensi sudah tersimpan</p>
        </div>
      ) : (
        <Button
          className="w-full"
          disabled={mutation.isPending || Object.keys(records).length === 0}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending
            ? 'Menyimpan...'
            : `Simpan Presensi (${total} Siswa)`}
        </Button>
      )}

      {mutation.isSuccess && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-700">
              Presensi berhasil: {totalHadir} hadir, {totalAlpha} alpha, {totalSakit} sakit, {totalIzin} izin
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
