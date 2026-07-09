import api from '@/lib/api'

export interface SesiPilihan {
  schedule_id: string
  tanggal: string
  hari: string
  jam_mulai: string
  jam_selesai: string
  kelas: string
  mapel: string | null
  bisa_diajukan: boolean
  alasan_blokir: string | null
}

export interface CalonPengganti {
  id: string
  nama: string
  nip: string | null
  /** Kosong = bebas. Terisi = sudah mengajar/menerima inval pada jam itu. Tidak memblokir. */
  bentrok: string[]
}

export interface InvalSesi {
  tanggal: string
  hari: string
  jam_mulai: string
  jam_selesai: string
  kelas: string
  mapel: string | null
}

export interface Inval {
  id: string
  status: 'diajukan' | 'disetujui' | 'ditolak' | 'dibatalkan' | 'kedaluwarsa'
  status_label: string
  pengaju: string
  pengganti: string
  alasan: string
  pesan: string | null
  link_tugas: string | null
  alasan_penolakan: string | null
  responded_at: string | null
  created_at: string
  sesi: InvalSesi[]
}

/** Kunci sesi yang dipahami backend: "<schedule_uuid>|<Y-m-d>". */
export const sesiKey = (s: { schedule_id: string; tanggal: string }) => `${s.schedule_id}|${s.tanggal}`

export const invalApi = {
  sesiSaya: (tanggalMulai: string, tanggalAkhir: string) =>
    api
      .get<{ data: SesiPilihan[] }>('/inval/sesi-saya', {
        params: { tanggal_mulai: tanggalMulai, tanggal_akhir: tanggalAkhir },
      })
      .then((r) => r.data.data),

  calonPengganti: (sesi: string[]) =>
    api
      .get<{ data: CalonPengganti[] }>('/inval/calon-pengganti', { params: { sesi } })
      .then((r) => r.data.data),

  ajukan: (payload: {
    substitute_teacher_id: string
    alasan: string
    pesan?: string
    link_tugas?: string
    sesi: string[]
  }) => api.post<{ message: string }>('/inval', payload).then((r) => r.data),

  masuk: () => api.get<{ data: Inval[] }>('/inval/masuk').then((r) => r.data.data),
  keluar: () => api.get<{ data: Inval[] }>('/inval/keluar').then((r) => r.data.data),

  setujui: (id: string) => api.put<{ message: string }>(`/inval/${id}/setujui`).then((r) => r.data),
  tolak: (id: string, alasan: string) =>
    api.put<{ message: string }>(`/inval/${id}/tolak`, { alasan_penolakan: alasan }).then((r) => r.data),
  batal: (id: string) => api.put<{ message: string }>(`/inval/${id}/batal`).then((r) => r.data),
}

export interface InvalAdminRow extends Omit<Inval, 'responded_at'> {
  diajukan_pada: string
  dijawab_pada: string | null
  jumlah_sesi: number
}

export const invalAdminApi = {
  list: (params: { status?: string; tanggal_mulai?: string; tanggal_akhir?: string; search?: string; page?: number }) =>
    api
      .get<{
        data: InvalAdminRow[]
        meta: { total: number; current_page: number; last_page: number }
        ringkasan: Record<string, number>
      }>('/admin/inval', { params })
      .then((r) => r.data),
}
