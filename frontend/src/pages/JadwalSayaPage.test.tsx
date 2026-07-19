import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a) } }))

// jsdom tidak punya createObjectURL/atob-blob; komponen memakainya untuk menampilkan PDF.
beforeEach(() => {
  vi.clearAllMocks()
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:uji')
  globalThis.URL.revokeObjectURL = vi.fn()
})

const { default: JadwalSayaPage } = await import('./JadwalSayaPage')

/**
 * R-03 (audit 2026-07-19): "admin belum mengunggah jadwal" adalah keadaan kosong
 * yang WAJAR, bukan kegagalan. Backend kini membalas 200 `available:false` pada
 * jalur preview alih-alih 404, supaya konsol tidak dipenuhi stack trace.
 * Test ini mengunci sisi frontend-nya — jalur yang belum pernah diuji di browser.
 */
describe('JadwalSayaPage', () => {
  it('menampilkan keadaan kosong saat backend balas available:false (200)', async () => {
    get.mockResolvedValue({
      data: {
        available: false,
        base64: null,
        filename: null,
        message: 'Jadwal PDF belum diunggah admin.',
      },
    })

    render(<JadwalSayaPage />)

    expect(await screen.findByText('Jadwal PDF belum diunggah admin.')).toBeInTheDocument()
    // Tidak boleh ada iframe maupun tombol unduh untuk keadaan kosong.
    expect(document.querySelector('iframe')).toBeNull()
    expect(screen.queryByRole('button', { name: /unduh pdf/i })).not.toBeInTheDocument()
  })

  it('tetap menampilkan keadaan kosong bila base64 kosong tanpa flag available', async () => {
    get.mockResolvedValue({ data: { base64: null } })

    render(<JadwalSayaPage />)

    expect(await screen.findByText('Jadwal PDF belum tersedia.')).toBeInTheDocument()
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('menampilkan PDF dan tombol unduh saat jadwal tersedia', async () => {
    get.mockResolvedValue({
      data: { base64: btoa('%PDF-1.4 palsu'), filename: 'Jadwal - budi.pdf' },
    })

    render(<JadwalSayaPage />)

    await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull())
    expect(document.querySelector('iframe')).toHaveAttribute('src', 'blob:uji')
    expect(screen.getByRole('button', { name: /unduh pdf/i })).toBeInTheDocument()
  })

  it('menampilkan pesan galat server saat permintaan benar-benar gagal', async () => {
    get.mockRejectedValue({ response: { data: { message: 'Sesi berakhir.' } } })

    render(<JadwalSayaPage />)

    expect(await screen.findByText('Sesi berakhir.')).toBeInTheDocument()
  })

  it('memanggil endpoint preview, bukan unduhan mentah', async () => {
    get.mockResolvedValue({ data: { available: false, base64: null } })

    render(<JadwalSayaPage />)

    await waitFor(() => expect(get).toHaveBeenCalled())
    expect(get).toHaveBeenCalledWith('/schedules/my-pdf?preview=1')
  })
})
