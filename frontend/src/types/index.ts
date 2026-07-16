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
  must_change_password?: boolean
  teacher?: TeacherProfile | null
  student?: StudentProfile | null
  linked_student?: LinkedStudentProfile | null
  kapabilitas?: Kapabilitas | null
  current_academic_year?: AcademicYearOption | null
  pkl?: PklStatus | null
  kokurikuler?: KokurikulerStatus | null
}

export interface PklStatus {
  mode_aktif: boolean
  is_pembimbing: boolean
}

export interface KokurikulerStatus {
  aktif: boolean
  is_fasilitator: boolean
  is_peserta: boolean
}

export interface AcademicYearOption {
  id: string
  tahun: string
  semester: 'ganjil' | 'genap'
  label: string
  aktif?: boolean
  // TA arsip (non-aktif) baca-saja kecuali admin membuka saklar tulis arsip.
  tulis_diizinkan?: boolean
}

export interface TeacherProfile {
  id: string
  nip: string | null
  mapel_utama: string | null
  nomor_hp: string | null
  gelar_depan: string | null
  gelar_belakang: string | null
  is_bk?: boolean
}

export interface Kapabilitas {
  is_bk: boolean
  is_wali_kelas: boolean
  wali_kelas_class: { id: string; label: string } | null
}

export interface StudentProfile {
  id: string
  nis: string
  nisn: string | null
  kelas: { tingkat: string; jurusan: string; rombel: string; label: string } | null
  foto_url: string | null
}

export interface LinkedStudentProfile {
  id: string
  nama: string | null
  nis: string
  nisn: string | null
  kelas: { tingkat: string; jurusan: string; rombel: string; label: string } | null
}

export interface ApiResponse<T> {
  message?: string
  data: T
}

export interface ApiError {
  message: string
  errors?: Record<string, string[]>
}
