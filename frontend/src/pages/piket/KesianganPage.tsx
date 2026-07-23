import { AlarmClock } from 'lucide-react'
import KesianganSection from '@/components/piket/KesianganSection'

export default function KesianganPage() {
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <AlarmClock className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-semibold">Kesiangan (Piket)</h1>
      </div>
      <KesianganSection />
    </div>
  )
}
