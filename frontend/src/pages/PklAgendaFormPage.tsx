import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Save, CheckCircle2 } from 'lucide-react'
import { pklApi, type PklAgendaForm } from '@/features/pkl/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toLocalDateStr } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { WhatsAppLink } from '@/components/ui/whatsapp-link'

// Absen model tap sekali sentuh (bukan dropdown — terlalu lambat utk 30+ siswa):
// satu huruf per status, terpilih = berwarna penuh. Default semua HADIR.
const STATUS = [
  { v: 'hadir', huruf: 'H', label: 'Hadir', on: 'bg-emerald-600 text-white border-emerald-600', ring: 'hover:border-emerald-400' },
  { v: 'sakit', huruf: 'S', label: 'Sakit', on: 'bg-amber-500 text-white border-amber-500', ring: 'hover:border-amber-400' },
  { v: 'izin', huruf: 'I', label: 'Izin', on: 'bg-sky-600 text-white border-sky-600', ring: 'hover:border-sky-400' },
  { v: 'alpha', huruf: 'A', label: 'Alpa', on: 'bg-red-600 text-white border-red-600', ring: 'hover:border-red-400' },
]

export default function PklAgendaFormPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const classId = params.get('class_id') ?? ''
  const minggu  = params.get('minggu') ?? ''
  const today   = toLocalDateStr(new Date())

  const { data, isLoading, error } = useQuery({
    queryKey: ['pkl-agenda', classId, minggu],
    queryFn: () => pklApi.agenda(classId, minggu),
    enabled: !!classId && !!minggu,
  })
  const form = data?.data.data as PklAgendaForm | undefined

  const [catatan, setCatatan] = useState('')
  const [objIds, setObjIds]   = useState<string[]>([])
  // presensi[studentId][tanggal] = status
  const [presensi, setPresensi] = useState<Record<string, Record<string, string>>>({})
  const [saved, setSaved] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!form) return
    setCatatan(form.agenda.catatan ?? '')
    setObjIds(form.agenda.objectives ?? [])
    const grid: Record<string, Record<string, string>> = {}
    const todayStr = toLocalDateStr(new Date())
    for (const s of form.students) {
      grid[s.id] = {}
      for (const [tgl, st] of Object.entries(s.presensi)) {
        // Default HADIR utk hari yang sudah berjalan dan belum tercatat — pembimbing
        // cukup mengoreksi yang tidak hadir, bukan mengisi satu-satu.
        grid[s.id][tgl] = st ?? (tgl <= todayStr ? 'hadir' : '')
      }
    }
    setPresensi(grid)
  }, [form])

  const grouped = useMemo(() => {
    const map: Record<string, PklAgendaForm['objectives']> = {}
    for (const o of form?.objectives ?? []) (map[o.lingkup] ??= []).push(o)
    return map
  }, [form])

  const save = useMutation({
    mutationFn: () => {
      const presensiArr: { student_id: string; tanggal: string; status: string }[] = []
      for (const [sid, days] of Object.entries(presensi))
        for (const [tgl, st] of Object.entries(days))
          if (st) presensiArr.push({ student_id: sid, tanggal: tgl, status: st })

      return pklApi.saveAgenda({ class_id: classId, minggu, catatan, objective_ids: objIds, presensi: presensiArr })
    },
    onSuccess: () => {
      setSaved(true); setErrMsg(null)
      qc.invalidateQueries({ queryKey: ['pkl-weeks'] })
      qc.invalidateQueries({ queryKey: ['agendas-perlu-diisi'] })
    },
    onError: (e: any) => setErrMsg(e?.response?.data?.message ?? 'Gagal menyimpan agenda PKL.'),
  })

  if (isLoading) return <div className="flex items-center gap-2 text-muted-foreground p-4"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</div>
  if (error || !form) return <div className="p-4 text-sm text-red-600">Gagal memuat agenda PKL.</div>

  return (
    <div className="max-w-4xl space-y-4">
      <button onClick={() => navigate('/pkl')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Kembali
      </button>

      <div>
        <h1 className="text-xl font-bold">Agenda PKL — {form.class.label}</h1>
        <p className="text-xs text-muted-foreground">Minggu {form.hari[0]?.tanggal} s/d {form.hari[form.hari.length - 1]?.tanggal}</p>
      </div>

      {/* TP Khusus PKL */}
      <Card><CardContent className="p-4 space-y-3">
        <Label>Tujuan Pembelajaran PKL</Label>
        {form.objectives.length === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada TP PKL untuk jurusan ini (dikelola admin).</p>
        ) : (
          Object.entries(grouped).map(([lingkup, list]) => (
            <div key={lingkup} className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">{lingkup}</p>
              {list.map((o) => (
                <label key={o.id} className="flex items-start gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="mt-1"
                    checked={objIds.includes(o.id)}
                    onChange={(e) => setObjIds((prev) => e.target.checked ? [...prev, o.id] : prev.filter((x) => x !== o.id))} />
                  <span>
                    {o.kode && <code className="mr-1.5 rounded bg-muted px-1 py-0.5 text-[10px] font-semibold text-muted-foreground">{o.kode}</code>}
                    {o.deskripsi}
                  </span>
                </label>
              ))}
            </div>
          ))
        )}
      </CardContent></Card>

      {/* Catatan monitoring */}
      <Card><CardContent className="p-4 space-y-2">
        <Label htmlFor="catatan">Catatan Monitoring</Label>
        <textarea id="catatan" rows={3}
          className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background"
          placeholder="Ringkasan monitoring PKL minggu ini…"
          value={catatan} onChange={(e) => setCatatan(e.target.value)} />
      </CardContent></Card>

      {/* Presensi harian — tap sekali sentuh, default semua Hadir */}
      <Card><CardContent className="p-4 space-y-2">
        <Label>Presensi Harian (Senin–Jumat)</Label>
        <p className="text-xs text-muted-foreground">
          Semua siswa otomatis <strong className="text-emerald-700">Hadir</strong> — tap hanya yang perlu diubah:{' '}
          {STATUS.map((st, i) => (
            <span key={st.v}>{i > 0 && ' · '}<strong>{st.huruf}</strong> = {st.label}</span>
          ))}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                {/* sticky: nama siswa tetap terlihat saat tabel digulir horizontal di HP */}
                <th className="text-left py-2 pr-2 font-medium sticky left-0 bg-card min-w-[8rem] max-w-[11rem]">Nama</th>
                {form.hari.map((h) => (
                  <th key={h.tanggal} className="px-1.5 py-2 font-medium text-center whitespace-nowrap">
                    {h.nama}
                    {h.tanggal > today && <span className="block text-[10px] text-muted-foreground font-normal">(nanti)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.students.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-1.5 pr-2 sticky left-0 bg-card min-w-[8rem] max-w-[11rem]">
                    <span className="inline-flex items-center gap-1.5">{s.nama}<WhatsAppLink telpon={s.telpon} iconOnly /></span>
                  </td>
                  {form.hari.map((h) => {
                    const future = h.tanggal > today
                    const current = presensi[s.id]?.[h.tanggal] ?? ''
                    return (
                      <td key={h.tanggal} className="px-1.5 py-1.5 text-center">
                        {future ? (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        ) : (
                          <span className="inline-flex gap-0.5" role="radiogroup" aria-label={`${s.nama} ${h.nama}`}>
                            {STATUS.map((st) => {
                              const active = current === st.v
                              return (
                                <button
                                  key={st.v} type="button" role="radio" aria-checked={active}
                                  title={st.label}
                                  onClick={() => setPresensi((prev) => ({
                                    ...prev, [s.id]: { ...prev[s.id], [h.tanggal]: st.v },
                                  }))}
                                  className={cn(
                                    'h-7 w-7 rounded-md border text-[11px] font-semibold transition-colors select-none',
                                    active ? st.on : cn('border-input bg-background text-muted-foreground', st.ring),
                                  )}>
                                  {st.huruf}
                                </button>
                              )
                            })}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {form.students.length === 0 && (
                <tr><td colSpan={form.hari.length + 1} className="text-center py-6 text-muted-foreground">Tidak ada siswa bimbingan di kelas ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent></Card>

      {errMsg && <p className="text-sm text-red-600">{errMsg}</p>}
      {saved && <p className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Agenda PKL tersimpan.</p>}

      <div className="flex justify-end">
        <Button className="w-full sm:w-auto" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Simpan Agenda PKL
        </Button>
      </div>
    </div>
  )
}
