import { useState } from 'react'
import { Download, Loader2, Settings2, X } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'

/**
 * Alur baku untuk SEMUA export PDF di aplikasi ini: klik tombol "PDF" membuka preview
 * dulu (iframe dari blob, endpoint dipanggil dengan `?preview=1`) — TIDAK memicu download
 * manager apa pun (mis. IDM) karena (1) tidak ada elemen <a download> yang di-klik sampai
 * user pilih "Simpan PDF" sendiri, DAN (2) response preview dibungkus JSON base64 (bukan
 * `Content-Type: application/pdf` mentah) supaya ekstensi download manager dengan "advanced
 * browser integration" tidak mengendus & memaksa prompt download di level jaringan — lihat
 * `App\Traits\HandlesPdfPreview::pdfResponse()` di backend untuk alasan lengkapnya.
 *
 * WAJIB dipakai untuk export PDF baru di halaman manapun — jangan bikin alur langsung-
 * download (`URL.createObjectURL` + `a.click()` + `a.download`) lagi tanpa lewat preview
 * ini, kecuali diminta eksplisit oleh user.
 */

interface PrintSettingsData {
  paper_size: 'A4' | 'F4'
  margin_top: number
  margin_bottom: number
  margin_left: number
  margin_right: number
  kop_width_percent: number
  kop_position: 'left' | 'center' | 'right'
}

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

export function usePdfPreview(options?: { printSettings?: boolean }) {
  const [preview, setPreview] = useState<{ url: string; filename: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastOpen, setLastOpen] = useState<{ endpoint: string; filename: string } | null>(null)

  // ── Pengaturan Cetak (opsional — cuma dipakai halaman yang PDF-nya konsumsi
  // PrintSetting; GK30: per-akun, endpoint /print-settings terbuka utk semua role
  // login — tiap user cuma bisa ubah barisnya sendiri, tidak memengaruhi user lain) ──
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<PrintSettingsData | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  async function openPreview(endpoint: string, filename: string) {
    setError('')
    setLoading(true)
    setLastOpen({ endpoint, filename })
    try {
      const sep = endpoint.includes('?') ? '&' : '?'
      const resp = await api.get(`${endpoint}${sep}preview=1`)
      const blob = base64ToBlob(resp.data.base64, 'application/pdf')
      const blobUrl = URL.createObjectURL(blob)
      setPreview({ url: blobUrl, filename: resp.data.filename || filename })
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Gagal memuat preview PDF.')
    } finally {
      setLoading(false)
    }
  }

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
    setSettingsOpen(false)
  }

  function savePdf() {
    if (!preview) return
    const a = document.createElement('a')
    a.href = preview.url
    a.download = preview.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // JANGAN revoke segera setelah click() — download manager (mis. IDM) baca blob
    // secara ASYNC lewat hook browser-nya sendiri. Revoke terlalu cepat bikin
    // pembacaan gagal & IDM terus-menerus minta ulang unduhan. Beri jeda lama dulu.
    const url = preview.url
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    setPreview(null)
  }

  async function openSettings() {
    setSettingsOpen(true)
    if (settings) return
    setSettingsLoading(true)
    try {
      const resp = await api.get('/print-settings')
      setSettings(resp.data.data)
    } catch {
      setError('Gagal memuat pengaturan cetak.')
    } finally {
      setSettingsLoading(false)
    }
  }

  async function saveSettings() {
    if (!settings) return
    setSavingSettings(true)
    try {
      await api.put('/print-settings', settings)
      setSettingsOpen(false)
      if (lastOpen) await openPreview(lastOpen.endpoint, lastOpen.filename)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Gagal menyimpan pengaturan cetak.')
    } finally {
      setSavingSettings(false)
    }
  }

  const isOpen = !!preview

  const settingsPanel = settingsOpen ? (
    <div className="border-b bg-muted/30 px-4 py-3 space-y-3 text-sm">
      {settingsLoading || !settings ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat pengaturan...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Ukuran Kertas</span>
              <select
                className="w-full rounded-md border border-input px-2 py-1.5 text-sm bg-background"
                value={settings.paper_size}
                onChange={(e) => setSettings({ ...settings, paper_size: e.target.value as 'A4' | 'F4' })}
              >
                <option value="A4">A4</option>
                <option value="F4">F4 (Folio)</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Posisi Kop</span>
              <select
                className="w-full rounded-md border border-input px-2 py-1.5 text-sm bg-background"
                value={settings.kop_position}
                onChange={(e) => setSettings({ ...settings, kop_position: e.target.value as 'left' | 'center' | 'right' })}
              >
                <option value="left">Kiri</option>
                <option value="center">Tengah</option>
                <option value="right">Kanan</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {([
              ['margin_top', 'Atas'], ['margin_bottom', 'Bawah'],
              ['margin_left', 'Kiri'], ['margin_right', 'Kanan'],
            ] as const).map(([key, label]) => (
              <label key={key} className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">{label} (cm)</span>
                <input
                  type="number" step="0.1" min="0" max="5"
                  className="w-full rounded-md border border-input px-2 py-1.5 text-sm bg-background"
                  value={settings[key]}
                  onChange={(e) => setSettings({ ...settings, [key]: parseFloat(e.target.value) || 0 })}
                />
              </label>
            ))}
          </div>
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-muted-foreground">Lebar Kop ({settings.kop_width_percent}%)</span>
            <input
              type="range" min="20" max="100"
              className="w-full"
              value={settings.kop_width_percent}
              onChange={(e) => setSettings({ ...settings, kop_width_percent: parseInt(e.target.value) })}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(false)}>Batal</Button>
            <Button size="sm" onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Terapkan &amp; Muat Ulang Preview
            </Button>
          </div>
        </>
      )}
    </div>
  ) : null

  const modal = preview ? (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Preview PDF</h3>
          <div className="flex items-center gap-1">
            {options?.printSettings && (
              <button onClick={() => (settingsOpen ? setSettingsOpen(false) : openSettings())}
                className={settingsOpen ? 'text-primary-600' : 'text-muted-foreground hover:text-foreground'}
                title="Pengaturan kertas & margin">
                <Settings2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={closePreview} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {settingsPanel}
        <div className="flex-1 overflow-hidden bg-muted/30">
          <iframe src={preview.url} className="w-full h-full border-0" title="Preview PDF" />
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t">
          <Button variant="outline" size="sm" onClick={closePreview}>Batal</Button>
          <Button size="sm" onClick={savePdf}>
            <Download className="h-4 w-4 mr-1" /> Simpan PDF
          </Button>
        </div>
      </div>
    </div>
  ) : null

  const loadingOverlay = loading ? (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg px-5 py-4 flex items-center gap-3 shadow-xl">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm">Menyiapkan preview PDF...</span>
      </div>
    </div>
  ) : null

  return { openPreview, modal, loadingOverlay, isOpen, loading, error, setError }
}
