import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

/**
 * Widget foto 3x4 (potret) yang dipakai di mana pun foto siswa/guru bisa diedit manual
 * (modal edit siswa & guru di Panel Admin, halaman "Foto Siswa Kelas Saya" wali kelas).
 * Upload langsung terjadi saat file dipilih (tidak nunggu tombol "Simpan" form utama),
 * konsisten dengan pola upload foto profil yang sudah ada di ProfilePage.tsx.
 */
export default function PhotoEditWidget({
  fotoUrl, uploadEndpoint, onUploaded, disabled,
}: {
  fotoUrl: string | null
  uploadEndpoint: string
  onUploaded?: (fotoUrl: string) => void
  disabled?: boolean
}) {
  const [preview, setPreview] = useState<string | null>(fotoUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setLoading(true)
    try {
      const form = new FormData()
      form.append('foto', file)
      const resp = await api.post<{ foto_url: string }>(uploadEndpoint, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setPreview(resp.data.foto_url)
      onUploaded?.(resp.data.foto_url)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Gagal upload foto.')
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-[20mm] shrink-0 rounded-md border bg-muted">
        <img src={preview || '/images/default-avatar.jpg'} alt="Foto" className="w-full h-auto rounded-md" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="h-4 w-4 animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="space-y-1">
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => fileRef.current?.click()}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-accent',
            (disabled || loading) && 'opacity-50 cursor-not-allowed',
          )}
        >
          <Camera className="h-3.5 w-3.5" />Ganti Foto
        </button>
        <p className="text-[11px] text-muted-foreground">JPG/PNG, maks 50KB, rasio 3x4</p>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
        <input
          ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden"
          onChange={handleChange}
        />
      </div>
    </div>
  )
}
