import api from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string; nama: string; email: string; role: string; status: string; nomor_hp: string | null
  linked_student?: { id: string; nama: string | null; nis: string; kelas: string | null } | null
}

export interface ImportResult {
  success_count: number; error_count: number; errors: string[]
  // Import siswa: baris yang NIS-nya sudah ada dan hanya dilengkapi field kosongnya.
  completed_count?: number
}

export interface AdminTeacher {
  id: string; nama: string; email: string; role: string
  status: string; nip: string; mapel_utama: string; nomor_hp: string | null
  gelar_depan: string | null; gelar_belakang: string | null; is_bk?: boolean
  foto_url: string | null
}

export interface AdminManualNote {
  id: string; uuid: string; catatan: string; nilai: number | null
  status: 'pending' | 'approved' | 'rejected'
  admin_catatan: string | null; nilai_final: number | null
  student: { id: string; nama: string; nis: string; kelas: string | null }
  teacher: { id: string; nama: string }
  created_at: string
}

export interface AdminStudent {
  id: string; nama: string; email: string; status: string
  nis: string; nisn: string | null; jenis_kelamin: 'L' | 'P' | null; angkatan: number | null
  status_siswa: 'aktif' | 'lulus' | 'pindah' | 'keluar'
  tanggal_keluar: string | null
  wali_nama: string | null; wali_kontak: string | null
  kelas: { id: string; label: string } | null
  foto_url: string | null
}

export interface AdminClass {
  id: string; tingkat: string; jurusan: string; rombel: string
  label: string; wali_kelas: { id: string; nama: string } | null
  tahun_ajaran: string | null; jumlah_siswa: number
}

export interface AdminSubject {
  id: string; kode: string; nama: string; kelompok: string; aktif: boolean
}

export interface AdminSchedule {
  id: string; hari: string; jam_mulai: string; jam_selesai: string; ruangan: string | null; aktif: boolean
  kelas: { id: string; label: string }
  mapel: { id: string; nama: string }
  guru:  { id: string; nama: string }
}

export interface AdminAcademicYear {
  id: string; tahun: string; semester: string; aktif: boolean
  locked: boolean
  tanggal_mulai: string | null; tanggal_selesai: string | null
  wk_kurikulum_gelar_depan: string | null; wk_kurikulum_nama: string | null
  wk_kurikulum_gelar_belakang: string | null; wk_kurikulum_nip: string | null
  kepala_sekolah_gelar_depan: string | null; kepala_sekolah_nama: string | null
  kepala_sekolah_gelar_belakang: string | null; kepala_sekolah_nip: string | null
}

export interface AdminCharacterCategory {
  id: string; nama: string; deskripsi: string | null; aktif: boolean; jumlah_subitem: number
}

export interface AdminCharacterSubitem {
  id: string; kode: string; deskripsi: string; bobot: number; sifat: string; aktif: boolean
  kategori: { id: string; nama: string } | null
}

export interface AdminThreshold {
  id: string; min_point: number; max_point: number | null
  sifat: string; rekomendasi: string; aktif: boolean
  kategori: { id: string; nama: string } | null
}

export interface PromotionPreviewStudent { id: string; nama: string; nis: string }
export interface PromotionPreviewClass {
  id: string; label: string; tingkat: 'X' | 'XI' | 'XII'
  wali_kelas: string | null
  tujuan: string; tujuan_ada: boolean | null
  jumlah_siswa: number
  students: PromotionPreviewStudent[]
}
export interface PromotionPreview {
  source: { id: string; label: string }
  target: { id: string; label: string }
  classes: PromotionPreviewClass[]
}

export interface ClassRoster {
  kelas: AdminClass
  siswa: { id: string; nama: string; nis: string; status: 'aktif' | 'naik' | 'tinggal' | 'lulus' | 'pindah' }[]
}

export interface ScheduleCopyPreview {
  source: { id: string; label: string }
  target: { id: string; label: string }
  jumlah_jadwal: number
  kelas_cocok: number
  tanpa_padanan: string[]
}

