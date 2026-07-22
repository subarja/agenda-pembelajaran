import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { DoorOpen, Loader2, Clock, CheckCircle2, XCircle } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface IzinKeluar {
  id: string; tanggal: string; keperluan: string; alasan: string | null
  status: string; status_label: string
  berlaku_dari: string | null; berlaku_sampai: string | null
  qr_token: string | null; waktu_keluar: string | null; waktu_masuk: string | null; catatan_piket: string | null
}

const inputCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

const statusTone: Record<string, string> = {
  diajukan: 'bg-amber-100 text-amber-700', disetujui: 'bg-green-100 text-green-700',
  ditolak: 'bg-red-100 text-red-700', keluar: 'bg-blue-100 text-blue-700',
  kembali: 'bg-slate-100 text-slate-600', dibatalkan: 'bg-slate-100 text-slate-500',
}

export default function IzinKeluarSiswaPage() {
  const qc = useQueryClient()
  const [keperluan, setKeperluan] = useState('')
  const [alasan, setAlasan] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ data: IzinKeluar[] }>({
    queryKey: ['izin-keluar-aktif'],
    queryFn: () => api.get('/izin-keluar/aktif').then(r => r.data),
    refetchInterval: 15_000, // supaya QR muncul otomatis begitu piket menyetujui
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['izin-keluar-aktif'] })

  const ajukan = useMutation({
    mutationFn: () => api.post('/izin-keluar', { keperluan, alasan: alasan || null }).then(r => r.data),
    onSuccess: (d) => { setMsg(d.message); setKeperluan(''); setAlasan(''); refresh() },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal mengajukan.'),
  })
  const batal = useMutation({
    mutationFn: (id: string) => api.post(`/izin-keluar/${id}/batal`).then(r => r.data),
    onSuccess: (d) => { setMsg(d.message); refresh() },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal membatalkan.'),
  })

  const daftar = data?.data ?? []
  const adaAktif = daftar.some(i => ['diajukan', 'disetujui', 'keluar'].includes(i.status))

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <DoorOpen className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-semibold">Izin Keluar</h1>
      </div>

      {/* Form ajukan */}
      <Card><CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Ajukan Izin Keluar</h3>
        {adaAktif ? (
          <p className="text-xs text-muted-foreground">Anda masih punya izin aktif hari ini. Selesaikan atau batalkan dulu sebelum mengajukan lagi.</p>
        ) : (
          <>
            <div>
              <label className="text-xs text-muted-foreground">Keperluan</label>
              <input className={inputCls} value={keperluan} onChange={e => setKeperluan(e.target.value)} placeholder="mis. Berobat ke klinik" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Alasan (opsional)</label>
              <textarea className={inputCls} rows={2} value={alasan} onChange={e => setAlasan(e.target.value)} />
            </div>
            <Button size="sm" onClick={() => { setMsg(null); ajukan.mutate() }} disabled={ajukan.isPending || !keperluan.trim()}>
              {ajukan.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Ajukan
            </Button>
          </>
        )}
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      </CardContent></Card>

      {/* Daftar izin hari ini */}
      {isLoading ? <div className="h-32 rounded-lg bg-muted animate-pulse" /> : daftar.map(izin => (
        <Card key={izin.id}><CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{izin.keperluan}</span>
            <Badge className={statusTone[izin.status] ?? ''}>{izin.status_label}</Badge>
            {izin.berlaku_sampai && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> berlaku s.d. {izin.berlaku_sampai}</span>}
          </div>

          {izin.qr_token && (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="rounded-xl bg-white p-3 border">
                <QRCodeSVG value={izin.qr_token} size={200} />
              </div>
              <p className="text-xs text-muted-foreground text-center">Tunjukkan QR ini ke petugas keamanan saat keluar & masuk kembali.</p>
            </div>
          )}

          {(izin.waktu_keluar || izin.waktu_masuk) && (
            <div className="flex items-center gap-4 text-xs">
              {izin.waktu_keluar && <span className="flex items-center gap-1 text-blue-600"><CheckCircle2 className="h-3.5 w-3.5" /> Keluar {izin.waktu_keluar}</span>}
              {izin.waktu_masuk && <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> Kembali {izin.waktu_masuk}</span>}
            </div>
          )}

          {izin.status === 'ditolak' && izin.catatan_piket && (
            <p className="text-xs text-red-600 flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> {izin.catatan_piket}</p>
          )}

          {['diajukan', 'disetujui'].includes(izin.status) && (
            <Button size="sm" variant="outline" onClick={() => batal.mutate(izin.id)} disabled={batal.isPending}>Batalkan</Button>
          )}
        </CardContent></Card>
      ))}
    </div>
  )
}
