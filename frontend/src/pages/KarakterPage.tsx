import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, CheckCircle2, ChevronDown, ChevronUp, Loader2, Info } from 'lucide-react'
import { karakterApi } from '@/features/karakter/api'
import type { CharacterSubitem, StudentSearchItem } from '@/features/karakter/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StudentClassPicker } from '@/components/karakter/StudentClassPicker'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

interface ManualNote {
  id: string; uuid: string; catatan: string; nilai: number | null
  status: 'pending' | 'approved' | 'rejected'
  admin_catatan: string | null; nilai_final: number | null
  teacher: string; created_at: string
}

const STATUS_LABEL: Record<string, string> = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' }
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

// GK24: satu siswa hanya bisa dinilai lewat SALAH SATU jalur dalam satu waktu — pilih
// sub-karakter terstruktur ATAU catatan manual (butuh review admin), tidak berbarengan.
type NilaiMode = 'sub' | 'manual' | null

export default function KarakterPage() {
  const queryClient = useQueryClient()

  const [selectedStudent, setSelectedStudent] = useState<StudentSearchItem | null>(null)
  const [mode, setMode] = useState<NilaiMode>(null)

  // ── Nilai Sub-Karakter ────────────────────────────────────────────────────
  const [selectedSubitem, setSelectedSubitem] = useState<CharacterSubitem | null>(null)
  const [manualSign, setManualSign] = useState<'positif' | 'negatif'>('positif')
  const [catatan, setCatatan] = useState('')
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{ poin: number; student: string; subitem: string } | null>(null)
  const catatanRef = useRef<HTMLInputElement>(null)

  // ── Nilai Karakter Manual ─────────────────────────────────────────────────
  const [mnCatatan, setMnCatatan] = useState('')
  const [mnNilai, setMnNilai]     = useState('')
  const [mnErr, setMnErr]         = useState('')
  const [mnSuccess, setMnSuccess] = useState(false)

  const { data: categoriesRes } = useQuery({
    queryKey: ['character-categories'],
    queryFn: () => karakterApi.getCategories(),
  })
  const categories = categoriesRes?.data.data ?? []

  const { data: summaryRes } = useQuery({
    queryKey: ['character-summary', selectedStudent?.id],
    queryFn: () => karakterApi.getSummary(selectedStudent!.id),
    enabled: !!selectedStudent,
  })
  const summary = summaryRes?.data.data

  const { data: historyRes } = useQuery({
    queryKey: ['character-inputs', selectedStudent?.id],
    queryFn: () => karakterApi.getInputs(selectedStudent!.id),
    enabled: !!selectedStudent,
  })
  const history = historyRes?.data.data ?? []

  const { data: mnNotesRes, isLoading: mnNotesLoading } = useQuery({
    queryKey: ['manual-notes', selectedStudent?.id],
    queryFn: () => api.get<{ data: ManualNote[] }>('/character-manual-notes', { params: { student_id: selectedStudent!.id } }).then(r => r.data.data),
    enabled: !!selectedStudent && mode === 'manual',
  })
  const mnNotes = mnNotesRes ?? []

  const mnMutation = useMutation({
    mutationFn: () => api.post('/character-manual-notes', {
      student_id: selectedStudent!.id,
      catatan: mnCatatan,
      nilai: mnNilai !== '' ? parseInt(mnNilai, 10) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual-notes', selectedStudent?.id] })
      setMnCatatan(''); setMnNilai(''); setMnErr(''); setMnSuccess(true)
      setTimeout(() => setMnSuccess(false), 3000)
    },
    onError: (e: { response?: { data?: { message?: string } } }) => setMnErr(e.response?.data?.message ?? 'Terjadi kesalahan'),
  })

  const mutation = useMutation({
    mutationFn: () => karakterApi.storeInput({
      student_id: selectedStudent!.id,
      subitem_id: selectedSubitem!.id,
      sign: selectedSubitem!.sifat === 'keduanya' ? manualSign : undefined,
      catatan: catatan || undefined,
    }),
    onSuccess: (res) => {
      setLastResult(res.data.data)
      setSelectedSubitem(null)
      setCatatan('')
      queryClient.invalidateQueries({ queryKey: ['character-summary', selectedStudent?.id] })
      queryClient.invalidateQueries({ queryKey: ['character-inputs', selectedStudent?.id] })
      setTimeout(() => setLastResult(null), 4000)
    },
  })

  function selectStudent(s: StudentSearchItem) {
    setSelectedStudent(s)
    setMode(null)
    setSelectedSubitem(null)
    setLastResult(null)
    setMnCatatan(''); setMnNilai(''); setMnErr('')
  }

  // GK25: Batal kembali ke posisi tanpa filter kelas (reset total)
  function batalKeSemula() {
    setSelectedStudent(null)
    setMode(null)
    setSelectedSubitem(null)
    setLastResult(null)
  }

  function pickSubitem(sub: CharacterSubitem) {
    setSelectedSubitem(sub)
    setCatatan('')
    setTimeout(() => catatanRef.current?.focus(), 100)
  }

  const effectiveSign = selectedSubitem?.sifat === 'keduanya'
    ? manualSign
    : selectedSubitem?.sifat === 'positif' ? 'positif' : 'negatif'

  const effectivePoin = selectedSubitem
    ? (effectiveSign === 'positif' ? Math.abs(selectedSubitem.bobot) : -Math.abs(selectedSubitem.bobot))
    : 0

  function handleMnSubmit() {
    if (!mnCatatan.trim()) { setMnErr('Catatan tidak boleh kosong.'); return }
    if (mnNilai !== '' && (isNaN(parseInt(mnNilai)) || parseInt(mnNilai) < -20 || parseInt(mnNilai) > 20)) {
      setMnErr('Nilai harus antara -20 dan +20.'); return
    }
    setMnErr('')
    mnMutation.mutate()
  }

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-bold">Penilaian Karakter</h1>

      {/* ── 1. Pilih Siswa (GK25: filter kelas ketik-langsung + grid foto) ──── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          1. Nama
        </p>

        {selectedStudent ? (
          <div className="flex items-center gap-3 rounded-lg border border-primary-300 bg-primary-50 px-4 py-3">
            <img src={selectedStudent.foto_url || '/images/default-avatar.jpg'} alt={selectedStudent.nama}
              className="w-[20mm] h-auto shrink-0 rounded border object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{selectedStudent.nama}</p>
              <p className="text-xs text-muted-foreground">
                {selectedStudent.nis}
                {selectedStudent.kelas && ` · ${selectedStudent.kelas}`}
              </p>
              {summary && (
                <span className={cn(
                  'text-sm font-bold tabular-nums',
                  summary.total_poin >= 0 ? 'text-green-600' : 'text-red-600',
                )}>
                  {summary.total_poin >= 0 ? '+' : ''}{summary.total_poin} poin
                </span>
              )}
            </div>
            <button type="button" onClick={batalKeSemula} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          // GK25: siswa lain disembunyikan hanya SETELAH terpilih — sebelum itu tampilkan
          // picker penuh (filter kelas / pencarian bebas)
          <StudentClassPicker onPick={selectStudent} />
        )}
      </div>

      {/* ── 2/3. Nilai Sub-Karakter ATAU Nilai Karakter Manual (mutual exclusive) ── */}
      {selectedStudent && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button"
            disabled={mode === 'manual'}
            onClick={() => setMode(mode === 'sub' ? null : 'sub')}
            className={cn(
              'rounded-md border py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              mode === 'sub' ? 'border-primary-600 bg-primary-50 text-primary-600' : 'border-border hover:bg-muted',
            )}
          >
            2. Nilai Sub-Karakter
          </button>
          <button type="button"
            disabled={mode === 'sub'}
            onClick={() => setMode(mode === 'manual' ? null : 'manual')}
            className={cn(
              'rounded-md border py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              mode === 'manual' ? 'border-primary-600 bg-primary-50 text-primary-600' : 'border-border hover:bg-muted',
            )}
          >
            3. Nilai Karakter Manual
          </button>
        </div>
      )}

      {/* ── Nilai Sub-Karakter ───────────────────────────────────────────────── */}
      {selectedStudent && mode === 'sub' && (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted transition-colors"
              >
                <span className="text-sm font-medium">{cat.nama}</span>
                {expandedCat === cat.id
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                }
              </button>

              {expandedCat === cat.id && (
                <div className="divide-y divide-border">
                  {cat.subitems.map((sub) => {
                    // `bobot` SELALU disimpan sebagai magnitudo positif (arah tanda
                    // ditentukan `sifat`, bukan tanda numerik `bobot`) — jangan pernah
                    // pakai `bobot > 0` untuk menentukan +/−, itu SELALU true dan bikin
                    // semua subitem (termasuk yang negatif) tampil hijau "+".
                    const isBoth = sub.sifat === 'keduanya'
                    const isPos  = sub.sifat === 'positif'
                    const isSelected = selectedSubitem?.id === sub.id
                    return (
                      <button
                        key={sub.id} type="button"
                        onClick={() => pickSubitem(sub)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 transition-colors text-left',
                          isSelected
                            ? 'bg-primary-50 border-l-2 border-primary-600'
                            : 'hover:bg-accent',
                        )}
                      >
                        <span className={cn(
                          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                          isBoth ? 'bg-amber-100 text-amber-700' : isPos ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                        )}>
                          {isBoth ? '±' : isPos ? '+' : '−'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{sub.deskripsi}</p>
                          <p className="text-xs text-muted-foreground">{sub.kode}</p>
                        </div>
                        <span className={cn(
                          'text-sm font-bold tabular-nums shrink-0',
                          isBoth ? 'text-amber-600' : isPos ? 'text-green-600' : 'text-red-600',
                        )}>
                          {isBoth ? '±' : isPos ? '+' : '−'}{sub.bobot}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Konfirmasi & Submit */}
          {selectedSubitem && (
            <Card className="border-primary-200">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold">Konfirmasi</p>
                <div className="rounded-lg bg-muted/40 px-4 py-3 space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">{selectedStudent.nama}</span>
                    {' '}akan mendapat{' '}
                    <span className={cn('font-bold', effectivePoin >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {effectivePoin >= 0 ? '+' : ''}{effectivePoin} poin
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">{selectedSubitem.deskripsi}</p>
                </div>

                {selectedSubitem.sifat === 'keduanya' && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setManualSign('positif')}
                      className={cn('flex-1 py-2 rounded-md border text-sm font-medium transition-colors',
                        manualSign === 'positif' ? 'bg-green-100 border-green-400 text-green-700' : 'border-border hover:bg-muted')}
                    >+ Apresiasi</button>
                    <button type="button" onClick={() => setManualSign('negatif')}
                      className={cn('flex-1 py-2 rounded-md border text-sm font-medium transition-colors',
                        manualSign === 'negatif' ? 'bg-red-100 border-red-400 text-red-700' : 'border-border hover:bg-muted')}
                    >− Pelanggaran</button>
                  </div>
                )}

                <Input
                  ref={catatanRef}
                  placeholder="Keterangan (opsional)..."
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && mutation.mutate()}
                />

                <div className="flex gap-2">
                  <Button className="flex-1" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                    {mutation.isPending ? 'Menyimpan...' : 'Simpan Penilaian'}
                  </Button>
                  <Button variant="ghost" onClick={() => setSelectedSubitem(null)}>Batal</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {lastResult && (
            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <p className="text-sm text-green-700">
                <span className="font-medium">{lastResult.student}</span>
                {' '}·{' '}
                <span className={cn('font-bold', lastResult.poin >= 0 ? 'text-green-600' : 'text-red-600')}>
                  {lastResult.poin >= 0 ? '+' : ''}{lastResult.poin} poin
                </span>
                {' '}· {lastResult.subitem}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Nilai Karakter Manual ────────────────────────────────────────────── */}
      {selectedStudent && mode === 'manual' && (
        <div className="space-y-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Gunakan ini jika belum ada pilihan karakter yang sesuai di daftar Sub-Karakter. Nilai yang diajukan akan menunggu persetujuan admin sebelum berlaku.</span>
          </div>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="mn-catatan" className="text-sm font-medium">Catatan <span className="text-red-500">*</span></label>
                <textarea
                  id="mn-catatan"
                  value={mnCatatan}
                  onChange={e => setMnCatatan(e.target.value)}
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  placeholder="Deskripsikan perilaku / kejadian secara objektif..."
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="mn-nilai" className="text-sm font-medium">Nilai Poin (opsional, -20 s.d. +20)</label>
                <Input
                  id="mn-nilai"
                  type="number" min="-20" max="20"
                  value={mnNilai}
                  onChange={e => setMnNilai(e.target.value)}
                  placeholder="Kosongkan jika tidak ada nilai numerik"
                />
              </div>
              {mnErr && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{mnErr}</p>}
              {mnSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-md">
                  <CheckCircle2 className="h-4 w-4" />Catatan berhasil dikirim dan menunggu persetujuan admin.
                </div>
              )}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleMnSubmit} disabled={mnMutation.isPending}>
                  {mnMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Kirim Catatan
                </Button>
                <Button variant="ghost" onClick={() => setMode(null)}>Batal</Button>
              </div>
            </CardContent>
          </Card>

          {/* Riwayat catatan manual siswa terpilih */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Riwayat Catatan — {selectedStudent.nama}
            </p>
            {mnNotesLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin" />}
            {!mnNotesLoading && mnNotes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada catatan manual untuk siswa ini.</p>
            )}
            {mnNotes.map(n => (
              <div key={n.id} className="rounded-lg border border-border px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLOR[n.status])}>
                    {STATUS_LABEL[n.status]}
                  </span>
                  <span className="text-xs text-muted-foreground">{n.created_at?.slice(0, 10)}</span>
                </div>
                <p className="text-sm">{n.catatan}</p>
                {n.nilai !== null && (
                  <p className="text-xs text-muted-foreground">Nilai diajukan: <strong className={n.nilai >= 0 ? 'text-green-600' : 'text-red-600'}>{n.nilai >= 0 ? '+' : ''}{n.nilai}</strong></p>
                )}
                {n.status === 'approved' && n.nilai_final !== null && (
                  <p className="text-xs text-green-700">Nilai final: <strong>{n.nilai_final >= 0 ? '+' : ''}{n.nilai_final}</strong></p>
                )}
                {n.admin_catatan && (
                  <p className="text-xs text-muted-foreground border-l-2 pl-2">Catatan admin: {n.admin_catatan}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Riwayat penilaian siswa terpilih ─────────────────────────────── */}
      {selectedStudent && history.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Riwayat {selectedStudent.nama}
          </p>
          {summary && (
            <div className="grid grid-cols-2 gap-2">
              {summary.per_kategori.map((k) => (
                <div key={k.nama} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <p className="text-xs text-muted-foreground truncate">{k.nama}</p>
                  <p className={cn('text-sm font-bold', k.total >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {k.total >= 0 ? '+' : ''}{k.total}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1">
            {history.slice(0, 10).map((h) => (
              <div key={h.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                <Badge variant={h.poin >= 0 ? 'hijau' : 'merah'} className="shrink-0 text-xs">
                  {h.poin >= 0 ? '+' : ''}{h.poin}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{h.subitem}</p>
                  <p className="text-xs text-muted-foreground">{h.guru} · {h.tanggal}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
