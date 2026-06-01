export type UserRole =
  | 'admin'
  | 'guru'
  | 'wali_kelas'
  | 'siswa'
  | 'wakasek'
  | 'bk'
  | 'orang_tua'

export type UserStatus = 'aktif' | 'nonaktif'

export interface User {
  id: string
  nama: string
  email: string
  role: UserRole
  status: UserStatus
  nomor_hp?: string | null
  foto_url?: string | null
  teacher?: TeacherProfile | null
  student?: StudentProfile | null
}

export interface TeacherProfile {
  id: string
  nip: string | null
  mapel_utama: string | null
  nomor_hp: string | null
}

export interface StudentProfile {
  id: string
  nis: string
  nisn: string | null
  kelas: { tingkat: string; jurusan: string; rombel: string } | null
}

export interface ApiResponse<T> {
  message?: string
  data: T
}

export interface ApiError {
  message: string
  errors?: Record<string, string[]>
}
