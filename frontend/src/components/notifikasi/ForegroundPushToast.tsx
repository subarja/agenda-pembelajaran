import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, X } from 'lucide-react'
import { onForegroundMessage } from '@/lib/push'

interface Toast {
  id: number
  title: string
  body: string
  url: string
}

const AUTO_DISMISS_MS = 8000

/**
 * Pesan push yang tiba saat tab aplikasi sedang aktif TIDAK membangunkan service worker,
 * jadi tidak ada notifikasi sistem — dan memang tidak seharusnya ada: menampilkan
 * notifikasi OS di atas halaman yang sedang ditatap pengguna itu mengganggu, bukan
 * membantu. Sebagai gantinya pesan tampil sebagai kartu in-app yang bisa diklik.
 */
export default function ForegroundPushToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const navigate = useNavigate()
  const qc = useQueryClient()

  useEffect(() => {
    let unsubscribe = () => {}
    let cancelled = false

    void onForegroundMessage((payload) => {
      const d = payload.data ?? {}
      const toast: Toast = {
        id: Date.now() + Math.random(),
        title: d.title || 'Notifikasi baru',
        body: d.body || '',
        url: d.url || '/',
      }

      setToasts((prev) => [...prev, toast])
      // Lonceng harus ikut bertambah seketika, tanpa menunggu polling 30 detik berikutnya.
      void qc.invalidateQueries({ queryKey: ['notifications'] })

      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), AUTO_DISMISS_MS)
    }).then((unsub) => {
      // Langganan terpasang secara asinkron; kalau komponen sudah dilepas sebelum itu
      // selesai, lepaskan segera supaya tidak ada listener yatim yang tetap memanggil
      // setState pada komponen yang sudah tidak ada.
      if (cancelled) unsub()
      else unsubscribe = unsub
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [qc])

  if (toasts.length === 0) return null

  return (
    <div className="fixed right-4 top-4 z-[300] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex cursor-pointer gap-3 rounded-xl border bg-card p-4 shadow-lg transition hover:bg-accent/50"
          onClick={() => {
            setToasts((prev) => prev.filter((t) => t.id !== toast.id))
            navigate(toast.url)
          }}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Bell className="h-4 w-4 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-snug">{toast.title}</p>
            {toast.body && <p className="mt-0.5 text-sm text-muted-foreground">{toast.body}</p>}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation()
              setToasts((prev) => prev.filter((t) => t.id !== toast.id))
            }}
            className="h-fit rounded-md p-1 text-muted-foreground hover:bg-accent"
            aria-label="Tutup notifikasi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
