import api from '@/lib/api'
import type { EwsDetail, EwsMeta, EwsStudent, EwsLevel } from './types'

export const ewsApi = {
  getEws: (params?: { level?: EwsLevel; class_id?: string }) =>
    api.get<{ data: EwsStudent[]; meta: EwsMeta }>('/ews', { params }),

  getEwsDetail: (studentUuid: string) =>
    api.get<{ data: EwsDetail }>(`/ews/${studentUuid}`),
}
