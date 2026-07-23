import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { UserSearch, Search, AlarmClock } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Row { nama: string | null; nis: string | null; kelas: string | null; status: string; catatan: string | null; kesiangan_menit: number | null }

const STATUS: Record<string, { label: string; cls: string }> = {
  hadir: { label: 'Hadir', cls: 'bg-green-600 hover:bg-green-600' },
  sakit: { label: 'Sakit', cls: 'bg-amber-500 hover:bg-amber-500' },
  izin: { label: 'Izin', cls: 'bg-blue-500 hover:bg-blue-500' },
  alpha: { label: 'Alpha', cls: 'bg-red-600 hover:bg-red-600' },
  belum: { label: 'Belum diabsen', cls: 'bg-muted-foreground/60 hover:bg-muted-foreground/60' },
}

export default function CekKehadiranPage() {
  const [classId, setClassId] = useState('')
  const [nama, setNama] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebounced(nama), 350); return () => clearTimeout(t) }, [nama])

  const { data: classes } = useQuery<{ data: { id: string; label: string }[] }>({
    queryKey: ['piket-classes'],
    queryFn: () => api.get('/character/classes', { params: { scope: 'semua' } }).then(r => r.data),
  })

  const canSearch = !!classId || debounced.trim().length >= 2
  const { data, isFetching } = useQuery<{ data: Row[]; message?: string }>({
    queryKey: ['piket-cek-kehadiran', classId, debounced],
    queryFn: () => api.get('/piket/cek-kehadiran', { params: { class_id: classId || undefined, nama: debounced || undefined } }).then(r => r.data),
    enabled: canSearch,
  })

  const rows = data?.data ?? []

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <UserSearch className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-semibold">Cek Kehadiran Murid</h1>
      </div>
      <p className="text-xs text-muted-foreground">Cari status kehadiran murid hari ini berdasarkan kelas dan/atau nama.</p>

      <Card><CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-56">
            <label className="text-xs text-muted-foreground">Kelas</label>
            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={classId} onChange={e => setClassId(e.target.value)}>
              <option value="">— semua kelas —</option>
              {(classes?.data ?? []).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <label className="text-xs text-muted-foreground">Nama (min. 2 huruf)</label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <input className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm" placeholder="nama murid" value={nama} onChange={e => setNama(e.target.value)} />
            </div>
          </div>
        </div>

        {!canSearch && <p className="text-xs text-muted-foreground">Pilih kelas atau ketik minimal 2 huruf nama.</p>}
        {canSearch && isFetching && <div className="h-24 rounded bg-muted animate-pulse" />}
        {canSearch && !isFetching && rows.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada murid yang cocok.</p>}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left py-1.5 pr-2">Nama</th>
                  <th className="text-left px-2">Kelas</th>
                  <th className="text-left px-2">Status Hari Ini</th>
                  <th className="text-left px-2">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const st = STATUS[r.status] ?? STATUS.belum
                  return (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5 pr-2">
                        <div className="font-medium">{r.nama}</div>
                        <div className="text-[11px] text-muted-foreground">{r.nis}</div>
                      </td>
                      <td className="px-2 text-muted-foreground">{r.kelas}</td>
                      <td className="px-2"><Badge className={`${st.cls} text-[10px] text-white`}>{st.label}</Badge></td>
                      <td className="px-2 text-xs text-muted-foreground">
                        {r.catatan}
                        {r.kesiangan_menit ? <span className="inline-flex items-center gap-0.5 ml-1 text-amber-700"><AlarmClock className="h-3 w-3" /> kesiangan {r.kesiangan_menit}m</span> : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent></Card>
    </div>
  )
}
