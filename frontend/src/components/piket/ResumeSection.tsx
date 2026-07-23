import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Loader2, Download, ClipboardList } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePdfPreview } from '@/hooks/usePdfPreview'

interface KehadiranKelas { kelas: string; hadir: number; sakit: number; izin: number; alpha: number; total: number }
interface Rekap {
  waktu: string
  kehadiran_kelas: KehadiranKelas[]
  kehadiran_total: { hadir: number; sakit: number; izin: number; alpha: number; total: number }
  agenda: { berlangsung: number; terisi: number; belum: number }
  presensi: { berlangsung: number; terisi: number; belum: number }
}
interface ShiftInfo { id: number; nama: string; jam_mulai: string; jam_selesai: string; petugas: string[] }
interface ResumeData { ringkasan: string | null; kejadian_penting: string | null; penyunting: string | null; shift: ShiftInfo; rekap: Rekap }

export default function ResumeSection() {
  const qc = useQueryClient()
  const [ringkasan, setRingkasan] = useState('')
  const [kejadian, setKejadian] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const pdf = usePdfPreview({ printSettings: true })

  const { data, isError } = useQuery<{ data: ResumeData }>({
    queryKey: ['piket-resume'],
    queryFn: () => api.get('/piket/resume').then(r => r.data),
    refetchInterval: 60_000,
  })
  useEffect(() => { if (data) { setRingkasan(data.data.ringkasan ?? ''); setKejadian(data.data.kejadian_penting ?? '') } }, [data])

  const save = useMutation({
    mutationFn: () => api.post('/piket/resume', { ringkasan, kejadian_penting: kejadian || null }).then(r => r.data),
    onSuccess: (d) => { setMsg(d.message); qc.invalidateQueries({ queryKey: ['piket-resume'] }) },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal menyimpan.'),
  })

  async function exportXlsx() {
    const res = await api.get('/piket/resume/export', { params: { format: 'xlsx' }, responseType: 'blob' })
    const href = URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a'); a.href = href; a.download = 'Resume_Piket.xlsx'
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(href), 60_000)
  }

  const shift = data?.data.shift
  const rekap = data?.data.rekap
  const cls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  if (isError) return <p className="text-sm text-muted-foreground">Shift piket Anda hari ini tidak ditemukan.</p>

  return (
    <div className="space-y-4">
      {shift && (
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <div className="text-sm font-semibold">Resume Shift {shift.nama} <span className="text-muted-foreground font-normal">{shift.jam_mulai}–{shift.jam_selesai}</span></div>
              <div className="text-xs text-muted-foreground">Petugas: {shift.petugas.length ? shift.petugas.join(', ') : '—'}</div>
            </div>
            {rekap && <Badge variant="secondary">Rekap s.d. {rekap.waktu}</Badge>}
          </div>
        </CardContent></Card>
      )}

      {/* Rekap otomatis */}
      {rekap && (
        <Card><CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium"><ClipboardList className="h-4 w-4" /> Rekap Otomatis (sampai pukul {rekap.waktu})</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border p-2.5">
              <div className="text-xs text-muted-foreground">Agenda guru terisi</div>
              <div className="font-semibold">{rekap.agenda.terisi}/{rekap.agenda.berlangsung} <span className="text-xs font-normal text-muted-foreground">sesi berlangsung</span></div>
            </div>
            <div className="rounded-lg border p-2.5">
              <div className="text-xs text-muted-foreground">Presensi siswa terisi</div>
              <div className="font-semibold">{rekap.presensi.terisi}/{rekap.presensi.berlangsung} <span className="text-xs font-normal text-muted-foreground">sesi berlangsung</span></div>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium mb-1">Kehadiran per Kelas (absensi harian)</div>
            {rekap.kehadiran_kelas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Belum ada absensi harian tercatat.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-1 pr-2">Kelas</th>
                      <th className="text-center px-1">Hadir</th><th className="text-center px-1">Sakit</th>
                      <th className="text-center px-1">Izin</th><th className="text-center px-1">Alpha</th>
                      <th className="text-center px-1">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekap.kehadiran_kelas.map((k, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1 pr-2">{k.kelas}</td>
                        <td className="text-center px-1">{k.hadir}</td><td className="text-center px-1">{k.sakit}</td>
                        <td className="text-center px-1">{k.izin}</td><td className="text-center px-1">{k.alpha}</td>
                        <td className="text-center px-1 font-medium">{k.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">Angka rekap dibekukan saat resume disimpan (nilai di dokumen = kondisi saat pukul simpan).</p>
        </CardContent></Card>
      )}

      {/* Naskah resume */}
      <Card><CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" /> Resume Piket</div>
        {data?.data.penyunting && <p className="text-xs text-muted-foreground">Terakhir disunting: {data.data.penyunting}</p>}
        <div>
          <label className="text-xs text-muted-foreground">Ringkasan kegiatan</label>
          <textarea className={cls} rows={3} value={ringkasan} onChange={e => setRingkasan(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Kejadian penting (opsional)</label>
          <textarea className={cls} rows={2} value={kejadian} onChange={e => setKejadian(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={() => { setMsg(null); save.mutate() }} disabled={save.isPending || !ringkasan.trim()}>
            {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Simpan
          </Button>
          <Button size="sm" variant="outline" onClick={() => pdf.openPreview('/piket/resume/export?format=pdf', 'Resume_Piket.pdf')}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={exportXlsx}><Download className="h-4 w-4 mr-1" /> Excel</Button>
        </div>
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
        {pdf.modal}{pdf.loadingOverlay}
      </CardContent></Card>
    </div>
  )
}
