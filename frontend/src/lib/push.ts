import type { FirebaseApp } from 'firebase/app'
import type { MessagePayload, Messaging } from 'firebase/messaging'
import api from '@/lib/api'

// Scope terpisah dari service worker Workbox — lihat public/firebase-messaging-sw.js.
const SW_URL = '/firebase-messaging-sw.js'
const SW_SCOPE = '/fcm-push/'

// Token terakhir yang berhasil didaftarkan. Disimpan supaya tombol "matikan" tetap bisa
// mencabut langganan di server walau halaman sudah pernah dimuat ulang (getToken() akan
// meminta izin lagi kalau dipanggil hanya untuk mencari tahu tokennya).
const TOKEN_KEY = 'push_token'

export interface PushConfig {
  enabled: boolean
  firebase?: {
    apiKey: string
    authDomain: string
    projectId: string
    messagingSenderId: string
    appId: string
  }
  vapid_public_key?: string
}

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported'

let app: FirebaseApp | null = null
let messaging: Messaging | null = null

export function fetchPushConfig(): Promise<PushConfig> {
  return api.get<{ data: PushConfig }>('/push/config').then((r) => r.data.data)
}

/**
 * Perangkat ini sedang berlangganan push.
 *
 * Sengaja TIDAK memakai `Notification.permission === 'granted'` sebagai penanda: izin
 * situs tetap granted setelah pengguna mematikan notifikasi dari dalam aplikasi, jadi
 * memakainya akan menampilkan status "aktif" untuk perangkat yang sudah dicabut.
 */
export function isDeviceRegistered(): boolean {
  return Boolean(localStorage.getItem(TOKEN_KEY))
}

/**
 * Pemeriksaan dukungan yang sama dengan `isSupported()` milik Firebase, tapi tanpa
 * memuat SDK-nya. Fungsi ini dipanggil di SETIAP pemuatan aplikasi (usePush), jadi
 * memakai versi Firebase akan menarik ~50KB SDK ke jalur kritis semua pengguna —
 * termasuk siswa yang tidak pernah menyalakan notifikasi.
 *
 * Dukungan tidak bisa disimpulkan dari nama browser: Safari iOS baru mendukung sejak
 * 16.4 DAN hanya setelah aplikasi ditambahkan ke Layar Utama, dan mode penyamaran
 * mematikannya diam-diam. Karena itu yang diperiksa kemampuannya, bukan user agent.
 */
function browserSupportsPush(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof ServiceWorkerRegistration !== 'undefined' &&
    'showNotification' in ServiceWorkerRegistration.prototype
  )
}

export function pushPermission(): PushPermission {
  if (!browserSupportsPush()) return 'unsupported'
  return Notification.permission as PushPermission
}

/** Nama perangkat yang bisa dikenali pengguna di daftar "Perangkat Aktif". */
function deviceLabel(): string {
  const ua = navigator.userAgent

  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser'

  const os =
    /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'perangkat ini'

  return `${browser} di ${os}`
}

/**
 * SDK Firebase dimuat secara dinamis, tidak pernah di puncak modul.
 *
 * File ini diimpor oleh features/auth/api.ts (untuk mencabut token saat logout), yang
 * ikut ke bundel awal. Impor statis akan menyeret seluruh SDK ke halaman login untuk
 * setiap pengguna. Dengan dynamic import, biayanya hanya ditanggung perangkat yang
 * benar-benar memakai push.
 */
async function initMessaging(config: PushConfig): Promise<Messaging> {
  if (messaging) return messaging
  if (!config.firebase) throw new Error('Firebase belum dikonfigurasi oleh admin.')

  const [{ initializeApp }, { getMessaging }] = await Promise.all([
    import('firebase/app'),
    import('firebase/messaging'),
  ])

  // Nama app 'push' (bukan default) supaya tidak bentrok kalau nanti ada modul Firebase
  // lain yang ikut initializeApp() di aplikasi yang sama.
  app = initializeApp(config.firebase, 'push')
  messaging = getMessaging(app)
  return messaging
}

function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE })
}

