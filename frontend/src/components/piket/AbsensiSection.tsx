import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PresensiToggleList } from '@/components/presensi/PresensiToggleList'
import type { PresensiSubmitRecord, StatusPresensi } from '@/features/presensi/types'

const STATUS_CYCLE: StatusPresensi[] = ['hadir', 'alpha', 'sakit', 'izin']

export default function AbsensiSection() {
  const qc = useQueryClient()
  const [classId, setClassId] = useState('')
  const [records, setRecords] = useState<Record<string, PresensiSubmitRecord>>({})
  const [msg, setMsg] = useState<string | null>(null)

  const { data: classes } = useQuery<{ data: { id: string; label: string }[] }>({
    queryKey: ['piket-classes'],
    queryFn: () => api.get('/character/classes', { params: { scope: 'semua' } }).then(r => r.data),
  })

  const { data, isFetching } = useQuery<{ data: { kelas: { label: string }; is_filled: boolean; records: { student_id: string; nama: string; nis: string; status: StatusPresensi }[] } }>({
    queryKey: ['piket-absensi', classId],
    queryFn: () => api.get('/piket/absensi', { params: { class_id: classId } }).then(r => r.data),
    enabled: !!classId,
  })

  useEffect(() => {
    if (!data) return
    const init: Record<string, PresensiSubmitRecord> = {}
    data.data.records.forEach(r => { init[r.student_id] = { student_id: r.student_id, status: r.status, durasi_terlambat: 0, catatan: '' } })
    setRecords(init)
  }, [data])

  const cycle = (id: string) => setRecords(prev => {
    const cur = prev[id]?.status ?? 'hadir'
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length]
    return { ...prev, [id]: { ...prev[id], student_id: id, status: next, durasi_terlambat: 0, catatan: '' } }
  })
  const semuaHadir = () => setRecords(prev => Object.fromEntries(Object.keys(prev).map(id => [id, { student_id: id, status: 'hadir' as StatusPresensi, durasi_terlambat: 0, catatan: '' }])))

  const save = useMutation({
    mutationFn: () => api.post('/piket/absensi', { class_id: classId, records: Object.values(records) }).then(r => r.data),
    onSuccess: (d) => { setMsg(d.message); qc.invalidateQueries({ queryKey: ['piket-absensi', classId] }) },
    onError: (e: any) => setMsg(e.response?.data?.message ?? 'Gagal menyimpan.'),
  })

  const students = data?.data.records ?? []

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium"><ClipboardList className="h-4 w-4" /> Absensi Harian</div>
      <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={classId} onChange={e => setClassId(e.target.value)}>
        <option value="">— pilih kelas —</option>
        {(classes?.data ?? []).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>

      {classId && data?.data.is_filled && <p className="text-xs text-amber-700">Kelas ini sudah pernah diabsen hari ini. Menyimpan akan menimpa data terakhir.</p>}

      {classId && (isFetching ? <div className="h-24 rounded bg-muted animate-pulse" /> : students.length > 0 ? (
        <>
          <PresensiToggleList students={students} records={records} onCycle={cycle} onSetAllHadir={semuaHadir} />
          <Button size="sm" className="w-full" onClick={() => { setMsg(null); save.mutate() }} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Simpan Absensi {data?.data.kelas.label}
          </Button>
        </>
      ) : <p className="text-xs text-muted-foreground">Tidak ada siswa di kelas ini.</p>)}
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </CardContent></Card>
  )
}
