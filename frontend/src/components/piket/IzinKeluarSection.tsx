import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DoorOpen, Check, X, LogOut, LogIn, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface IzinRow {
  id: string; nama: string | null; kelas: string | null; foto_url: string | null
  keperluan: string; alasan: string | null; status: string; status_label: string
  berlaku_dari: string | null; berlaku_sampai: string | null
  waktu_keluar: string | null; waktu_masuk: string | null; catatan_piket: string | null
  terlambat_kembali: boolean; terlambat_menit: number
}

export default function IzinKeluarSection() {
  const qc = useQueryClient()
  const { data } = useQuery<{ data: IzinRow[] }>({
    queryKey: ['piket-izin-keluar'],
    queryFn: () => api.get('/piket/izin-keluar').then(r => r.data),
    refetchInterval: 10_000,
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['piket-izin-keluar'] })

  const proses = useMutation({
    mutationFn: (p: { id: string; body: Record<string, unknown> }) => api.post(`/piket/izin-keluar/${p.id}/proses`, p.body).then(r => r.data),
    onSuccess: () => refresh(),
  })

  const rows = data?.data ?? []
  const menunggu = rows.filter(r => r.status === 'diajukan')
  // Terlambat kembali di atas, lalu sisanya.
  const berjalan = rows.filter(r => ['disetujui', 'keluar', 'kembali'].includes(r.status))
    .sort((a, b) => Number(b.terlambat_kembali) - Number(a.terlambat_kembali))
  const jmlTerlambat = berjalan.filter(r => r.terlambat_kembali).length

  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium"><DoorOpen className="h-4 w-4" /> Izin Keluar (QR)</div>

      <div>
        <div className="text-xs text-muted-foreground mb-2">Menunggu persetujuan ({menunggu.length})</div>
        {menunggu.length === 0 && <p className="text-xs text-muted-foreground">Tidak ada pengajuan.</p>}
        <div className="space-y-2">
          {menunggu.map(r => <PengajuanCard key={r.id} row={r} onProses={(body) => proses.mutate({ id: r.id, body })} pending={proses.isPending} />)}
        </div>
      </div>

      {berjalan.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="text-xs text-muted-foreground">Berjalan hari ini</div>
            {jmlTerlambat > 0 && (
              <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {jmlTerlambat} terlambat kembali
              </Badge>
            )}
          </div>
          <div className="rounded-lg border divide-y">
            {berjalan.map(r => (
              <div key={r.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${r.terlambat_kembali ? 'bg-red-50 dark:bg-red-950/30' : ''}`}>
                <span className="flex-1">
                  {r.nama} <span className="text-muted-foreground text-xs">· {r.keperluan}</span>
                  {r.terlambat_kembali && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-medium text-red-600">
                      <AlertTriangle className="h-3 w-3" /> telat {r.terlambat_menit}m (batas {r.berlaku_sampai})
                    </span>
                  )}
                </span>
                <Badge variant={r.terlambat_kembali ? 'destructive' : 'secondary'} className="text-[10px]">{r.status_label}</Badge>
                {r.waktu_keluar && <span className="text-xs text-blue-600 flex items-center gap-0.5"><LogOut className="h-3 w-3" />{r.waktu_keluar}</span>}
                {r.waktu_masuk && <span className="text-xs text-green-600 flex items-center gap-0.5"><LogIn className="h-3 w-3" />{r.waktu_masuk}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </CardContent></Card>
  )
}

function PengajuanCard({ row, onProses, pending }: { row: IzinRow; onProses: (body: Record<string, unknown>) => void; pending: boolean }) {
  const [sampai, setSampai] = useState('')
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center gap-3">
        {row.foto_url
          ? <img src={row.foto_url} alt="" className="h-12 w-12 rounded object-cover border" />
          : <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">👤</div>}
        <div className="flex-1">
          <div className="font-medium text-sm">{row.nama} <span className="text-xs text-muted-foreground">{row.kelas}</span></div>
          <div className="text-xs text-muted-foreground">{row.keperluan}{row.alasan ? ` — ${row.alasan}` : ''}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-muted-foreground flex items-center gap-1">
          Berlaku s.d. <input type="time" className="rounded border px-2 py-1 text-xs" value={sampai} onChange={e => setSampai(e.target.value)} />
        </label>
        <Button size="sm" disabled={pending || !sampai} onClick={() => onProses({ aksi: 'setujui', berlaku_sampai: sampai })}>
          <Check className="h-4 w-4 mr-1" /> Setujui
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => onProses({ aksi: 'tolak' })}>
          <X className="h-4 w-4 mr-1" /> Tolak
        </Button>
      </div>
    </div>
  )
}