/** Ambil token FCM untuk perangkat ini dan catat di server. */
async function registerDevice(config: PushConfig): Promise<string | null> {
  const { getToken } = await import('firebase/messaging')

  const token = await getToken(await initMessaging(config), {
    vapidKey: config.vapid_public_key,
    serviceWorkerRegistration: await registerServiceWorker(),
  })

  if (!token) return null

  await api.post('/push/devices', { token, device_label: deviceLabel() })
  localStorage.setItem(TOKEN_KEY, token)
  return token
}

/**
 * Meminta izin lalu mendaftarkan perangkat ini.
 *
 * WAJIB dipanggil dari gestur pengguna (klik tombol), tidak pernah saat halaman dimuat:
 * browser menghitung penolakan sebagai "denied" permanen yang tidak bisa dibatalkan
 * aplikasi, dan Chrome menerapkan sanksi diam-diam pada situs yang memicu prompt tanpa
 * konteks. Karena itu tidak ada satu pun pemanggil otomatis fungsi ini.
 */
export async function enablePush(): Promise<void> {
  const config = await fetchPushConfig()
  if (!config.enabled) throw new Error('Push notification belum diaktifkan admin sekolah.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifikasi diblokir. Aktifkan lagi lewat pengaturan izin situs di browser Anda.'
        : 'Izin notifikasi belum diberikan.',
    )
  }

  if (!(await registerDevice(config))) {
    throw new Error('Browser tidak memberikan token notifikasi.')
  }
}

/** Cabut perangkat ini: hapus token di Firebase lalu di server. */
export async function disablePush(): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY)

  try {
    if (messaging) {
      const { deleteToken } = await import('firebase/messaging')
      await deleteToken(messaging)
    }
  } catch {
    // Token bisa saja sudah mati di sisi Firebase. Itu bukan alasan untuk membiarkan
    // barisnya tertinggal di server — lanjutkan pencabutan di bawah.
  }

  if (token) await api.post('/push/devices/unsubscribe', { token })
  localStorage.removeItem(TOKEN_KEY)
}

/**
 * Segarkan pendaftaran secara diam-diam untuk pengguna yang SUDAH berlangganan.
 *
 * FCM merotasi token (mis. setelah pembaruan browser atau pembersihan cache); tanpa ini
 * push berhenti sampai pengguna kebetulan membuka halaman pengaturan. Tidak pernah
 * memunculkan prompt izin karena dijaga dua syarat di bawah.
 */
export async function refreshPushToken(): Promise<void> {
  if (pushPermission() !== 'granted') return

  // Izin browser tetap 'granted' setelah pengguna menekan "matikan notifikasi" di
  // aplikasi — mematikannya tidak mencabut izin situs. Tanpa penjagaan ini, fungsi ini
  // akan mendaftarkan ulang perangkat yang baru saja dimatikan pada pemuatan berikutnya,
  // dan tombolnya tampak tidak berfungsi.
  if (!isDeviceRegistered()) return

  const config = await fetchPushConfig()
  if (!config.enabled) return

  // Dikirim walaupun tokennya tidak berubah — server menyegarkan last_used_at, yang jadi
  // dasar kolom "terakhir aktif" di daftar perangkat.
  await registerDevice(config)
}

/**
 * Pesan yang tiba saat aplikasi sedang dibuka TIDAK memicu service worker, jadi tidak
 * ada notifikasi sistem — memang begitu seharusnya (mengganggu orang yang sedang menatap
 * halamannya). Callback ini dipakai untuk menampilkan toast in-app sebagai gantinya.
 */
export async function onForegroundMessage(cb: (payload: MessagePayload) => void): Promise<() => void> {
  if (pushPermission() !== 'granted' || !isDeviceRegistered()) return () => {}

  const config = await fetchPushConfig()
  if (!config.enabled) return () => {}

  const { onMessage } = await import('firebase/messaging')

  // initMessaging() sendiri, jangan mengandalkan enablePush()/refreshPushToken() sudah
  // lebih dulu jalan — urutan efek React tidak dijamin dan langganan yang diam-diam
  // tidak terpasang akan tampak seperti "notifikasi kadang tidak muncul".
  return onMessage(await initMessaging(config), cb)
}

/** Dipanggil saat logout supaya guru berikutnya di HP yang sama tidak mewarisi push. */
export async function teardownPush(): Promise<void> {
  try {
    await disablePush()
  } finally {
    if (app) {
      const { deleteApp } = await import('firebase/app')
      await deleteApp(app)
      app = null
      messaging = null
    }
  }
}
