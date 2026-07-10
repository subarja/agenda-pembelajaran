import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { karakterApi } from '@/features/karakter/api'
import type { KarakterScope, StudentSearchItem } from '@/features/karakter/types'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'

// GK25: dipakai di Karakter & Nilai Tambah — filter kelas ketik-langsung (bukan
// dropdown). Kelas terpilih → grid foto + nomor absen, urut nama A-Z.
//
// Dua mode, mengikuti aturan siapa boleh menilai apa:
//
//   scope="semua"  (Penilaian Karakter) — seluruh kelas sekolah, dan tanpa kelas terpilih
//                  guru boleh mencari siswa mana pun via nama/NIS. Karakter adalah aset
//                  kolektif: semua guru mengamati semua siswa.
//   scope="diampu" (Nilai Tambah) — hanya kelas yang ia ajar/walikelasi. Pencarian bebas
//                  lintas sekolah DIMATIKAN di mode ini; kalau tidak, guru bisa memilih
//                  siswa yang ujungnya ditolak backend saat menyimpan.
export function StudentClassPicker({
  onPick,
  scope = 'semua',
}: {
  onPick: (s: StudentSearchItem) => void
  scope?: KarakterScope
}) {
  const [kelasQuery, setKelasQuery]     = useState('')
  const [selectedKelas, setSelectedKelas] = useState<{ id: string; label: string } | null>(null)
  const [showKelasDropdown, setShowKelasDropdown] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const debouncedQ = useDebounce(searchQ, 300)

  const bolehCariBebas = scope === 'semua'

  const { data: classesRes } = useQuery({
    queryKey: ['character-classes', scope],
    queryFn: () => karakterApi.getClasses(scope),
  })
  const classes = classesRes?.data.data ?? []
  const filteredClasses = kelasQuery
    ? classes.filter((c) => c.label.toLowerCase().includes(kelasQuery.toLowerCase()))
    : classes

  const { data: gridRes, isFetching: loadingGrid } = useQuery({
    queryKey: ['karakter-students-by-class', selectedKelas?.id],
    queryFn: () => karakterApi.studentsByClass(selectedKelas!.id),
    enabled: !!selectedKelas,
  })
  const gridStudents = gridRes?.data.data ?? []

  const { data: searchRes, isFetching: searching } = useQuery({
    queryKey: ['student-search', debouncedQ],
    queryFn: () => karakterApi.searchStudents(debouncedQ),
    enabled: bolehCariBebas && !selectedKelas && debouncedQ.length >= 2,
  })
  const searchResults = searchRes?.data.data ?? []

  return (
    <div className="space-y-3">
      {/* Filter Kelas — ketik langsung */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={
            selectedKelas ? selectedKelas.label
            : bolehCariBebas ? 'Ketik nama kelas... (kosongkan untuk Semua Kelas)'
            : 'Pilih kelas yang Anda ampu...'
          }
          value={kelasQuery}
          onChange={(e) => { setKelasQuery(e.target.value); setShowKelasDropdown(true) }}
          onFocus={() => setShowKelasDropdown(true)}
        />
        {selectedKelas && (
          <button type="button"
            onClick={() => { setSelectedKelas(null); setKelasQuery('') }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {showKelasDropdown && !selectedKelas && filteredClasses.length > 0 && (
          <div className="mt-1 rounded-lg border border-border bg-background shadow-sm overflow-hidden absolute z-10 w-full max-h-64 overflow-y-auto">
            {filteredClasses.map((c) => (
              <button key={c.id} type="button"
                onClick={() => { setSelectedKelas(c); setKelasQuery(''); setShowKelasDropdown(false) }}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-accent transition-colors border-b border-border last:border-0"
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!selectedKelas && (
        <p className="text-xs text-muted-foreground">
          {bolehCariBebas
            ? 'Semua Kelas — ketik nama/NIS siswa untuk mencari.'
            : classes.length === 0
              ? 'Anda belum mengampu kelas mana pun, jadi belum ada siswa yang bisa diberi nilai tambah.'
              : 'Nilai tambah hanya untuk siswa di kelas yang Anda ampu atau sedang Anda inval. Pilih kelas untuk melihat daftar siswanya.'}
        </p>
      )}

      {/* Tanpa kelas: cari nama/NIS bebas — hanya mode "semua" */}
      {!selectedKelas && bolehCariBebas && (
        <div className="relative">
          <Input
            placeholder="Ketik nama atau NIS siswa..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
          {searching && <p className="text-xs text-muted-foreground mt-1 px-1">Mencari...</p>}
          {!searching && searchResults.length > 0 && (
            <div className="mt-1 rounded-lg border border-border bg-background shadow-sm overflow-hidden">
              {searchResults.map((s) => (
                <button key={s.id} type="button"
                  onClick={() => onPick(s)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-left border-b border-border last:border-0"
                >
                  <img src={s.foto_url || '/images/default-avatar.jpg'} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
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

      {/* Kelas terpilih: grid foto + nomor absen, urut A-Z */}
      {selectedKelas && (
        <div>
          {loadingGrid && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />)}
            </div>
          )}
          {!loadingGrid && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {gridStudents.map((s) => (
                <button key={s.id} type="button"
                  onClick={() => onPick(s)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border border-border p-2 text-center',
                    'hover:border-primary-300 hover:bg-primary-50/50 transition-colors',
                  )}
                >
                  <img src={s.foto_url || '/images/default-avatar.jpg'} alt={s.nama}
                    className="w-[20mm] h-auto rounded border object-cover" />
                  <p className="text-xs text-muted-foreground">No. {s.nomor_absen}</p>
                  <p className="text-sm font-medium leading-tight line-clamp-2">{s.nama}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
