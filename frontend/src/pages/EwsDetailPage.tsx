import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, AlertTriangle, CheckCircle2, ClipboardList } from 'lucide-react'
import { ewsApi } from '@/features/ews/api'
import type { EwsLevel } from '@/features/ews/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

const LEVEL_BADGE: Record<EwsLevel, 'hijau' | 'kuning' | 'oranye' | 'merah'> = {
  hijau: 'hijau', kuning: 'kuning', oranye: 'oranye', merah: 'merah',
}
const LEVEL_LABEL: Record<EwsLevel, string> = {
  hijau: 'Normal', kuning: 'Perhatian', oranye: 'Waspada', merah: 'Kritis',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Belum Ditangani', proses: 'Sedang Diproses', selesai: 'Selesai', diabaikan: 'Diabaikan',
}
const STATUS_COLOR: Record<string, string> = {
  pending:   'bg-red-100 text-red-700',
  proses:    'bg-yellow-100 text-yellow-700',
  selesai:   'bg-green-100 text-green-700',
  diabaikan: 'bg-gray-100 text-gray-600',
}

export default function EwsDetailPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['ews-detail', studentId],
    queryFn: () => ewsApi.getEwsDetail(studentId!),
    enabled: !!studentId,
  })

  const updateRek = useMutation({
    mutationFn: ({ rekId, status }: { rekId: string; status: string }) =>
      api.put(`/students/${studentId}/rekap/rekomendasi/${rekId}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ews-detail', studentId] }),
  })

  const d = data?.data.data

  if (isLoading) {
    return (
      <div className="max-w-lg space-y-4">
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="h-28 bg-muted rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!d) return null

  const dim = d.dimensions
  const rekomendasi: any[] = (d as any).rekomendasi ?? []
  const rekPending = rekomendasi.filter(r => r.status === 'pending' || r.status === 'proses')

  return (
    <div className="max-w-lg space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Detail EWS</h1>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => navigate(`/siswa/${studentId}/rekap`)}
        >
          Rekap Lengkap
        </Button>
      </div>

      {/* Student card */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
            {d.student.nama.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{d.student.nama}</p>
            <p className="text-sm text-muted-foreground">{d.student.nis}{d.student.kelas && ` · ${d.student.kelas}`}</p>
          </div>
          <Badge variant={LEVEL_BADGE[d.level]}>{LEVEL_LABEL[d.level]}</Badge>
        </CardContent>
      </Card>

      {/* 4 Dimensi */}
      <div className="grid grid-cols-2 gap-3">
        <DimensionCard
          title="Kehadiran"
          score={`${dim.kehadiran.score.toFixed(1)}%`}
          warn={!!dim.kehadiran.warning}
          threshold="min. 80%"
          detail={
            dim.kehadiran.total > 0 ? (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                <span className="text-xs text-green-600">H: {dim.kehadiran.hadir}</span>
                <span className="text-xs text-blue-600">S: {dim.kehadiran.sakit}</span>
                <span className="text-xs text-yellow-600">I: {dim.kehadiran.izin}</span>
                <span className="text-xs text-red-600">A: {dim.kehadiran.alpha}</span>
              </div>
            ) : <p className="text-xs text-muted-foreground mt-1">Belum ada data</p>
          }
        />

        <DimensionCard
          title="Poin Karakter"
          score={`${dim.karakter.score >= 0 ? '+' : ''}${dim.karakter.score}`}
          warn={!!dim.karakter.warning}
          threshold="min. 0 poin"
          detail={<p className="text-xs text-muted-foreground mt-1">{dim.karakter.count} input penilaian</p>}
        />

        <DimensionCard
          title="Catatan KBM"
          score={`${dim.catatan.count}x`}
          warn={!!dim.catatan.warning}
          threshold="maks. 2 catatan"
          detail={
            <p className="text-xs text-muted-foreground mt-1">
              {dim.catatan.count === 0 ? 'Tidak ada catatan' : `${dim.catatan.count} catatan tercatat`}
            </p>
          }
        />

        <DimensionCard
          title="Rata-rata Nilai"
          score={dim.nilai.score !== null ? `${dim.nilai.score.toFixed(1)}` : '—'}
          warn={!!dim.nilai.warning}
          threshold="min. 70"
          detail={
            <p className="text-xs text-muted-foreground mt-1">
              {dim.nilai.count > 0 ? `${dim.nilai.count} sesi dinilai` : 'Belum ada nilai'}
            </p>
          }
        />
      </div>

      {/* Rekomendasi Tindakan */}
      <Card className={rekPending.length > 0 ? 'border-orange-200' : ''}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Rekomendasi Tindakan
            {rekPending.length > 0 && (
              <Badge className="bg-red-100 text-red-700">{rekPending.length} perlu ditangani</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {rekomendasi.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              Tidak ada rekomendasi aktif. Siswa dalam kondisi aman.
            </p>
          ) : (
            rekomendasi.map((r: any) => (
              <div key={r.id} className={cn(
                'rounded-lg border p-3',
                r.status === 'pending' ? 'border-red-200 bg-red-50/50' :
                r.status === 'proses'  ? 'border-yellow-200 bg-yellow-50/50' :
                'border-border bg-muted/30'
              )}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium leading-snug flex-1">{r.rekomendasi}</p>
                  <Badge className={cn('shrink-0 text-xs', STATUS_COLOR[r.status])}>
                    {STATUS_LABEL[r.status]}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mb-2">
                  <span>Akumulasi poin: <strong>{r.akumulasi}</strong></span>
                  {r.ditugaskan_ke && <span>Ditugaskan ke: {r.ditugaskan_ke}</span>}
                  <span>{r.dibuat_pada}</span>
                </div>
                {/* Update status */}
                {r.status !== 'selesai' && r.status !== 'diabaikan' && (
                  <div className="flex gap-2 mt-2">
                    {r.status === 'pending' && (
                      <button
                        onClick={() => updateRek.mutate({ rekId: r.id, status: 'proses' })}
                        className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-700 hover:bg-yellow-100"
                      >
                        Tandai Diproses
                      </button>
                    )}
                    <button
                      onClick={() => updateRek.mutate({ rekId: r.id, status: 'selesai' })}
                      className="rounded-md border border-green-300 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                    >
                      Selesai
                    </button>
                    <button
                      onClick={() => updateRek.mutate({ rekId: r.id, status: 'diabaikan' })}
                      className="rounded-md border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                    >
                      Abaikan
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Riwayat karakter terbaru */}
      {d.recent_karakter.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Riwayat Karakter Terbaru</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {d.recent_karakter.map((k, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={cn(
                  'shrink-0 text-xs font-bold tabular-nums w-10 text-right',
                  k.poin >= 0 ? 'text-green-600' : 'text-red-600',
                )}>
                  {k.poin >= 0 ? '+' : ''}{k.poin}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate">{k.subitem}</p>
                  <p className="text-xs text-muted-foreground">{k.guru} · {k.tanggal}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function DimensionCard({ title, score, warn, threshold, detail }: {
  title: string; score: string; warn: boolean; threshold: string; detail: React.ReactNode
}) {
  return (
    <Card className={cn('border', warn ? 'border-red-200 bg-red-50/40' : 'border-border')}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-xs font-medium text-muted-foreground leading-tight">{title}</p>
          {warn
            ? <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
            : <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
          }
        </div>
        <p className={cn('text-2xl font-bold', warn ? 'text-red-600' : 'text-foreground')}>{score}</p>
        <p className="text-xs text-muted-foreground">{threshold}</p>
        {detail}
      </CardContent>
    </Card>
  )
}
