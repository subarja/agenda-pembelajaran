import { useNavigate } from 'react-router-dom'
import type { AgendaPerluDiisi } from '@/features/agenda/types'
import { Badge } from '@/components/ui/badge'
import { cn, toLocalDateStr } from '@/lib/utils'

// Dipakai bersama di Dashboard (Guru & Wali Kelas), AgendaPage, dan AgendaFormPage —
// satu tempat untuk logika tampil "Agenda Perlu Diisi" (hari ini + sesi tertunda yang
// masih dalam batas waktu). Scroll-capped (~3 baris terlihat) alih-alih daftar tak
// terbatas, sesuai GK11/GK18.
export function AgendaPerluDiisiList({
  items,
  onSelect,
  selectedKey,
  emptyText = 'Semua agenda sudah diisi. Mantap!',
  scrollCap = true,
}: {
  items: AgendaPerluDiisi[]
  onSelect: (item: AgendaPerluDiisi) => void
  selectedKey?: string
  emptyText?: string
  scrollCap?: boolean
}) {
  const navigate = useNavigate()

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">{emptyText}</p>
  }
  const todayStr = toLocalDateStr(new Date())

  return (
    <div className={cn('space-y-2', scrollCap && 'max-h-[230px] overflow-y-auto pr-1')}>
      {items.map((s) => {
        const key = `${s.schedule_id}-${s.tanggal}`
        const isToday = s.tanggal === todayStr
        const mendesak = s.bisa_diisi && s.jam_tersisa !== null && s.jam_tersisa <= 24
        const tglLabel = isToday
          ? 'Hari ini'
          : new Date(s.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
        const active = key === selectedKey

        // Tagihan kokurikuler diisi di halaman Kokurikuler, tagihan PKL di form agenda
        // PKL mingguan — ditangani di sini supaya semua pemanggil (Dashboard/Agenda/
        // Form) tidak perlu tahu bedanya.
        const isKokurikuler = s.jenis === 'kokurikuler'
        const isPkl = s.jenis === 'pkl'

        return (
          <button
            key={key} type="button"
            onClick={() => isKokurikuler
              ? navigate('/kokurikuler')
              : isPkl
                ? navigate(`/pkl/agenda?class_id=${s.class_id}&minggu=${s.minggu ?? s.tanggal}`)
                : onSelect(s)}
            className={cn(
              'w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
              active ? 'border-primary-600 bg-primary-50'
                : !s.bisa_diisi ? 'border-red-200 bg-red-50/50'
                : mendesak ? 'border-orange-200 bg-orange-50/50 hover:border-orange-300'
                : 'border-border hover:border-primary-200',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{s.mapel} · {s.kelas}</p>
              <p className="text-xs text-muted-foreground">
                {tglLabel}{s.jam_mulai ? ` · ${s.jam_mulai}–${s.jam_selesai}` : ''}
                {' · '}
                {s.bisa_diisi
                  ? <span className={mendesak ? 'text-orange-600 font-medium' : ''}>Batas isi: {s.deadline}</span>
                  : <span className="text-red-600 font-medium">Lewat batas ({s.deadline})</span>}
              </p>
            </div>
            {s.bisa_diisi ? (
              <span className="shrink-0 rounded-md bg-primary-600 px-3 py-1 text-xs font-medium text-white">
                {isKokurikuler ? 'Isi Laporan' : isPkl ? 'Isi Agenda PKL' : 'Isi Agenda'}
              </span>
            ) : (
              <Badge className="shrink-0 bg-red-100 text-red-700">Lewat batas</Badge>
            )}
          </button>
        )
      })}
    </div>
  )
}
