import { useNavigate, NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { cn, toLocalDateStr } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/features/auth/api'
import { getNavForUser } from './nav-config'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import NotificationBell from './NotificationBell'
import AcademicYearBadge from './AcademicYearBadge'
import BrandLogo from './BrandLogo'
import { useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { adminApi } from '@/features/admin/api'
import { ewsApi } from '@/features/ews/api'

function usePrefetchNav() {
  const qc = useQueryClient()
  return (path: string) => {
    if (path === '/ews') {
      qc.prefetchQuery({ queryKey: ['ews', 'wali', null], queryFn: () => ewsApi.getEws({ scope: 'wali' }) })
    } else if (path === '/ews-bk') {
      qc.prefetchQuery({ queryKey: ['ews', 'bk', null], queryFn: () => ewsApi.getEws({ scope: 'bk' }) })
    } else if (path === '/ews-guru') {
      const today = new Date()
      const mulai = new Date(today); mulai.setDate(today.getDate() - 6)
      const fmt = toLocalDateStr
      qc.prefetchQuery({ queryKey: ['teacher-ews', fmt(mulai), fmt(today)], queryFn: () => api.get(`/admin/teacher-ews?tanggal_mulai=${fmt(mulai)}&tanggal_akhir=${fmt(today)}`).then(r => r.data) })
    } else if (path === '/admin') {
      qc.prefetchQuery({ queryKey: ['admin-classes'], queryFn: () => adminApi.getClasses() })
      qc.prefetchQuery({ queryKey: ['admin-teachers', '', 1, 25], queryFn: () => adminApi.getTeachers({ page: 1, per_page: 25 }) })
    }
  }
}

export default function Sidebar() {
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()
  const prefetchNav = usePrefetchNav()

  if (!user) return null

  const items = getNavForUser(user)
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
        <BrandLogo editable />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-foreground">Agenda Pembelajaran</p>
          <p className="text-xs text-muted-foreground">SMKN 2 Cimahi</p>
          <AcademicYearBadge className="mt-1" />
        </div>
      </div>

      <Separator />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {items.map((item) => (
          <div key={item.path}>
            {item.sectionLabel && (
              <div className="mt-4 mb-1 px-3 flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                  {item.sectionLabel}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}
            <NavLink
              to={item.path}
              end={item.path === '/'}
              onMouseEnter={() => prefetchNav(item.path)}
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
          </div>
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
