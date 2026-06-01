import api from '@/lib/api'
import type { ApiResponse } from '@/types'
import type { Agenda, AgendaFormData, LearningObjective, ScheduleToday, StudentItem } from './types'

export const agendaApi = {
  getTodaySchedules: () =>
    api.get<ApiResponse<ScheduleToday[]>>('/schedules/today'),

  getLearningObjectives: (scheduleId: string) =>
    api.get<ApiResponse<LearningObjective[]>>('/learning-objectives', {
      params: { schedule_id: scheduleId },
    }),

  getStudents: (classId: string) =>
    api.get<ApiResponse<StudentItem[]>>('/students', {
      params: { class_id: classId },
    }),

  getAgendas: (page = 1) =>
    api.get<{ data: Agenda[]; meta: { total: number; current_page: number; last_page: number } }>(
      '/agendas', { params: { page } },
    ),

  getAgenda: (id: string) =>
    api.get<ApiResponse<Agenda>>(`/agendas/${id}`),

  createAgenda: (data: AgendaFormData) =>
    api.post<ApiResponse<Agenda>>('/agendas', data),

  updateAgenda: (id: string, data: Partial<AgendaFormData>) =>
    api.put<ApiResponse<Agenda>>(`/agendas/${id}`, data),
}
