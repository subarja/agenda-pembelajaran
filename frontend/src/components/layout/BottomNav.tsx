import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { cn, toLocalDateStr } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { getNavForUser } from './nav-config'
import { useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { adminApi } from '@/features/admin/api'
import { ewsApi } from '@/features/ews/api'
import MobileMoreSheet from './MobileMoreSheet'

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
      qc.prefetchQuery({ queryKey: ['admin-classes'], queryFn: adminApi.getClasses })
      qc.prefetchQuery({ queryKey: ['admin-teachers', '', 1, 25], queryFn: () => adminApi.getTeachers({ page: 1, per_page: 25 }) })
    }
  }
}

export default function BottomNav() {
  const user = useAuthStore((s) => s.user)
  const prefetchNav = usePrefetchNav()
  const [moreOpen, setMoreOpen] = useState(false)
  if (!user) return null

  // Kalau menu terlalu banyak (mis. admin 9 item, guru wali kelas+BK 13 item), sisanya
  // dulu hilang begitu saja karena bottom nav cuma muat 5 slot — sekarang slot terakhir
  // jadi tombol "Menu" yang buka panel berisi SEMUA item, bukan cuma 5 pertama.
  const allItems = getNavForUser(user)
  const showMore = allItems.length > 5
  const items = showMore ? allItems.slice(0, 4) : allItems

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex h-16">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onMouseEnter={() => prefetchNav(item.path)}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors',
                  isActive
                    ? 'text-primary-600'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          {showMore && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors',
                moreOpen ? 'text-primary-600' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Menu className={cn('h-5 w-5', moreOpen && 'stroke-[2.5]')} />
              <span>Menu</span>
            </button>
          )}
        </div>
      </nav>

      <MobileMoreSheet items={allItems} open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}
