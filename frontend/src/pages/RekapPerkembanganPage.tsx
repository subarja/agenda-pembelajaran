import { TrendingUp } from 'lucide-react'

export default function RekapPerkembanganPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-lg font-semibold">Rekap Perkembangan Siswa Lintas Semester</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">
        Halaman ini akan menampilkan rekap poin karakter &amp; perkembangan siswa yang
        merangkum data dari seluruh semester (tidak terbatas satu tahun pelajaran).
        Format rekap sedang disiapkan dan akan tersedia setelah data per-semester
        lengkap terkumpul.
      </p>
    </div>
  )
}
