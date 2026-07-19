import api from '@/lib/api'
import type { ApiResponse } from '@/types'

// ── Tipe ─────────────────────────────────────────────────────────────────────

export interface KkHari {
  tanggal: string
  label: string
}

export interface KkKelas {
  id: string
  label: string
  jumlah_siswa: number
}

export interface KkProject {
  id: string
  judul: string
  tema: string | null
  tingkat: string | null
  tujuan: string | null
  status: 'aktif' | 'selesai'
  tanggal_mulai: string
  tanggal_selesai: string
  hari: KkHari[]
  classes: KkKelas[]
}

export type KkLevel = 'SB' | 'B' | 'C' | 'K'

export interface KkDimensiProjek {
  id: string
  nama: string
  aspek: string | null
  subdimensi: string[]
}

export interface KkNilaiStudent {
  id: string
  nis: string
  nama: string
  nilai: Record<string, { level: KkLevel; catatan: string | null } | null>
}

export interface KkAbsenStudent {
  id: string
  nis: string
  nama: string
  status: string | null
}

export interface KkLaporanRow {
  tanggal: string
  label: string
  isi: string | null
}

export interface KkRefleksiStudent {
  id: string
  nis: string
  nama: string
  isi: string | null
}

export interface KkAnggota {
  id: string
  nis?: string
  nama: string
}

export interface KkDokumen {
  id: string
  judul: string
  url: string
  oleh: string | null
  milik_saya: boolean
  created_at: string | null
}

export interface KkTeam {
  nomor: number
  nama: string | null
  anggota: KkAnggota[]
  dokumen: KkDokumen[]
}

export interface KkTeamBoard {
  kelas: string
  teams: KkTeam[]
  unassigned: KkAnggota[]
}

export interface KkSaya {
  project: {
    id: string
    judul: string
    tema: string | null
    deskripsi: string | null
    status: string
    tanggal_mulai: string
    tanggal_selesai: string
    hari: KkHari[]
  } | null
  refleksi_harian?: Record<string, string>
  refleksi_akhir?: string | null
  tim?: {
    nomor: number
    nama: string | null
    anggota: KkAnggota[]
    dokumen: KkDokumen[]
  } | null
}

export interface KkAdminProjectClass {
  id: string
  label: string
  fasilitator: string | null
  fasilitator_user_id: string | null
  wali_adalah_fasilitator: boolean
}

export interface KkAdminProjectDimensi {
  dimension_id: number
  nama: string | null
  aspek: string | null
  subdimension_ids: number[]
}

export interface KkAdminProject {
  id: string
  judul: string
  tema: string | null
  tingkat: string | null
  tujuan: string | null
  deskripsi: string | null
  status: 'draft' | 'aktif' | 'selesai'
  tanggal_mulai: string
  tanggal_selesai: string
  tahun_ajaran: string | null
  classes: KkAdminProjectClass[]
  dimensi: KkAdminProjectDimensi[]
}

export interface KkMasterDimension {
  id: number
  kode: string
  nama: string
  deskripsi: string | null
  aktif: boolean
  subdimensions: { id: number; nama: string }[]
}

export interface KkTeacherOption {
  id: string
  nama: string
  nip: string | null
}

export interface KkImportResult {
  success_count: number
  error_count: number
  errors: string[]
}

export interface KkAdminProjectPayload {
  judul: string
  tema: string | null
  tingkat: string | null
  tujuan: string | null
  deskripsi: string | null
  tanggal_mulai: string
  tanggal_selesai: string
  status: 'draft' | 'aktif' | 'selesai'
  classes: { id: string; fasilitator_user_id: string | null }[]
  dimensi: { dimension_id: number; aspek: string | null; subdimension_ids: number[] }[]
}

export interface KkRekap {
  project: KkAdminProject
  hari: KkHari[]
  classes: {
    id: string
    label: string
    fasilitator: string
    jumlah_siswa: number
    jumlah_tim: number
    dokumen: number
    absen: Record<string, number>
    laporan: Record<string, boolean>
    refleksi: Record<string, number>
    refleksi_akhir: number
    nilai_terisi: number
    nilai_total: number
  }[]
}

// ── Unduh biner (Excel) — body error berupa blob JSON, parse dulu ────────────
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

