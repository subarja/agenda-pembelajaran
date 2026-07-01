import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, X, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { karakterApi } from '@/features/karakter/api'
import type { CharacterSubitem, StudentSearchItem } from '@/features/karakter/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
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

export default function KarakterPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'penilaian' | 'catatan-manual'>('penilaian')

  // ── State ──────────────────────────────────────────────────────────────────
  const [searchQ, setSearchQ] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchItem | null>(null)
  const [selectedSubitem, setSelectedSubitem] = useState<CharacterSubitem | null>(null)
  const [manualSign, setManualSign] = useState<'positif' | 'negatif'>('positif')
  const [catatan, setCatatan] = useState('')
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{ poin: number; student: string; subitem: string } | null>(null)
  const catatanRef = useRef<HTMLInputElement>(null)

  // ── Catatan Manual state ───────────────────────────────────────────────────
  const [mnStudent, setMnStudent]         = useState<StudentSearchItem | null>(null)
  const [mnSearchQ, setMnSearchQ]         = useState('')
  const [mnShowDropdown, setMnShowDropdown] = useState(false)
  const [mnCatatan, setMnCatatan]         = useState('')
  const [mnNilai, setMnNilai]             = useState('')
  const [mnErr, setMnErr]                 = useState('')
  const [mnSuccess, setMnSuccess]         = useState(false)
  const debouncedMnQ = useDebounce(mnSearchQ, 300)

  const debouncedQ = useDebounce(searchQ, 300)

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: searchRes, isFetching: searching } = useQuery({
    queryKey: ['student-search', debouncedQ],
    queryFn: () => karakterApi.searchStudents(debouncedQ),
    enabled: debouncedQ.length >= 2 && !selectedStudent,
  })
  const searchResults = searchRes?.data.data ?? []

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

  // ── Catatan Manual queries ─────────────────────────────────────────────────
  const { data: mnSearchRes } = useQuery({
    queryKey: ['mn-student-search', debouncedMnQ],
    queryFn: () => karakterApi.searchStudents(debouncedMnQ),
    enabled: debouncedMnQ.length >= 2 && !mnStudent,
  })
  const mnSearchResults = mnSearchRes?.data.data ?? []

  const { data: mnNotesRes, isLoading: mnNotesLoading } = useQuery({
    queryKey: ['manual-notes', mnStudent?.id],
    queryFn: () => api.get<{ data: ManualNote[] }>('/character-manual-notes', { params: { student_id: mnStudent!.id } }).then(r => r.data.data),
    enabled: !!mnStudent,
  })
  const mnNotes = mnNotesRes ?? []

  const mnMutation = useMutation({
    mutationFn: () => api.post('/character-manual-notes', {
      student_id: mnStudent!.id,
      catatan: mnCatatan,
      nilai: mnNilai !== '' ? parseInt(mnNilai, 10) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual-notes', mnStudent?.id] })
      setMnCatatan(''); setMnNilai(''); setMnErr(''); setMnSuccess(true)
      setTimeout(() => setMnSuccess(false), 3000)
    },
    onError: (e: any) => setMnErr(e.response?.data?.message ?? 'Terjadi kesalahan'),
  })

  // ── Mutation ───────────────────────────────────────────────────────────────
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
    setSearchQ('')
    setSelectedSubitem(null)
    setLastResult(null)
  }

  function clearStudent() {
    setSelectedStudent(null)
    setSearchQ('')
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
    if (!mnStudent)        { setMnErr('Pilih siswa terlebih dahulu.'); return }
    if (mnNilai !== '' && (isNaN(parseInt(mnNilai)) || parseInt(mnNilai) < -20 || parseInt(mnNilai) > 20)) {
      setMnErr('Nilai harus antara -20 dan +20.'); return
    }
    setMnErr('')
    mnMutation.mutate()
  }

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-bold">Penilaian Karakter</h1>

      {/* ── Tab switcher ─────────────────────────────────────────────────── */}
      <div className="flex border-b border-border">
        {([['penilaian', 'Penilaian Karakter'], ['catatan-manual', 'Catatan Manual']] as const).map(([tab, label]) => (
          <button key={tab} type="button"
            onClick={() => setActiveTab(tab)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab ? 'border-primary-600 text-primary-600' : 'border-transparent text-muted-foreground hover:text-foreground')}
          >{label}</button>
        ))}
      </div>

      {/* ── Tab: Catatan Manual ───────────────────────────────────────────── */}
      {activeTab === 'catatan-manual' && (
        <div className="space-y-4">
          {/* Pilih Siswa */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pilih Siswa</p>
            {mnStudent ? (
              <div className="flex items-center gap-3 rounded-lg border border-primary-300 bg-primary-50 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{mnStudent.nama}</p>
                  <p className="text-xs text-muted-foreground">{mnStudent.nis}{mnStudent.kelas && ` · ${mnStudent.kelas}`}</p>
                </div>
                <button type="button" onClick={() => { setMnStudent(null); setMnSearchQ('') }} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Ketik nama atau NIS siswa..."
                  value={mnSearchQ}
                  onChange={(e) => { setMnSearchQ(e.target.value); setMnShowDropdown(true) }}
                  onFocus={() => setMnShowDropdown(true)}
                />
                {mnShowDropdown && mnSearchResults.length > 0 && (
                  <div className="mt-1 rounded-lg border border-border bg-background shadow-sm overflow-hidden">
                    {mnSearchResults.map((s) => (
                      <button key={s.id} type="button"
                        onClick={() => { setMnStudent(s); setMnSearchQ(''); setMnShowDropdown(false) }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-left border-b border-border last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium">{s.nama}</p>
                          <p className="text-xs text-muted-foreground">{s.nis}{s.kelas && ` · ${s.kelas}`}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form */}
          {mnStudent && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Tambah Catatan Manual</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mn-catatan">Catatan <span className="text-red-500">*</span></Label>
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
                  <Label htmlFor="mn-nilai">Nilai Poin (opsional, -20 s.d. +20)</Label>
                  <Input
                    id="mn-nilai"
                    type="number" min="-20" max="20"
                    value={mnNilai}
                    onChange={e => setMnNilai(e.target.value)}
                    placeholder="Kosongkan jika tidak ada nilai numerik"
                  />
                  <p className="text-xs text-muted-foreground">Jika diisi, nilai ini akan menunggu persetujuan admin sebelum diterapkan ke poin karakter siswa.</p>
                </div>
                {mnErr && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{mnErr}</p>}
                {mnSuccess && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-md">
                    <CheckCircle2 className="h-4 w-4" />Catatan berhasil dikirim dan menunggu persetujuan admin.
                  </div>
                )}
                <Button onClick={handleMnSubmit} disabled={mnMutation.isPending} className="w-full">
                  {mnMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Kirim Catatan
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Riwayat catatan manual siswa terpilih */}
          {mnStudent && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Riwayat Catatan — {mnStudent.nama}
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
          )}
        </div>
      )}

      {/* ── Tab: Penilaian Karakter ───────────────────────────────────────── */}
      {activeTab === 'penilaian' && <>

      {/* ── 1. Cari Siswa ────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          1. Pilih Siswa
        </p>

        {selectedStudent ? (
          <div className="flex items-center gap-3 rounded-lg border border-primary-300 bg-primary-50 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{selectedStudent.nama}</p>
              <p className="text-xs text-muted-foreground">
                {selectedStudent.nis}
                {selectedStudent.kelas && ` · ${selectedStudent.kelas}`}
              </p>
            </div>
            {summary && (
              <span className={cn(
                'text-sm font-bold tabular-nums shrink-0',
                summary.total_poin >= 0 ? 'text-green-600' : 'text-red-600',
              )}>
                {summary.total_poin >= 0 ? '+' : ''}{summary.total_poin} poin
              </span>
            )}
            <button type="button" onClick={clearStudent} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-9"
              placeholder="Ketik nama atau NIS siswa..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
            {searching && (
              <p className="text-xs text-muted-foreground mt-1 px-1">Mencari...</p>
            )}
            {!searching && searchResults.length > 0 && (
              <div className="mt-1 rounded-lg border border-border bg-background shadow-sm overflow-hidden">
                {searchResults.map((s) => (
                  <button key={s.id} type="button"
                    onClick={() => selectStudent(s)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-left border-b border-border last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{s.nama}</p>
                      <p className="text-xs text-muted-foreground">{s.nis}{s.kelas && ` · ${s.kelas}`}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {!searching && debouncedQ.length >= 2 && searchResults.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1 px-1">Siswa tidak ditemukan.</p>
            )}
          </div>
        )}
      </div>

      {/* ── 2. Pilih Sub-Karakter ─────────────────────────────────────────── */}
      {selectedStudent && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            2. Pilih Sub-Karakter
          </p>

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
                    const isPos = sub.bobot > 0
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
                          isPos ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                        )}>
                          {isPos ? '+' : '−'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{sub.deskripsi}</p>
                          <p className="text-xs text-muted-foreground">{sub.kode}</p>
                        </div>
                        <span className={cn(
                          'text-sm font-bold tabular-nums shrink-0',
                          isPos ? 'text-green-600' : 'text-red-600',
                        )}>
                          {isPos ? '+' : ''}{sub.bobot}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── 3. Konfirmasi & Submit ────────────────────────────────────────── */}
      {selectedStudent && selectedSubitem && (
        <Card className="border-primary-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">3. Konfirmasi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted/40 px-4 py-3 space-y-1">
              <p className="text-sm">
                <span className="font-medium">{selectedStudent.nama}</span>
                {' '}akan mendapat{' '}
                <span className={cn(
                  'font-bold',
                  effectivePoin >= 0 ? 'text-green-600' : 'text-red-600',
                )}>
                  {effectivePoin >= 0 ? '+' : ''}{effectivePoin} poin
                </span>
              </p>
              <p className="text-xs text-muted-foreground">{selectedSubitem.deskripsi}</p>
            </div>

            {/* Sign picker untuk subitem 'keduanya' */}
            {selectedSubitem.sifat === 'keduanya' && (
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => setManualSign('positif')}
                  className={cn(
                    'flex-1 py-2 rounded-md border text-sm font-medium transition-colors',
                    manualSign === 'positif'
                      ? 'bg-green-100 border-green-400 text-green-700'
                      : 'border-border hover:bg-muted',
                  )}
                >
                  + Apresiasi
                </button>
                <button type="button"
                  onClick={() => setManualSign('negatif')}
                  className={cn(
                    'flex-1 py-2 rounded-md border text-sm font-medium transition-colors',
                    manualSign === 'negatif'
                      ? 'bg-red-100 border-red-400 text-red-700'
                      : 'border-border hover:bg-muted',
                  )}
                >
                  − Pelanggaran
                </button>
              </div>
            )}

            <div>
              <Input
                ref={catatanRef}
                placeholder="Keterangan (opsional)..."
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && mutation.mutate()}
              />
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                {mutation.isPending ? 'Menyimpan...' : 'Simpan Penilaian'}
              </Button>
              <Button variant="ghost" onClick={() => setSelectedSubitem(null)}>Batal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Toast sukses ─────────────────────────────────────────────────── */}
      {lastResult && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-700">
            <span className="font-medium">{lastResult.student}</span>
            {' '}+{' '}
            <span className={cn('font-bold', lastResult.poin >= 0 ? 'text-green-600' : 'text-red-600')}>
              {lastResult.poin >= 0 ? '+' : ''}{lastResult.poin} poin
            </span>
            {' '}· {lastResult.subitem}
          </p>
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

      </> /* end penilaian tab */}
    </div>
  )
}
