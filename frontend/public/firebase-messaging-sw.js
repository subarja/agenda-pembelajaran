/* eslint-disable no-undef */
/**
 * Service worker push — Agenda Pembelajaran SMKN 2 Cimahi
 *
 * SENGAJA tanpa SDK Firebase di dalamnya (tidak ada importScripts ke gstatic).
 * Pesan FCM data-only sampai ke browser sebagai event `push` Web Push biasa, jadi
 * SDK di sini hanya akan menambah ~100KB unduhan dari domain pihak ketiga di setiap
 * pemasangan service worker — tanpa memberi satu pun kemampuan tambahan.
 *
 * Berkas ini didaftarkan pada scope '/fcm-push/', BUKAN '/'. Scope '/' sudah dipakai
 * service worker Workbox (vite-plugin-pwa) yang menangani cache offline; mendaftarkan
 * skrip berbeda pada scope yang sama akan MENGGANTIKAN registrasi itu dan mematikan
 * seluruh caching PWA. Event push dikirim ke service worker mana pun yang berlangganan,
 * apa pun scope-nya, jadi memisahkan scope tidak ada ruginya.
 */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = { data: { body: event.data.text() } }
  }

  // FCM data-only membungkus muatan di `data`. `notification` diperiksa sebagai
  // cadangan kalau suatu saat ada pengirim lain yang memakai format itu.
  const d = payload.data || payload.notification || {}

  event.waitUntil(
    self.registration.showNotification(d.title || 'Agenda Pembelajaran', {
      body: d.body || '',
      icon: '/icons/pwa-192.png',
      badge: '/icons/pwa-192.png',
      // Notifikasi sejenis saling menimpa daripada menumpuk: guru yang menerima lima
      // eskalasi EWS berturut-turut melihat satu notifikasi terbaru, bukan lima baris.
      tag: d.type || 'agenda',
      renotify: true,
      data: { url: d.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const target = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

      // Fokuskan tab yang sudah terbuka lalu arahkan ke halaman tujuan. Membuka jendela
      // baru setiap kali notifikasi diklik akan meninggalkan tumpukan tab aplikasi yang
      // sama — dan di PWA yang ter-install, jendela kedua terasa seperti aplikasi hang.
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus()
          if ('navigate' in client) await client.navigate(target)
          return
        }
      }

      await self.clients.openWindow(target)
    })(),
  )
})
