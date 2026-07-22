export type StatusPresensi = 'hadir' | 'sakit' | 'izin' | 'alpha'

export interface PresensiRecord {
  student_id: string
  nama: string
  nis: string
  status: StatusPresensi
  durasi_terlambat: number
  catatan: string | null
  sudah_diisi: boolean
  kesiangan_menit?: number | null
}

export interface PresensiData {
  agenda: {
    id: string
    tanggal: string
    subject: string
    class: string
  }
  records: PresensiRecord[]
  total_siswa: number
  sudah_diisi: boolean
}

export interface PresensiSubmitRecord {
  student_id: string
  status: StatusPresensi
  durasi_terlambat: number
  catatan: string
}
