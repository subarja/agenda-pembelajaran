import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlarmClock, Check, X, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface KesianganRow {
  id: string; nama: string | null; kelas: string | null; foto_url: string | null
  alasan: string | null; waktu_tiba: string | null; terlambat_menit: number
  status: string; status_label: string
}

export default function KesianganSection() {
  const qc = useQueryClient()
  const [msg, setMsg] = useState<{ text: string; warn: boolean } | null>(null)
  const { data } = useQuery<{ data: KesianganRow[] }>({
    queryKey: ['piket-kesiangan'],
    queryFn: () => api.get('/piket/kesiangan').then(r => r.data),
    refetchInterval: 15_000,
  })
  const verif = useMutation({
    mutationFn: (p: { id: string; aksi: 'setujui' | 'tolak' }) => api.post(`/piket/kesiangan/${p.id}/verifikasi`, { aksi: p.aksi }).then(r => r.data),
    onSuccess: (d) => { setMsg({ text: d.message, warn: d.poin_status && d.poin_status !== 'applied' }); qc.invalidateQueries({ queryKey: ['piket-kesiangan'] }) },
  })

  const rows = data?.data ?? []
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium"><AlarmClock className="h-4 w-4" /> Izin Masuk Kesiangan</div>
      {rows.length === 0 && <p className="text-xs text-muted-foreground">Belum ada kesiangan hari ini.</p>}
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.id} className="rounded-md border p-3 space-y-2">
            <div className="flex items-center gap-3">
              {r.foto_url
                ? <img src={r.foto_url} alt="" className="h-12 w-12 rounded object-cover border" />
                : <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">👤</div>}
              <div className="flex-1">
                <div className="font-medium text-sm">{r.nama} <span className="text-xs text-muted-foreground">{r.kelas}</span></div>
                <div className="text-xs text-muted-foreground">Tiba {r.waktu_tiba} · terlambat {r.terlambat_menit} menit{r.alasan ? ` · ${r.alasan}` : ''}</div>
              </div>
              {r.status !== 'diajukan' && <Badge variant="secondary" className="text-[10px]">{r.status_label}</Badge>}
            </div>
            {r.status === 'diajukan' && (
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={verif.isPending} onClick={() => verif.mutate({ id: r.id, aksi: 'setujui' })}><Check className="h-4 w-4 mr-1" /> Setujui</Button>
                <Button size="sm" variant="outline" disabled={verif.isPending} onClick={() => verif.mutate({ id: r.id, aksi: 'tolak' })}><X className="h-4 w-4 mr-1" /> Tolak</Button>
              </div>
            )}
          </div>
        ))}
      </div>
      {msg && (
        <div className={`rounded-md border p-2 text-xs flex items-start gap-1.5 ${msg.warn ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-green-200 bg-green-50 text-green-700'}`}>
          {msg.warn && <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
          <span>{msg.text}</span>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Poin keterlambatan tercatat otomatis (baik disetujui maupun ditolak); persetujuan hanya menandai berizin.</p>
    </CardContent></Card>
  )
}
