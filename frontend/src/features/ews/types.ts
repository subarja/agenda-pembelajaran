export type EwsLevel = 'hijau' | 'kuning' | 'oranye' | 'merah'

export interface EwsStudent {
  student_id: string
  nama: string
  nis: string
  kelas: string | null
  foto_url?: string | null
  level: EwsLevel
  kehadiran_score: number
  karakter_score: number
  catatan_count: number
  nilai_score: number | null
  warning_count: number
  sedang_ditangani_wali_kelas?: boolean
}

export interface EwsDimension {
  score: number
  warning: number
  total?: number
  hadir?: number
  alpha?: number
  sakit?: number
  izin?: number
  count?: number
}

export interface EwsDetail {
  student: { id: string; nama: string; nis: string; kelas: string | null; foto_url: string | null }
  level: EwsLevel
  dimensions: {
    kehadiran: EwsDimension & { total: number; hadir: number; alpha: number; sakit: number; izin: number }
    karakter:  EwsDimension & { count: number }
    catatan:   { count: number; warning: number }
    nilai:     { score: number | null; count: number; warning: number }
  }
  recent_karakter: {
    kategori: string; subitem: string; poin: number; guru: string; tanggal: string
  }[]
}

export interface EwsMeta {
  total: number
  summary: Record<EwsLevel, number>
}
