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
  placement_id: string
  id: string
  nama: string
  nis: string | null
  nisn: string | null
  telpon: string | null
  wa: string | null
  belum_diplot: boolean
  tempat_pkl: string | null
  alamat_pkl: string
  mulai: string | null
  selesai: string | null
  class_id: string | null
  kelas: string | null
  // Rekap kehadiran per industri (per penempatan)
  hadir: number
  sakit: number
  izin: number
  alpha: number
  hari_kerja: number
  pct_hadir: number
}

export interface PklWeek {
  minggu_mulai: string
  label: string
  classes: { label: string; jumlah_siswa: number }[]
  total_siswa: number
  terisi: boolean
  bisa_diisi: boolean
  sebelum_jumat: boolean
  lewat_batas: boolean
  deadline: string
}

export interface PklObjectiveOption {
  id: string
  kode: string | null
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
  kelas: string | null
  telpon: string | null
  presensi: Record<string, string | null>
}

export interface PklAgendaForm {
  minggu: string
  hari: PklDay[]
  objectives: PklObjectiveOption[]
  agenda: { catatan: string; objectives: string[] }
  students: PklAgendaStudent[]
}

// Data admin
export interface PklAdminObjective {
  id: string
  kode: string | null
  deskripsi: string
  jurusan: string | null
  aktif: boolean
}

export interface PklPlacementRow {
  id: string
  nama: string | null
  nis: string | null
  nisn: string | null
  telpon: string | null
  class_id: string | null
  kelas: string | null
  tempat_pkl: string
  alamat_pkl: string | null
  mulai: string | null
  selesai: string | null
  pembimbing: string | null
}

export interface PklPendingMatch {
  key: string
  siswa: string | null
  kelas: string | null
  tempat_baru: string
  tempat_lama: string
}

export interface PklImportResult {
  success_count: number
  error_count: number
  errors: string[]
  // Perusahaan MIRIP yang ditahan — admin memutuskan: timpa atau perusahaan baru.
  pending_matches?: PklPendingMatch[]
}

export interface PklPlacementPayload {
  tempat_pkl: string
  alamat_pkl?: string | null
  telpon?: string | null
  tanggal_mulai: string
  tanggal_selesai: string
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

  // Agenda PKL kini AGREGAT: satu daftar minggu untuk semua kelas bimbingan sekaligus.
  weeks: () =>
    api.get<ApiResponse<{ weeks: PklWeek[] }>>('/pkl/weeks'),

  agenda: (minggu: string) =>
    api.get<ApiResponse<PklAgendaForm>>('/pkl/agenda', { params: { minggu } }),

  saveAgenda: (payload: {
    minggu: string
    catatan: string
    objective_ids: string[]
    presensi: { student_id: string; tanggal: string; status: string }[]
  }) => api.post<ApiResponse<null>>('/pkl/agenda', payload),

  downloadStudents: (classId: string | null, filename: string) =>
    downloadBlob(`/pkl/students/export?${classId ? `class_id=${classId}&` : ''}format=excel`, filename),

  // Edit & tambah tempat PKL oleh pembimbing (siswa bimbingannya sendiri).
  updatePlacement: (placementId: string, d: PklPlacementPayload) =>
    api.put(`/pkl/placements/${placementId}`, d),
  createPlacement: (d: PklPlacementPayload & { student_id: string }) =>
    api.post('/pkl/placements', d),

  downloadRekap: (classId: string, filename: string) =>
    downloadBlob(`/pkl/rekap-absen/export?class_id=${classId}&format=excel`, filename),
}

// ── API admin ───────────────────────────────────────────────────────────────
export const pklAdminApi = {
  getSetting: () => api.get<ApiResponse<{ aktif: boolean }>>('/admin/pkl/setting'),
  setSetting: (aktif: boolean) => api.put('/admin/pkl/setting', { aktif }),

  getObjectives: () =>
    api.get<{ data: PklAdminObjective[]; jurusans: string[] }>('/admin/pkl/objectives'),
  createObjective: (d: { kode?: string | null; deskripsi: string; jurusan: string | null }) => api.post('/admin/pkl/objectives', d),
  updateObjective: (id: string, d: { kode?: string | null; deskripsi: string; jurusan: string | null; aktif?: boolean }) =>
    api.put(`/admin/pkl/objectives/${id}`, d),
  deleteObjective: (id: string) => api.delete(`/admin/pkl/objectives/${id}`),

  getPlacements: (classId?: string) =>
    api.get<ApiResponse<PklPlacementRow[]>>('/admin/pkl/placements', { params: classId ? { class_id: classId } : {} }),
  deletePlacement: (id: string) => api.delete(`/admin/pkl/placements/${id}`),
  importPlacements: (file: File, decisions?: Record<string, 'timpa' | 'baru'>) => {
    const fd = new FormData()
    fd.append('file', file)
    if (decisions) fd.append('decisions', JSON.stringify(decisions))
    return api.post<PklImportResult>('/admin/pkl/placements/import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  createPlacement: (d: PklPlacementPayload & { nisn?: string; nis?: string; pembimbing: string }) =>
    api.post('/admin/pkl/placements', d),
  updatePlacement: (id: string, d: PklPlacementPayload & { pembimbing?: string | null }) =>
    api.put(`/admin/pkl/placements/${id}`, d),
  exportPlacements: () => downloadBlob('/admin/pkl/placements/export', 'peserta_pkl.xlsx'),
  downloadTemplate: () => downloadBlob('/admin/pkl/placements/template', 'template_pkl.xlsx'),
  downloadRekap: (classId: string, filename: string) =>
    downloadBlob(`/pkl/rekap-absen/export?class_id=${classId}&format=excel`, filename),
}
