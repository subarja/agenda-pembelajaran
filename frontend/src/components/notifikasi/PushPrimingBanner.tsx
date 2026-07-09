import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePush } from '@/hooks/usePush'

const DISMISSED_KEY = 'push_prompt_dismissed_at'
const SNOOZE_DAYS = 14

function isSnoozed(): boolean {
  const at = Number(localStorage.getItem(DISMISSED_KEY))
  if (!at) return false
  return Date.now() - at < SNOOZE_DAYS * 24 * 60 * 60 * 1000
}

/**
 * Permission priming — kartu ajakan yang menjelaskan MANFAATNYA sebelum browser
 * memunculkan dialog izin.
 *
 * Aplikasi tidak boleh pernah memanggil Notification.requestPermission() saat halaman
 * dimuat. Prompt tanpa konteks hampir selalu ditolak, dan penolakan itu PERMANEN: sekali
 * pengguna menekan "Blokir", aplikasi tidak punya cara apa pun untuk bertanya lagi —
 * satu-satunya jalan pulih adalah pengguna membuka pengaturan izin situs sendiri.
 * Karena itu dialog izin baru muncul setelah pengguna menekan "Aktifkan" di sini.
 */
export default function PushPrimingBanner() {
  const { available, supported, active, blocked, busy, error, enable } = usePush()
  const [dismissed, setDismissed] = useState(isSnoozed)

  if (!available || !supported || active || blocked || dismissed) return null

  function snooze() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    setDismissed(true)
  }

  return (
    <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bell className="h-5 w-5 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Aktifkan notifikasi di perangkat ini</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Dapatkan pemberitahuan langsung saat ada peringatan alpha, kenaikan level EWS,
            atau pengajuan konseling — tanpa perlu membuka aplikasi.
          </p>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => void enable()} disabled={busy}>
              {busy ? 'Memproses…' : 'Aktifkan'}
            </Button>
            <Button size="sm" variant="ghost" onClick={snooze} disabled={busy}>
              Nanti saja
            </Button>
            <Link
              to="/pengaturan/notifikasi"
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Atur jenis notifikasi
            </Link>
          </div>
        </div>

        <button
          onClick={snooze}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          aria-label="Tutup ajakan notifikasi"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
