import api from '@/lib/api'
import type { ApiResponse } from '@/types'
import type {
  CharacterCategory, CharacterInput, CharacterSummary, KarakterScope, StudentSearchItem,
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

  // Pemilih kelas: 'semua' untuk Penilaian Karakter (lintas kelas), 'diampu' untuk
  // Nilai Tambah. Backend yang menentukan isinya — lihat CharacterController::classes().
  getClasses: (scope: KarakterScope) =>
    api.get<ApiResponse<{ id: string; label: string }[]>>('/character/classes', { params: { scope } }),

  // GK25: grid siswa per kelas (dengan foto + nomor absen), dipakai saat filter kelas aktif.
  // Selalu /character/students, termasuk untuk Nilai Tambah: daftar kelas yang ditawarkan
  // sudah dipersempit backend, dan gerbang sesungguhnya ada di storeNilaiTambah(). Memakai
  // /students di sini justru salah — guru inval akan ditolak membaca daftar absen kelas
  // yang boleh ia nilai.
  studentsByClass: (classId: string) =>
    api.get<ApiResponse<StudentSearchItem[]>>('/character/students', { params: { class_id: classId } }),

  // GK32: Nilai Tambah — poin manual langsung final, tidak perlu approval admin
  storeNilaiTambah: (payload: { student_id: string; nilai: number; catatan?: string }) =>
    api.post<ApiResponse<{ id: string }>>('/character-manual-notes/nilai-tambah', payload),
}
