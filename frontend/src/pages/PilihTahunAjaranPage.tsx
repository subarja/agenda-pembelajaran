import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { academicYearApi } from '@/features/auth/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { CalendarRange, Loader2, AlertCircle } from 'lucide-react'

export default function PilihTahunAjaranPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const currentAcademicYear = useAuthStore((s) => s.currentAcademicYear)
  const setCurrentAcademicYear = useAuthStore((s) => s.setCurrentAcademicYear)
  const updateUser = useAuthStore((s) => s.updateUser)
  const [selectedId, setSelectedId] = useState<string | null>(currentAcademicYear?.id ?? null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['academic-years-pilihan'],
    queryFn: () => academicYearApi.pilihan().then((r) => r.data.data),
  })

  useEffect(() => {
    if (!selectedId && data && data.length > 0) {
      const aktif = data.find((y) => y.aktif)
      setSelectedId(aktif?.id ?? data[0].id)
    }
  }, [data, selectedId])

  const mutation = useMutation({
    mutationFn: (id: string) => academicYearApi.pilih(id),
    onSuccess: (res) => {
      const user = res.data.data
      updateUser(user)
      if (user.current_academic_year) setCurrentAcademicYear(user.current_academic_year)
      // Seluruh data di-scope per TA terpilih — cache query lama milik TA sebelumnya.
      qc.clear()
      navigate('/')
    },
  })

  return (
    <div className="min-h-screen bg-primary-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 mb-4">
            <CalendarRange className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-primary-600">Pilih Tahun Pelajaran</h1>
          <p className="text-sm text-muted-foreground mt-1">Tentukan tahun pelajaran yang ingin dikerjakan</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tahun Pelajaran Aktif</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading && (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}

            {!!error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
                Gagal memuat daftar tahun pelajaran. Coba muat ulang halaman.
              </p>
            )}

            {data && data.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Belum ada tahun pelajaran. Hubungi admin untuk membuatnya terlebih dahulu.
              </p>
            )}

            {data && data.length > 0 && (
              <div className="space-y-2">
                {data.map((y) => (
                  <button
                    key={y.id}
                    type="button"
                    onClick={() => setSelectedId(y.id)}
                    className={cn(
                      'w-full text-left rounded-lg border px-3 py-2.5 transition-colors',
                      selectedId === y.id
                        ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600'
                        : 'border-border hover:bg-muted/40',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{y.label}</span>
                      {y.aktif && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                          Aktif
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {mutation.isError && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 flex gap-2 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Gagal menyimpan pilihan. Coba lagi.
              </div>
            )}

            <p className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
              Seluruh aplikasi akan menampilkan data tahun pelajaran yang dipilih.
              Tahun pelajaran <strong>non-aktif</strong> dibuka sebagai <strong>arsip
              baca-saja</strong> &mdash; data lama bisa dilihat tapi tidak bisa diubah,
              kecuali admin membuka akses tulis di Panel Admin.
            </p>

            <Button
              type="button"
              disabled={!selectedId || mutation.isPending}
              onClick={() => selectedId && mutation.mutate(selectedId)}
              className="w-full"
            >
              {mutation.isPending ? 'Menyimpan...' : 'Lanjutkan'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
