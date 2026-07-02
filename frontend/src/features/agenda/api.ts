import api from '@/lib/api'
import type { ApiResponse } from '@/types'
import type { Agenda, AgendaFormData, AgendaPerluDiisi, LearningObjective, ScheduleToday, ScheduleWeek, StudentItem } from './types'

export const agendaApi = {
  getTodaySchedules: () =>
    api.get<ApiResponse<ScheduleToday[]>>('/schedules/today'),

  getThisWeekSchedules: () =>
    api.get<ApiResponse<ScheduleWeek[]>>('/schedules/this-week'),

  getPerluDiisi: () =>
    api.get<ApiResponse<AgendaPerluDiisi[]>>('/agendas/perlu-diisi'),

  getLearningObjectives: (scheduleId: string) =>
    api.get<ApiResponse<LearningObjective[]>>('/learning-objectives', {
      params: { schedule_id: scheduleId },
    }),

  getStudents: (classId: string) =>
    api.get<ApiResponse<StudentItem[]>>('/students', {
      params: { class_id: classId },
    }),

  getMyClasses: () =>
    api.get<{ data: { id: string; label: string }[] }>('/agendas/my-classes'),

  getAgendas: (params: { page?: number; kelas?: string; tanggal_dari?: string; tanggal_sampai?: string } = {}) =>
    api.get<{ data: Agenda[]; meta: { total: number; current_page: number; last_page: number; per_page: number } }>(
      '/agendas', { params },
    ),

  getAgenda: (id: string) =>
    api.get<ApiResponse<Agenda>>(`/agendas/${id}`),

  createAgenda: (data: AgendaFormData) =>
    api.post<ApiResponse<Agenda>>('/agendas', data),

  updateAgenda: (id: string, data: Partial<AgendaFormData>) =>
    api.put<ApiResponse<Agenda>>(`/agendas/${id}`, data),
}
