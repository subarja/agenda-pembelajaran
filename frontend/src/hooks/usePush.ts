import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  disablePush,
  enablePush,
  fetchPushConfig,
  isDeviceRegistered,
  pushPermission,
  refreshPushToken,
  type PushPermission,
} from '@/lib/push'

/**
 * Status push untuk perangkat ini + aksi menyalakan/mematikannya.
 *
 * `permission` selalu dibaca ulang dari browser, bukan diingat di state React —
 * pengguna bisa mencabut izin lewat pengaturan situs kapan saja tanpa sepengetahuan
 * aplikasi, dan UI harus mengikuti kenyataan itu.
 *
 * `active` TIDAK sama dengan permission === 'granted'. Mematikan notifikasi dari dalam
 * aplikasi mencabut token tapi meninggalkan izin situs tetap granted, jadi hanya adanya
 * token terdaftar yang benar-benar berarti "perangkat ini menerima push".
 */
export function usePush() {
  const qc = useQueryClient()
  const [permission, setPermission] = useState<PushPermission>(pushPermission)
  const [registered, setRegistered] = useState(isDeviceRegistered)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['push-config'],
    queryFn: fetchPushConfig,
    staleTime: Infinity,
  })

  const sync = useCallback(() => {
    setPermission(pushPermission())
    setRegistered(isDeviceRegistered())
  }, [])

  // Token FCM bisa dirotasi browser kapan saja (pembaruan browser, cache dibersihkan).
  // Disegarkan sekali tiap aplikasi dimuat, hanya untuk perangkat yang memang sudah
  // berlangganan; tidak pernah memunculkan prompt izin (lihat lib/push.ts).
  useEffect(() => {
    if (config?.enabled && permission === 'granted' && registered) {
      void refreshPushToken().catch(() => {})
    }
  }, [config?.enabled, permission, registered])

  const run = useCallback(
    async (action: () => Promise<void>, fallbackMessage: string) => {
      setBusy(true)
      setError(null)
      try {
        await action()
        await qc.invalidateQueries({ queryKey: ['push-devices'] })
      } catch (e) {
        setError(e instanceof Error ? e.message : fallbackMessage)
      } finally {
        sync()
        setBusy(false)
      }
    },
    [qc, sync],
  )

  return {
    /** Admin sekolah sudah menyetel Firebase. */
    available: Boolean(config?.enabled),
    supported: permission !== 'unsupported',
    // Jangan simpulkan apa pun sebelum /push/config tiba — kalau tidak, kartu status
    // sempat berkedip "belum diaktifkan sekolah" pada setiap pemuatan halaman.
    loading: configLoading,
    permission,
    /** Perangkat ini sedang menerima push. */
    active: registered && permission === 'granted',
    /** Diblokir pengguna — hanya bisa dipulihkan lewat pengaturan izin browser. */
    blocked: permission === 'denied',
    busy,
    error,
    enable: useCallback(() => run(enablePush, 'Gagal mengaktifkan notifikasi.'), [run]),
    disable: useCallback(() => run(disablePush, 'Gagal mematikan notifikasi.'), [run]),
  }
}
