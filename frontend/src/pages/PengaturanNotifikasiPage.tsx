import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, Check, Loader2, Moon, Smartphone, Trash2, TriangleAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { usePush } from '@/hooks/usePush'
import { notifikasiApi, type NotificationPreferences } from '@/features/notifikasi/api'

export default function PengaturanNotifikasiPage() {
  const qc = useQueryClient()
  const push = usePush()
  const [saved, setSaved] = useState(false)

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: notifikasiApi.getPreferences,
  })

  const { data: devices } = useQuery({
    queryKey: ['push-devices'],
    queryFn: notifikasiApi.getDevices,
  })

  const save = useMutation({
    mutationFn: notifikasiApi.updatePreferences,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notification-preferences'] })
      setSaved(true)
    },
  })

  const removeDevice = useMutation({
    mutationFn: notifikasiApi.deleteDevice,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['push-devices'] }),
  })

  // Tanda "Tersimpan" hilang sendiri; jangan biarkan menempel selamanya di layar.
  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 2000)
    return () => clearTimeout(t)
  }, [saved])

  if (isLoading || !prefs) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Pengaturan Notifikasi</h1>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Check className="h-3.5 w-3.5" /> Tersimpan
          </span>
        )}
      </div>

      <DeviceStatusCard push={push} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Jenis Notifikasi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <Row
            title="Notifikasi push"
            description="Saklar utama. Dimatikan pun, notifikasi tetap masuk ke lonceng di dalam aplikasi."
          >
            <Switch
              checked={prefs.push_enabled}
              aria-label="Notifikasi push"
              onCheckedChange={(v) => save.mutate({ push_enabled: v })}
            />
          </Row>

          <div className="h-px bg-border" />

          {prefs.types.map((type) => (
            <Row key={type.key} title={type.label}>
              <Switch
                checked={type.enabled}
                disabled={!prefs.push_enabled}
                aria-label={type.label}
                onCheckedChange={(v) => save.mutate({ types: { [type.key]: v } })}
              />
            </Row>
          ))}
        </CardContent>
      </Card>

      <QuietHoursCard prefs={prefs} onSave={save.mutate} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-4 w-4" /> Perangkat Aktif
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!devices || devices.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Belum ada perangkat yang menerima notifikasi.
            </p>
          ) : (
            <div className="space-y-2">
              {devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{device.device_label}</p>
                    <p className="text-xs text-muted-foreground">
                      {device.last_used_at ? `Terakhir aktif ${device.last_used_at}` : 'Belum pernah dipakai'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeDevice.mutate(device.id)}
                    disabled={removeDevice.isPending}
                    aria-label={`Cabut ${device.device_label}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Row({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}

/** Kartu status untuk PERANGKAT INI — dipisah karena tiap kondisinya butuh ajakan
 *  bertindak yang berbeda, dan menumpuknya jadi satu blok kondisional sulit dibaca. */
function DeviceStatusCard({ push }: { push: ReturnType<typeof usePush> }) {
  if (push.loading) return null

  if (!push.available) {
    return (
      <Callout icon={TriangleAlert} tone="muted" title="Push notification belum diaktifkan sekolah">
        Admin belum menghubungkan aplikasi ini ke Firebase. Notifikasi tetap muncul di lonceng
        dalam aplikasi.
      </Callout>
    )
  }

  if (!push.supported) {
    return (
      <Callout icon={TriangleAlert} tone="muted" title="Browser ini tidak mendukung notifikasi">
        Di iPhone/iPad, notifikasi hanya berjalan setelah aplikasi ditambahkan ke Layar Utama
        lewat menu Bagikan → Tambahkan ke Layar Utama.
      </Callout>
    )
  }

  if (push.blocked) {
    return (
      <Callout icon={BellOff} tone="danger" title="Notifikasi diblokir di browser ini">
        Aplikasi tidak bisa meminta izin lagi setelah diblokir. Buka ikon gembok di sebelah
        alamat situs → Izin situs → Notifikasi → Izinkan, lalu muat ulang halaman ini.
      </Callout>
    )
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              push.active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
            }`}
          >
            {push.active ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-sm font-semibold">
              {push.active ? 'Perangkat ini menerima notifikasi' : 'Perangkat ini belum menerima notifikasi'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {push.active
                ? 'Notifikasi akan muncul walau aplikasi tertutup.'
                : 'Aktifkan untuk menerima peringatan penting tanpa membuka aplikasi.'}
            </p>
            {push.error && <p className="mt-1 text-xs text-red-600">{push.error}</p>}
          </div>
        </div>

        <Button
          size="sm"
          variant={push.active ? 'outline' : 'default'}
          disabled={push.busy}
          onClick={() => void (push.active ? push.disable() : push.enable())}
        >
          {push.busy ? 'Memproses…' : push.active ? 'Matikan' : 'Aktifkan'}
        </Button>
      </CardContent>
    </Card>
  )
}

type PreferencePayload = Parameters<typeof notifikasiApi.updatePreferences>[0]

function QuietHoursCard({
  prefs,
  onSave,
}: {
  prefs: NotificationPreferences
  onSave: (payload: PreferencePayload) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Moon className="h-4 w-4" /> Jam Tenang
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Row
          title="Tahan push pada jam tertentu"
          description="Notifikasi tetap tersimpan di lonceng, hanya pemberitahuan ke layar yang ditahan."
        >
          <Switch
            checked={prefs.quiet_hours_enabled}
            aria-label="Jam tenang"
            onCheckedChange={(v) => onSave({ quiet_hours_enabled: v })}
          />
        </Row>

        {prefs.quiet_hours_enabled && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quiet_start">Mulai</Label>
              <Input
                id="quiet_start"
                type="time"
                defaultValue={prefs.quiet_start}
                onBlur={(e) => e.target.value && onSave({ quiet_start: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quiet_end">Selesai</Label>
              <Input
                id="quiet_end"
                type="time"
                defaultValue={prefs.quiet_end}
                onBlur={(e) => e.target.value && onSave({ quiet_end: e.target.value })}
              />
            </div>
            <p className="col-span-2 text-xs text-muted-foreground">
              Boleh melewati tengah malam — misalnya 21:00 sampai 05:00. Waktu mengikuti WIB.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Callout({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: React.ElementType
  title: string
  tone: 'muted' | 'danger'
  children: React.ReactNode
}) {
  const styles =
    tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-900'
      : 'border-border bg-muted/40 text-foreground'

  return (
    <div className={`flex gap-3 rounded-xl border p-4 ${styles}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm opacity-80">{children}</p>
      </div>
    </div>
  )
}
