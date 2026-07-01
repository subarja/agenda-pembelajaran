import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AcademicYearOption, User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  currentAcademicYear: AcademicYearOption | null
  setAuth: (user: User, token: string) => void
  setCurrentAcademicYear: (year: AcademicYearOption) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      currentAcademicYear: null,
      setAuth: (user, token) => {
        localStorage.setItem('token', token)
        set({ user, token, isAuthenticated: true, currentAcademicYear: user.current_academic_year ?? null })
      },
      setCurrentAcademicYear: (year) => set({ currentAcademicYear: year }),
      clearAuth: () => {
        localStorage.removeItem('token')
        set({ user: null, token: null, isAuthenticated: false, currentAcademicYear: null })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (s) => ({
        user: s.user,
        token: s.token,
        isAuthenticated: s.isAuthenticated,
        currentAcademicYear: s.currentAcademicYear,
      }),
    },
  ),
)
