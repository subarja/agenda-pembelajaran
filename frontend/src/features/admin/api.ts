import api from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminTeacher {
  id: string; nama: string; email: string; role: string
  status: string; nip: string; mapel_utama: string; nomor_hp: string | null
}

export interface AdminStudent {
  id: string; nama: string; email: string; status: string
  nis: string; nisn: string | null; angkatan: number | null
  wali_nama: string | null; wali_kontak: string | null
  kelas: { id: string; label: string } | null
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
  id: string; hari: string; jam_mulai: string; jam_selesai: string; aktif: boolean
  kelas: { id: string; label: string }
  mapel: { id: string; nama: string }
  guru:  { id: string; nama: string }
}

export interface AdminAcademicYear {
  id: string; tahun: string; semester: string; aktif: boolean
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

// ── Academic Years ────────────────────────────────────────────────────────────
export const adminApi = {
  // Tahun Ajaran
  getAcademicYears: () => api.get('/admin/academic-years').then(r => r.data.data as AdminAcademicYear[]),
  createAcademicYear: (d: object) => api.post('/admin/academic-years', d).then(r => r.data),
  updateAcademicYear: (id: string, d: object) => api.put(`/admin/academic-years/${id}`, d).then(r => r.data),
  deleteAcademicYear: (id: string) => api.delete(`/admin/academic-years/${id}`).then(r => r.data),

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
  getClasses: () => api.get('/admin/classes').then(r => r.data.data as AdminClass[]),
  createClass: (d: object) => api.post('/admin/classes', d).then(r => r.data),
  updateClass: (id: string, d: object) => api.put(`/admin/classes/${id}`, d).then(r => r.data),
  deleteClass: (id: string) => api.delete(`/admin/classes/${id}`).then(r => r.data),

  // Mata Pelajaran
  getSubjects: () => api.get('/admin/subjects').then(r => r.data.data as AdminSubject[]),
  createSubject: (d: object) => api.post('/admin/subjects', d).then(r => r.data),
  updateSubject: (id: string, d: object) => api.put(`/admin/subjects/${id}`, d).then(r => r.data),
  deleteSubject: (id: string) => api.delete(`/admin/subjects/${id}`).then(r => r.data),

  // Jadwal
  getSchedules: (params?: object) => api.get('/admin/schedules', { params }).then(r => r.data.data as AdminSchedule[]),
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
}
