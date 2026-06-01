import api from '@/lib/api'
import type { ApiResponse } from '@/types'
import type {
  CharacterCategory, CharacterInput, CharacterSummary, StudentSearchItem,
} from './types'

export const karakterApi = {
  getCategories: () =>
    api.get<ApiResponse<CharacterCategory[]>>('/character-categories'),

  storeInput: (payload: {
    student_id: string
    subitem_id: string
    sign?: 'positif' | 'negatif'
    catatan?: string
    agenda_id?: string
  }) => api.post<ApiResponse<{ poin: number; student: string; subitem: string }>>('/character-inputs', payload),

  getInputs: (studentId: string, limit = 20) =>
    api.get<ApiResponse<CharacterInput[]>>('/character-inputs', {
      params: { student_id: studentId, limit },
    }),

  getSummary: (studentId: string) =>
    api.get<ApiResponse<CharacterSummary>>('/character-summary', {
      params: { student_id: studentId },
    }),

  searchStudents: (q: string) =>
    api.get<ApiResponse<StudentSearchItem[]>>('/students', { params: { search: q } }),
}
