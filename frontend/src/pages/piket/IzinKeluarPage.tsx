import { DoorOpen } from 'lucide-react'
import IzinKeluarSection from '@/components/piket/IzinKeluarSection'

export default function IzinKeluarPage() {
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <DoorOpen className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-semibold">Izin Keluar (Piket)</h1>
      </div>
      <IzinKeluarSection />
    </div>
  )
}
