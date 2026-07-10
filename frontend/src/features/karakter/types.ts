export type CharacterSifat = 'positif' | 'negatif' | 'keduanya'
export type CharacterSign  = 'positif' | 'negatif'

export interface CharacterSubitem {
  id: string
  kode: string
  deskripsi: string
  bobot: number
  sifat: CharacterSifat
}

export interface CharacterCategory {
  id: string
  nama: string
  subitems: CharacterSubitem[]
}

export interface CharacterInput {
  id: number
  kategori: string
  subitem: string
  poin: number
  sign: CharacterSign
  catatan: string | null
  guru: string
  tanggal: string
}

export interface CharacterSummary {
  student: { id: string; nama: string; nis: string }
  total_poin: number
  per_kategori: { nama: string; total: number; count: number }[]
  total_input: number
}

// 'semua' = seluruh kelas sekolah (Penilaian Karakter); 'diampu' = kelas yang diajar
// atau diwalikelasi guru ybs (Nilai Tambah).
export type KarakterScope = 'semua' | 'diampu'

export interface StudentSearchItem {
  id: string
  nis: string
  nama: string
  kelas: string | null
  foto_url?: string | null
  nomor_absen?: number
}
