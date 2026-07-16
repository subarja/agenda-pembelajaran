import { useQuery } from '@tanstack/react-query'
import { BookOpen, Briefcase, Clock } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface BebanRow { kelas: string; mapel: string; hari: string; jumlah_sesi: number; jp: number }
interface BebanPkl { kelas: string; jumlah_siswa: number; periode: string }
interface BebanData { rows: BebanRow[]; total_jp: number; pkl: BebanPkl[] }

/**
 * Beban Mengajar — rekap kelas & mapel yang diampu guru (dari ploting jadwal TA aktif)
 * plus penugasan PKL sebagai pembimbing (yang tidak lewat ploting). Total JP dihitung
 * backend: rentang jam-ke bila ada, kalau tidak durasi ÷ 45 menit.
 */
export default function BebanMengajarPage() {
  const { data, isLoading } = useQuery<BebanData>({
    queryKey: ['beban-mengajar'],
    queryFn: () => api.get('/beban-mengajar').then(r => r.data.data),
  })

  if (isLoading || !data) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Beban Mengajar
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelas &amp; mata pelajaran yang Anda ampu pada tahun ajaran aktif, termasuk penugasan
            PKL yang tidak lewat ploting jadwal.
          </p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-2 text-center">
          <p className="text-2xl font-bold leading-tight">{data.total_jp}</p>
          <p className="text-xs text-muted-foreground">Total JP / minggu</p>
        </div>
      </div>

      <Card><CardContent className="p-4 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <BookOpen className="h-4 w-4" /> Ploting Jadwal
        </h2>
        {data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Belum ada ploting jadwal untuk Anda di tahun ajaran aktif.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">Kelas</th>
                  <th className="px-3 py-2 text-left font-medium">Mata Pelajaran</th>
                  <th className="px-3 py-2 text-left font-medium">Hari</th>
                  <th className="px-3 py-2 text-center font-medium">Sesi/Minggu</th>
                  <th className="px-3 py-2 text-center font-medium">JP</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground w-10 text-center">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{r.kelas}</td>
                    <td className="px-3 py-2">{r.mapel}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.hari}</td>
                    <td className="px-3 py-2 text-center">{r.jumlah_sesi}</td>
                    <td className="px-3 py-2 text-center font-semibold">{r.jp}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 font-semibold">
                  <td colSpan={5} className="px-3 py-2 text-right">Total</td>
                  <td className="px-3 py-2 text-center">{data.total_jp}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent></Card>

      {data.pkl.length > 0 && (
        <Card><CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Briefcase className="h-4 w-4" /> Penugasan PKL (Pembimbing)
          </h2>
          <p className="text-xs text-muted-foreground">
            Penugasan di luar ploting jadwal — agenda &amp; presensinya diisi lewat menu PKL
            (mingguan) saat Mode PKL aktif.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.pkl.map((p, i) => (
              <div key={i} className="rounded-lg border px-3 py-2.5 flex flex-wrap items-center gap-2">
                <span className="font-medium text-sm">{p.kelas}</span>
                <Badge variant="secondary">{p.jumlah_siswa} siswa bimbingan</Badge>
                <span className="text-xs text-muted-foreground w-full">Periode: {p.periode}</span>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}
    </div>
  )
}
