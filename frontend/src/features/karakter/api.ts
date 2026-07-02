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

  // GK25: grid siswa per kelas (dengan foto + nomor absen), dipakai saat filter kelas aktif
  studentsByClass: (classId: string) =>
    api.get<ApiResponse<StudentSearchItem[]>>('/students', { params: { class_id: classId } }),

  // GK32: Nilai Tambah — poin manual langsung final, tidak perlu approval admin
  storeNilaiTambah: (payload: { student_id: string; nilai: number; catatan?: string }) =>
    api.post<ApiResponse<{ id: string }>>('/character-manual-notes/nilai-tambah', payload),
}
