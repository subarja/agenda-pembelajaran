import api from '@/lib/api'

export interface PreferenceType {
  key: string
  label: string
  enabled: boolean
}

export interface NotificationPreferences {
  push_enabled: boolean
  types: PreferenceType[]
  quiet_hours_enabled: boolean
  quiet_start: string
  quiet_end: string
}

export interface PushDevice {
  id: number
  device_label: string
  last_used_at: string | null
  token_hint: string
}

export interface FcmSettings {
  service_account_set: boolean
  service_account_email: string | null
  project_id: string | null
  web_api_key: string | null
  web_app_id: string | null
  messaging_sender_id: string | null
  vapid_public_key: string | null
  aktif: boolean
  is_configured: boolean
  total_perangkat: number
}

export interface FcmSettingsPayload {
  service_account_json?: string
  web_api_key?: string
  web_app_id?: string
  messaging_sender_id?: string
  vapid_public_key?: string
  aktif?: boolean
}

export const notifikasiApi = {
  getPreferences: () =>
    api.get<{ data: NotificationPreferences }>('/notification-preferences').then((r) => r.data.data),

  // Kirim hanya field yang berubah — backend menggabungkan `types` dengan yang tersimpan,
  // jadi satu toggle tidak menghapus toggle lain.
  updatePreferences: (payload: Partial<Omit<NotificationPreferences, 'types'>> & { types?: Record<string, boolean> }) =>
    api.put<{ message: string }>('/notification-preferences', payload).then((r) => r.data),

  getDevices: () => api.get<{ data: PushDevice[] }>('/push/devices').then((r) => r.data.data),

  deleteDevice: (id: number) => api.delete<{ message: string }>(`/push/devices/${id}`).then((r) => r.data),
}

export const fcmAdminApi = {
  getSettings: () => api.get<{ data: FcmSettings }>('/admin/fcm/settings').then((r) => r.data.data),

  updateSettings: (payload: FcmSettingsPayload) =>
    api.put<{ message: string }>('/admin/fcm/settings', payload).then((r) => r.data),

  test: () => api.post<{ message: string }>('/admin/fcm/test').then((r) => r.data),
}
