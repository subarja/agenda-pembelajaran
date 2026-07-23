import { FileText } from 'lucide-react'
import ResumeSection from '@/components/piket/ResumeSection'

export default function ResumePage() {
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-semibold">Resume Piket</h1>
      </div>
      <ResumeSection />
    </div>
  )
}
