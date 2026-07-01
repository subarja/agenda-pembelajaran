import axios from 'axios'
import { useAuthStore } from '@/store/auth'

// Default KOSONG (path relatif) — request otomatis ke host yang sama dipakai browser
// membuka aplikasi (localhost ATAU IP LAN), diteruskan proxy Vite (vite.config.ts) ke
// backend. JANGAN hardcode 'http://localhost:8000' di sini — itu cuma valid kalau browser
// & backend di mesin yang sama persis, rusak total kalau diakses dari perangkat lain.
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ''}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // clearAuth() bersihkan token + auth-storage (Zustand persist) sekaligus
      // agar tidak terjadi loop: interceptor hapus 'token' tapi 'auth-storage'
      // masih berisi isAuthenticated:true sehingga GuestRoute redirect ke '/'
      useAuthStore.getState().clearAuth()
      window.location.replace('/login')
    }
    return Promise.reject(err)
  },
)

export default api
