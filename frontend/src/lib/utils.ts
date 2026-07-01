import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format tanggal LOKAL sebagai "YYYY-MM-DD" — JANGAN pakai `date.toISOString().slice(0,10)`
// untuk ini. toISOString() mengonversi ke UTC dulu, jadi di zona waktu yang lebih cepat dari
// UTC (WIB/WITA/WIT semua begitu) tanggal bisa mundur 1 hari untuk jam-jam dini hari (mis.
// jam 00:00-06:59 WIB masih dianggap "kemarin" oleh UTC). Selalu pakai fungsi ini untuk
// tanggal hari-ini/pilihan form, supaya konsisten dengan kalender lokal pengguna.
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
