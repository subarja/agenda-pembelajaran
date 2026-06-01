import { useEffect, useState } from 'react'
import { X, Download } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow]                     = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Tampilkan banner hanya jika belum pernah dismiss
      const dismissed = localStorage.getItem('pwa-banner-dismissed')
      if (!dismissed) setShow(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
    }
    setDeferredPrompt(null)
  }

  function handleDismiss() {
    setShow(false)
    localStorage.setItem('pwa-banner-dismissed', '1')
  }

  if (!show) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 md:bottom-4 md:left-auto md:right-4 md:w-80 z-50 rounded-xl border bg-card shadow-lg p-4 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white font-bold text-sm">
        AP
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Install Aplikasi</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pasang di layar utama HP Anda untuk akses lebih cepat — bisa offline!
        </p>
        <button
          onClick={handleInstall}
          className="mt-2 flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Pasang Sekarang
        </button>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded-full p-1 hover:bg-accent"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  )
}
