import { Check } from 'lucide-react'
import type { ScheduleToday } from '@/features/agenda/types'
import { cn } from '@/lib/utils'

// GK12: daftar jadwal hari ini beserta status isi/belum, dipakai di Dashboard Guru dan
// popover "+ Isi Agenda" (GK14). Kosong → "Tidak ada Jadwal Hari ini". Scroll-capped
// sama seperti AgendaPerluDiisiList (GK11).
export function AgendaHariIniList({
  items,
  onSelect,
  onViewFilled,
  selectedId,
  scrollCap = true,
}: {
  items: ScheduleToday[]
  onSelect: (item: ScheduleToday) => void
  onViewFilled?: (item: ScheduleToday) => void
  selectedId?: string
  scrollCap?: boolean
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Tidak ada Jadwal Hari ini</p>
  }

  return (
    <div className={cn('space-y-2', scrollCap && 'max-h-[230px] overflow-y-auto pr-1')}>
      {items.map((s) => {
        const sudahDiisi = !!s.agenda_hari_ini
        const active = s.id === selectedId

        return (
          <button
            key={s.id} type="button"
            disabled={sudahDiisi && !onViewFilled}
            onClick={() => (sudahDiisi ? onViewFilled?.(s) : onSelect(s))}
            className={cn(
              'w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
              active ? 'border-primary-600 bg-primary-50'
                : sudahDiisi ? 'border-border bg-muted/50 opacity-80'
                : 'border-border hover:border-primary-200',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{s.subject.nama}</p>
              <p className="text-xs text-muted-foreground">
                {s.class.label} · {s.jam_mulai.slice(0, 5)}–{s.jam_selesai.slice(0, 5)}
              </p>
            </div>
            {sudahDiisi ? (
              <span className="shrink-0 flex items-center gap-1 text-xs text-green-700">
                <Check className="h-3.5 w-3.5" /> {onViewFilled ? 'Lihat / Edit' : 'Sudah diisi'}
              </span>
            ) : (
              <span className="shrink-0 rounded-md bg-primary-600 px-3 py-1 text-xs font-medium text-white">
                Isi Agenda
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
