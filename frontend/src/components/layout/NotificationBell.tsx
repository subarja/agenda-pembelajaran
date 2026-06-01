import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, CheckCheck, Trash2, AlertTriangle, TrendingUp, Star } from 'lucide-react'
import api from '@/lib/api'

interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  url: string | null
  data: Record<string, unknown>
  read: boolean
  created_at: string
}

function fetchNotifications(unread = false) {
  return api.get<{ data: AppNotification[]; unread_count: number }>(
    `/notifications${unread ? '?unread=1' : ''}`
  ).then(r => r.data)
}

const TYPE_ICON: Record<string, React.ElementType> = {
  alpha_alert:    AlertTriangle,
  ews_escalation: TrendingUp,
  rekomendasi:    Star,
}
const TYPE_COLOR: Record<string, string> = {
  alpha_alert:    'text-red-600 bg-red-100',
  ews_escalation: 'text-orange-600 bg-orange-100',
  rekomendasi:    'text-blue-600 bg-blue-100',
}

export default function NotificationBell() {
  const [open, setOpen]         = useState(false)
  const containerRef            = useRef<HTMLDivElement>(null)
  const navigate                = useNavigate()
  const qc                      = useQueryClient()

  const { data, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchNotifications(),
    refetchInterval: 30_000, // poll setiap 30 detik
    staleTime: 25_000,
  })

  const markRead = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAll = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unreadCount = data?.unread_count ?? 0
  const notifications = data?.data ?? []

  function handleClick(n: AppNotification) {
    if (!n.read) markRead.mutate(n.id)
    if (n.url) {
      navigate(n.url)
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => { setOpen(o => !o); if (!open) refetch() }}
        className="relative rounded-full p-2 hover:bg-accent transition-colors"
        aria-label={`Notifikasi${unreadCount > 0 ? ` (${unreadCount} belum dibaca)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border bg-card shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="font-semibold text-sm">Notifikasi</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Tandai semua dibaca
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Tidak ada notifikasi</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon  = TYPE_ICON[n.type] ?? Bell
                const color = TYPE_COLOR[n.type] ?? 'text-gray-600 bg-gray-100'
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b last:border-0 ${!n.read ? 'bg-primary/5' : ''}`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleClick(n)}>
                      <p className={`text-sm font-medium leading-snug ${!n.read ? 'font-semibold' : ''}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-xs text-muted-foreground mt-1">{n.created_at}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      {!n.read && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markRead.mutate(n.id) }}
                          className="rounded p-1 hover:bg-accent"
                          title="Tandai dibaca"
                        >
                          <Check className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); del.mutate(n.id) }}
                        className="rounded p-1 hover:bg-red-100"
                        title="Hapus"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
