import api from '@/lib/api'
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

  logout: () =>
    api.post('/auth/logout'),
}

export const academicYearApi = {
  pilihan: () =>
    api.get<ApiResponse<AcademicYearOption[]>>('/academic-years/pilihan'),

  pilih: (academic_year_id: string) =>
    api.post<ApiResponse<User>>('/academic-years/pilih', { academic_year_id }),
}
