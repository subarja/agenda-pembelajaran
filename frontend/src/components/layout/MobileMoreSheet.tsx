import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/features/auth/api'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { NavItem } from './nav-config'

export default function MobileMoreSheet({
  items, open, onClose,
}: { items: NavItem[]; open: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()

  if (!open || !user) return null

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
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl bg-background shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium">{user.nama}</p>
              <p className="text-xs text-muted-foreground capitalize">{user.role.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent shrink-0" aria-label="Tutup menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav list */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {items.map((item) => (
            <div key={item.path}>
              {item.sectionLabel && (
                <div className="mt-4 mb-1 px-3 flex items-center gap-2 first:mt-0">
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
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-foreground hover:bg-accent',
                  )
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </NavLink>
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-3 border-t border-border shrink-0" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Keluar
          </button>
        </div>
      </div>
    </div>
  )
}
