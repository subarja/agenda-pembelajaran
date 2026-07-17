import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'

export function useBranding() {
  return useQuery({
    queryKey: ['branding'],
    queryFn: async () =>
      (await api.get<{ data: { logo_url: string | null } }>('/branding')).data.data,
    staleTime: 5 * 60 * 1000,
  })
}

// Desktop minimal 18x18mm (~68px @96dpi); mobile menyesuaikan.
// sm = TopBar (khusus mobile), md = sidebar (khusus desktop), lg = halaman login (responsif).
const sizeClasses = {
  sm: 'h-10 w-10 rounded-lg',
  md: 'h-[18mm] w-[18mm] rounded-lg',
  lg: 'h-12 w-12 md:h-[18mm] md:w-[18mm] rounded-xl',
}
const textClasses = { sm: 'text-sm', md: 'text-xl', lg: 'text-xl md:text-2xl' }

/**
 * Logo aplikasi di sebelah tulisan "Agenda Pembelajaran". Tanpa logo terpasang
 * tampil kotak dummy "AP". Untuk admin/wakasek (editable), logo bisa diklik
 * untuk membuka dialog ganti/hapus logo — tidak lewat panel admin.
 */
export default function BrandLogo({
  size = 'md',
  editable = false,
}: {
  size?: keyof typeof sizeClasses
  editable?: boolean
}) {
  const { user } = useAuthStore()
  const { data } = useBranding()
  const [open, setOpen] = useState(false)
  const canEdit = editable && (user?.role === 'admin' || user?.role === 'wakasek')

  const mark = data?.logo_url ? (
    <img
      src={data.logo_url}
      alt="Logo"
      className={`${sizeClasses[size]} shrink-0 object-contain`}
    />
  ) : (
    <div className={`${sizeClasses[size]} shrink-0 flex items-center justify-center bg-primary-600`}>
      <span className={`${textClasses[size]} font-bold text-white`}>AP</span>
    </div>
  )

  if (!canEdit) return mark

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Klik untuk ganti logo"
        className="shrink-0 rounded-md transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary-600/40"
      >
        {mark}
      </button>
      {open && <GantiLogoDialog logoUrl={data?.logo_url ?? null} onClose={() => setOpen(false)} />}
    </>
  )
}

function GantiLogoDialog({ logoUrl, onClose }: { logoUrl: string | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError('')
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(f)
    })
  }

  function done() {
    queryClient.invalidateQueries({ queryKey: ['branding'] })
    if (preview) URL.revokeObjectURL(preview)
    onClose()
  }

  function fail(err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      ?? 'Gagal menyimpan logo. Coba lagi.'
    setError(msg)
  }

  const upload = useMutation({
    mutationFn: async () => {
      const form = new FormData()
      form.append('logo', file!)
      await api.post('/admin/branding/logo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: done,
    onError: fail,
  })

  const reset = useMutation({
    mutationFn: async () => { await api.delete('/admin/branding/logo') },
    onSuccess: done,
    onError: fail,
  })

  const shown = preview ?? logoUrl

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="z-[60] max-w-sm">
        <DialogHeader>
          <DialogTitle>Ganti Logo Aplikasi</DialogTitle>
          <DialogDescription>
            Logo tampil di sebelah tulisan Agenda Pembelajaran (sidebar, halaman login).
            Format PNG/JPG/WebP, maksimal 2 MB — disarankan gambar persegi.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 overflow-hidden">
            {shown ? (
              <img src={shown} alt="Pratinjau logo" className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600">
                <span className="text-xl font-bold text-white">AP</span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handlePick}
              className="hidden"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              Pilih Gambar…
            </Button>
            <p className="text-xs text-muted-foreground">
              {file ? file.name : logoUrl ? 'Logo terpasang.' : 'Belum ada logo (memakai dummy AP).'}
            </p>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex items-center justify-between gap-2">
          {logoUrl ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50"
              disabled={reset.isPending || upload.isPending}
              onClick={() => reset.mutate()}
            >
              {reset.isPending ? 'Menghapus…' : 'Hapus Logo'}
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Batal</Button>
            <Button
              type="button"
              size="sm"
              disabled={!file || upload.isPending || reset.isPending}
              onClick={() => upload.mutate()}
            >
              {upload.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
