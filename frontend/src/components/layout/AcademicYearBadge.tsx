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

  // TA non-aktif = mode arsip: seluruh app menampilkan semester itu, default baca-saja.
  const arsip = ay.aktif === false

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold leading-none whitespace-nowrap',
        arsip
          ? 'border-slate-300 bg-slate-100 text-slate-600'
          : 'border-amber-300 bg-amber-100 text-amber-800',
        className,
      )}
      title={arsip
        ? `Arsip ${ay.label} — ${ay.tulis_diizinkan ? 'akses tulis dibuka admin' : 'baca-saja'}`
        : `Tahun ajaran yang sedang dikerjakan: ${ay.label}`}
    >
      <CalendarDays className="h-3 w-3 shrink-0" />
      TA {ay.tahun} · {ay.semester === 'ganjil' ? 'Ganjil' : 'Genap'}
      {arsip && (
        <span className="rounded-sm bg-slate-600 px-1 py-px text-[9px] font-bold text-white">
          {ay.tulis_diizinkan ? 'ARSIP·TULIS' : 'ARSIP'}
        </span>
      )}
    </span>
  )
}
