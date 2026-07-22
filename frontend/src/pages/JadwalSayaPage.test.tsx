import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a) } }))

// jsdom tidak punya createObjectURL/atob-blob; alur unduh PDF memakainya.
beforeEach(() => {
  vi.clearAllMocks()
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:uji')
  globalThis.URL.revokeObjectURL = vi.fn()
})

const { default: JadwalSayaPage } = await import('./JadwalSayaPage')

const SESI_GURU = {
  id: 's1', jam_mulai: '07:00', jam_selesai: '08:30',
  jam_ke_mulai: 1, jam_ke_selesai: 2, ruangan: 'Ruang E1',
  subject: { nama: 'Matematika', kode: 'MTK' }, kelas: 'XII RPL A',
}

function mockMyWeek(payload: Record<string, unknown>) {
  get.mockImplementation((url: string) => {
    if (url === '/schedules/my-week') return Promise.resolve({ data: payload })
    return Promise.resolve({ data: { available: false, base64: null } })
  })
}

describe('JadwalSayaPage', () => {
  it('merender tabel jadwal terstruktur (guru → kolom kelas)', async () => {
    mockMyWeek({ data: { senin: [SESI_GURU] }, hari: ['senin', 'selasa'], role: 'guru', has_pdf: false })

    render(<JadwalSayaPage />)

    expect(await screen.findByText('Matematika')).toBeInTheDocument()
    expect(screen.getByText('Senin')).toBeInTheDocument()
    expect(screen.getByText('XII RPL A')).toBeInTheDocument()
    expect(screen.getByText('Ruang E1')).toBeInTheDocument()
    expect(screen.getByText(/07:00–08:30/)).toBeInTheDocument()
    // Tidak ada iframe PDF lagi — tampilan utama HTML.
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('menampilkan nama guru untuk siswa', async () => {
    const sesiSiswa = { ...SESI_GURU, kelas: undefined, guru: 'Pak Budi' }
    mockMyWeek({ data: { senin: [sesiSiswa] }, hari: ['senin'], role: 'siswa', has_pdf: false })

    render(<JadwalSayaPage />)

    expect(await screen.findByText('Pak Budi')).toBeInTheDocument()
  })

  it('menyembunyikan tombol PDF saat has_pdf false', async () => {
    mockMyWeek({ data: { senin: [SESI_GURU] }, hari: ['senin'], role: 'guru', has_pdf: false })

    render(<JadwalSayaPage />)

    await screen.findByText('Matematika')
    expect(screen.queryByRole('button', { name: /unduh pdf/i })).not.toBeInTheDocument()
  })

  it('menampilkan tombol PDF & fetch preview lazily saat diklik', async () => {
    mockMyWeek({ data: { senin: [SESI_GURU] }, hari: ['senin'], role: 'guru', has_pdf: true })

    render(<JadwalSayaPage />)

    const tombol = await screen.findByRole('button', { name: /unduh pdf/i })
    // PDF belum di-fetch saat load — hanya my-week yang dipanggil.
    expect(get).not.toHaveBeenCalledWith('/schedules/my-pdf?preview=1')

    get.mockImplementation((url: string) => {
      if (url === '/schedules/my-pdf?preview=1') {
        return Promise.resolve({ data: { base64: btoa('%PDF palsu'), filename: 'jadwal.pdf' } })
      }
      return Promise.resolve({ data: { data: { senin: [SESI_GURU] }, hari: ['senin'], role: 'guru', has_pdf: true } })
    })

    await userEvent.click(tombol)
    await waitFor(() => expect(get).toHaveBeenCalledWith('/schedules/my-pdf?preview=1'))
  })

  it('menampilkan keadaan kosong bila tak ada jadwal', async () => {
    mockMyWeek({ data: { senin: [], selasa: [] }, hari: ['senin', 'selasa'], role: 'siswa', has_pdf: false })

    render(<JadwalSayaPage />)

    expect(await screen.findByText(/belum ada jadwal/i)).toBeInTheDocument()
  })

  it('menampilkan pesan galat saat permintaan gagal', async () => {
    get.mockRejectedValue({ response: { data: { message: 'Sesi berakhir.' } } })

    render(<JadwalSayaPage />)

    expect(await screen.findByText('Sesi berakhir.')).toBeInTheDocument()
  })
})
