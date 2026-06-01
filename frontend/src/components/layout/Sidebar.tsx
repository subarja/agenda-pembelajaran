import { useNavigate, NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/features/auth/api'
import { navByRole } from './nav-config'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import NotificationBell from './NotificationBell'

export default function Sidebar() {
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()

  if (!user) return null

  const items = navByRole[user.role]
  const initials = user.nama
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  async function handleLogout() {
    try { await authApi.logout() } finally {
      clearAuth()
      navigate('/login')
    }
  }

  return (
    <aside className="hidden md:flex h-screen w-64 flex-col border-r border-border bg-background fixed left-0 top-0">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-600">
          <span className="text-xs font-bold text-white">AP</span>
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-foreground">Agenda Pembelajaran</p>
          <p className="text-xs text-muted-foreground">SMKN 2 Cimahi</p>
        </div>
      </div>

      <Separator />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-600'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Separator />

      {/* User info */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden leading-tight">
            <p className="truncate text-sm font-medium">{user.nama}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {user.role.replace(/_/g, ' ')}
            </p>
          </div>
          <NotificationBell />
        </div>

        {/* Tombol Keluar — jelas terlihat */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Keluar
        </button>
      </div>
    </aside>
  )
}
