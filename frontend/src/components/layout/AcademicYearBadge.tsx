import { CalendarDays } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'

/**
 * Kotak kecil berwarna berisi tahun ajaran & semester yang sedang dikerjakan.
 * Dipasang tepat di bawah judul aplikasi (Sidebar desktop + TopBar mobile) supaya
 * konteks TA selalu terlihat di SEMUA halaman — bukan cuma di dashboard.
 */
export default function AcademicYearBadge({ className }: { className?: string }) {
  const ay = useAuthStore(s => s.currentAcademicYear)
  if (!ay) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-100',
        'px-1.5 py-0.5 text-[10px] font-bold leading-none text-amber-800 whitespace-nowrap',
        className,
      )}
      title={`Tahun ajaran yang sedang dikerjakan: ${ay.label}`}
    >
      <CalendarDays className="h-3 w-3 shrink-0" />
      TA {ay.tahun} · {ay.semester === 'ganjil' ? 'Ganjil' : 'Genap'}
    </span>
  )
}