// ── Academic Years ────────────────────────────────────────────────────────────
export const adminApi = {
  // Tahun Ajaran
  getAcademicYears: () => api.get('/admin/academic-years').then(r => r.data.data as AdminAcademicYear[]),
  createAcademicYear: (d: object) => api.post('/admin/academic-years', d).then(r => r.data),
  updateAcademicYear: (id: string, d: object) => api.put(`/admin/academic-years/${id}`, d).then(r => r.data),
  deleteAcademicYear: (id: string) => api.delete(`/admin/academic-years/${id}`).then(r => r.data),

  // Wizard Naik Kelas
  getPromotionPreview: (sourceId: string, targetId: string) =>
    api.get('/admin/promotion/preview', { params: { source_academic_year_id: sourceId, target_academic_year_id: targetId } })
      .then(r => r.data.data as PromotionPreview),
  executePromotion: (d: { source_academic_year_id: string; target_academic_year_id: string; tinggal: Record<string, string[]> }) =>
    api.post('/admin/promotion/execute', d).then(r => r.data),

  // Salin Jadwal antar semester
  getScheduleCopyPreview: (sourceId: string) =>
    api.get('/admin/schedules/copy-preview', { params: { source_academic_year_id: sourceId } })
      .then(r => r.data.data as ScheduleCopyPreview),
  copySchedules: (sourceId: string) =>
    api.post('/admin/schedules/copy-from', { source_academic_year_id: sourceId }).then(r => r.data),

  // Guru
  getTeachers: (params?: object) => api.get('/admin/teachers', { params }).then(r => r.data as { data: AdminTeacher[]; meta: any }),
  createTeacher: (d: object) => api.post('/admin/teachers', d).then(r => r.data),
  updateTeacher: (id: string, d: object) => api.put(`/admin/teachers/${id}`, d).then(r => r.data),
  deleteTeacher: (id: string) => api.delete(`/admin/teachers/${id}`).then(r => r.data),

  // Siswa
  getStudents: (params?: object) => api.get('/admin/students', { params }).then(r => r.data as { data: AdminStudent[]; meta: any }),
  createStudent: (d: object) => api.post('/admin/students', d).then(r => r.data),
  updateStudent: (id: string, d: object) => api.put(`/admin/students/${id}`, d).then(r => r.data),
  deleteStudent: (id: string) => api.delete(`/admin/students/${id}`).then(r => r.data),

  // Kelas
  getClasses: (params?: { academic_year_id?: string }) =>
    api.get('/admin/classes', { params }).then(r => r.data.data as AdminClass[]),
  getClassRoster: (id: string) =>
    api.get(`/admin/classes/${id}/roster`).then(r => r.data.data as ClassRoster),
  createClass: (d: object) => api.post('/admin/classes', d).then(r => r.data),
  updateClass: (id: string, d: object) => api.put(`/admin/classes/${id}`, d).then(r => r.data),
  deleteClass: (id: string) => api.delete(`/admin/classes/${id}`).then(r => r.data),

  // Mata Pelajaran
  getSubjects: () => api.get('/admin/subjects').then(r => r.data.data as AdminSubject[]),
  createSubject: (d: object) => api.post('/admin/subjects', d).then(r => r.data),
  updateSubject: (id: string, d: object) => api.put(`/admin/subjects/${id}`, d).then(r => r.data),
  deleteSubject: (id: string) => api.delete(`/admin/subjects/${id}`).then(r => r.data),

  // Jadwal
  getSchedules: (params?: object) => api.get('/admin/schedules', { params }).then(r => r.data as { data: AdminSchedule[]; meta: any }),
  createSchedule: (d: object) => api.post('/admin/schedules', d).then(r => r.data),
  updateSchedule: (id: string, d: object) => api.put(`/admin/schedules/${id}`, d).then(r => r.data),
  deleteSchedule: (id: string) => api.delete(`/admin/schedules/${id}`).then(r => r.data),

  // Karakter - Kategori
  getCharacterCategories: () => api.get('/admin/character-categories').then(r => r.data.data as AdminCharacterCategory[]),
  createCharacterCategory: (d: object) => api.post('/admin/character-categories', d).then(r => r.data),
  updateCharacterCategory: (id: string, d: object) => api.put(`/admin/character-categories/${id}`, d).then(r => r.data),
  deleteCharacterCategory: (id: string) => api.delete(`/admin/character-categories/${id}`).then(r => r.data),

  // Karakter - Sub-item
  getCharacterSubitems: (params?: object) => api.get('/admin/character-subitems', { params }).then(r => r.data.data as AdminCharacterSubitem[]),
  createCharacterSubitem: (d: object) => api.post('/admin/character-subitems', d).then(r => r.data),
  updateCharacterSubitem: (id: string, d: object) => api.put(`/admin/character-subitems/${id}`, d).then(r => r.data),
  deleteCharacterSubitem: (id: string) => api.delete(`/admin/character-subitems/${id}`).then(r => r.data),

  // Ambang Tindakan
  getThresholds: () => api.get('/admin/action-thresholds').then(r => r.data.data as AdminThreshold[]),
  createThreshold: (d: object) => api.post('/admin/action-thresholds', d).then(r => r.data),
  updateThreshold: (id: string, d: object) => api.put(`/admin/action-thresholds/${id}`, d).then(r => r.data),
  deleteThreshold: (id: string) => api.delete(`/admin/action-thresholds/${id}`).then(r => r.data),

  // Pengguna (admin, bk, orang_tua)
  getAdminUsers: (params?: object) => api.get('/admin/users', { params }).then(r => r.data as { data: AdminUser[]; meta: any }),
  createAdminUser: (d: object) => api.post('/admin/users', d).then(r => r.data),
  updateAdminUser: (id: string, d: object) => api.put(`/admin/users/${id}`, d).then(r => r.data),
  deleteAdminUser: (id: string) => api.delete(`/admin/users/${id}`).then(r => r.data),

  // Nilai Manual (character_manual_notes)
  getManualNotes: (params?: object) => api.get('/admin/character-manual-notes', { params }).then(r => r.data as { data: AdminManualNote[]; meta: any }),
  reviewManualNote: (uuid: string, d: { action: 'approve' | 'reject' | 'adjust'; nilai_final?: number | null; admin_catatan?: string }) =>
    api.put(`/admin/character-manual-notes/${uuid}/review`, d).then(r => r.data),

  // Import Excel
  importData: (entity: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/admin/import/${entity}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data as ImportResult)
  },

  // Template download
  downloadTemplate: async (entity: string) => {
    const res = await api.get(`/admin/template/${entity}`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a   = document.createElement('a')
    a.href    = url
    a.download = `template_${entity}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  },

  // Format Import Data Guru (guru + wali kelas + program keahlian, 3 sheet dalam 1 file)
  downloadDapodikGuruTemplate: async () => {
    const res = await api.get('/admin/import/dapodik-guru/template', { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a   = document.createElement('a')
    a.href    = url
    a.download = 'Format Import Data Guru.xlsx'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  },
}
