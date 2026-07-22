import { Users } from 'lucide-react'
import type { StatusPresensi, PresensiSubmitRecord } from '@/features/presensi/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Urutan cycling: hadir → alpha → sakit → izin → hadir. Default hadir, guru hanya tap
// yang tidak hadir. Dipakai di PresensiFormPage (edit presensi tersimpan) dan
// AgendaFormPage (isi presensi sekaligus saat isi agenda, GK13/GK22).
export const STATUS_CYCLE: StatusPresensi[] = ['hadir', 'alpha', 'sakit', 'izin']

export const STATUS_CONFIG: Record<StatusPresensi, { label: string; short: string; classes: string }> = {
  hadir: { label: 'Hadir', short: 'H', classes: 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200' },
  sakit: { label: 'Sakit', short: 'S', classes: 'bg-blue-100  text-blue-700  border-blue-300  hover:bg-blue-200' },
  izin:  { label: 'Izin',  short: 'I', classes: 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200' },
  alpha: { label: 'Alpha', short: 'A', classes: 'bg-red-100   text-red-700   border-red-300   hover:bg-red-200' },
}

export function SummaryChip({
  label, count, total, colorClass,
}: { label: string; count: number; total: number; colorClass: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', colorClass)}>
      {label}: {count}/{total}
    </span>
  )
}

export function PresensiToggleList({
  students, records, onCycle, onSetAllHadir, showSummary = true,
}: {
  students: { student_id: string; nama: string; nis: string; kesiangan_menit?: number | null }[]
  records: Record<string, PresensiSubmitRecord>
  onCycle: (studentId: string) => void
  onSetAllHadir?: () => void
  showSummary?: boolean
}) {
  const total      = students.length
  const totalHadir = students.filter((s) => (records[s.student_id]?.status ?? 'hadir') === 'hadir').length
  const totalAlpha = students.filter((s) => records[s.student_id]?.status === 'alpha').length
  const totalSakit = students.filter((s) => records[s.student_id]?.status === 'sakit').length
  const totalIzin  = students.filter((s) => records[s.student_id]?.status === 'izin').length

  return (
    <div className="space-y-2">
      {showSummary && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <SummaryChip label="Hadir" count={totalHadir} total={total} colorClass="text-green-700 bg-green-50" />
            {totalAlpha > 0 && <SummaryChip label="Alpha" count={totalAlpha} total={total} colorClass="text-red-700 bg-red-50" />}
            {totalSakit > 0 && <SummaryChip label="Sakit" count={totalSakit} total={total} colorClass="text-blue-700 bg-blue-50" />}
            {totalIzin  > 0 && <SummaryChip label="Izin"  count={totalIzin}  total={total} colorClass="text-yellow-700 bg-yellow-50" />}
          </div>
          {onSetAllHadir && (
            <Button type="button" variant="outline" size="sm" onClick={onSetAllHadir} className="shrink-0">
              <Users className="h-3 w-3" /> Semua Hadir
            </Button>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Tap nama siswa untuk ganti status: Hadir → Alpha → Sakit → Izin → Hadir
      </p>

      <div className="space-y-2">
        {students.map((student) => {
          const current = records[student.student_id]?.status ?? 'hadir'
          const cfg = STATUS_CONFIG[current]
          return (
            <button
              key={student.student_id}
              type="button"
              onClick={() => onCycle(student.student_id)}
              className={cn(
                'w-full flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors text-left',
                cfg.classes,
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{student.nama}</p>
                <p className="text-xs opacity-70">{student.nis}</p>
                {student.kesiangan_menit != null && (
                  <p className="text-[11px] font-medium text-amber-700">
                    Kesiangan {student.kesiangan_menit} mnt{current === 'hadir' ? ' → hadir terlambat' : ' (default alpha)'}
                  </p>
                )}
              </div>
              <span className={cn(
                'shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold border-2',
                current === 'hadir'
                  ? 'border-green-500 bg-green-500 text-white'
                  : current === 'alpha'
                    ? 'border-red-500 bg-red-500 text-white'
                    : current === 'sakit'
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-yellow-500 bg-yellow-500 text-white',
              )}>
                {cfg.short}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
