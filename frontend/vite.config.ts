import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      // 'prompt' (bukan 'autoUpdate'): service worker versi baru MENUNGGU, tidak
      // langsung skipWaiting. Kita tampilkan banner "Versi baru tersedia" dan
      // guru menekan "Muat ulang" saat siap — supaya form yang sedang diisi tidak
      // ter-reload mendadak dan kehilangan input. Registrasi ditangani sendiri
      // lewat hook useRegisterSW di PwaUpdateBanner, jadi injeksi otomatis dimatikan.
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Agenda Pembelajaran SMKN 2 Cimahi',
        short_name: 'Agenda',
        description: 'Aplikasi Agenda Pembelajaran Kelas — Penilaian Karakter & EWS',
        theme_color: '#1f4e79',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'id',
        icons: [
          {
            src: '/icons/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Input Agenda',
            short_name: 'Agenda',
            description: 'Buka form input agenda baru',
            url: '/agenda/baru',
          },
          {
            name: 'Input Karakter',
            short_name: 'Karakter',
            description: 'Buka form input penilaian karakter',
            url: '/karakter',
          },
        ],
        categories: ['education', 'productivity'],
      },
      workbox: {
        // Service worker push punya siklus hidupnya sendiri dan selalu diambil browser
        // dari jaringan (permintaan skrip SW tidak melewati SW lain). Mem-precache-nya
        // hanya menambah entri yang tak pernah terpakai + revisi yang harus diurus.
        globIgnores: ['**/firebase-messaging-sw.js'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/v1\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 * 30 },
            },
          },
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