// ── API fasilitator & siswa ──────────────────────────────────────────────────
export const kokurikulerApi = {
  overview: () =>
    api.get<ApiResponse<{ projects: KkProject[] }>>('/kokurikuler/overview'),

  absen: (projectId: string, classId: string, tanggal: string) =>
    api.get<ApiResponse<{ kelas: string; tanggal: string; students: KkAbsenStudent[] }>>('/kokurikuler/absen', {
      params: { project_id: projectId, class_id: classId, tanggal },
    }),

  simpanAbsen: (payload: {
    project_id: string
    class_id: string
    tanggal: string
    records: { student_id: string; status: string }[]
  }) => api.post('/kokurikuler/absen', payload),

  laporan: (projectId: string, classId: string) =>
    api.get<ApiResponse<{ kelas: string; laporan: KkLaporanRow[] }>>('/kokurikuler/laporan', {
      params: { project_id: projectId, class_id: classId },
    }),

  simpanLaporan: (payload: { project_id: string; class_id: string; tanggal: string; isi: string }) =>
    api.post('/kokurikuler/laporan', payload),

  refleksi: (projectId: string, classId: string, jenis: 'harian' | 'akhir', tanggal?: string) =>
    api.get<ApiResponse<{ kelas: string; terisi: number; students: KkRefleksiStudent[] }>>('/kokurikuler/refleksi', {
      params: { project_id: projectId, class_id: classId, jenis, tanggal },
    }),

  tim: (projectId: string, classId: string) =>
    api.get<ApiResponse<KkTeamBoard>>('/kokurikuler/tim', {
      params: { project_id: projectId, class_id: classId },
    }),

  simpanTim: (payload: {
    project_id: string
    class_id: string
    jumlah_tim: number
    teams: { nomor: number; nama?: string | null }[]
    assignments: { student_id: string; nomor: number | null }[]
  }) => api.post<ApiResponse<KkTeamBoard>>('/kokurikuler/tim', payload),

  nilai: (projectId: string, classId: string) =>
    api.get<ApiResponse<{ kelas: string; dimensi: KkDimensiProjek[]; students: KkNilaiStudent[] }>>('/kokurikuler/nilai', {
      params: { project_id: projectId, class_id: classId },
    }),

  simpanNilai: (payload: {
    project_id: string
    class_id: string
    nilai: { student_id: string; dimension_id: string; level: KkLevel | null; catatan?: string | null }[]
  }) => api.post('/kokurikuler/nilai', payload),

  downloadNilaiExcel: (projectId: string, classId: string, filename: string) =>
    downloadBlob(`/kokurikuler/nilai/export?project_id=${projectId}&class_id=${classId}&format=excel`, filename),

  nilaiPdfUrl: (projectId: string, classId: string) =>
    `/kokurikuler/nilai/export?project_id=${projectId}&class_id=${classId}&format=pdf`,

  saya: () => api.get<ApiResponse<KkSaya>>('/kokurikuler/saya'),

  simpanRefleksi: (payload: { project_id: string; jenis: 'harian' | 'akhir'; tanggal?: string; isi: string }) =>
    api.post('/kokurikuler/refleksi', payload),

  tambahDokumen: (payload: { project_id: string; judul: string; url: string }) =>
    api.post('/kokurikuler/dokumen', payload),

  hapusDokumen: (id: string) => api.delete(`/kokurikuler/dokumen/${id}`),
}

// ── API admin ────────────────────────────────────────────────────────────────
export const kokurikulerAdminApi = {
  projects: () => api.get<ApiResponse<KkAdminProject[]>>('/admin/kokurikuler/projects'),

  // Seluruh program (semua tahun ajaran) dalam 1 workbook 3 sheet — beda dari
  // downloadAbsen/downloadNilaiExcel yang isinya satu projek saja.
  downloadProjects: (filename: string) =>
    downloadBlob('/admin/kokurikuler/projects/export', filename),

  createProject: (d: KkAdminProjectPayload) => api.post('/admin/kokurikuler/projects', d),

  updateProject: (id: string, d: KkAdminProjectPayload) => api.put(`/admin/kokurikuler/projects/${id}`, d),

  deleteProject: (id: string) => api.delete(`/admin/kokurikuler/projects/${id}`),

  teacherOptions: () => api.get<ApiResponse<KkTeacherOption[]>>('/admin/kokurikuler/teacher-options'),

  fasilitatorReset: (id: string) => api.post(`/admin/kokurikuler/projects/${id}/fasilitator-reset`),

  downloadFasilitatorTemplate: (id: string) =>
    downloadBlob(`/admin/kokurikuler/projects/${id}/fasilitator-template`, 'template_fasilitator_kokurikuler.xlsx'),

  importFasilitator: (id: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<KkImportResult>(`/admin/kokurikuler/projects/${id}/fasilitator-import`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },

  dimensions: () => api.get<ApiResponse<KkMasterDimension[]>>('/admin/kokurikuler/dimensions'),
  downloadDimensionTemplate: () =>
    downloadBlob('/admin/kokurikuler/dimensions/template', 'template_dimensi_kokurikuler.xlsx'),
  importDimensions: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<KkImportResult>('/admin/kokurikuler/dimensions/import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },
  createDimension: (d: { nama: string; deskripsi: string | null; subdimensions: string[] }) =>
    api.post('/admin/kokurikuler/dimensions', d),
  updateDimension: (id: number, d: { nama: string; deskripsi: string | null; aktif?: boolean; subdimensions: string[] }) =>
    api.put(`/admin/kokurikuler/dimensions/${id}`, d),
  deleteDimension: (id: number) => api.delete(`/admin/kokurikuler/dimensions/${id}`),

  rekap: (id: string) => api.get<ApiResponse<KkRekap>>(`/admin/kokurikuler/projects/${id}/rekap`),

  downloadAbsen: (id: string, filename: string) =>
    downloadBlob(`/admin/kokurikuler/projects/${id}/export-absen`, filename),

  downloadNilaiExcel: (projectId: string, filename: string) =>
    downloadBlob(`/kokurikuler/nilai/export?project_id=${projectId}&class_id=semua&format=excel`, filename),

  nilaiPdfUrl: (projectId: string) =>
    `/kokurikuler/nilai/export?project_id=${projectId}&class_id=semua&format=pdf`,
}
