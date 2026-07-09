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
  const [pos, setPos]           = useState({ top: 0, left: 0, openUp: false })
  const containerRef            = useRef<HTMLDivElement>(null)
  const buttonRef               = useRef<HTMLButtonElement>(null)
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

  // Badge angka di ikon aplikasi PWA (taskbar/home screen), sehingga guru melihat ada
  // notifikasi baru tanpa membuka aplikasi. Belum didukung Firefox & Safari desktop —
  // di sana pemanggilannya tidak ada; lonceng di dalam aplikasi tetap satu-satunya
  // sumber yang selalu benar.
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return

    if (unreadCount > 0) void navigator.setAppBadge(unreadCount).catch(() => {})
    else void navigator.clearAppBadge().catch(() => {})
  }, [unreadCount])

  function calcPos() {
    if (!buttonRef.current) return
    const rect       = buttonRef.current.getBoundingClientRect()
    const vw         = window.innerWidth
    const vh         = window.innerHeight
    const PANEL_W    = Math.min(400, vw - 16)
    const PANEL_H    = Math.min(520, vh - 80)
    const spaceBelow = vh - rect.bottom
    const openUp     = spaceBelow < PANEL_H && rect.top > PANEL_H / 2
    setPos({
      top:  openUp ? Math.max(8, rect.top - PANEL_H - 8) : rect.bottom + 8,
      left: Math.max(8, (vw - PANEL_W) / 2),
      openUp,
    })
  }

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
        ref={buttonRef}
        onClick={() => { calcPos(); setOpen(o => !o); if (!open) refetch() }}
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
        <div
          className="fixed max-w-[calc(100vw-1rem)] rounded-2xl border bg-card shadow-2xl z-[200] flex flex-col"
          style={{ top: pos.top, left: pos.left, width: 400 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-base">Notifikasi</h3>
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary hover:bg-primary/10 transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Tandai semua dibaca
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: Math.min(460, window.innerHeight - 160) }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Bell className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">Tidak ada notifikasi</p>
                <p className="text-xs text-muted-foreground/60">Notifikasi baru akan muncul di sini</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon  = TYPE_ICON[n.type] ?? Bell
                const color = TYPE_COLOR[n.type] ?? 'text-gray-600 bg-gray-100'
                return (
                  <div
                    key={n.id}
                    className={`group relative border-b last:border-0 transition-colors ${
                      !n.read ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'
                    }`}
                  >
                    {/* Unread indicator */}
                    {!n.read && (
                      <span className="absolute left-0 top-0 bottom-0 w-1 rounded-l-sm bg-primary" />
                    )}

                    <div className="flex gap-3 px-5 py-4 cursor-pointer" onClick={() => handleClick(n)}>
                      {/* Icon */}
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${color}`}>
                        <Icon className="h-5 w-5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${!n.read ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'}`}>
                          {n.title}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                          {n.body}
                        </p>
                        <p className="mt-1.5 text-xs text-muted-foreground/70">{n.created_at}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!n.read && (
                          <button
                            onClick={(e) => { e.stopPropagation(); markRead.mutate(n.id) }}
                            className="rounded-md p-1.5 hover:bg-accent"
                            title="Tandai dibaca"
                          >
                            <Check className="h-4 w-4 text-muted-foreground" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); del.mutate(n.id) }}
                          className="rounded-md p-1.5 hover:bg-red-100"
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t px-5 py-3 text-center">
              <p className="text-xs text-muted-foreground">
                {notifications.length} notifikasi
                {unreadCount > 0 ? `, ${unreadCount} belum dibaca` : ' · semua sudah dibaca'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
