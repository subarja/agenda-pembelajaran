import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// GK11/GK12: card dashboard bergaya notifikasi — header menampilkan badge jumlah,
// konten (list agenda) baru muncul saat header diklik (expand/collapse), scroll-capped
// di dalamnya (ditangani oleh AgendaPerluDiisiList/AgendaHariIniList).
export function NotifCard({
  title, count, badges, defaultOpen = false, children,
}: {
  title: string
  count: number
  badges?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const userToggled = useRef(false)

  // defaultOpen sering baru bernilai benar SETELAH data query datang (render pertama
  // masih 0 item) — ikuti perubahannya selama user belum menyentuh toggle, supaya
  // kartu berisi tagihan tidak tampil tertutup.
  useEffect(() => {
    if (!userToggled.current) setOpen(defaultOpen)
  }, [defaultOpen])

  return (
    <Card>
      <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => { userToggled.current = true; setOpen((o) => !o) }}>
        <div className="flex items-center justify-between flex-wrap gap-1.5">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            {title}
            {count > 0 && (
              <Badge className="bg-primary-100 text-primary-700">{count}</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {badges}
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
          </div>
        </div>
      </CardHeader>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  )
}
