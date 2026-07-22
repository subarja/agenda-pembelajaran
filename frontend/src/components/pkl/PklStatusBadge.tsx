import { cn } from '@/lib/utils'
import type { PklPlacementStatus } from '@/features/pkl/api'

const STYLES: Record<PklPlacementStatus, string> = {
  berlangsung:       'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  selesai:           'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  mengundurkan_diri: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  dipindahkan:       'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
}

const LABELS: Record<PklPlacementStatus, string> = {
  berlangsung:       'Berlangsung',
  selesai:           'Selesai',
  mengundurkan_diri: 'Mengundurkan diri',
  dipindahkan:       'Dipindahkan',
}

/**
 * Label status siklus hidup penempatan PKL. Pakai `status` = status_efektif dari API
 * (sudah memperhitungkan "selesai otomatis" saat tanggal terlewati).
 */
export default function PklStatusBadge({
  status,
  label,
  className,
}: {
  status: PklPlacementStatus
  label?: string
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', STYLES[status], className)}>
      {label ?? LABELS[status]}
    </span>
  )
}
