import api from '@/lib/api'
import type { ApiResponse } from '@/types'
import type { PresensiData, PresensiSubmitRecord } from './types'

export const presensiApi = {
  getPresensi: (agendaId: string) =>
    api.get<ApiResponse<PresensiData>>(`/agendas/${agendaId}/presensi`),

  submitPresensi: (agendaId: string, records: PresensiSubmitRecord[]) =>
    api.post<ApiResponse<{
      hadir: number; alpha: number; sakit: number; izin: number
      alerts: { student_id: string; nama: string; streak: number; pesan: string }[]
    }>>(
      `/agendas/${agendaId}/presensi`,
      { records },
    ),
}
