import { describe, expect, it } from 'vitest'
import { toLocalDateStr } from './utils'

/**
 * Regresi bug timezone: `toISOString().slice(0,10)` menggeser tanggal MUNDUR satu hari
 * untuk waktu WIB (UTC+7) sebelum pukul 07:00, karena mengonversi ke UTC lebih dulu.
 * `toLocalDateStr()` dibuat sebagai penggantinya dan wajib dipakai untuk semua tanggal
 * baru. Test ini mengunci perilakunya supaya tidak diam-diam kembali ke pola lama.
 */
describe('toLocalDateStr', () => {
  it('memakai tanggal LOKAL, bukan hasil konversi UTC', () => {
    // 00:30 WIB — titik paling rawan. toISOString() akan bilang tanggal 19.
    const dinihariWib = new Date(2026, 6, 20, 0, 30, 0)
    expect(toLocalDateStr(dinihariWib)).toBe('2026-07-20')
  })

  it('tidak bergeser pada batas tengah malam maupun akhir hari', () => {
    expect(toLocalDateStr(new Date(2026, 6, 20, 0, 0, 0))).toBe('2026-07-20')
    expect(toLocalDateStr(new Date(2026, 6, 20, 23, 59, 59))).toBe('2026-07-20')
  })

  it('memberi nol di depan untuk bulan & tanggal satu digit', () => {
    expect(toLocalDateStr(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('benar pada pergantian bulan dan tahun', () => {
    expect(toLocalDateStr(new Date(2026, 11, 31, 22, 0, 0))).toBe('2026-12-31')
    expect(toLocalDateStr(new Date(2027, 0, 1, 1, 0, 0))).toBe('2027-01-01')
  })

  it('menangani tahun kabisat', () => {
    expect(toLocalDateStr(new Date(2028, 1, 29))).toBe('2028-02-29')
  })

  it('berbeda dari toISOString() persis pada kasus yang dulu jadi bug', () => {
    // Membuktikan test ini memang menangkap sesuatu: kalau seseorang mengganti
    // implementasinya kembali ke toISOString(), assertion pertama akan gagal.
    const d = new Date(2026, 6, 20, 3, 0, 0)
    const lewatUtc = d.toISOString().slice(0, 10)
    if (d.getTimezoneOffset() < 0) {
      // Hanya bermakna di zona waktu positif (WIB = UTC+7 → offset -420).
      expect(lewatUtc).not.toBe(toLocalDateStr(d))
    }
    expect(toLocalDateStr(d)).toBe('2026-07-20')
  })
})
