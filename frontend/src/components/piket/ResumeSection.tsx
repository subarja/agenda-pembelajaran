import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Loader2, Download } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePdfPreview } from '@/hooks/usePdfPreview'

export default function ResumeSection() {
  const qc = useQueryClient()
  const [ringkasan, setRingkasan] = useState('')
  const [kejadian, setKejadian] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const pdf = usePdfPreview({ printSettings: true })

  const { data } = useQuery<{ data: { ringkasan: string | null; kejadian_penting: string | null; penyunting: string | null } }>({
    queryKey: ['piket-resume'],
    queryFn: () => api.get('/piket/resume').then(r => r.data),
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

  const cls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
  return (
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
  )
}
