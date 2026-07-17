import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/features/auth/api'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import NotificationBell from './NotificationBell'
import AcademicYearBadge from './AcademicYearBadge'
import BrandLogo from './BrandLogo'

export default function TopBar({ title = 'Agenda Pembelajaran' }: { title?: string }) {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const initials = user?.nama
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() ?? 'U'

  async function handleLogout() {
    try { await authApi.logout() } finally {
      clearAuth()
      navigate('/login')
    }
  }

  return (
    <header className="sticky top-0 z-40 flex min-h-14 items-center gap-2.5 border-b border-border bg-background px-4 py-1.5 md:hidden">
      <BrandLogo size="sm" editable />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-primary-600 truncate">{title}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-xs text-muted-foreground">SMKN 2 Cimahi</p>
          <AcademicYearBadge />
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <NotificationBell />

        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Keluar
        </button>
      </div>
    </header>
  )
}
