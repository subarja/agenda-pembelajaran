import { ClipboardList } from 'lucide-react'
import AbsensiSection from '@/components/piket/AbsensiSection'

export default function AbsensiPage() {
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-semibold">Absensi Harian (Piket)</h1>
      </div>
      <AbsensiSection />
    </div>
  )
}
