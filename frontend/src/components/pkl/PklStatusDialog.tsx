import { useEffect, useState } from 'react'
import { Loader2, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toLocalDateStr } from '@/lib/utils'
import type { PklPlacementStatus, PklStatusPayload } from '@/features/pkl/api'

export interface PklStatusTarget {
  id: string
  nama: string | null
  mulai: string | null
  selesai: string | null
  status: PklPlacementStatus
  berakhir_aktual: string | null
  alasan_berakhir: string | null
}

// Aksi penutupan (tanpa 'berlangsung' yang khusus "buka kembali").
const ACTIONS: { value: PklPlacementStatus; label: string; hint: string }[] = [
  { value: 'selesai', label: 'Selesai lebih awal', hint: 'PKL selesai sebelum tanggal rencana. (Selesai sesuai tanggal otomatis, tak perlu ditandai.)' },
  { value: 'mengundurkan_diri', label: 'Mengundurkan diri', hint: 'Siswa berhenti dari PKL.' },
  { value: 'dipindahkan', label: 'Pindah tempat', hint: 'Tutup tempat ini, lalu tambahkan tempat PKL baru lewat tombol Tambah.' },
]

/**
 * Dialog ubah siklus hidup satu penempatan PKL: selesai (lebih awal), mengundurkan
 * diri, pindah tempat, atau buka kembali penutupan. Dipakai admin & pembimbing.
 * Penonaktifan siswa dari sekolah (keluar_sekolah) hanya untuk admin + aksi mundur.
 */
export default function PklStatusDialog({
  open,
  target,
  isAdmin = false,
  onClose,
  onSubmit,
}: {
  open: boolean
  target: PklStatusTarget | null
  isAdmin?: boolean
  onClose: () => void
  onSubmit: (payload: PklStatusPayload & { keluar_sekolah?: boolean }) => Promise<void>
}) {
  const today = toLocalDateStr(new Date())
  const isClosed = target ? target.status !== 'berlangsung' : false

  const [action, setAction] = useState<PklPlacementStatus>('selesai')
  const [tanggal, setTanggal] = useState('')
  const [alasan, setAlasan] = useState('')
  const [keluarSekolah, setKeluarSekolah] = useState(false)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!target) return
    setAction(isClosed ? target.status : 'selesai')
    setTanggal(target.berakhir_aktual ?? today)
    setAlasan(target.alasan_berakhir ?? '')
    setKeluarSekolah(false)
    setErr('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, open])

  if (!target) return null

  const punyaTanggal = !!target.mulai
  const perluTanggal = punyaTanggal // untuk semua aksi penutupan

  async function submit(reopen = false) {
    setSaving(true)
    setErr('')
    try {
      if (reopen) {
        await onSubmit({ status: 'berlangsung' })
      } else {
        if (perluTanggal && !tanggal) throw new Error('Tanggal berhenti/selesai wajib diisi.')
        await onSubmit({
          status: action,
          tanggal_berakhir_aktual: punyaTanggal ? tanggal : null,
          alasan_berakhir: alasan.trim() || null,
          ...(isAdmin && action === 'mengundurkan_diri' ? { keluar_sekolah: keluarSekolah } : {}),
        })
      }
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string })
      setErr(msg?.response?.data?.message ?? msg?.message ?? 'Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Status PKL — {target.nama}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {isClosed && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-800 dark:text-amber-300">
              Penempatan ini sudah ditutup. Anda bisa mengganti alasan/tanggal, atau{' '}
              <button type="button" className="font-semibold underline" disabled={saving} onClick={() => submit(true)}>
                buka kembali
              </button>{' '}
              (kembali berlangsung).
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Tindakan</Label>
            <div className="grid gap-1.5">
              {ACTIONS.map((a) => (
                <label key={a.value} className="flex cursor-pointer items-start gap-2 rounded-md border p-2 hover:bg-accent/50">
                  <input
                    type="radio"
                    name="pkl-action"
                    className="mt-0.5"
                    checked={action === a.value}
                    onChange={() => setAction(a.value)}
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{a.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{a.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {punyaTanggal ? (
            <div>
              <Label className="text-xs">
                {action === 'selesai' ? 'Tanggal selesai' : 'Tanggal berhenti'}
              </Label>
              <Input
                type="date"
                value={tanggal}
                min={target.mulai ?? undefined}
                max={action === 'selesai' && target.selesai ? minStr(target.selesai, today) : today}
                onChange={(e) => setTanggal(e.target.value)}
              />
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Absen & tagihan agenda berhenti setelah tanggal ini; riwayat sebelumnya tetap ada.
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Penempatan ini belum berjadwal (belum diplot), jadi tak perlu tanggal.
            </p>
          )}

          <div>
            <Label className="text-xs">Alasan / catatan {action === 'dipindahkan' ? '(mis. tujuan pindah)' : '(opsional)'}</Label>
            <textarea
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              maxLength={300}
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Catatan singkat…"
            />
          </div>

          {isAdmin && action === 'mengundurkan_diri' && (
            <label className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 p-2.5 text-xs">
              <input type="checkbox" className="mt-0.5" checked={keluarSekolah} onChange={(e) => setKeluarSekolah(e.target.checked)} />
              <span>
                <span className="font-medium text-red-700 dark:text-red-300">Sekaligus keluarkan dari sekolah</span>
                <span className="block text-muted-foreground">
                  Menonaktifkan siswa (status “keluar”). Centang hanya bila siswa benar-benar keluar sekolah,
                  bukan sekadar berhenti PKL.
                </span>
              </span>
            </label>
          )}

          {err && <p className="text-xs text-red-600">{err}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={onClose}>Batal</Button>
            <Button size="sm" disabled={saving} onClick={() => submit(false)}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              Simpan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function minStr(a: string, b: string): string {
  return a < b ? a : b
}
