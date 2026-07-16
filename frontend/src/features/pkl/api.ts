import api from '@/lib/api'
import type { ApiResponse } from '@/types'

// ── Tipe ────────────────────────────────────────────────────────────────────
export interface PklClass {
  id: string
  label: string
  jumlah_siswa: number
  // 'pembimbing' = penugasan bimbingan; 'pengajar' = ber-ploting jadwal di kelas XII itu
  sebagai?: 'pembimbing' | 'pengajar'
}

export interface PklStudentRow {
  id: string
  nama: string
  nisn: string | null
  tempat_pkl: string
  alamat_pkl: string
  mulai: string | null
  selesai: string | null
}

export interface PklWeek {
  minggu_mulai: string
  label: string
  terisi: boolean
  agenda_id: string | null
  sudah_mulai: boolean
  deadline: string
  lewat_batas: boolean
}

export interface PklObjectiveOption {
  id: string
  deskripsi: string
  lingkup: string
}

export interface PklDay {
  nama: string
  tanggal: string
}

export interface PklAgendaStudent {
  id: string
  nis: string
  nama: string
  presensi: Record<string, string | null>
}

export interface PklAgendaForm {
  class: { id: string; label: string }
  minggu: string
  hari: PklDay[]
  objectives: PklObjectiveOption[]
  agenda: { id: string | null; catatan: string; objectives: string[] }
  students: PklAgendaStudent[]
}

// Data admin
export interface PklAdminObjective {
  id: string
  deskripsi: string
  jurusan: string | null
  aktif: boolean
}

export interface PklPlacementRow {
  id: string
  nama: string | null
  nisn: string | null
  class_id: string | null
  kelas: string | null
  tempat_pkl: string
  alamat_pkl: string | null
  mulai: string | null
  selesai: string | null
  pembimbing: string | null
}

export interface PklImportResult {
  success_count: number
  error_count: number
  errors: string[]
}

// ── Unduh biner (Excel / template) ──────────────────────────────────────────
// Saat server menolak (mis. 404 "Tidak ada data PKL untuk diunduh"), body error
// berupa blob JSON — parse dulu supaya pemanggil bisa menampilkan pesannya.
async function downloadBlob(url: string, filename: string) {
  let res
  try {
    res = await api.get(url, { responseType: 'blob' })
  } catch (err: unknown) {
    const blob = (err as { response?: { data?: Blob } })?.response?.data
    if (blob instanceof Blob) {
      const parsed = await blob.text().then((t) => JSON.parse(t)).catch(() => null)
      if (parsed?.message) throw new Error(parsed.message)
    }
    throw err
  }
  const blob = new Blob([res.data])
  const href = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 60_000)
}

// ── API guru pembimbing ─────────────────────────────────────────────────────
export const pklApi = {
  overview: () =>
    api.get<ApiResponse<{ mode_aktif: boolean; classes: PklClass[] }>>('/pkl/overview'),

  myStudents: (classId?: string) =>
    api.get<ApiResponse<PklStudentRow[]>>('/pkl/my-students', { params: classId ? { class_id: classId } : {} }),

  weeks: (classId: string) =>
    api.get<ApiResponse<{ class: { id: string; label: string }; weeks: PklWeek[] }>>('/pkl/weeks', {
      params: { class_id: classId },
    }),

  agenda: (classId: string, minggu: string) =>
    api.get<ApiResponse<PklAgendaForm>>('/pkl/agenda', { params: { class_id: classId, minggu } }),

  saveAgenda: (payload: {
    class_id: string
    minggu: string
    catatan: string
    objective_ids: string[]
    presensi: { student_id: string; tanggal: string; status: string }[]
  }) => api.post<ApiResponse<{ id: string }>>('/pkl/agenda', payload),

  downloadStudents: (classId: string, filename: string) =>
    downloadBlob(`/pkl/students/export?class_id=${classId}&format=excel`, filename),

  downloadRekap: (classId: string, filename: string) =>
    downloadBlob(`/pkl/rekap-absen/export?class_id=${classId}&format=excel`, filename),
}

// ── API admin ───────────────────────────────────────────────────────────────
export const pklAdminApi = {
  getSetting: () => api.get<ApiResponse<{ aktif: boolean }>>('/admin/pkl/setting'),
  setSetting: (aktif: boolean) => api.put('/admin/pkl/setting', { aktif }),

  getObjectives: () =>
    api.get<{ data: PklAdminObjective[]; jurusans: string[] }>('/admin/pkl/objectives'),
  createObjective: (d: { deskripsi: string; jurusan: string | null }) => api.post('/admin/pkl/objectives', d),
  updateObjective: (id: string, d: { deskripsi: string; jurusan: string | null; aktif?: boolean }) =>
    api.put(`/admin/pkl/objectives/${id}`, d),
  deleteObjective: (id: string) => api.delete(`/admin/pkl/objectives/${id}`),

  getPlacements: (classId?: string) =>
    api.get<ApiResponse<PklPlacementRow[]>>('/admin/pkl/placements', { params: classId ? { class_id: classId } : {} }),
  deletePlacement: (id: string) => api.delete(`/admin/pkl/placements/${id}`),
  importPlacements: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<PklImportResult>('/admin/pkl/placements/import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  downloadTemplate: () => downloadBlob('/admin/pkl/placements/template', 'template_pkl.xlsx'),
  downloadRekap: (classId: string, filename: string) =>
    downloadBlob(`/pkl/rekap-absen/export?class_id=${classId}&format=excel`, filename),
}
