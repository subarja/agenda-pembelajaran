import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AcademicYearOption, User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  currentAcademicYear: AcademicYearOption | null
  // false sampai zustand `persist` selesai baca localStorage (async, walau localStorage
  // sendiri sync — ada 1 microtask delay). SEBELUM ini true, `isAuthenticated`/`user`
  // masih nilai awal (false/null) meski sebenarnya sudah login — dulu bikin dashboard
  // blank putih sekejap. Router HARUS tunggu `hasHydrated` dulu sebelum memutuskan render.
  hasHydrated: boolean
  setAuth: (user: User, token: string) => void
  setCurrentAcademicYear: (year: AcademicYearOption) => void
  clearAuth: () => void
  setHasHydrated: (v: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      currentAcademicYear: null,
      hasHydrated: false,
      setAuth: (user, token) => {
        localStorage.setItem('token', token)
        set({ user, token, isAuthenticated: true, currentAcademicYear: user.current_academic_year ?? null })
      },
      setCurrentAcademicYear: (year) => set({ currentAcademicYear: year }),
      clearAuth: () => {
        localStorage.removeItem('token')
        set({ user: null, token: null, isAuthenticated: false, currentAcademicYear: null })
      },
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: 'auth-storage',
      partialize: (s) => ({
        user: s.user,
        token: s.token,
        isAuthenticated: s.isAuthenticated,
        currentAcademicYear: s.currentAcademicYear,
      }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
)
