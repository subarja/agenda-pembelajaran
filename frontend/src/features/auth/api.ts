import api from '@/lib/api'
import type { ApiResponse, User } from '@/types'

export interface LoginPayload {
  identifier: string   // email / NIP / NISN
  password: string
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
