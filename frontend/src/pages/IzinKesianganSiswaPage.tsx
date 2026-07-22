import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlarmClock, Loader2, Clock } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface IzinKesiangan {
  id: string; tanggal: string; alasan: string | null; status: string; status_label: string
  waktu_tiba: string | null; terlambat_menit: number
}

const inputCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const statusTone: Record<string, string> = {
  diajukan: 'bg-amber-100 text-amber-700', disetujui: 'bg-green-100 text-green-700', ditolak: 'bg-red-100 text-red-700',
}

export default function IzinKesianganSiswaPage() {
  const qc = useQueryClient()
  const [alasan, setAlasan] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ data: IzinKesiangan | null }>({
    queryKey: ['izin-kesiangan-hari-ini'],
    queryFn: () => api.get('/izin-kesiangan/hari-ini').then(r => r.data),
    refetchInterval: 20_000,
  })

  const ajukan = useMutation({
    mutationFn: () => api.post('/izin-kesiangan', { alasan: alasan || null }).then(r => r.data),
    onSuccess: (d) => { setMsg(d.message); setAlasan(''); qc.invalidateQueries({ queryKey: ['izin-kesiangan-hari-ini'] }) },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal mengajukan.'),
  })

  const izin = data?.data ?? null

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <AlarmClock className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-semibold">Izin Masuk Kesiangan</h1>
      </div>

      {isLoading ? <div className="h-32 rounded-lg bg-muted animate-pulse" /> : izin ? (
        <Card><CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={statusTone[izin.status] ?? ''}>{izin.status_label}</Badge>
            <span className="text-sm flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Tiba {izin.waktu_tiba} · terlambat {izin.terlambat_menit} menit</span>
          </div>
          {izin.alasan && <p className="text-sm text-muted-foreground">Alasan: {izin.alasan}</p>}
          <p className="text-xs text-muted-foreground">
            Tunjukkan diri ke guru piket untuk verifikasi. Poin keterlambatan tercatat otomatis sesuai lama keterlambatan.
          </p>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">Ajukan Izin Kesiangan</h3>
          <p className="text-xs text-muted-foreground">
            Waktu kedatangan dicatat otomatis saat Anda mengirim. Keterlambatan dihitung dari jam masuk sekolah.
          </p>
          <div>
            <label className="text-xs text-muted-foreground">Alasan (opsional)</label>
            <textarea className={inputCls} rows={2} value={alasan} onChange={e => setAlasan(e.target.value)} placeholder="mis. ban bocor" />
          </div>
          <Button size="sm" onClick={() => { setMsg(null); ajukan.mutate() }} disabled={ajukan.isPending}>
            {ajukan.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Ajukan Sekarang
          </Button>
        </CardContent></Card>
      )}
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  )
}
