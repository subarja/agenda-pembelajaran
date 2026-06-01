import { BookOpen, ClipboardCheck, Star, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const greetingByRole: Record<string, string> = {
  admin:      'Panel Admin',
  guru:       'Selamat mengajar hari ini',
  wali_kelas: 'Pantau kelas Anda',
  wakasek:    'Monitoring Kurikulum',
  bk:         'Bimbingan & Konseling',
  siswa:      'Semangat belajar',
  orang_tua:  'Pantau perkembangan anak',
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null

  const greeting = greetingByRole[user.role] ?? 'Dashboard'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">{greeting}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Halo, <span className="font-medium text-foreground">{user.nama}</span>
        </p>
      </div>

      {/* Quick stats — placeholder sampai API tersedia */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={BookOpen}       label="Agenda Hari Ini"  value="—" color="text-blue-600"   bg="bg-blue-50" />
        <StatCard icon={ClipboardCheck} label="Kehadiran"        value="—" color="text-green-600"  bg="bg-green-50" />
        <StatCard icon={Star}           label="Poin Karakter"    value="—" color="text-yellow-600" bg="bg-yellow-50" />
        <StatCard icon={AlertTriangle}  label="EWS Aktif"        value="—" color="text-red-600"    bg="bg-red-50" />
      </div>

      {/* Status card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Status Sistem
            <Badge variant="hijau">Online</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Backend API terhubung. Fitur modul sedang dalam pengembangan.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  icon: Icon, label, value, color, bg,
}: {
  icon: React.ElementType
  label: string
  value: string
  color: string
  bg: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`inline-flex rounded-lg p-2 ${bg} mb-3`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  )
}
