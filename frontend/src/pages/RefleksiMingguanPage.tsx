import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpenCheck, Download, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { usePdfPreview } from '@/hooks/usePdfPreview'
import { toLocalDateStr } from '@/lib/utils'

interface Reflection {
  id: string
  minggu_mulai: string
  catatan: string
  updated_at: string
}

// Senin di minggu yang sama dengan tanggal input
function mondayOf(d: Date): Date {
  const day = d.getDay() // 0=Min ... 6=Sab
  const diff = (day === 0 ? -6 : 1) - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return monday
}

/**
 * Refleksi Mingguan — wali kelas isi catatan reflektif per minggu tentang kelas yang ia
 * walikan (mirip isi Agenda tapi mingguan & bebas teks), plus unduh laporan seperti
 * "Rekap Agenda Saya" (Isu GK5).
 */
export default function RefleksiMingguanPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Reflection | null>(null)
  const [formMinggu, setFormMinggu] = useState(() => toLocalDateStr(mondayOf(new Date())))
  const [formCatatan, setFormCatatan] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [err, setErr] = useState('')

  const today = new Date()
  const [tglMulai, setTglMulai] = useState(toLocalDateStr(new Date(today.getFullYear(), today.getMonth() - 1, 1)))
  const [tglAkhir, setTglAkhir] = useState(toLocalDateStr(today))

  // GK30: pengaturan kertas per-akun — sebelumnya tidak ada tombol gear sama sekali
  // di halaman ini walau PDF-nya konsumsi PrintSetting.
  const pdfPreview = usePdfPreview({ printSettings: true })

  const { data, isLoading, error } = useQuery<{ data: Reflection[] }>({
    queryKey: ['weekly-reflections'],
    queryFn: () => api.get('/weekly-reflections').then(r => r.data),
  })

  const reflections = useMemo(() => data?.data ?? [], [data])

  const save = useMutation({
    mutationFn: () => editing
      ? api.put(`/weekly-reflections/${editing.id}`, { catatan: formCatatan })
      : api.post('/weekly-reflections', { minggu_mulai: formMinggu, catatan: formCatatan }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['weekly-reflections'] })
      closeForm()
    },
    onError: (e: any) => setErr(e.response?.data?.message ?? 'Gagal menyimpan.'),
  })

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/weekly-reflections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['weekly-reflections'] }),
  })

  function openNew() {
    setEditing(null)
    setFormMinggu(toLocalDateStr(mondayOf(new Date())))
    setFormCatatan('')
    setErr('')
    setShowForm(true)
  }

  function openEdit(r: Reflection) {
    setEditing(r)
    setFormCatatan(r.catatan)
    setErr('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
    setErr('')
  }

  async function downloadReport() {
    await pdfPreview.openPreview(
      `/weekly-reflections/export?tanggal_mulai=${tglMulai}&tanggal_akhir=${tglAkhir}&format=pdf`,
      'Refleksi_Mingguan.pdf',
    )
  }

  async function downloadExcel() {
    const resp = await api.get(`/weekly-reflections/export?tanggal_mulai=${tglMulai}&tanggal_akhir=${tglAkhir}&format=excel`, { responseType: 'blob' })
    const url = URL.createObjectURL(resp.data)
    const a = document.createElement('a')
    a.href = url; a.download = 'Refleksi_Mingguan.xlsx'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        {(error as any)?.response?.data?.message ?? 'Anda bukan wali kelas aktif — halaman ini hanya untuk wali kelas.'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5" />
            Refleksi Mingguan
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Catatan reflektif Anda sebagai wali kelas, per minggu.</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Tulis Refleksi
        </Button>
      </div>

      {/* Unduh laporan */}
      <div className="rounded-lg border p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unduh Laporan</p>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Dari</label>
            <input type="date" className="rounded-md border border-input px-2 py-1.5 text-sm" value={tglMulai} max={toLocalDateStr(new Date())} onChange={e => setTglMulai(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Sampai</label>
            <input type="date" className="rounded-md border border-input px-2 py-1.5 text-sm" value={tglAkhir} max={toLocalDateStr(new Date())} onChange={e => setTglAkhir(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" onClick={downloadReport} disabled={pdfPreview.loading}>
            {pdfPreview.loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={downloadExcel}>
            <Download className="h-4 w-4 mr-1" /> Excel
          </Button>
        </div>
        {pdfPreview.error && <p className="text-xs text-red-600">{pdfPreview.error}</p>}
      </div>

      {/* Daftar refleksi */}
      {reflections.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">Belum ada refleksi mingguan. Klik "Tulis Refleksi" untuk mulai.</p>
      ) : (
        <div className="space-y-2">
          {reflections.map(r => (
            <div key={r.id} className="rounded-lg border p-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  Minggu {new Date(r.minggu_mulai + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{r.catatan}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Diperbarui: {r.updated_at}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(r)} className="rounded p-1.5 hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => { if (confirm('Hapus refleksi ini?')) del.mutate(r.id) }} className="rounded p-1.5 hover:bg-accent text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e => e.target === e.currentTarget && closeForm()}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl p-5 space-y-3">
            <h3 className="font-semibold">{editing ? 'Edit Refleksi' : 'Tulis Refleksi Mingguan'}</h3>
            {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{err}</p>}

            {!editing && (
              <div>
                <label className="text-xs font-medium block mb-1">Minggu Mulai (Senin)</label>
                {/* max=hari ini: tidak bisa menulis refleksi untuk minggu yang belum terjadi. */}
                <input type="date" className="w-full rounded-md border border-input px-3 py-2 text-sm" value={formMinggu} max={toLocalDateStr(new Date())} onChange={e => setFormMinggu(e.target.value)} />
              </div>
            )}

            <div>
              <label className="text-xs font-medium block mb-1">Catatan Refleksi</label>
              <textarea
                rows={6}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Apa yang terjadi minggu ini di kelas Anda? Tantangan, capaian, rencana tindak lanjut..."
                value={formCatatan}
                onChange={e => setFormCatatan(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button size="sm" className="flex-1" disabled={save.isPending || !formCatatan.trim()} onClick={() => save.mutate()}>
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Simpan
              </Button>
              <Button variant="outline" size="sm" onClick={closeForm}>Batal</Button>
            </div>
          </div>
        </div>
      )}

      {pdfPreview.modal}
      {pdfPreview.loadingOverlay}
    </div>
  )
}
