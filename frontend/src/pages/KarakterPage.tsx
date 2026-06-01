import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, X, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { karakterApi } from '@/features/karakter/api'
import type { CharacterSubitem, StudentSearchItem } from '@/features/karakter/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'

export default function KarakterPage() {
  const queryClient = useQueryClient()

  // ── State ──────────────────────────────────────────────────────────────────
  const [searchQ, setSearchQ] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchItem | null>(null)
  const [selectedSubitem, setSelectedSubitem] = useState<CharacterSubitem | null>(null)
  const [manualSign, setManualSign] = useState<'positif' | 'negatif'>('positif')
  const [catatan, setCatatan] = useState('')
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{ poin: number; student: string; subitem: string } | null>(null)
  const catatanRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-bold">Penilaian Karakter</h1>

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
    </div>
  )
}
