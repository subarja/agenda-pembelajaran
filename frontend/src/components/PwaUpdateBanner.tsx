import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw } from 'lucide-react'

// Cek pembaruan berkala untuk sesi PWA yang dibuka lama (mis. terinstal di HP dan
// jarang ditutup): tanpa ini, service worker hanya dicek saat navigasi/refresh.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 jam

/**
 * Banner "Versi baru tersedia".
 *
 * Muncul ketika service worker mendeteksi build baru di server (registerType:
 * 'prompt'). SW baru sudah ter-precache tapi MENUNGGU — aplikasi tetap berjalan
 * di versi lama sampai pengguna menekan "Muat ulang", sehingga form yang sedang
 * diisi tidak hilang. Ini pengganti dari reload otomatis yang mengganggu.
 */
export default function PwaUpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => {
        // Hanya cek bila online; update() saat offline hanya menambah error diam.
        if (navigator.onLine) void registration.update()
      }, UPDATE_CHECK_INTERVAL_MS)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 md:bottom-4 md:left-auto md:right-4 md:w-80 z-[110] rounded-xl border bg-card shadow-lg p-4 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
        <RefreshCw className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Versi baru tersedia</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pembaruan aplikasi sudah siap. Muat ulang untuk memakai versi terbaru.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => void updateServiceWorker(true)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Muat Ulang
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
          >
            Nanti
          </button>
        </div>
      </div>
    </div>
  )
}
