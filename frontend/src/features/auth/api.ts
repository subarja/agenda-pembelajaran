import api from '@/lib/api'
import { teardownPush } from '@/lib/push'
import type { ApiResponse, AcademicYearOption, User } from '@/types'

export interface LoginPayload {
  identifier: string   // email / NIP / NISN
  password: string
  academic_year_id: string
  device_name?: string
}

export interface LoginResponse {
  user: User
  token: string
  token_type: string
}

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<ApiResponse<LoginResponse>>('/auth/login', payload),

  me: () =>
    api.get<ApiResponse<User>>('/auth/me'),

  /**
     * Token push dicabut DI SINI, bukan di keempat tombol logout, supaya tidak ada satu
     * pun jalur keluar yang terlewat. Kalau tidak dicabut, guru berikutnya yang login di
     * HP yang sama akan terus menerima push milik guru sebelumnya — token FCM melekat
     * pada browser, bukan pada sesi.
     *
     * Dijalankan sebelum /auth/logout selagi token Sanctum masih sah, dan kegagalannya
     * tidak boleh menghalangi logout itu sendiri.
     */
  logout: async () => {
    try {
      await teardownPush()
    } catch {
      // Perangkat offline atau izin sudah dicabut — logout tetap harus jalan.
    }

    return api.post('/auth/logout')
  },
}

export const academicYearApi = {
  pilihan: () =>
    api.get<ApiResponse<AcademicYearOption[]>>('/academic-years/pilihan'),

  pilih: (academic_year_id: string) =>
    api.post<ApiResponse<User>>('/academic-years/pilih', { academic_year_id }),
}
